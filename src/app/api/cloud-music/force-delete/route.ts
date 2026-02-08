import { NextRequest, NextResponse } from "next/server";
import { getDb } from "coze-coding-dev-sdk";
import { musicAnalyses } from "@/storage/database/shared/schema";
import { eq, inArray } from "drizzle-orm";
import { S3Storage } from "coze-coding-dev-sdk";

/**
 * POST /api/cloud-music/force-delete
 * 强制删除云端音乐（跳过对象存储删除，直接更新数据库）
 *
 * ⚠️ 警告：此API会强制更新数据库状态，即使文件可能仍存在于对象存储中
 *
 * 请求体：{
 *   fileIds: string[]  // 要强制删除的文件ID列表
 *   force: boolean     // 是否强制删除（即使对象存储删除失败）
 * }
 *
 * 响应：{
 *   success: true,
 *   data: {
 *     deleted: Array<{ fileId: string, fileName: string }>,
 *     failed: Array<{ fileId: string, fileName: string, error: string }>
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { fileIds, force = false } = await request.json();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "请提供要删除的文件ID列表" },
        { status: 400 }
      );
    }

    // 初始化对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });

    const db = await getDb();

    // 查询数据库记录
    const records = await db
      .select()
      .from(musicAnalyses)
      .where(inArray(musicAnalyses.id, fileIds));

    const results = {
      deleted: [] as Array<{ fileId: string, fileName: string }>,
      failed: [] as Array<{ fileId: string, fileName: string, error: string }>
    };

    for (const fileId of fileIds) {
      try {
        const record = records.find(r => r.id === fileId);

        if (!record) {
          results.failed.push({
            fileId,
            fileName: "未知",
            error: "数据库中不存在该记录"
          });
          continue;
        }

        let storageDeleted = false;
        let storageError: string | null = null;

        // 如果有fileKey，尝试从对象存储删除
        if (record.fileKey) {
          try {
            storageDeleted = await storage.deleteFile({ fileKey: record.fileKey });
            console.log(`[强制删除] 对象存储删除${storageDeleted ? '成功' : '失败'}: ${record.fileName}`);
          } catch (error: any) {
            storageError = error.message;
            console.error(`[强制删除] 对象存储删除失败: ${record.fileName}`, error);
          }
        }

        // 如果强制删除，或者对象存储删除成功，或者没有fileKey，则更新数据库
        if (force || storageDeleted || !record.fileKey) {
          await db
            .update(musicAnalyses)
            .set({
              fileKey: null,
              isUploaded: false,
              isOnline: false,
              uploadedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(musicAnalyses.id, fileId));

          console.log(`[强制删除] 数据库已更新: ${record.fileName}`);

          results.deleted.push({
            fileId,
            fileName: record.fileName,
          });
        } else {
          results.failed.push({
            fileId,
            fileName: record.fileName,
            error: storageError || "对象存储删除失败且未启用强制模式"
          });
        }
      } catch (error: any) {
        console.error(`[强制删除] 处理文件 ${fileId} 时发生异常:`, error);
        results.failed.push({
          fileId,
          fileName: "未知",
          error: error.message || "删除失败"
        });
      }
    }

    console.log(`[强制删除] 批量删除完成: 成功 ${results.deleted.length} 个, 失败 ${results.failed.length} 个`);

    return NextResponse.json({
      success: true,
      data: results,
      message: force 
        ? `强制删除完成：成功 ${results.deleted.length} 个，失败 ${results.failed.length} 个（可能仍存在于对象存储中）`
        : `删除完成：成功 ${results.deleted.length} 个，失败 ${results.failed.length} 个`
    });
  } catch (error: any) {
    console.error("[强制删除] API调用失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "强制删除失败"
      },
      { status: 500 }
    );
  }
}
