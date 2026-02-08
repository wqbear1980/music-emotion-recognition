/**
 * 增强的数据库连接层
 * 提供连接重试、超时控制和降级策略
 */

import { getDb as getOriginalDb } from 'coze-coding-dev-sdk';

/**
 * 数据库健康状态接口
 */
export interface DbHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  error?: string;
  timestamp: string;
  consecutiveFailures: number;
}

/**
 * 详细的错误日志记录
 * 帮助快速定位数据库连接问题
 */
function logDetailedError(
  stage: string,
  error: any,
  context?: Record<string, any>
): void {
  console.error(`[数据库错误] ${stage}:`, {
    timestamp: new Date().toISOString(),
    errorMessage: error.message,
    errorName: error.name,
    // 限制堆栈信息长度
    stackTrace: error.stack?.substring(0, 800),
    // 自定义上下文信息
    ...context,
  });

  // 如果是特定错误类型，给出处理建议
  if (error.message?.includes('timeout')) {
    console.warn('[数据库错误] 建议：检查网络连接或延长超时时间');
  } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('Compute node')) {
    console.warn('[数据库错误] 建议：检查数据库服务是否启动，或联系管理员确认服务状态');
  } else if (error.message?.includes('connection')) {
    console.warn('[数据库错误] 建议：检查连接参数（地址、端口、账号密码）和防火墙设置');
  }
}

/**
 * 数据库配置
 * 优化说明：
 * - 延长连接超时时间：从 5 秒延长到 10 秒，适应网络波动
 * - 增加重试次数：从 2 次增加到 3 次，提高连接成功率
 * - 延长重试延迟：使用指数退避策略，避免频繁重试
 */
const DB_CONFIG = {
  connectionTimeoutMs: 10000,  // 连接超时时间（10秒，适应网络波动）
  maxRetries: 3,                // 最大重试次数（增加到3次）
  retryDelayMs: 1000,           // 初始重试延迟（毫秒）
  failureThreshold: 3,           // 连续失败阈值，超过后启用降级模式
  healthCheckInterval: 30000,   // 健康检查间隔（30秒）
};

/**
 * 全局健康状态
 */
let healthStatus: DbHealthStatus = {
  status: 'unknown',
  timestamp: new Date().toISOString(),
  consecutiveFailures: 0,
};

/**
 * 带超时的Promise包装
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Database operation timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 更新健康状态
 */
function updateHealthStatus(status: 'healthy' | 'unhealthy', error?: string): void {
  if (status === 'healthy') {
    healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      consecutiveFailures: 0,
    };
    console.log('[数据库健康检查] 数据库连接正常');
  } else {
    healthStatus.consecutiveFailures += 1;
    healthStatus.status = 'unhealthy';
    healthStatus.error = error;
    healthStatus.timestamp = new Date().toISOString();
    console.error(`[数据库健康检查] 连接失败 (${healthStatus.consecutiveFailures}/${DB_CONFIG.failureThreshold}):`, error);
  }
}

/**
 * 重置健康状态（用于手动恢复）
 */
export function resetHealthStatus(): void {
  healthStatus = {
    status: 'unknown',
    timestamp: new Date().toISOString(),
    consecutiveFailures: 0,
  };
}

/**
 * 获取当前健康状态
 */
export function getHealthStatus(): DbHealthStatus {
  return { ...healthStatus };
}

/**
 * 判断是否应该启用降级模式
 */
function shouldEnableFallback(): boolean {
  return healthStatus.consecutiveFailures >= DB_CONFIG.failureThreshold;
}

/**
 * 带重试的数据库连接函数
 * 优化说明：
 * - 使用指数退避策略，避免频繁重试导致雪崩
 * - 增加详细的错误日志记录，便于排查问题
 */
export async function getDbWithRetry(): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= DB_CONFIG.maxRetries; attempt++) {
    try {
      console.log(`[数据库连接] 尝试 ${attempt}/${DB_CONFIG.maxRetries}`);

      // 添加超时控制
      const db = await withTimeout(getOriginalDb(), DB_CONFIG.connectionTimeoutMs);

      // 测试连接是否可用
      if (db && typeof db.select === 'function') {
        updateHealthStatus('healthy');
        return db;
      } else {
        throw new Error('Invalid database connection object');
      }
    } catch (error: any) {
      lastError = error;

      // 详细的错误日志记录（使用新的日志函数）
      logDetailedError(
        `尝试 ${attempt}/${DB_CONFIG.maxRetries} 失败`,
        error,
        {
          attempt,
          maxRetries: DB_CONFIG.maxRetries,
          timeout: DB_CONFIG.connectionTimeoutMs,
          willRetry: attempt < DB_CONFIG.maxRetries,
          nextDelay: attempt < DB_CONFIG.maxRetries
            ? DB_CONFIG.retryDelayMs * Math.pow(2, attempt - 1)
            : 0,
        }
      );

      // 如果是最后一次尝试，记录失败
      if (attempt === DB_CONFIG.maxRetries) {
        updateHealthStatus('unhealthy', error.message);
        logDetailedError(
          '所有重试均失败',
          error,
          {
            totalAttempts: attempt,
            totalDuration: DB_CONFIG.connectionTimeoutMs * attempt,
            fallbackEnabled: shouldEnableFallback(),
          }
        );
      } else {
        // 等待后重试（指数退避：第1次1秒，第2次2秒，第3次3秒）
        const delayMs = DB_CONFIG.retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`[数据库连接] 等待 ${delayMs}ms 后重试...`);
        await delay(delayMs);
      }
    }
  }

  // 所有尝试都失败
  throw lastError || new Error('Database connection failed after all retries');
}

