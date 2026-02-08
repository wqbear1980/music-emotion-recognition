import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * GET /api/music-analyses/stats
 * 获取所有分类的统计概览
 * 返回每个分类维度下各标签的音乐数量统计
 */
export async function GET(request: NextRequest) {
  try {
    const stats = await musicAnalysisManager.getAllCategoryStats();

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
