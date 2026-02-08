import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * GET /api/music-analyses/stats/[category]
 * 获取指定分类维度的统计信息
 * 
 * 路径参数：
 * - category: 分类维度（emotion, film, scenario, instrument, style）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;

    // 验证分类维度是否有效
    const validCategories = [
      "emotion",
      "film",
      "scenario",
      "instrument",
      "style",
    ];

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category. Valid categories are: ${validCategories.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    const stats = await musicAnalysisManager.getCategoryStats(
      category as
        | "emotion"
        | "film"
        | "scenario"
        | "instrument"
        | "style"
    );

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching category stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch category stats",
      },
      { status: 500 }
    );
  }
}
