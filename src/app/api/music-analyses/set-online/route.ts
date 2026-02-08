import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * POST /api/music-analyses/set-online
 * 根据文件名更新记录的在线状态
 * Body: { fileName: string, isOnline: boolean, fileKey?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { fileName, isOnline, fileKey } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { success: false, error: "缺少文件名参数" },
        { status: 400 }
      );
    }

    // 根据文件名查找记录
    const existing = await musicAnalysisManager.getAnalysisByFileName(fileName);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "未找到该文件的分析记录" },
        { status: 404 }
      );
    }

    // 更新在线状态
    const updateData: any = { isOnline };

    // 如果设置为在线，同时更新 isUploaded 为 true
    // 因为文件已上传到对象存储，应该标记为已上传
    if (isOnline) {
      updateData.isUploaded = true;
    }

    // 如果提供了 fileKey，也一并更新
    if (fileKey) {
      updateData.fileKey = fileKey;
    }

    const updated = await musicAnalysisManager.updateAnalysis(existing.id, updateData);

    return NextResponse.json({
      success: true,
      data: {
        id: updated?.id,
        fileName: updated?.fileName,
        isOnline: updated?.isOnline,
      },
    });
  } catch (error: any) {
    console.error("Error setting online status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to set online status",
      },
      { status: 500 }
    );
  }
}
