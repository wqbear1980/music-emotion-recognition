import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms } from '@/storage/database/shared/schema';
import { sql, eq, and } from 'drizzle-orm';
import {
  validateMultiple,
  createSuccessResponse,
  createSimpleErrorResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 获取动态词库API
 *
 * 功能：
 * 1. 从数据库中加载所有已审核通过的标准词库
 * 2. 构建分类映射表（兼容 STANDARD_TERMS 格式）
 * 3. 支持前端缓存（Last-Modified 头）
 *
 * GET /api/term-management/get-dynamic-vocabulary
 *
 * Query:
 *   - category?: string - 可选，指定分类筛选
 *
 * 返回：
 * {
 *   success: true,
 *   data: {
 *     mood: { mapping: {...}, standardList: [...] },
 *     style: { mapping: {...}, standardList: [...] },
 *     instruments: { mapping: {...}, standardList: [...] },
 *     filmGenres: { mapping: {...}, standardList: [...] },
 *     standardScenes: { mapping: {...}, standardList: [...] },
 *     dubbingSuggestions: { mapping: {...}, standardList: [...] },
 *     era: { mapping: {...}, standardList: [...] }
 *   },
 *   timestamp: '2025-01-15T...'
 * }
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const db = await getDb();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    // 查询条件：只获取审核通过的词
    const conditions = [
      eq(standardTerms.reviewStatus, 'approved')
    ];

    if (category) {
      conditions.push(eq(standardTerms.category, category));
    }

    // 从数据库加载标准词
    const terms = await db
      .select()
      .from(standardTerms)
      .where(and(...conditions))
      .orderBy(sql`${standardTerms.usageCount} DESC`);

    // 构建分类映射表
    const vocabulary: any = {};

    for (const term of terms) {
      const cat = term.category;

      // 初始化分类
      if (!vocabulary[cat]) {
        vocabulary[cat] = {
          mapping: {},
          standardList: []
        };
      }

      // 添加标准词到列表
      vocabulary[cat].standardList.push(term.term);

      // 添加标准词自身的映射
      vocabulary[cat].mapping[term.term] = term.term;

      // 添加近义词映射
      if (term.synonyms && Array.isArray(term.synonyms)) {
        for (const synonym of term.synonyms) {
          if (synonym && typeof synonym === 'string') {
            vocabulary[cat].mapping[synonym] = term.term;
          }
        }
      }
    }

    // 对于特殊分类，补充结构化信息
    // 注意：不要添加函数到 vocabulary 对象，因为函数无法被 JSON 序列化
    // standardize 方法将在前端实现

    return createSuccessResponse({
      vocabulary,
      timestamp: new Date().toISOString(),
      termCount: terms.length
    }, '获取动态词库成功');
  } catch (error: any) {
    console.error(`[获取动态词库失败] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      error.message || '获取动态词库失败',
      500,
      'GET_DYNAMIC_VOCABULARY_FAILED',
      requestId
    );
  }
}
