import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * POST /api/music-analyses/set-all-online
 * 批量修复所有音乐记录的 is_online 字段
 *
 * 将所有未上传到云端的音乐（is_uploaded = false）的 is_online 设置为 true
 * 用于修复历史数据中的状态错误
 *
 * 请求体：{}
 * 响应：
 * {
 *   success: true,
 *   data: {
 *     updated: number,  // 更新的记录数
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 执行批量更新
    const updatedCount = await musicAnalysisManager.setAllOnline();

    return NextResponse.json({
      success: true,
      data: {
        updated: updatedCount,
      },
      message: `已将 ${updatedCount} 条记录的 is_online 设置为 true`,
    });
  } catch (error: any) {
    console.error("Error setting all records online:", error);

    const errorDetails = {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
    };

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to set all records online",
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
