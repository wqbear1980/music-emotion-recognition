import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms, musicAnalyses, unrecognizedTerms } from '@/storage/database/shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  validateMultiple,
  validateRequired,
  validateType,
  validateCategory,
  validateTermType,
  createErrorResponse,
  createSuccessResponse,
  createSimpleErrorResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 直接将非标准词转为标准词（一键转正）
 *
 * 功能：
 * 1. 将非标准词直接录入标准词库（无需审核流程）
 * 2. 批量更新分析结果中的非标准词为标准词
 * 3. 清理未识别词表中的对应记录
 *
 * 请求体：
 * {
 *   term: string,          // 非标准词
 *   standardTerm: string,  // 选定的标准词
 *   category: 'scenario' | 'dubbing',  // 分类
 *   termType: 'core' | 'extended',    // 词汇类型
 *   filmTypes?: string[],   // 适配的影视类型
 *   synonyms?: string[],   // 近义词
 *   reason?: string         // 转正理由
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const body = await request.json();
    const {
      term,
      standardTerm,
      category,
      termType,
      filmTypes = [],
      synonyms = [],
      reason = '用户手动一键转正'
    } = body;

    // 参数验证
    const validationResult = validateMultiple(
      validateRequired(body, 'term', '非标准词'),
      validateType(body, 'term', 'string', '非标准词'),
      validateRequired(body, 'standardTerm', '标准词'),
      validateType(body, 'standardTerm', 'string', '标准词'),
      validateRequired(body, 'category', '分类'),
      validateType(body, 'category', 'string', '分类'),
      validateCategory(body),
      validateRequired(body, 'termType', '词类型'),
      validateType(body, 'termType', 'string', '词类型'),
      validateTermType(body),
      filmTypes !== undefined ? validateType(body, 'filmTypes', 'array', '影视类型') : undefined,
      synonyms !== undefined ? validateType(body, 'synonyms', 'array', '近义词') : undefined,
    );

    if (!validationResult.isValid) {
      return createErrorResponse(validationResult.errors, 400, requestId);
    }

    console.log(`[一键转正] 开始处理: ${term} -> ${standardTerm}`);

    const db = await getDb();

    // 1. 检查标准词是否已存在
    const existingTerm = await db
      .select()
      .from(standardTerms)
      .where(eq(standardTerms.term, standardTerm))
      .limit(1);

    if (existingTerm.length > 0) {
      return NextResponse.json({
        success: false,
        error: `标准词"${standardTerm}"已存在于词库中，请选择其他标准词或使用审核流程`
      }, { status: 400 });
    }

    // 2. 插入标准词到词库（reviewStatus='approved'，直接审核通过）
    const newTermId = crypto.randomUUID();
    await db.insert(standardTerms).values({
      id: newTermId,
      term: standardTerm,
      category,
      termType,
      synonyms,
      filmTypes,
      isAutoExpanded: false,
      expansionSource: 'manual_approve_directly',
      expansionReason: reason,
      reviewStatus: 'approved',
      reviewedAt: new Date(),
      usageCount: 0,
      createdAt: new Date()
    });

    console.log(`[一键转正] 标准词"${standardTerm}"已录入词库`);

    // 3. 批量更新分析结果中的非标准词为标准词
    let updatedAnalysesCount = 0;

    if (category === 'scenario') {
      // 更新场景建议字段
      const scenarioResults = await db
        .select({ id: musicAnalyses.id, scenarios: musicAnalyses.scenarios })
        .from(musicAnalyses)
        .where(sql`${musicAnalyses.scenarios}::text ILIKE ${`%${term}%`}`);

      for (const result of scenarioResults) {
        if (result.scenarios && Array.isArray(result.scenarios)) {
          const updatedScenarios = result.scenarios.map((s: string) => {
            // 完全匹配或包含非标准词，则替换为标准词
            if (s === term || (typeof s === 'string' && s.includes(term))) {
              return standardTerm;
            }
            return s;
          });

          // 检查是否有变化
          const hasChanged = result.scenarios.some((s: string) =>
            s === term || (typeof s === 'string' && s.includes(term))
          );

          if (hasChanged) {
            await db
              .update(musicAnalyses)
              .set({
                scenarios: updatedScenarios,
                updatedAt: new Date()
              })
              .where(eq(musicAnalyses.id, result.id));
            updatedAnalysesCount++;
          }
        }
      }
    } else if (category === 'dubbing') {
      // 更新配音建议字段（存储在otherFeatures中）
      const dubbingResults = await db
        .select({ id: musicAnalyses.id, otherFeatures: musicAnalyses.otherFeatures })
        .from(musicAnalyses)
        .where(sql`${musicAnalyses.otherFeatures}::text ILIKE ${`%${term}%`}`);

      for (const result of dubbingResults) {
        if (result.otherFeatures) {
          const otherFeatures = result.otherFeatures as any;
          const dubbing = otherFeatures.dubbing;

          if (dubbing && typeof dubbing === 'string') {
            // 替换配音建议中的非标准词
            const updatedDubbing = dubbing.replace(new RegExp(term, 'g'), standardTerm);

            if (updatedDubbing !== dubbing) {
              await db
                .update(musicAnalyses)
                .set({
                  otherFeatures: {
                    ...otherFeatures,
                    dubbing: updatedDubbing
                  },
                  updatedAt: new Date()
                })
                .where(eq(musicAnalyses.id, result.id));
              updatedAnalysesCount++;
            }
          }
        }
      }
    }

    console.log(`[一键转正] 已更新 ${updatedAnalysesCount} 条分析结果`);

    // 4. 清理未识别词表中的对应记录
    const deletedUnrecognized = await db
      .delete(unrecognizedTerms)
      .where(
        and(
          eq(unrecognizedTerms.term, term),
          eq(unrecognizedTerms.category, category)
        )
      )
      .returning();

    console.log(`[一键转正] 已清理 ${deletedUnrecognized.length} 条未识别词记录`);

    return NextResponse.json({
      success: true,
      data: {
        standardTermId: newTermId,
        updatedAnalysesCount,
        deletedUnrecognizedCount: deletedUnrecognized.length
      },
      message: `成功将"${term}"转正为标准词"${standardTerm}"，已更新${updatedAnalysesCount}条分析结果`
    });

  } catch (error) {
    console.error('[一键转正] 处理失败:', error);
    return NextResponse.json({
      success: false,
      error: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`
    }, { status: 500 });
  }
}
