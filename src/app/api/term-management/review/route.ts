import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { musicAnalyses, standardTerms, termExpansionRecords, unrecognizedTerms } from '@/storage/database/shared/schema';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { STANDARD_TERMS } from '@/lib/standardTerms';
import { randomUUID } from 'crypto';
import {
  validateMultiple,
  validateRequired,
  validateType,
  validateArrayNotEmpty,
  validateReviewAction,
  createErrorResponse,
  createSuccessResponse,
  createSimpleErrorResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 人工审核API
 *
 * 功能：
 * 1. 查看待审核的扩充记录
 * 2. 审核通过：将扩充的标准词状态设为approved
 * 3. 审核拒绝：将扩充的标准词删除，恢复历史数据
 * 4. 批量审核
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get('reviewStatus') || 'pending';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const offset = (page - 1) * limit;

    // 查询待审核的扩充记录
    const records = await db
      .select({
        id: standardTerms.id,
        term: standardTerms.term,
        category: standardTerms.category,
        termType: standardTerms.termType,
        filmTypes: standardTerms.filmTypes,
        synonyms: standardTerms.synonyms,
        isAutoExpanded: standardTerms.isAutoExpanded,
        expansionSource: standardTerms.expansionSource,
        expansionReason: standardTerms.expansionReason,
        reviewStatus: standardTerms.reviewStatus,
        reviewedBy: standardTerms.reviewedBy,
        reviewedAt: standardTerms.reviewedAt,
        reviewComment: standardTerms.reviewComment,
        usageCount: standardTerms.usageCount,
        createdAt: standardTerms.createdAt,
      })
      .from(standardTerms)
      .where(eq(standardTerms.reviewStatus, reviewStatus))
      .orderBy(standardTerms.createdAt)
      .limit(limit)
      .offset(offset);

    // 统计总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(standardTerms)
      .where(eq(standardTerms.reviewStatus, reviewStatus));

    const total = countResult[0]?.count || 0;

    return createSuccessResponse(
      {
        records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    );
  } catch (error: any) {
    console.error(`[查询审核记录失败] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      error.message || '查询审核记录失败',
      500,
      'QUERY_REVIEW_RECORDS_FAILED',
      requestId
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const db = await getDb();
    const body = await request.json();
    const { termIds, action, reviewer, comment } = body;

    // 参数验证
    const validationResult = validateMultiple(
      validateRequired(body, 'termIds', '术语ID列表'),
      validateType(body, 'termIds', 'array', '术语ID列表'),
      validateArrayNotEmpty(body, 'termIds', '术语ID列表'),
      validateRequired(body, 'action', '审核动作'),
      validateType(body, 'action', 'string', '审核动作'),
      validateReviewAction(body),
      reviewer !== undefined ? validateType(body, 'reviewer', 'string', '审核人') : undefined,
      comment !== undefined ? validateType(body, 'comment', 'string', '审核意见') : undefined,
    );

    if (!validationResult.isValid) {
      return createErrorResponse(validationResult.errors, 400, requestId);
    }

    const results = [];

    for (const termId of termIds) {
      try {
        // 获取术语信息
        const terms = await db
          .select()
          .from(standardTerms)
          .where(eq(standardTerms.id, termId))
          .limit(1);

        if (terms.length === 0) {
          continue;
        }

        const term = terms[0];

        if (action === 'approve') {
          // 审核通过
          await db
            .update(standardTerms)
            .set({
              reviewStatus: 'approved',
              reviewedBy: reviewer || 'admin',
              reviewedAt: new Date(),
              reviewComment: comment || '审核通过',
            })
            .where(eq(standardTerms.id, termId));

          results.push({
            termId,
            term: term.term,
            action: 'approve',
            success: true,
          });
        } else {
          // 审核拒绝：删除标准词，恢复历史数据
          // 1. 恢复历史数据
          if (term.synonyms && Array.isArray(term.synonyms)) {
            for (const synonym of term.synonyms) {
              // 恢复数据库中的原始术语
              if (term.category === 'dubbing') {
                const dubbingResults = await db
                  .select({ id: musicAnalyses.id, filmScenes: musicAnalyses.filmScenes })
                  .from(musicAnalyses)
                  .where(sql`${musicAnalyses.filmScenes}::text ILIKE ${`%${term.term}%`}`);

                for (const result of dubbingResults) {
                  if (result.filmScenes && Array.isArray(result.filmScenes)) {
                    const updatedScenes = result.filmScenes.map((scene: any) => {
                      if (
                        typeof scene === 'object' &&
                        scene.type === term.term &&
                        scene.description
                      ) {
                        return {
                          ...scene,
                          type: '未分类',
                          description: scene.description.replace(term.term, synonym),
                        };
                      }
                      return scene;
                    });

                    await db
                      .update(musicAnalyses)
                      .set({ filmScenes: updatedScenes })
                      .where(eq(musicAnalyses.id, result.id));
                  }
                }
              } else if (term.category === 'scenario') {
                const scenarioResults = await db
                  .select({ id: musicAnalyses.id, scenarios: musicAnalyses.scenarios })
                  .from(musicAnalyses)
                  .where(sql`${musicAnalyses.scenarios}::text ILIKE ${`%${term.term}%`}`);

                for (const result of scenarioResults) {
                  if (result.scenarios && Array.isArray(result.scenarios)) {
                    const updatedScenarios = result.scenarios.map((scenario: string) => {
                      if (scenario === term.term) {
                        return synonym;
                      }
                      return scenario;
                    });

                    await db
                      .update(musicAnalyses)
                      .set({ scenarios: updatedScenarios })
                      .where(eq(musicAnalyses.id, result.id));
                  }
                }
              }
            }
          }

          // 2. 删除标准词
          await db.delete(standardTerms).where(eq(standardTerms.id, termId));

          // 3. 更新扩充记录
          await db
            .update(termExpansionRecords)
            .set({
              expansionType: 'manual-rejected',
            })
            .where(eq(termExpansionRecords.termId, termId));

          // 4. 恢复未识别内容的状态
          await db
            .update(unrecognizedTerms)
            .set({
              expansionStatus: 'ineligible',
              rejectionReason: `人工审核拒绝：${comment || '不符合标准'}`,
            })
            .where(eq(unrecognizedTerms.term, term.term));

          results.push({
            termId,
            term: term.term,
            action: 'reject',
            success: true,
          });
        }
      } catch (error) {
        console.error(`审核术语 ${termId} 失败:`, error);
        results.push({
          termId,
          action,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return createSuccessResponse(
      results,
      `审核完成，成功 ${results.filter((r) => r.success).length} 条，失败 ${results.filter((r) => !r.success).length} 条`
    );
  } catch (error: any) {
    console.error(`[审核失败] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      error.message || '审核失败',
      500,
      'REVIEW_TERMS_FAILED',
      requestId
    );
  }
}
