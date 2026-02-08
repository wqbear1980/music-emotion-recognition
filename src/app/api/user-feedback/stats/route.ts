import { NextRequest, NextResponse } from 'next/server';
import { getRawClient } from '@/storage/database/rawClient';

/**
 * GET /api/user-feedback/stats
 * 获取用户反馈统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const client = await getRawClient();

    // 总体统计
    const totalStatsQuery = `
      SELECT
        COUNT(*) as "totalFeedbacks",
        SUM(CASE WHEN feedback_type = 'correct' THEN 1 ELSE 0 END) as "correctCount",
        SUM(CASE WHEN feedback_type = 'incorrect' THEN 1 ELSE 0 END) as "incorrectCount",
        SUM(CASE WHEN feedback_type = 'partial' THEN 1 ELSE 0 END) as "partialCount",
        SUM(CASE WHEN is_processed = true THEN 1 ELSE 0 END) as "processedCount",
        AVG(quality_score) as "avgQualityScore"
      FROM user_feedback
    `;

    const totalStatsResult = await client.query(totalStatsQuery);
    const totalStats = totalStatsResult.rows[0];

    const totalFeedbacks = Number(totalStats.totalFeedbacks) || 0;
    const accuracyRate = totalFeedbacks > 0
      ? ((Number(totalStats.correctCount) / totalFeedbacks) * 100).toFixed(2)
      : '0.00';

    // 按影片类型统计准确率
    const accuracyByFilmTypeQuery = `
      SELECT
        ma.film_type as "filmType",
        COUNT(*) as "totalFeedbacks",
        SUM(CASE WHEN uf.feedback_type = 'correct' THEN 1 ELSE 0 END) as "correctCount"
      FROM user_feedback uf
      INNER JOIN music_analyses ma ON uf.analysis_id = ma.id
      GROUP BY ma.film_type
      HAVING COUNT(*) >= 3
      ORDER BY "correctCount" DESC
    `;

    const accuracyByFilmTypeResult = await client.query(accuracyByFilmTypeQuery);
    const accuracyByFilmTypeWithRate = accuracyByFilmTypeResult.rows.map((item: any) => ({
      filmType: item.filmType || '未分类',
      accuracyRate: Number(item.totalFeedbacks) > 0
        ? ((Number(item.correctCount) / Number(item.totalFeedbacks)) * 100).toFixed(2)
        : '0.00',
      totalFeedbacks: Number(item.totalFeedbacks),
    }));

    // 按情绪统计准确率（简化版，不使用jsonb_array_elements）
    const accuracyByMoodQuery = `
      SELECT
        ma.summary as mood,
        COUNT(*) as "totalFeedbacks",
        SUM(CASE WHEN uf.feedback_type = 'correct' THEN 1 ELSE 0 END) as "correctCount"
      FROM user_feedback uf
      INNER JOIN music_analyses ma ON uf.analysis_id = ma.id
      GROUP BY ma.summary
      HAVING COUNT(*) >= 3
      ORDER BY "correctCount" DESC
      LIMIT 10
    `;

    const accuracyByMoodResult = await client.query(accuracyByMoodQuery);
    const accuracyByMoodWithRate = accuracyByMoodResult.rows.map((item: any) => ({
      mood: item.mood || '未知',
      accuracyRate: Number(item.totalFeedbacks) > 0
        ? ((Number(item.correctCount) / Number(item.totalFeedbacks)) * 100).toFixed(2)
        : '0.00',
      totalFeedbacks: Number(item.totalFeedbacks),
    }));

    // 常见错误分析（简化版）
    const commonErrorsQuery = `
      SELECT
        corrected_fields as "correctedFields",
        COUNT(*) as "frequency"
      FROM user_feedback
      WHERE feedback_type = 'incorrect'
        AND corrected_fields IS NOT NULL
        AND corrected_fields::text != '{}'
      GROUP BY corrected_fields
      ORDER BY "frequency" DESC
      LIMIT 10
    `;

    const commonErrorsResult = await client.query(commonErrorsQuery);
    const commonErrors = commonErrorsResult.rows.map((item: any) => {
      let field = '未知';
      let incorrectValue = '未知';
      let correctValue = '未知';

      try {
        const correctedFields = typeof item.correctedFields === 'string'
          ? JSON.parse(item.correctedFields)
          : item.correctedFields;

        if (correctedFields && typeof correctedFields === 'object') {
          const keys = Object.keys(correctedFields);
          if (keys.length > 0) {
            field = keys[0];
            const fieldData = correctedFields[field];
            if (fieldData) {
              incorrectValue = fieldData.original || '未知';
              correctValue = fieldData.corrected || '未知';
            }
          }
        }
      } catch (e) {
        // 解析失败，使用默认值
      }

      return {
        field,
        incorrectValue,
        correctValue,
        frequency: Number(item.frequency),
      };
    });

    // 时间趋势（最近30天）
    const trendQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as "count",
        SUM(CASE WHEN feedback_type = 'correct' THEN 1 ELSE 0 END) as correct
      FROM user_feedback
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;

    const trendResult = await client.query(trendQuery);
    const accuracyTrend = trendResult.rows.map((item: any) => ({
      date: item.date || '未知',
      count: Number(item.count),
      correct: Number(item.correct),
      accuracyRate: Number(item.count) > 0
        ? ((Number(item.correct) / Number(item.count)) * 100).toFixed(2)
        : '0.00',
    }));

    return NextResponse.json({
      success: true,
      data: {
        overall: {
          totalFeedbacks: Number(totalStats.totalFeedbacks) || 0,
          correctCount: Number(totalStats.correctCount) || 0,
          incorrectCount: Number(totalStats.incorrectCount) || 0,
          partialCount: Number(totalStats.partialCount) || 0,
          processedCount: Number(totalStats.processedCount) || 0,
          accuracyRate: `${accuracyRate}%`,
          avgQualityScore: totalStats.avgQualityScore ? Number(totalStats.avgQualityScore).toFixed(2) : null,
        },
        accuracyByFilmType: accuracyByFilmTypeWithRate,
        accuracyByMood: accuracyByMoodWithRate,
        commonErrors,
        accuracyTrend,
      },
    });
  } catch (error: any) {
    console.error('[用户反馈] 获取统计数据失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '获取统计数据失败'
    }, { status: 500 });
  }
}
