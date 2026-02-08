import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";
import { getDb } from "coze-coding-dev-sdk";
import { musicAnalyses } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/cloud-music/upload-file
 * 上传音乐文件到对象存储（支持多文件批量上传）
 *
 * 由于前端无法直接使用对象存储 SDK（后端专用），因此通过此 API 处理上传
 *
 * 请求体（multipart/form-data）：
 * - files: File[]  （多个文件）
 *
 * 响应：{
 *   success: true,
 *   data: {
 *     uploadedFiles: Array<{
 *       fileId: string,
 *       fileName: string,
 *       fileKey: string,
 *       uploadedAt: string
 *     }>,
 *     failedFiles: Array<{
 *       fileName: string,
 *       error: string
 *     }>
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[upload-file] 开始处理上传请求');

    // 解析表单数据
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    console.log(`[upload-file] 收到 ${files.length} 个文件`);

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "没有上传文件" },
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

    console.log('[upload-file] 对象存储初始化完成');

    const db = await getDb();
    const uploadedFiles: any[] = [];
    const failedFiles: any[] = [];

    // 批量上传文件
    for (const file of files) {
      try {
        console.log(`[upload-file] 开始处理文件: ${file.name}, 大小: ${file.size} 字节`);

        // 检查文件大小
        const maxSize = 200 * 1024 * 1024; // 200MB
        if (file.size > maxSize) {
          console.log(`[upload-file] 文件"${file.name}"大小超过限制`);
          failedFiles.push({
            fileName: file.name,
            error: `文件大小超过限制（最大200MB）`
          });
          continue;
        }

        // 尝试解码文件名（如果文件名被编码过）
        let decodedFileName = file.name;
        try {
          decodedFileName = decodeURIComponent(file.name);
        } catch {
          // 解码失败，使用原始文件名
          console.log(`[upload-file] 文件名解码失败，使用原始文件名: ${file.name}`);
        }

        console.log(`[upload-file] 查询数据库，文件名: "${decodedFileName}"`);

        // 查询数据库记录（尝试解码后的文件名）
        let records = await db
          .select()
          .from(musicAnalyses)
          .where(eq(musicAnalyses.fileName, decodedFileName));

        // 如果没找到，尝试使用原始文件名查询
        if (records.length === 0 && decodedFileName !== file.name) {
          console.log(`[upload-file] 使用解码文件名未找到记录，尝试使用原始文件名: "${file.name}"`);
          records = await db
            .select()
            .from(musicAnalyses)
            .where(eq(musicAnalyses.fileName, file.name));
        }

        // 如果还是没找到，尝试模糊匹配（查询所有记录，看是否有相似的文件名）
        if (records.length === 0) {
          console.log(`[upload-file] 精确匹配未找到记录，尝试模糊匹配...`);

          // 查询所有记录
          const allRecords = await db
            .select({ fileName: musicAnalyses.fileName })
            .from(musicAnalyses);

          console.log(`[upload-file] 数据库中共有 ${allRecords.length} 条记录`);
          console.log(`[upload-file] 数据库中的文件名列表:`, allRecords.map(r => r.fileName).join(', '));

          // 尝试模糊匹配（忽略大小写）
          const matchedRecord = allRecords.find(r =>
            r.fileName.toLowerCase() === decodedFileName.toLowerCase() ||
            r.fileName.toLowerCase() === file.name.toLowerCase()
          );

          if (matchedRecord) {
            console.log(`[upload-file] 模糊匹配成功: "${matchedRecord.fileName}"`);
            records = await db
              .select()
              .from(musicAnalyses)
              .where(eq(musicAnalyses.fileName, matchedRecord.fileName));
          }
        }

        if (records.length === 0) {
          console.log(`[upload-file] 未找到文件"${file.name}"的数据库记录`);
          failedFiles.push({
            fileName: file.name,
            error: "未找到该文件在数据库中的记录，请确保该文件已完成分析并保存到数据库"
          });
          continue;
        }

        const record = records[0];
        console.log(`[upload-file] 找到数据库记录，ID: ${record.id}`);

        // 将文件转换为 ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`[upload-file] 文件转换为Buffer完成，准备上传到对象存储`);

        // 上传到对象存储
        const fileKey = await storage.uploadFile({
          fileContent: buffer,
          fileName: `music/${file.name}`,
          contentType: file.type || 'audio/mpeg',
        });

        console.log(`[upload-file] 文件"${file.name}"上传到对象存储成功，fileKey: ${fileKey}`);

        // 更新数据库记录
        const now = new Date();
        await db
          .update(musicAnalyses)
          .set({
            fileKey: fileKey,
            isUploaded: true,
            isOnline: true, // 文件已上传到对象存储，可以在线访问
            uploadedAt: now,
            updatedAt: now,
          })
          .where(eq(musicAnalyses.id, record.id));

        console.log(`[upload-file] 数据库记录更新成功`);

        uploadedFiles.push({
          fileId: record.id,
          fileName: file.name,
          fileKey: fileKey,
          uploadedAt: now.toISOString(),
        });
      } catch (error: any) {
        console.error(`[upload-file] 上传文件"${file.name}"失败:`, error);
        console.error(`[upload-file] 错误堆栈:`, error.stack);
        failedFiles.push({
          fileName: file.name,
          error: error.message || "上传失败"
        });
      }
    }

    console.log(`[upload-file] 上传完成，成功 ${uploadedFiles.length} 个，失败 ${failedFiles.length} 个`);

    return NextResponse.json({
      success: true,
      data: {
        uploadedFiles,
        failedFiles,
      },
      message: `成功上传 ${uploadedFiles.length} 个文件，失败 ${failedFiles.length} 个文件`
    });
  } catch (error: any) {
    console.error("[upload-file] Error uploading files:", error);
    console.error("[upload-file] 错误堆栈:", error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "文件上传失败"
      },
      { status: 500 }
    );
  }
}
