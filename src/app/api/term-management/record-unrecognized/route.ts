import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { unrecognizedTerms } from '@/storage/database/shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  validateMultiple,
  validateRequired,
  validateType,
  validateCategory,
  createErrorResponse,
  createSuccessResponse,
  createSimpleErrorResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 记录未识别内容的API
 *
 * 功能：
 * 1. 接收前端传来的未识别场景或配音建议
 * 2. 更新出现次数
 * 3. 记录关联的影视类型
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const db = await getDb();
    const body = await request.json();
    const { term, category, filmType } = body;

    // 参数验证
    const validationResult = validateMultiple(
      validateRequired(body, 'term', '术语'),
      validateType(body, 'term', 'string', '术语'),
      validateRequired(body, 'category', '分类'),
      validateType(body, 'category', 'string', '分类'),
      validateCategory(body),
      filmType !== undefined ? validateType(body, 'filmType', 'string', '影视类型') : undefined,
    );

    if (!validationResult.isValid) {
      return createErrorResponse(validationResult.errors, 400, requestId);
    }

    const now = new Date();
    const minFrequency = 10; // 最低出现次数

    // 检查是否已存在
    const existing = await db
      .select()
      .from(unrecognizedTerms)
      .where(
        and(
          eq(unrecognizedTerms.term, term),
          eq(unrecognizedTerms.category, category)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // 更新
      const current = existing[0];

      // 更新关联的影视类型
      const relatedFilmTypes = current.relatedFilmTypes || [];

      if (filmType) {
        const existingFilmType = relatedFilmTypes.find(
          (ft: any) => ft.filmType === filmType
        );

        if (existingFilmType) {
          existingFilmType.count++;
        } else {
          relatedFilmTypes.push({ filmType, count: 1 });
        }
      }

      // 排序影视类型（按出现次数降序）
      relatedFilmTypes.sort((a: any, b: any) => b.count - a.count);

      await db
        .update(unrecognizedTerms)
        .set({
          occurrenceCount: current.occurrenceCount + 1,
          lastSeenAt: now,
          relatedFilmTypes: relatedFilmTypes as any,
          expansionStatus:
            current.occurrenceCount + 1 >= minFrequency
              ? 'eligible'
              : 'pending',
          updatedAt: now,
        })
        .where(eq(unrecognizedTerms.id, current.id));

      return createSuccessResponse(
        {
          term,
          category,
          occurrenceCount: current.occurrenceCount + 1,
          isEligible: current.occurrenceCount + 1 >= minFrequency,
        },
        '更新未识别内容成功'
      );
    } else {
      // 插入
      const relatedFilmTypes = filmType
        ? [{ filmType, count: 1 }]
        : [];

      await db.insert(unrecognizedTerms).values({
        term,
        category,
        occurrenceCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        relatedFilmTypes: relatedFilmTypes as any,
        expansionStatus: 'pending',
      });

      return createSuccessResponse(
        {
          term,
          category,
          occurrenceCount: 1,
          isEligible: false,
        },
        '记录未识别内容成功'
      );
    }
  } catch (error: any) {
    console.error(`[记录未识别内容失败] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      error.message || '记录未识别内容失败',
      500,
      'UNRECOGNIZED_RECORD_FAILED',
      requestId
    );
  }
}
