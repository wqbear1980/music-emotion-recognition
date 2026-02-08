import { NextRequest, NextResponse } from "next/server";
import { getDb } from "coze-coding-dev-sdk";
import { musicAnalyses } from "@/storage/database/shared/schema";
import { inArray } from "drizzle-orm";
import { S3Storage } from "coze-coding-dev-sdk";

/**
 * POST /api/cloud-music/diagnose
 * 诊断云端音乐删除失败的原因
 *
 * 请求体：{
 *   fileIds: string[]  // 要诊断的文件ID列表
 * }
 *
 * 响应：{
 *   success: true,
 *   data: {
 *     results: Array<{
 *       fileId: string,
 *       fileName: string,
 *       fileKey: string,
 *       existsInDb: boolean,
 *       isUploaded: boolean,
 *       existsInStorage: boolean | null,  // null=未检测, true=存在, false=不存在
 *       canDelete: boolean,
 *       issue: string | null,  // 问题原因
 *       recommendation: string  // 修复建议
 *     }>
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { fileIds } = await request.json();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "请提供要诊断的文件ID列表" },
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

    const results = [];

    for (const fileId of fileIds) {
      const record = records.find(r => r.id === fileId);
      
      if (!record) {
        results.push({
          fileId,
          fileName: "未知",
          fileKey: null,
          existsInDb: false,
          isUploaded: false,
          existsInStorage: null,
          canDelete: false,
          issue: "数据库中不存在该记录",
          recommendation: "该文件可能已被删除，刷新列表查看"
        });
        continue;
      }

      // 检查数据库状态
      const isUploaded = record.isUploaded === true;
      const hasFileKey = !!record.fileKey;

      // 检查对象存储中的文件是否存在
      let existsInStorage: boolean | null = null;
      let storageError: string | null = null;

      if (hasFileKey) {
        try {
          // 尝试读取文件（只读取1个字节来检查是否存在）
          // 注意：这里会实际读取文件内容，但只读1字节
          const data = await storage.readFile({ fileKey: record.fileKey! });
          existsInStorage = !!data && data.length > 0;
          console.log(`[诊断] 文件存在: ${record.fileName} (${data.length} bytes)`);
        } catch (error: any) {
          storageError = error.message;
          // 如果返回404或类似错误，说明文件不存在
          if (error.message?.includes('404') || error.message?.includes('NoSuchKey') || error.message?.includes('不存在')) {
            existsInStorage = false;
            console.log(`[诊断] 文件不存在: ${record.fileName}`);
          } else {
            // 其他错误，不确定是否存在
            existsInStorage = null;
            console.warn(`[诊断] 无法验证文件是否存在: ${record.fileName}`, error);
          }
        }
      }

      // 分析问题
      let issue: string | null = null;
      let recommendation: string = "";
      let canDelete = false;

      if (!isUploaded) {
        issue = "数据库显示该文件未上传到云端";
        recommendation = "直接强制修复：清除fileKey并标记为未上传";
        canDelete = true;
      } else if (!hasFileKey) {
        issue = "数据库中fileKey为空，无法定位云端文件";
        recommendation = "直接强制修复：标记为未上传";
        canDelete = true;
      } else if (existsInStorage === false) {
        issue = "对象存储中不存在该文件（可能已被删除）";
        recommendation = "强制修复：清除fileKey并标记为未上传";
        canDelete = true;
      } else if (existsInStorage === null) {
        issue = `无法验证对象存储中的文件状态: ${storageError || '未知错误'}`;
        recommendation = "建议重试删除，或联系管理员检查存储服务";
        canDelete = false;
      } else if (existsInStorage === true) {
        issue = "文件在对象存储中存在，但删除失败";
        recommendation = "可能的原因：\n1. 网络问题导致删除请求超时\n2. 存储服务临时不可用\n3. 权限问题\n建议：重试删除，或使用强制删除功能";
        canDelete = true;
      }

      results.push({
        fileId,
        fileName: record.fileName,
        fileKey: record.fileKey || null,
        existsInDb: true,
        isUploaded,
        existsInStorage,
        canDelete,
        issue,
        recommendation
      });
    }

    return NextResponse.json({
      success: true,
      data: { results }
    });
  } catch (error: any) {
    console.error("[云端音乐诊断] API调用失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "诊断失败"
      },
      { status: 500 }
    );
  }
}
