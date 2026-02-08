import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { musicAnalyses, standardTerms, termExpansionRecords, unrecognizedTerms } from '@/storage/database/shared/schema';
import { sql, eq, and, inArray, or, like, desc } from 'drizzle-orm';
import { STANDARD_TERMS } from '@/lib/standardTerms';
import { randomUUID } from 'crypto';
import {
  validateMultiple,
  validateRequired,
  validateType,
  validateArrayNotEmpty,
  createErrorResponse,
  createSuccessResponse,
  createSimpleErrorResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 触发自动扩充的API
 *
 * 功能：
 * 1. 获取符合扩充条件的未识别内容
 * 2. 校验是否符合扩充规则（频率门槛、匹配门槛、无冲突门槛）
 * 3. 标准化命名
 * 4. 检查近义词冲突
 * 5. 添加到标准词库
 * 6. 记录扩充历史
 * 7. 清洗历史数据
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const db = await getDb();
    const body = await request.json();
    const { termIds, minFrequency = 10 } = body;

    // 参数验证
    const validationResult = validateMultiple(
      validateRequired(body, 'termIds', '术语ID列表'),
      validateType(body, 'termIds', 'array', '术语ID列表'),
      validateArrayNotEmpty(body, 'termIds', '术语ID列表'),
      minFrequency !== undefined ? validateType(body, 'minFrequency', 'number', '最低出现次数') : undefined,
    );

    if (!validationResult.isValid) {
      return createErrorResponse(validationResult.errors, 400, requestId);
    }

    // 1. 获取符合扩充条件的未识别内容
    const candidates = await db
      .select()
      .from(unrecognizedTerms)
      .where(
        and(
          inArray(unrecognizedTerms.id, termIds),
          eq(unrecognizedTerms.expansionStatus, 'eligible')
        )
      );

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有符合扩充条件的内容',
        data: [],
      });
    }

    const expansionResults = [];
    const batchId = `auto-${Date.now()}`;

    for (const candidate of candidates) {
      try {
        // 2. 校验触发条件
        if (candidate.occurrenceCount < minFrequency) {
          await db
            .update(unrecognizedTerms)
            .set({
              expansionStatus: 'ineligible',
              rejectionReason: `出现次数不足（${candidate.occurrenceCount} < ${minFrequency}）`,
            })
            .where(eq(unrecognizedTerms.id, candidate.id));
          continue;
        }

        // 检查是否已有关联的影视类型
        if (
          !candidate.relatedFilmTypes ||
          candidate.relatedFilmTypes.length === 0
        ) {
          await db
            .update(unrecognizedTerms)
            .set({
              expansionStatus: 'ineligible',
              rejectionReason: '无法明确绑定影视类型',
            })
            .where(eq(unrecognizedTerms.id, candidate.id));
          continue;
        }

        // 3. 标准化命名
        let standardTerm = candidate.term.trim();

        // 去除常见的后缀
        standardTerm = standardTerm
          .replace(/场景$/g, '')
          .replace(/戏$/g, '')
          .replace(/配音$/g, '')
          .replace(/建议$/g, '')
          .replace(/片段$/g, '')
          .replace(/时刻$/g, '');

        // 4. 检查近义词冲突
        const isConflict = await checkSynonymConflict(db, standardTerm, candidate.category);
        if (isConflict) {
          await db
            .update(unrecognizedTerms)
            .set({
              expansionStatus: 'rejected',
              rejectionReason: '与现有标准词或近义词冲突',
            })
            .where(eq(unrecognizedTerms.id, candidate.id));
          continue;
        }

        // 5. 提取关联的影视类型
        const boundFilmTypes = candidate.relatedFilmTypes
          ? candidate.relatedFilmTypes.map((item: any) => item.filmType).slice(0, 5)
          : [];

        // 6. 添加到标准词库
        const newTermId = randomUUID();
        await db.insert(standardTerms).values({
          id: newTermId,
          term: standardTerm,
          category: candidate.category,
          termType: 'extended', // 自动扩充的都是扩展词
          filmTypes: boundFilmTypes,
          synonyms: [candidate.term], // 原始词作为近义词
          isAutoExpanded: true,
          expansionSource: 'auto',
          expansionReason: `自动扩充：未识别内容出现${candidate.occurrenceCount}次`,
          reviewStatus: 'approved', // 自动扩充的直接审核通过
          usageCount: candidate.occurrenceCount,
        });

        // 7. 记录扩充历史
        await db.insert(termExpansionRecords).values({
          termId: newTermId,
          term: standardTerm,
          category: candidate.category,
          termType: 'extended',
          triggerCount: candidate.occurrenceCount,
          boundFilmTypes,
          validationPassed: true,
          validationDetails: {
            namingNormalized: standardTerm !== candidate.term,
            synonymsChecked: true,
            conflictsResolved: true,
          },
          expansionType: 'auto',
          expandedBy: 'auto',
          expansionBatchId: batchId,
        });

        // 8. 清洗历史数据
        let cleanedCount = 0;

        if (candidate.category === 'dubbing') {
          // 清洗配音建议的未分类数据
          const dubbingResults = await db
            .select({ id: musicAnalyses.id, filmScenes: musicAnalyses.filmScenes })
            .from(musicAnalyses)
            .where(sql`${musicAnalyses.filmScenes}::text ILIKE ${`%${candidate.term}%`}`);

          for (const result of dubbingResults) {
            if (result.filmScenes && Array.isArray(result.filmScenes)) {
              const updatedScenes = result.filmScenes.map((scene: any) => {
                if (
                  typeof scene === 'object' &&
                  scene.type === '未分类' &&
                  scene.description &&
                  scene.description.includes(candidate.term)
                ) {
                  cleanedCount++;
                  return {
                    ...scene,
                    type: standardTerm,
                    description: scene.description.replace(candidate.term, standardTerm),
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
        } else if (candidate.category === 'scenario') {
          // 清洗场景的未识别数据
          const scenarioResults = await db
            .select({ id: musicAnalyses.id, scenarios: musicAnalyses.scenarios })
            .from(musicAnalyses)
            .where(sql`${musicAnalyses.scenarios}::text ILIKE ${`%${candidate.term}%`}`);

          for (const result of scenarioResults) {
            if (result.scenarios && Array.isArray(result.scenarios)) {
              const updatedScenarios = result.scenarios.map((scenario: string) => {
                if (scenario === '未识别场景' || (typeof scenario === 'string' && scenario.includes(candidate.term))) {
                  cleanedCount++;
                  return standardTerm;
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

        // 更新扩充记录中的清洗信息
        await db
          .update(termExpansionRecords)
          .set({
            historicalDataCleaned: true,
            cleanedCount,
          })
          .where(eq(termExpansionRecords.termId, newTermId));

        // 9. 更新未识别内容的扩充状态
        await db
          .update(unrecognizedTerms)
          .set({
            expansionStatus: 'expanded',
          })
          .where(eq(unrecognizedTerms.id, candidate.id));

        expansionResults.push({
          originalTerm: candidate.term,
          standardTerm,
          category: candidate.category,
          occurrenceCount: candidate.occurrenceCount,
          boundFilmTypes,
          cleanedCount,
        });
      } catch (error) {
        console.error(`扩充术语 ${candidate.term} 失败:`, error);
      }
    }

    return createSuccessResponse(
      {
        batchId,
        expandedTerms: expansionResults,
      },
      `成功扩充 ${expansionResults.length} 个标准词`
    );
  } catch (error: any) {
    console.error(`[自动扩充失败] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      error.message || '自动扩充失败',
      500,
      'AUTO_EXPAND_FAILED',
      requestId
    );
  }
}

/**
 * 检查近义词冲突
 */
async function checkSynonymConflict(db: any, term: string, category: string): Promise<boolean> {
  // 检查是否已存在于标准词库中
  const existingStandard = await db
    .select()
    .from(standardTerms)
    .where(
      and(
        eq(standardTerms.term, term),
        eq(standardTerms.category, category)
      )
    )
    .limit(1);

  if (existingStandard.length > 0) {
    return true;
  }

  // 检查是否为现有标准词的近义词
  const allStandardTerms = await db
    .select()
    .from(standardTerms)
    .where(eq(standardTerms.category, category));

  for (const stdTerm of allStandardTerms) {
    if (stdTerm.synonyms && Array.isArray(stdTerm.synonyms)) {
      if (stdTerm.synonyms.includes(term)) {
        return true;
      }
    }
  }

  return false;
}
