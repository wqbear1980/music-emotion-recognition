import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms, termExpansionRecords } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { autoValidateTerm } from '@/lib/similarityCalculator';
import { checkVocabularyConflict } from '@/lib/vocabularyConflictChecker';

/**
 * 场景词库自动扩充API
 * POST /api/term-management/auto-expand-scene
 *
 * 功能：接收AI分析时提取的候选新场景词，进行校验和自动扩充
 * 
 * Body: {
 *   term: string;              // 候选新词
 *   category: string;          // 分类：scenario、dubbing
 *   synonyms?: string[];       // 近义词清单（AI推荐时提供）
 *   filmTypes?: string[];      // 适配的影视类型
 *   confidence?: number;       // 置信度（0-1）
 *   reason?: string;           // 推荐理由
 *   threshold?: number;        // 相似度阈值（默认0.8）
 * }
 *
 * 返回：
 * - 成功：{ success: true, data: { termId, term, reviewStatus, similarityResult } }
 * - 失败：{ success: false, error: string, data?: { similarityResult } }
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      term,
      category,
      synonyms = [],
      filmTypes = [],
      confidence,
      reason,
      threshold = 0.8,
    } = body;

    // 1. 基本参数校验
    if (!term || typeof term !== 'string') {
      return NextResponse.json(
        { success: false, error: '请提供候选新词' },
        { status: 400 }
      );
    }

    if (!category || !['scenario', 'dubbing'].includes(category)) {
      return NextResponse.json(
        { success: false, error: '请提供有效的分类（scenario、dubbing）' },
        { status: 400 }
      );
    }

    // 2. 检查词是否已存在（快速拒绝）
    const existingTerm = await db
      .select()
      .from(standardTerms)
      .where(eq(standardTerms.term, term))
      .limit(1);

    if (existingTerm.length > 0) {
      return NextResponse.json(
        { success: false, error: `该词"${term}"已存在于词库中，无需重复添加` },
        { status: 400 }
      );
    }

    // 3. 使用词汇冲突检测工具进行初步检查（基于本地词库）
    const conflictResult = checkVocabularyConflict(
      category === 'scenario' ? 'standardScenes' : 'dubbingSuggestions',
      term
    );

    if (conflictResult.hasConflict) {
      return NextResponse.json(
        {
          success: false,
          error: conflictResult.message,
          data: { conflictResult }
        },
        { status: 400 }
      );
    }

    // 4. 使用LLM进行语义相似度校验
    const similarityResult = await autoValidateTerm(term, category, threshold);

    // 5. 根据相似度校验结果决定是否扩充
    if (similarityResult.recommendedAction === 'reject') {
      // 相似度过高，拒绝录入
      const conflictingTerms = similarityResult.existingTerms
        .filter(t => t.similarity >= threshold)
        .map(t => `${t.term}(${(t.similarity * 100).toFixed(1)}%)`)
        .join('、');

      return NextResponse.json(
        {
          success: false,
          error: `该词"${term}"与词库中已有词汇相似度过高（≥${(threshold * 100).toFixed(0)}%），避免重复录入`,
          data: {
            similarityResult,
            conflictingTerms
          }
        },
        { status: 400 }
      );
    }

    if (similarityResult.recommendedAction === 'review') {
      // 相似度接近阈值，需要谨慎处理
      // 录入待审核，标注为高风险（激进策略）
    }

    // 6. 录入待审核列表
    const termId = randomUUID();
    const now = new Date();

    // 根据相似度决定审核状态
    let reviewStatus: 'pending' | 'approved' = 'pending';
    let reviewComment = '';

    if (similarityResult.highestSimilarity === 0) {
      // 完全没有相似词，直接通过
      reviewStatus = 'approved';
      reviewComment = '无相似词汇，自动通过';
    } else if (similarityResult.highestSimilarity < threshold - 0.1) {
      // 相似度较低，自动通过
      reviewStatus = 'approved';
      reviewComment = `最高相似度${(similarityResult.highestSimilarity * 100).toFixed(1)}%，低于阈值${(threshold * 100).toFixed(0)}%，自动通过`;
    } else if (similarityResult.recommendedAction === 'review') {
      // 相似度接近阈值，需要人工审核
      reviewStatus = 'pending';
      reviewComment = `最高相似度${(similarityResult.highestSimilarity * 100).toFixed(1)}%，接近阈值${(threshold * 100).toFixed(0)}%，需要人工审核`;
    }

    // 7. 插入标准词库
    await db.insert(standardTerms).values({
      id: termId,
      term: term.trim(),
      category,
      termType: 'extended', // 自动扩充的词默认为扩展词
      filmTypes,
      synonyms,
      isAutoExpanded: true,
      expansionSource: 'ai-auto-expand',
      expansionReason: reason || `AI推荐的新场景词，置信度${confidence ? (confidence * 100).toFixed(0) + '%' : '未提供'}`,
      reviewStatus,
      reviewComment,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // 8. 记录扩充历史
    await db.insert(termExpansionRecords).values({
      termId, // 现在可以引用已插入的standardTerms记录
      term: term.trim(),
      category,
      termType: 'extended',
      triggerCount: confidence ? Math.round(confidence * 100) : 0,
      boundFilmTypes: filmTypes,
      validationPassed: true,
      validationDetails: {
        namingNormalized: true,
        synonymsChecked: synonyms.length > 0,
        conflictsResolved: !conflictResult.hasConflict,
      },
      expansionType: 'ai-auto-expand',
      expandedBy: 'ai',
      expansionBatchId: `auto-expand-${Date.now()}`,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: reviewStatus === 'approved'
        ? `词"${term}"已自动通过审核并扩充到词库`
        : `词"${term}"已录入待审核列表，等待人工审核`,
      data: {
        termId,
        term: term.trim(),
        category,
        termType: 'extended',
        reviewStatus,
        reviewComment,
        similarityResult,
        confidence
      }
    });
  } catch (error: any) {
    console.error('场景词库自动扩充失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '场景词库自动扩充失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 初始化目标场景词汇到数据库
 * POST /api/term-management/initialize-target-scenes
 *
 * 功能：将6类目标场景的核心词汇初始化到数据库中
 */
