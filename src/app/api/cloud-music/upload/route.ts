import { NextRequest, NextResponse } from "next/server";
import { getDb } from "coze-coding-dev-sdk";
import { musicAnalyses } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/cloud-music/upload
 * 更新文件的云端上传状态（前端直接上传后调用此接口更新数据库）
 *
 * 由于系统采用纯本地分析架构，文件只在浏览器内存中，服务器无法访问
 * 因此采用以下流程：
 * 1. 前端使用对象存储SDK直接上传文件到云端
 * 2. 上传成功后，调用此接口更新数据库记录
 *
 * 请求体：{
 *   fileId: string,
 *   fileKey: string,  // 对象存储返回的实际key
 * }
 *
 * 响应：{
 *   success: true,
 *   data: {
 *     fileId: string,
 *     fileName: string,
 *     fileKey: string,
 *     uploadedAt: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { fileId, fileKey } = await request.json();

    if (!fileId || !fileKey) {
      return NextResponse.json(
        { success: false, error: "缺少fileId或fileKey参数" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // 查询文件记录
    const records = await db
      .select()
      .from(musicAnalyses)
      .where(eq(musicAnalyses.id, fileId));

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: "未找到该文件记录" },
        { status: 404 }
      );
    }

    const record = records[0];

    // 更新数据库记录
    const now = new Date();
    await db
      .update(musicAnalyses)
      .set({
        fileKey: fileKey,
        isUploaded: true,
        uploadedAt: now,
        updatedAt: now,
      })
      .where(eq(musicAnalyses.id, fileId));

    return NextResponse.json({
      success: true,
      data: {
        fileId: record.id,
        fileName: record.fileName,
        fileKey: fileKey,
        uploadedAt: now.toISOString(),
      },
      message: `文件"${record.fileName}"上传成功`
    });
  } catch (error: any) {
    console.error("Error updating upload status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "更新上传状态失败"
      },
      { status: 500 }
    );
  }
}
