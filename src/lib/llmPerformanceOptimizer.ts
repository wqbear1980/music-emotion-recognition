/**
 * LLM 调用性能优化模块
 *
 * 提供缓存、并发控制、重试机制等性能优化功能
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * LLM 请求缓存类
 */
class LLMCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    // 默认缓存 5 分钟
    this.defaultTTL = defaultTTL;
  }

  /**
   * 生成缓存键
   */
  private generateKey(
    model: string,
    prompt: string,
    temperature: number,
    maxTokens?: number
  ): string {
    const normalizedPrompt = prompt.trim().replace(/\s+/g, ' ');
    return `${model}:${temperature}:${maxTokens || 'default'}:${normalizedPrompt}`;
  }

  /**
   * 获取缓存
   */
  get(
    model: string,
    prompt: string,
    temperature: number,
    maxTokens?: number
  ): T | null {
    const key = this.generateKey(model, prompt, temperature, maxTokens);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.timestamp + entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[LLM缓存] 命中缓存: ${key.substring(0, 50)}...`);
    return entry.data;
  }

  /**
   * 设置缓存
   */
  set(
    model: string,
    prompt: string,
    data: T,
    temperature: number,
    maxTokens?: number,
    ttl?: number
  ): void {
    const key = this.generateKey(model, prompt, temperature, maxTokens);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: ttl || this.defaultTTL,
    };

    this.cache.set(key, entry);
    console.log(`[LLM缓存] 设置缓存: ${key.substring(0, 50)}... (TTL: ${entry.expiry}ms)`);

    // 限制缓存大小，防止内存泄漏
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[LLM缓存] 清理了 ${cleaned} 个过期缓存条目`);
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    console.log('[LLM缓存] 缓存已清空');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number } {
    return {
      size: this.cache.size,
    };
  }
}

/**
 * 并发请求控制器
 */
class ConcurrencyController {
  private maxConcurrent: number;
  private pendingQueue: Map<string, PendingRequest<any>> = new Map();
  private activeRequests: Set<string> = new Set();

  constructor(maxConcurrent: number = 5) {
    // 默认最多 5 个并发请求
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * 执行请求（带并发控制）
   */
  async execute<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // 如果相同请求正在执行中，等待结果
    if (this.activeRequests.has(key)) {
      console.log(`[并发控制] 检测到重复请求，等待完成: ${key.substring(0, 50)}...`);
      return new Promise((resolve, reject) => {
        this.pendingQueue.set(key, { resolve, reject, timestamp: Date.now() });
      });
    }

    // 如果已达并发上限，等待
    while (this.activeRequests.size >= this.maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 开始执行请求
    this.activeRequests.add(key);
    console.log(`[并发控制] 开始执行请求: ${key.substring(0, 50)}... (当前并发: ${this.activeRequests.size})`);

    try {
      const result = await requestFn();

      // 通知等待的请求
      const pending = this.pendingQueue.get(key);
      if (pending) {
        this.pendingQueue.delete(key);
        pending.resolve(result);
      }

      return result;
    } catch (error) {
      // 通知等待的请求
      const pending = this.pendingQueue.get(key);
      if (pending) {
        this.pendingQueue.delete(key);
        pending.reject(error as Error);
      }

      throw error;
    } finally {
      this.activeRequests.delete(key);
      console.log(`[并发控制] 请求完成: ${key.substring(0, 50)}... (当前并发: ${this.activeRequests.size})`);
    }
  }

  /**
   * 清理过期的等待请求（超过 30 秒）
   */
  cleanup(): void {
    const now = Date.now();
    const timeout = 30 * 1000;

    for (const [key, pending] of this.pendingQueue.entries()) {
      if (now - pending.timestamp > timeout) {
        this.pendingQueue.delete(key);
        pending.reject(new Error('请求超时'));
      }
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): { active: number; pending: number; maxConcurrent: number } {
    return {
      active: this.activeRequests.size,
      pending: this.pendingQueue.size,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

/**
 * LLM 性能优化器
 */
export class LLMPerformanceOptimizer {
  private cache: LLMCache<any>;
  private concurrencyController: ConcurrencyController;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config?: {
    cacheTTL?: number;
    maxConcurrent?: number;
    maxRetries?: number;
    retryDelay?: number;
  }) {
    this.cache = new LLMCache(config?.cacheTTL);
    this.concurrencyController = new ConcurrencyController(config?.maxConcurrent);
    this.maxRetries = config?.maxRetries || 3;
    this.retryDelay = config?.retryDelay || 1000;
  }

  /**
   * 优化的 LLM 调用
   */
  async call<T>(
    requestFn: () => Promise<T>,
    options: {
      model: string;
      prompt: string;
      temperature: number;
      maxTokens?: number;
      enableCache?: boolean;
      enableRetry?: boolean;
    }
  ): Promise<T> {
    const {
      model,
      prompt,
      temperature,
      maxTokens,
      enableCache = true,
      enableRetry = true,
    } = options;

    const key = `${model}:${prompt}:${temperature}:${maxTokens || 'default'}`;

    // 尝试从缓存获取
    if (enableCache) {
      const cached = this.cache.get(model, prompt, temperature, maxTokens);
      if (cached) {
        return cached as T;
      }
    }

    // 执行请求（带并发控制）
    const result = await this.concurrencyController.execute(key, async () => {
      return await this.executeWithRetry(requestFn, enableRetry);
    });

    // 缓存结果
    if (enableCache) {
      this.cache.set(model, prompt, result, temperature, maxTokens);
    }

    return result;
  }

  /**
   * 带重试机制的请求执行
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    enableRetry: boolean
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[重试机制] 第 ${attempt} 次重试...`);
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * attempt));
        }

        return await requestFn();
      } catch (error) {
        lastError = error as Error;

        if (!enableRetry || attempt >= this.maxRetries) {
          console.error(`[重试机制] 所有重试失败: ${lastError.message}`);
          break;
        }

        console.warn(`[重试机制] 请求失败 (${attempt + 1}/${this.maxRetries}): ${lastError.message}`);
      }
    }

    throw lastError || new Error('请求失败');
  }

  /**
   * 清理缓存
   */
  cleanup(): void {
    this.cache.cleanup();
    this.concurrencyController.cleanup();
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取性能统计
   */
  getStats(): {
    cache: { size: number };
    concurrency: { active: number; pending: number; maxConcurrent: number };
  } {
    return {
      cache: this.cache.getStats(),
      concurrency: this.concurrencyController.getStatus(),
    };
  }
}

// 创建全局实例
export const llmOptimizer = new LLMPerformanceOptimizer({
  cacheTTL: 5 * 60 * 1000, // 5 分钟
  maxConcurrent: 5, // 最多 5 个并发请求
  maxRetries: 3, // 最多重试 3 次
  retryDelay: 1000, // 重试延迟 1 秒
});

// 定期清理缓存（每 5 分钟）
if (typeof window === 'undefined') {
  // 只在服务端执行
  setInterval(() => {
    llmOptimizer.cleanup();
  }, 5 * 60 * 1000);
}
