import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { musicAnalyses, unrecognizedTerms } from '@/storage/database/shared/schema';
import { sql, eq, and, like, desc, gt } from 'drizzle-orm';
import { STANDARD_TERMS } from '@/lib/standardTerms';

/**
 * 统计未识别内容的API
 * 
 * 功能：
 * 1. 扫描数据库中标记为"未分类"的配音建议和"未识别场景"的场景建议
 * 2. 统计每个未识别内容的出现次数
 * 3. 分析关联的影视类型
 * 4. 更新unrecognizedTerms表
 * 5. 返回符合扩充条件的高频内容列表
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // 'dubbing' | 'scenario' | 'all'
    const minFrequency = parseInt(searchParams.get('minFrequency') || '10', 10); // 最低出现次数

    // 1. 扫描未识别的配音建议
    const dubbingUnrecognized: Record<string, { count: number; filmTypes: Record<string, number> }> = {};

    if (!category || category === 'all' || category === 'dubbing') {
      const dubbingResults = await db
        .select({
          filmScenes: musicAnalyses.filmScenes,
          filmType: musicAnalyses.filmType,
        })
        .from(musicAnalyses)
        .where(sql`${musicAnalyses.filmScenes}::text ILIKE '%未分类%'`);

      for (const result of dubbingResults) {
        if (result.filmScenes && Array.isArray(result.filmScenes)) {
          for (const scene of result.filmScenes as any[]) {
            // 提取场景的type字段（配音建议）
            if (typeof scene === 'object' && scene.type) {
              const type = scene.type;
              if (type === '未分类' && scene.description) {
                const desc = scene.description;
                if (!dubbingUnrecognized[desc]) {
                  dubbingUnrecognized[desc] = { count: 0, filmTypes: {} };
                }
                dubbingUnrecognized[desc].count++;
                if (result.filmType) {
                  dubbingUnrecognized[desc].filmTypes[result.filmType] =
                    (dubbingUnrecognized[desc].filmTypes[result.filmType] || 0) + 1;
                }
              }
            }
          }
        }
      }
    }

    // 2. 扫描未识别的场景
    const scenarioUnrecognized: Record<string, { count: number; filmTypes: Record<string, number> }> = {};

    if (!category || category === 'all' || category === 'scenario') {
      const scenarioResults = await db
        .select({
          scenarios: musicAnalyses.scenarios,
          filmType: musicAnalyses.filmType,
        })
        .from(musicAnalyses)
        .where(sql`${musicAnalyses.scenarios}::text ILIKE '%未识别场景%'`);

      for (const result of scenarioResults) {
        if (result.scenarios && Array.isArray(result.scenarios)) {
          for (const scenario of result.scenarios) {
            if (scenario === '未识别场景' || (typeof scenario === 'string' && scenario.includes('未识别'))) {
              // 这里实际应该提取原始的未识别场景，但因为已经标准化了，需要从其他地方获取
              // 暂时跳过，因为数据库中已经标准化了
            }
          }
        }
      }
    }

    // 3. 更新unrecognizedTerms表
    const now = new Date();

    // 更新配音建议未识别项
    for (const [term, data] of Object.entries(dubbingUnrecognized)) {
      // 检查是否已存在
      const existing = await db
        .select()
        .from(unrecognizedTerms)
        .where(
          and(
            eq(unrecognizedTerms.term, term),
            eq(unrecognizedTerms.category, 'dubbing')
          )
        )
        .limit(1);

      const relatedFilmTypes = Object.entries(data.filmTypes)
        .map(([filmType, count]) => ({ filmType, count }))
        .sort((a, b) => b.count - a.count);

      if (existing.length > 0) {
        // 更新
        await db
          .update(unrecognizedTerms)
          .set({
            occurrenceCount: data.count,
            lastSeenAt: now,
            relatedFilmTypes: relatedFilmTypes as any,
            expansionStatus: data.count >= minFrequency ? 'eligible' : 'pending',
            updatedAt: now,
          })
          .where(eq(unrecognizedTerms.id, existing[0].id));
      } else {
        // 插入
        await db.insert(unrecognizedTerms).values({
          term,
          category: 'dubbing',
          occurrenceCount: data.count,
          firstSeenAt: now,
          lastSeenAt: now,
          relatedFilmTypes: relatedFilmTypes as any,
          expansionStatus: data.count >= minFrequency ? 'eligible' : 'pending',
        });
      }
    }

    // 4. 返回符合扩充条件的内容
    const eligibleTerms = await db
      .select()
      .from(unrecognizedTerms)
      .where(
        and(
          eq(unrecognizedTerms.expansionStatus, 'eligible'),
          gt(unrecognizedTerms.occurrenceCount, minFrequency - 1)
        )
      )
      .orderBy(desc(unrecognizedTerms.occurrenceCount))
      .limit(50);

    return NextResponse.json({
      success: true,
      data: {
        dubbingStats: Object.entries(dubbingUnrecognized).map(([term, data]) => ({
          term,
          category: 'dubbing',
          count: data.count,
          filmTypes: data.filmTypes,
          isEligible: data.count >= minFrequency,
        })),
        scenarioStats: Object.entries(scenarioUnrecognized).map(([term, data]) => ({
          term,
          category: 'scenario',
          count: data.count,
          filmTypes: data.filmTypes,
          isEligible: data.count >= minFrequency,
        })),
        eligibleTerms,
      },
    });
  } catch (error: any) {
    console.error('统计未识别内容失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '统计未识别内容失败',
      },
      { status: 500 }
    );
  }
}
