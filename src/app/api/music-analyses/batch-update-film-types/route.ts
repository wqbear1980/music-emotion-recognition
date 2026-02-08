import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";
import { STANDARD_TERMS } from "@/lib/standardTerms";

/**
 * POST /api/music-analyses/batch-update-film-types
 * 批量更新影片类型字段
 * 根据filmScenes字段自动推断并更新filmType
 */
export async function POST(request: NextRequest) {
  try {
    // 获取所有分析记录
    const allAnalyses = await musicAnalysisManager.getAnalyses({
      skip: 0,
      limit: 10000, // 足够大的值
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // 标准影片类型列表
    const standardFilmTypes = STANDARD_TERMS.filmTypes.getAllStandardTypes();

    // 遍历所有记录
    for (const analysis of allAnalyses) {
      try {
        // 如果已经有filmType，跳过
        if (analysis.filmType && analysis.filmType !== '未分类') {
          skippedCount++;
          continue;
        }

        // 从filmScenes推断影片类型
        let inferredType = '未分类';

        if (analysis.filmScenes && analysis.filmScenes.length > 0) {
          // 遍历filmScenes，尝试匹配标准类型
          for (const scene of analysis.filmScenes) {
            // 标准化场景名称
            const standardizedType = STANDARD_TERMS.filmTypes.standardize(scene);

            // 如果匹配到标准类型
            if (standardizedType !== '未分类') {
              inferredType = standardizedType;
              break;
            }

            // 检查是否为标准类型本身
            if (standardFilmTypes.includes(scene)) {
              inferredType = scene;
              break;
            }
          }

          // 如果仍然未分类，尝试从情绪词推断
          if (inferredType === '未分类' && analysis.emotionTags && analysis.emotionTags.length > 0) {
            // 获取主要情绪词
            const primaryMood = analysis.emotionTags[0];

            // 遍历所有影片类型的情绪词池
            for (const [filmType, moodList] of Object.entries(STANDARD_TERMS.filmTypeToMoods)) {
              if (moodList.includes(primaryMood)) {
                inferredType = filmType;
                break;
              }
            }
          }
        }

        // 更新记录
        await musicAnalysisManager.updateAnalysis(analysis.id, {
          filmType: inferredType,
        });

        updatedCount++;
      } catch (error: any) {
        errors.push(`更新记录 ${analysis.fileName} 失败: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedCount,
        skippedCount,
        total: allAnalyses.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `成功更新 ${updatedCount} 条记录，跳过 ${skippedCount} 条记录`,
    });
  } catch (error: any) {
    console.error("批量更新影片类型失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "批量更新影片类型失败",
      },
      { status: 500 }
    );
  }
}
