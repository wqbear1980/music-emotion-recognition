import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms } from '@/storage/database/shared/schema';
import { STANDARD_TERMS } from '@/lib/standardTerms';
import { sql, eq, and } from 'drizzle-orm';

/**
 * 词库初始化 API
 * 将 standardTerms.ts 中定义的所有标准词导入到数据库
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    // 准备插入的数据
    const termsToInsert: any[] = [];

    // 【测试模式】只插入场景词（4个核心词 + 194个扩展词 = 198个）

    // 1. 情绪词
    const moodTerms = STANDARD_TERMS.mood.standardList;
    moodTerms.forEach(term => {
      termsToInsert.push({
        term,
        category: 'emotion',
        termType: 'core',
        filmTypes: [],
        synonyms: [],
        isAutoExpanded: false,
        expansionSource: null,
        expansionReason: null,
        reviewStatus: 'approved',
        reviewedBy: 'system',
        reviewedAt: new Date(),
        reviewComment: '系统初始化：核心情绪词',
        usageCount: 0,
      });
    });

    // 2. 传统风格词
    const traditionalStyles = STANDARD_TERMS.style.traditionalList;
    traditionalStyles.forEach(term => {
      termsToInsert.push({
        term,
        category: 'style',
        termType: 'core',
        filmTypes: [],
        synonyms: [],
        isAutoExpanded: false,
        expansionSource: null,
        expansionReason: null,
        reviewStatus: 'approved',
        reviewedBy: 'system',
        reviewedAt: new Date(),
        reviewComment: '系统初始化：传统风格词',
        usageCount: 0,
      });
    });

    // 3. 场景/氛围风格
    const atmosphericStyles = STANDARD_TERMS.style.atmosphericList;
    atmosphericStyles.forEach(term => {
      termsToInsert.push({
        term,
        category: 'style',
        termType: 'core',
        filmTypes: [],
        synonyms: [],
        isAutoExpanded: false,
        expansionSource: null,
        expansionReason: null,
        reviewStatus: 'approved',
        reviewedBy: 'system',
        reviewedAt: new Date(),
        reviewComment: '系统初始化：场景/氛围风格词',
        usageCount: 0,
      });
    });

    // 4. 乐器词
    const instrumentTerms = STANDARD_TERMS.instruments.standardList;
    instrumentTerms.forEach(term => {
      termsToInsert.push({
        term,
        category: 'instrument',
        termType: 'core',
        filmTypes: [],
        synonyms: [],
        isAutoExpanded: false,
        expansionSource: null,
        expansionReason: null,
        reviewStatus: 'approved',
        reviewedBy: 'system',
        reviewedAt: new Date(),
        reviewComment: '系统初始化：标准乐器词',
        usageCount: 0,
      });
    });

    // 5. 影视类型
    const filmTypesList = STANDARD_TERMS.filmTypes.getAllStandardTypes();
    filmTypesList.forEach(term => {
      termsToInsert.push({
        term,
        category: 'film',
        termType: 'core',
        filmTypes: [],
        synonyms: [],
        isAutoExpanded: false,
        expansionSource: null,
        expansionReason: null,
        reviewStatus: 'approved',
        reviewedBy: 'system',
        reviewedAt: new Date(),
        reviewComment: '系统初始化：标准影视类型',
        usageCount: 0,
      });
    });

    // 6. 核心场景词（4个）
    const coreScenes = STANDARD_TERMS.standardScenes.core.standardList;
    coreScenes.forEach(term => {
      const mapping = STANDARD_TERMS.standardScenes.core.filmTypeMapping[term as keyof typeof STANDARD_TERMS.standardScenes.core.filmTypeMapping];
      const allowedFilmTypes = mapping?.allowed || [];

      termsToInsert.push({
        term,
        category: 'scenario',
        termType: 'core',
        filmTypes: allowedFilmTypes,
        synonyms: [],
        isAutoExpanded: false,
        expansionSource: null,
        expansionReason: null,
        reviewStatus: 'approved',
        reviewedBy: 'system',
        reviewedAt: new Date(),
        reviewComment: '系统初始化：核心场景词',
        usageCount: 0,
      });
    });

    // 7. 扩展场景词（100+个）
    const extendedScenes = STANDARD_TERMS.standardScenes.extended.standardList;
    extendedScenes.forEach(term => {
      const mapping = STANDARD_TERMS.standardScenes.extended.filmTypeMapping[term as keyof typeof STANDARD_TERMS.standardScenes.extended.filmTypeMapping];
      const allowedFilmTypes = mapping?.allowed || [];

      termsToInsert.push({
        term,
        category: 'scenario',
        termType: 'extended',
        filmTypes: allowedFilmTypes,
        synonyms: [],
        isAutoExpanded: false,
        expansionSource: null,
        expansionReason: null,
        reviewStatus: 'approved',
        reviewedBy: 'system',
        reviewedAt: new Date(),
        reviewComment: '系统初始化：扩展场景词',
        usageCount: 0,
      });
    });

    // 批量插入（使用 ON CONFLICT 避免重复）
    // 注意：Drizzle ORM 的批量插入需要分别处理每个分类
    let insertedCount = 0;
    let skippedCount = 0;

    // 添加日志：总词数和前10个词
    const logs: string[] = [];
    logs.push(`准备插入 ${termsToInsert.length} 个词汇`);
    logs.push(`前10个词汇: ${termsToInsert.slice(0, 10).map(t => `${t.term}(${t.category})`).join(', ')}`);

    // 限制插入数量（测试模式）
    const maxInsert = termsToInsert.length; // 初始限制，可以调整
    logs.push(`最大插入数量: ${maxInsert}`);

    for (const termData of termsToInsert.slice(0, maxInsert)) {
      try {
        // 检查是否已存在
        const existing = await db
          .select()
          .from(standardTerms)
          .where(
            and(
              eq(standardTerms.term, termData.term),
              eq(standardTerms.category, termData.category)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          logs.push(`跳过已存在的词汇: ${termData.term} (${termData.category})`);
          skippedCount++;
          continue;
        }

        // 插入新记录 - 使用 raw SQL 避免 Drizzle ORM 的类型问题
        const filmTypesJson = JSON.stringify(termData.filmTypes);
        const synonymsJson = JSON.stringify(termData.synonyms);

        await db.execute(
          sql`INSERT INTO standard_terms (
            term, category, term_type, film_types, synonyms,
            is_auto_expanded, expansion_source, expansion_reason,
            review_status, reviewed_by, reviewed_at, review_comment, usage_count
          ) VALUES (
            ${termData.term}, ${termData.category}, ${termData.termType},
            ${filmTypesJson}::jsonb, ${synonymsJson}::jsonb,
            ${termData.isAutoExpanded}, ${termData.expansionSource}, ${termData.expansionReason},
            ${termData.reviewStatus}, ${termData.reviewedBy}, ${termData.reviewedAt},
            ${termData.reviewComment}, ${termData.usageCount}
          )`
        );

        logs.push(`插入新词汇: ${termData.term} (${termData.category})`);
        insertedCount++;
      } catch (error) {
        logs.push(`插入词汇失败: ${termData.term} - ${error instanceof Error ? error.message : String(error)}`);
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: '词库初始化完成',
      stats: {
        inserted: insertedCount,
        skipped: skippedCount,
        total: termsToInsert.length,
      },
      breakdown: {
        emotions: moodTerms.length,
        traditionalStyles: traditionalStyles.length,
        atmosphericStyles: atmosphericStyles.length,
        instruments: instrumentTerms.length,
        filmTypes: filmTypesList.length,
        coreScenes: coreScenes.length,
        extendedScenes: extendedScenes.length,
      },
      logs: logs.slice(0, 50), // 返回前50条日志
    });
  } catch (error) {
    console.error('词库初始化失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '初始化失败',
      },
      { status: 500 }
    );
  }
}
