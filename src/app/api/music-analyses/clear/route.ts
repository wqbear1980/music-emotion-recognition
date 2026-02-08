import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * DELETE /api/music-analyses/clear
 * 将所有在线记录设置为未在线状态
 * 此操作不删除记录，只是将is_online字段设置为false
 */
export async function DELETE(request: NextRequest) {
  try {
    // 获取当前所有在线记录
    const onlineRecords = await musicAnalysisManager.getAnalyses({
      skip: 0,
      limit: 10000,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    // 过滤出在线的记录
    const onlineCount = onlineRecords.filter(r => (r as any).isOnline).length;

    // 将所有在线记录设置为未在线状态
    const updatedCount = await musicAnalysisManager.setAllOffline();

    return NextResponse.json({
      success: true,
      message: `成功将 ${updatedCount} 条记录状态设置为"未在线"`,
      updatedCount,
      onlineCount,
    });
  } catch (error: any) {
    console.error("Error setting music analyses offline:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to set music analyses offline",
      },
      { status: 500 }
    );
  }
}