/**
 * 健康检查函数（快速检测）
 * 优化说明：延长超时时间到 5 秒，与连接超时保持合理比例
 */
export async function checkDbHealth(): Promise<DbHealthStatus> {
  try {
    const db = await withTimeout(getOriginalDb(), 5000); // 5秒快速检查（从3秒延长）
    if (db && typeof db.select === 'function') {
      updateHealthStatus('healthy');
      return getHealthStatus();
    }
    throw new Error('Invalid database connection');
  } catch (error: any) {
    logDetailedError('健康检查失败', error, {
      checkTimeout: 5000,
      consecutiveFailures: healthStatus.consecutiveFailures + 1,
    });
    return getHealthStatus();
  }
}

/**
 * 获取数据库连接（增强版）
 * 自动重试，失败后记录健康状态
 */
export async function getDb(): Promise<any> {
  try {
    return await getDbWithRetry();
  } catch (error: any) {
    // 抛出特殊错误，让上层可以选择降级处理
    const enhancedError = new Error('DB_CONNECTION_FAILED', { cause: error });
    (enhancedError as any).originalError = error;
    throw enhancedError;
  }
}

/**
 * 安全执行数据库操作
 * 如果数据库不可用，返回降级数据
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  fallbackData: T,
  fallbackEnabled: boolean = true
): Promise<{ success: boolean; data: T; fallback: boolean; error?: string }> {
  // 如果已启用降级模式且降级功能已启用，直接返回降级数据
  if (fallbackEnabled && shouldEnableFallback()) {
    console.log('[数据库降级] 使用降级数据（基于历史失败）');
    return {
      success: true,
      data: fallbackData,
      fallback: true,
    };
  }

  try {
    const data = await operation();
    return {
      success: true,
      data,
      fallback: false,
    };
  } catch (error: any) {
    // 检查是否是数据库连接错误
    if (
      error.message.includes('DB_CONNECTION_FAILED') ||
      error.message.includes('timeout') ||
      error.message.includes('Compute node') ||
      error.message.includes('connection') ||
      error.message.includes('ECONNREFUSED')
    ) {
      logDetailedError('数据库操作失败，使用降级数据', error, {
        fallbackEnabled,
        consecutiveFailures: healthStatus.consecutiveFailures,
      });

      return {
        success: true,
        data: fallbackData,
        fallback: true,
        error: error.message,
      };
    }

    // 其他错误抛出
    throw error;
  }
}

/**
 * 定期健康检查（需要在应用启动时调用）
 */
export function startHealthCheck(): void {
  setInterval(async () => {
    try {
      await checkDbHealth();
    } catch (error: any) {
      logDetailedError('定期健康检查失败', error, {
        healthCheckInterval: DB_CONFIG.healthCheckInterval,
      });
    }
  }, DB_CONFIG.healthCheckInterval);

  // 立即执行一次
  checkDbHealth();
}

/**
 * 预定义的降级数据
 */
export const FALLBACK_DATA = {
  standardTerms: {
    emotion: ['开心', '悲伤', '平静', '激动', '焦虑', '愤怒', '感动', '忧郁'],
    style: ['流行', '古典', '摇滚', '爵士', '电子', '民谣', '说唱', 'R&B'],
    instrument: ['钢琴', '吉他', '小提琴', '鼓', '贝斯', '萨克斯', '笛子', '二胡'],
    film: ['电影', '电视剧', '纪录片', '动画片', '短视频', '广告', '游戏', 'MV'],
    scenario: ['城市', '自然', '室内', '户外', '运动', '浪漫', '悬疑', '搞笑'],
    dubbing: ['中文', '英文', '日文', '韩文', '法文', '德文', '西班牙文', '意大利文'],
  },
  
  musicAnalysis: {
    emotions: ['情绪分析暂时不可用'],
    styles: ['风格分析暂时不可用'],
    instruments: ['乐器分析暂时不可用'],
  },
};
