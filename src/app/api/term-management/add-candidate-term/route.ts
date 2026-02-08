import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms, termExpansionRecords } from '@/storage/database/shared/schema';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  validateMultiple,
  validateRequired,
  validateType,
  validateCategory,
  validateTermType,
  createErrorResponse,
  createSimpleErrorResponse,
  createSuccessResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 添加候选新词到词库
 * POST /api/term-management/add-candidate-term
 *
 * Body: {
 *   term: string;           // 标准词名称
 *   category: string;       // 分类：scenario、dubbing
 *   termType?: string;      // 词类型：core、extended（默认extended）
 *   synonyms?: string[];    // 近义词清单
 *   filmTypes?: string[];   // 适配的影视类型
 *   confidence?: number;    // 置信度（AI推荐时提供）
 *   reason?: string;        // 添加理由
 *   source?: 'ai' | 'manual'; // 来源：ai（AI推荐）、manual（手动添加，默认manual）
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      term,
      category,
      termType = 'extended',
      synonyms = [],
      filmTypes = [],
      confidence,
      reason,
      source = 'manual',
    } = body;

    // 1. 基本参数校验
    const validationResult = validateMultiple(
      validateRequired(body, 'term', '标准词名称'),
      validateType(body, 'term', 'string', '标准词名称'),
      validateRequired(body, 'category', '分类'),
      validateType(body, 'category', 'string', '分类'),
      validateCategory(body),
      validateRequired(body, 'reason', '添加理由'),
      validateType(body, 'reason', 'string', '添加理由'),
      termType !== undefined ? validateType(body, 'termType', 'string', '词类型') : undefined,
      termType !== undefined ? validateTermType(body) : undefined,
      filmTypes !== undefined ? validateType(body, 'filmTypes', 'array', '影视类型') : undefined,
      synonyms !== undefined ? validateType(body, 'synonyms', 'array', '近义词清单') : undefined,
      confidence !== undefined ? validateType(body, 'confidence', 'number', '置信度') : undefined,
    );

    if (!validationResult.isValid) {
      return createErrorResponse(validationResult.errors, 400, requestId);
    }

    // 2. 检查词是否已存在
    const existingTerm = await db
      .select()
      .from(standardTerms)
      .where(eq(standardTerms.term, term))
      .limit(1);

    if (existingTerm.length > 0) {
      return NextResponse.json(
        { success: false, error: `标准词"${term}"已存在` },
        { status: 400 }
      );
    }

    // 3. 检查近义词冲突
    const conflicts = [];

    for (const synonym of synonyms) {
      // 检查近义词是否是其他标准词
      const conflictTerms = await db
        .select()
        .from(standardTerms)
        .where(eq(standardTerms.term, synonym))
        .limit(1);

      if (conflictTerms.length > 0) {
        conflicts.push(`"${synonym}"已作为标准词存在`);
      }

      // 检查近义词是否在其他标准词的近义词列表中
      const synonymConflicts = await db
        .select()
        .from(standardTerms)
        .where(sql`${standardTerms.synonyms}::jsonb ? ${synonym}`)
        .limit(1);

      if (synonymConflicts.length > 0) {
        conflicts.push(`"${synonym}"是"${synonymConflicts[0].term}"的近义词`);
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `近义词冲突：${conflicts.join('、')}，请修改近义词清单`,
        },
        { status: 400 }
      );
    }

    // 4. 添加到标准词库
    const termId = randomUUID();
    const now = new Date();

    await db.insert(standardTerms).values({
      id: termId,
      term: term.trim(),
      category,
      termType,
      filmTypes,
      synonyms,
      isAutoExpanded: source === 'ai',
      expansionSource: source === 'ai' ? 'ai-recommend' : 'manual',
      expansionReason: reason,
      reviewStatus: 'pending', // 新增词都需要审核
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // 5. 记录扩充历史
    await db.insert(termExpansionRecords).values({
      term: term.trim(),
      category,
      termType,
      triggerCount: confidence ? Math.round(confidence) : 0,
      boundFilmTypes: filmTypes,
      validationPassed: true,
      validationDetails: {
        namingNormalized: true,
        synonymsChecked: true,
        conflictsResolved: conflicts.length === 0,
      },
      expansionType: source === 'ai' ? 'ai-recommend' : 'manual',
      expandedBy: source === 'ai' ? 'ai' : 'manual',
      expansionBatchId: source === 'ai' ? `ai-${Date.now()}` : `manual-${Date.now()}`,
      createdAt: now,
    });

    return createSuccessResponse(
      {
        termId,
        term: term.trim(),
        category,
        termType,
        reviewStatus: 'pending',
      },
      `标准词"${term}"已成功提交审核`
    );
  } catch (error: any) {
    console.error(`[添加候选新词失败] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      error.message || '添加候选新词失败',
      500,
      'ADD_CANDIDATE_TERM_FAILED',
      requestId
    );
  }
}
