import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-enhanced';
import { FALLBACK_DATA } from '@/lib/db-enhanced';
import { standardTerms } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * 内存缓存接口
 */
interface CacheEntry {
  data: any;
  timestamp: number;
}

/**
 * 简单的内存缓存实现
 */
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存过期时间

/**
 * 获取缓存数据
 */
function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;

  // 检查是否过期
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * 设置缓存数据
 */
function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * 预热缓存
 * 在模块加载时自动预加载所有标准词库到缓存
 */
let warmupPromise: Promise<void> | null = null;

async function warmupCache(): Promise<void> {
  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    try {
      console.log('[标准词库预热] 开始预加载缓存');
      
      // 使用增强的getDb函数，带有重试机制
      const db = await getDb();

      // 预热所有词库
      const allTerms = await db
        .select({
          term: standardTerms.term,
          category: standardTerms.category,
        })
        .from(standardTerms)
        .where(eq(standardTerms.reviewStatus, 'approved'));

      // 按分类分组
      const result: Record<string, string[]> = {
        emotion: [],
        style: [],
        instrument: [],
        film: [],
        scenario: [],
        dubbing: [],
      };

      allTerms.forEach((item: { term: string; category: string }) => {
        const { term, category: cat } = item;
        if (result[cat]) {
          result[cat].push(term);
        }
      });

      const responseData = {
        terms: result,
        totalCount: allTerms.length,
        countsByCategory: {
          emotion: result.emotion.length,
          style: result.style.length,
          instrument: result.instrument.length,
          film: result.film.length,
          scenario: result.scenario.length,
          dubbing: result.dubbing.length,
        }
      };

      // 设置缓存
      setCache('standard_terms:all', responseData);

      // 预热各个分类
      const categories = ['emotion', 'style', 'instrument', 'film', 'scenario', 'dubbing'];
      for (const cat of categories) {
        const categoryData = {
          terms: { [cat]: result[cat] },
          totalCount: result[cat].length,
          countsByCategory: {
            [cat]: result[cat].length,
          }
        };
        setCache(`standard_terms:${cat}`, categoryData);
      }

      console.log('[标准词库预热] 预加载完成，共缓存', allTerms.length, '个标准词');
    } catch (error: any) {
      console.error('[标准词库预热] 预加载失败:', error.message);
      // 预热失败不影响正常流程，API调用时会自动降级
    }
  })();

  return warmupPromise;
}

// 模块加载时自动预热缓存
warmupCache();

/**
 * 耗时分析接口
 */
interface StepTimes {
  cacheCheck: number;      // 缓存检查耗时
  dbConnect: number;       // 数据库连接耗时
  dbQuery: number;         // 数据库查询耗时
  dataFormat: number;      // 数据格式化耗时
  cacheSet: number;        // 缓存设置耗时
  total: number;           // 总耗时
}

