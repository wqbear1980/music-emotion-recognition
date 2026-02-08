import { NextRequest, NextResponse } from "next/server";
import { getDb } from "coze-coding-dev-sdk";
import { musicAnalyses } from "@/storage/database/shared/schema";
import { eq, inArray } from "drizzle-orm";
import { S3Storage } from "coze-coding-dev-sdk";

/**
 * POST /api/cloud-music/delete
 * 从云端删除音乐文件（仅删除云端，不影响本地文件）
 *
 * 请求体：{
 *   fileIds: string[]  // 要删除的文件ID列表
 * }
 *
 * 响应：{
 *   success: true,
 *   data: {
 *     deleted: Array<{ fileId: string, fileName: string }>,
 *     failed: Array<{ fileId: string, fileName: string, error: string }>
 *   }
 * }
 *
 * 业务逻辑：
 * 1. 根据fileIds查询数据库记录
 * 2. 从对象存储删除文件
 * 3. 更新数据库记录（isUploaded=false, uploadedAt=null, fileKey=null）
 * 4. 返回删除结果
 */
export async function POST(request: NextRequest) {
  try {
    const { fileIds } = await request.json();

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

    // 【性能优化】只查询要删除的文件，避免查询所有已上传记录
    const records = await db
      .select()
      .from(musicAnalyses)
      .where(inArray(musicAnalyses.id, fileIds));

    const results = {
      deleted: [] as Array<{ fileId: string, fileName: string }>,
      failed: [] as Array<{ fileId: string, fileName: string, error: string }>
    };

    // 处理每个文件
    for (const fileId of fileIds) {
      try {
        const record = records.find(r => r.id === fileId);

        if (!record) {
          results.failed.push({
            fileId,
            fileName: "未知",
            error: "未找到该文件记录或文件未上传"
          });
          console.warn(`[云端删除] 文件记录不存在: ${fileId}`);
          continue;
        }

        if (!record.fileKey) {
          results.failed.push({
            fileId,
            fileName: record.fileName,
            error: "文件fileKey为空，可能未成功上传"
          });
          console.warn(`[云端删除] fileKey为空: ${fileId} - ${record.fileName}`);
          continue;
        }

        // 【优化】添加重试机制，最多重试3次
        let deleted = false;
        let lastError: any = null;

        for (let retry = 1; retry <= 3; retry++) {
          try {
            console.log(`[云端删除] 删除文件 (第${retry}次尝试): ${record.fileName} (${record.fileKey})`);
            
            // 设置超时（10秒）
            const deletePromise = storage.deleteFile({ fileKey: record.fileKey });
            const timeoutPromise = new Promise<boolean>((_, reject) => {
              setTimeout(() => reject(new Error("删除超时（10秒）")), 10000);
            });

            deleted = await Promise.race([deletePromise, timeoutPromise]) as boolean;
            
            if (deleted) {
              console.log(`[云端删除] 成功删除: ${record.fileName}`);
              break;
            } else {
              lastError = new Error("删除返回false");
              console.warn(`[云端删除] 第${retry}次尝试失败: ${record.fileName}`);
            }
          } catch (error: any) {
            lastError = error;
            console.error(`[云端删除] 第${retry}次尝试异常:`, error);
            
            // 如果不是最后一次重试，等待一段时间再重试
            if (retry < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retry)); // 1秒、2秒后重试
            }
          }
        }

        if (!deleted) {
          results.failed.push({
            fileId,
            fileName: record.fileName,
            error: lastError?.message || "删除云端文件失败（已重试3次）"
          });
          console.error(`[云端删除] 彻底失败: ${record.fileName}`, lastError);
          continue;
        }

        // 更新数据库记录（保留本地状态，仅清除云端状态）
        try {
          await db
            .update(musicAnalyses)
            .set({
              fileKey: null,
              isUploaded: false,
              isOnline: false, // 文件已从云端删除，不在线
              uploadedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(musicAnalyses.id, fileId));
          
          console.log(`[云端删除] 数据库已更新: ${record.fileName}`);
        } catch (dbError: any) {
          console.error(`[云端删除] 数据库更新失败: ${record.fileName}`, dbError);
          // 即使数据库更新失败，也认为删除成功（因为文件已经从云端删除）
        }

        results.deleted.push({
          fileId,
          fileName: record.fileName,
        });
      } catch (error: any) {
        console.error(`[云端删除] 处理文件 ${fileId} 时发生未捕获的异常:`, error);
        results.failed.push({
          fileId,
          fileName: "未知",
          error: error.message || "删除失败"
        });
      }
    }

    console.log(`[云端删除] 批量删除完成: 成功 ${results.deleted.length} 个, 失败 ${results.failed.length} 个`);
    
    return NextResponse.json({
      success: true,
      data: results,
      message: `成功删除 ${results.deleted.length} 个文件，失败 ${results.failed.length} 个`
    });
  } catch (error: any) {
    console.error("[云端删除] API调用失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "删除文件失败"
      },
      { status: 500 }
    );
  }
}
