import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms } from '@/storage/database/shared/schema';
import { sql, eq, and } from 'drizzle-orm';

/**
 * 自动加入词库 API
 * 当AI识别出情绪、风格、乐器等标签时，自动将这些标签加入到词库中
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { emotionTags, styles, instruments, filmType, scenarios } = body;

    const db = await getDb();

    let addedCount = 0;
    let skippedCount = 0;
    const addedTerms: any[] = [];

    /**
     * 辅助函数：检查并添加词汇到词库
     */
    const checkAndAddTerm = async (
      term: string,
      category: string,
      filmTypes?: string[]
    ) => {
      // 跳过空值和未识别的标签
      if (!term || !term.trim() || term === '未识别' || term === '未分类') {
        return;
      }

      const trimmedTerm = term.trim();

      // 检查是否已存在
      const existing = await db
        .select()
        .from(standardTerms)
        .where(
          and(
            eq(standardTerms.term, trimmedTerm),
            eq(standardTerms.category, category)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`[自动加入词库] 跳过已存在的词汇: ${trimmedTerm} (${category})`);
        skippedCount++;
        return;
      }

      // 插入新词汇
      const now = new Date();
      const newTerm = {
        term: trimmedTerm,
        category,
        termType: 'core',
        filmTypes: filmTypes || [],
        synonyms: [],
        isAutoExpanded: true,
        expansionSource: 'auto',
        expansionReason: `AI自动识别：从音乐分析结果中自动添加`,
        reviewStatus: 'approved', // AI识别的词汇自动通过审核
        reviewedBy: 'system',
        reviewedAt: now,
        reviewComment: 'AI识别标签，自动通过审核',
        usageCount: 1,
        createdAt: now,
        updatedAt: now,
      };

      // 使用原始SQL插入，避免Drizzle ORM的类型问题
      await db.execute(sql`
        INSERT INTO standard_terms (
          id, term, category, term_type, film_types, synonyms,
          is_auto_expanded, expansion_source, expansion_reason,
          review_status, reviewed_by, reviewed_at, review_comment,
          usage_count, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${newTerm.term},
          ${newTerm.category},
          ${newTerm.termType},
          ${JSON.stringify(newTerm.filmTypes)}::jsonb,
          ${JSON.stringify(newTerm.synonyms)}::jsonb,
          ${newTerm.isAutoExpanded},
          ${newTerm.expansionSource},
          ${newTerm.expansionReason},
          ${newTerm.reviewStatus},
          ${newTerm.reviewedBy},
          ${newTerm.reviewedAt},
          ${newTerm.reviewComment},
          ${newTerm.usageCount},
          ${newTerm.createdAt},
          ${newTerm.updatedAt}
        )
      `);

      console.log(`[自动加入词库] 添加新词汇: ${trimmedTerm} (${category})`);
      addedCount++;
      addedTerms.push({
        term: trimmedTerm,
        category,
        filmTypes: filmTypes || [],
      });
    };

    /**
     * 1. 处理情绪标签
     */
    if (Array.isArray(emotionTags)) {
      for (const emotion of emotionTags) {
        await checkAndAddTerm(emotion, 'emotion');
      }
    } else if (emotionTags) {
      // 单个情绪标签
      await checkAndAddTerm(emotionTags, 'emotion');
    }

    /**
     * 2. 处理风格标签
     */
    if (Array.isArray(styles)) {
      for (const style of styles) {
        await checkAndAddTerm(style, 'style');
      }
    } else if (styles) {
      // 单个风格标签
      await checkAndAddTerm(styles, 'style');
    }

    /**
     * 3. 处理乐器标签
     */
    if (Array.isArray(instruments)) {
      for (const instrument of instruments) {
        await checkAndAddTerm(instrument, 'instrument');
      }
    } else if (instruments) {
      // 单个乐器标签
      await checkAndAddTerm(instruments, 'instrument');
    }

    /**
     * 4. 处理影视类型（如果提供了）
     */
    if (filmType && filmType !== '未分类' && filmType !== '未识别') {
      await checkAndAddTerm(filmType, 'film');
    }

    /**
     * 5. 处理场景标签（如果提供了）
     */
    if (Array.isArray(scenarios)) {
      for (const scenario of scenarios) {
        if (scenario !== '未识别' && scenario !== '未分类') {
          await checkAndAddTerm(scenario, 'scenario');
        }
      }
    } else if (scenarios && scenarios !== '未识别' && scenarios !== '未分类') {
      await checkAndAddTerm(scenarios, 'scenario');
    }

    return NextResponse.json({
      success: true,
      addedCount,
      skippedCount,
      addedTerms,
      message: `成功添加 ${addedCount} 个词汇到词库，跳过 ${skippedCount} 个已存在的词汇`,
    });
  } catch (error: any) {
    console.error('自动加入词库失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '自动加入词库失败',
      },
      { status: 500 }
    );
  }
}