/**
 * GET /api/term-management/get-standard-terms
 * 获取所有审核通过的标准词，按分类返回
 *
 * 用于前端动态加载词库，确保新添加的标准词能够实时生效
 * 
 * 性能优化：
 * - 使用内存缓存，缓存时间5分钟
 * - 缓存命中时直接返回，不查询数据库
 * - 缓存键基于 category 参数，支持不同分类独立缓存
 * 
 * 耗时分析：
 * - 记录每个关键步骤的耗时，定位性能瓶颈
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const stepTimes: StepTimes = {
    cacheCheck: 0,
    dbConnect: 0,
    dbQuery: 0,
    dataFormat: 0,
    cacheSet: 0,
    total: 0,
  };

  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category'); // 可选：只查询特定分类
    const bypassCache = searchParams.get('bypassCache') === 'true'; // 调试用：绕过缓存

    // 1. 缓存检查耗时
    const cacheCheckStart = Date.now();
    const cacheKey = category ? `standard_terms:${category}` : 'standard_terms:all';
    const cachedData = bypassCache ? null : getFromCache(cacheKey);
    stepTimes.cacheCheck = Date.now() - cacheCheckStart;

    if (cachedData && !bypassCache) {
      stepTimes.total = Date.now() - startTime;
      console.log('[获取标准词库] 缓存命中，耗时分析:', stepTimes);
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true,
        performance: stepTimes,
      });
    }

    // 2. 数据库连接耗时
    const dbConnectStart = Date.now();
    const db = await getDb();
    stepTimes.dbConnect = Date.now() - dbConnectStart;

    // 3. 数据库查询耗时
    const dbQueryStart = Date.now();
    const conditions = [eq(standardTerms.reviewStatus, 'approved')];

    if (category) {
      conditions.push(eq(standardTerms.category, category));
    }

    // 添加LIMIT限制，防止数据量过大（当前词库395条，设置合理上限）
    const approvedTerms = await db
      .select({
        term: standardTerms.term,
        category: standardTerms.category,
      })
      .from(standardTerms)
      .where(and(...conditions))
      .limit(1000); // 限制最多返回1000条记录
    stepTimes.dbQuery = Date.now() - dbQueryStart;

    // 4. 数据格式化耗时
    const formatStart = Date.now();

    // 使用Map来高效分组，避免多次if判断
    const categoryMap = new Map<string, string[]>([
      ['emotion', []],
      ['style', []],
      ['instrument', []],
      ['film', []],
      ['scenario', []],
      ['dubbing', []],
    ]);

    // 使用forEach而不是reduce，因为forEach在大多数V8引擎中更快
    for (const item of approvedTerms) {
      const terms = categoryMap.get(item.category);
      if (terms) {
        terms.push(item.term);
      }
    }

    // 转换为Record对象
    const result: Record<string, string[]> = {
      emotion: categoryMap.get('emotion') || [],
      style: categoryMap.get('style') || [],
      instrument: categoryMap.get('instrument') || [],
      film: categoryMap.get('film') || [],
      scenario: categoryMap.get('scenario') || [],
      dubbing: categoryMap.get('dubbing') || [],
    };

    // 【增强】数据后置校验（确保返回的数据格式正确）
    const validationErrors: string[] = [];

    // 4.1 检查是否有null或undefined值
    for (const [key, value] of Object.entries(result)) {
      if (value === null || value === undefined) {
        validationErrors.push(`分类 "${key}" 的值为 ${value}`);
      }
      if (!Array.isArray(value)) {
        validationErrors.push(`分类 "${key}" 不是数组，实际类型: ${typeof value}`);
      }
    }

    // 4.2 检查数组中是否有非法值（null、undefined、空字符串）
    for (const [key, value] of Object.entries(result)) {
      if (Array.isArray(value)) {
        const invalidItems = value.filter(item =>
          item === null || item === undefined || (typeof item === 'string' && item.trim() === '')
        );
        if (invalidItems.length > 0) {
          validationErrors.push(`分类 "${key}" 包含 ${invalidItems.length} 个非法值（null/undefined/空字符串）`);
        }
      }
    }

    // 4.3 检查是否有超长字符串（防止XSS或数据库错误）
    const maxLength = 500;
    for (const [key, value] of Object.entries(result)) {
      if (Array.isArray(value)) {
        const longItems = value.filter(item =>
          typeof item === 'string' && item.length > maxLength
        );
        if (longItems.length > 0) {
          console.warn(`[数据校验] 分类 "${key}" 包含 ${longItems.length} 个超长字符串（>${maxLength}字符）`);
        }
      }
    }

    // 4.4 检查数据一致性（总数与各分类数量之和）
    const sumOfCategories = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
    if (sumOfCategories !== approvedTerms.length) {
      console.warn(`[数据校验] 数据不一致: 总数 ${approvedTerms.length}，各分类之和 ${sumOfCategories}`);
    }

    // 4.5 如果有严重错误，抛出异常
    if (validationErrors.length > 0) {
      throw new Error(`数据后置校验失败: ${validationErrors.join('; ')}`);
    }

    const responseData = {
      terms: result,
      totalCount: approvedTerms.length,
      countsByCategory: {
        emotion: result.emotion.length,
        style: result.style.length,
        instrument: result.instrument.length,
        film: result.film.length,
        scenario: result.scenario.length,
        dubbing: result.dubbing.length,
      }
    };
    stepTimes.dataFormat = Date.now() - formatStart;

    // 5. 缓存设置耗时
    const cacheSetStart = Date.now();
    setCache(cacheKey, responseData);
    stepTimes.cacheSet = Date.now() - cacheSetStart;

    // 计算总耗时
    stepTimes.total = Date.now() - startTime;

    // 输出详细耗时日志
    console.log('【词库API耗时分析】', JSON.stringify({
      ...stepTimes,
      recordCount: approvedTerms.length,
      category: category || 'all',
    }, null, 2));

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      performance: stepTimes, // 返回耗时分析数据
    });
  } catch (error: any) {
    stepTimes.total = Date.now() - startTime;

    // 【降级策略】数据库连接错误时返回降级数据
    if (
      error.message.includes('DB_CONNECTION_FAILED') ||
      error.message.includes('timeout') ||
      error.message.includes('Compute node') ||
      error.message.includes('connection') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('timeout after')
    ) {
      console.error('[获取标准词库] 数据库连接失败，使用降级数据:', error.message);
      console.error('[获取标准词库] 耗时分析（出错前）:', stepTimes);

      // 准备降级数据
      const fallbackResponseData = {
        terms: FALLBACK_DATA.standardTerms,
        totalCount: Object.values(FALLBACK_DATA.standardTerms).reduce((sum: number, arr: any) => sum + arr.length, 0),
        countsByCategory: {
          emotion: FALLBACK_DATA.standardTerms.emotion.length,
          style: FALLBACK_DATA.standardTerms.style.length,
          instrument: FALLBACK_DATA.standardTerms.instrument.length,
          film: FALLBACK_DATA.standardTerms.film.length,
          scenario: FALLBACK_DATA.standardTerms.scenario.length,
          dubbing: FALLBACK_DATA.standardTerms.dubbing.length,
        }
      };

      // 返回降级数据，但标记为fallback
      return NextResponse.json(
        {
          success: true,
          data: fallbackResponseData,
          cached: false,
          fallback: true,
          fallbackReason: '数据库连接失败',
          error: error.message,
          performance: stepTimes,
        },
        { status: 200 } // 降级数据返回200状态码
      );
    }

    // 【增强】区分不同类型的错误，返回不同的HTTP状态码
    console.error('[获取标准词库] 错误:', error);
    console.error('[获取标准词库] 耗时分析（出错前）:', stepTimes);

    const errorMessage = error.message || '未知错误';
    const errorStack = error.stack || '';

    // 1. 数据库连接错误
    if (
      errorMessage.includes('连接') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED')
    ) {
      console.error('[获取标准词库] 数据库连接失败');
      return NextResponse.json(
        {
          success: false,
          error: '数据库连接失败，请稍后重试',
          errorType: 'database_connection',
          performance: stepTimes,
        },
        { status: 503 } // Service Unavailable
      );
    }

    // 2. 查询错误（表结构异常、字段不存在等）
    if (
      errorMessage.includes('column') ||
      errorMessage.includes('does not exist') ||
      errorMessage.includes('relation') ||
      errorMessage.includes('table') ||
      errorStack.includes('drizzle-orm')
    ) {
      console.error('[获取标准词库] 数据库查询错误（可能是表结构异常）');
      return NextResponse.json(
        {
          success: false,
          error: '数据库表结构异常，请联系管理员',
          errorType: 'database_schema',
          details: errorMessage,
          performance: stepTimes,
        },
        { status: 400 } // Bad Request（客户端问题）
      );
    }

    // 3. 数据格式错误（null、undefined、类型不匹配等）
    if (
      errorMessage.includes('null') ||
      errorMessage.includes('undefined') ||
      errorMessage.includes('Cannot read') ||
      errorMessage.includes('Cannot access') ||
      errorMessage.includes('is not a function')
    ) {
      console.error('[获取标准词库] 数据格式错误');
      return NextResponse.json(
        {
          success: false,
          error: '数据格式错误，请检查数据完整性',
          errorType: 'data_format',
          details: errorMessage,
          performance: stepTimes,
        },
        { status: 400 } // Bad Request（客户端问题）
      );
    }

    // 4. 内存溢出或超时
    if (
      errorMessage.includes('out of memory') ||
      errorMessage.includes('memory') ||
      errorMessage.includes('heap') ||
      errorMessage.includes('timeout')
    ) {
      console.error('[获取标准词库] 内存或超时错误');
      return NextResponse.json(
        {
          success: false,
          error: '系统资源不足，请稍后重试',
          errorType: 'resource_limit',
          performance: stepTimes,
        },
        { status: 503 } // Service Unavailable
      );
    }

    // 5. 其他未知错误
    console.error('[获取标准词库] 未知错误');
    return NextResponse.json(
      {
        success: false,
        error: `获取标准词库失败: ${errorMessage}`,
        errorType: 'unknown',
        performance: stepTimes,
      },
      { status: 500 } // Internal Server Error
    );
  }
}