export async function PUT(request: NextRequest) {
  try {
    const { getAllTargetSceneTerms } = await import('@/lib/targetScenes');
    const db = await getDb();

    const terms = getAllTargetSceneTerms();
    let successCount = 0;
    let skipCount = 0;
    const errors: string[] = [];

    const now = new Date();

    for (const termData of terms) {
      try {
        // 检查词是否已存在
        const { standardTerms } = await import('@/storage/database/shared/schema');
        const { eq } = await import('drizzle-orm');

        const existingTerm = await db
          .select()
          .from(standardTerms)
          .where(eq(standardTerms.term, termData.term))
          .limit(1);

        if (existingTerm.length > 0) {
          skipCount++;
          continue;
        }

        // 插入新词
        await db.insert(standardTerms).values({
          id: randomUUID(),
          term: termData.term,
          category: termData.category,
          termType: termData.termType,
          filmTypes: termData.filmTypes,
          synonyms: termData.synonyms,
          isAutoExpanded: false,
          expansionSource: 'manual-initialize',
          expansionReason: '初始化6类目标场景的核心词汇',
          reviewStatus: 'approved', // 初始化的核心词默认已通过审核
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        });

        successCount++;
      } catch (error: any) {
        errors.push(`${termData.term}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `初始化完成，成功添加${successCount}个词，跳过${skipCount}个已存在的词`,
      data: {
        totalTerms: terms.length,
        successCount,
        skipCount,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error: any) {
    console.error('初始化目标场景词汇失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '初始化目标场景词汇失败',
      },
      { status: 500 }
    );
  }
}
