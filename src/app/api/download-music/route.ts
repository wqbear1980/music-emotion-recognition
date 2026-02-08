import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { musicAnalyses } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * 下载单首音乐
 * GET /api/download-music?id={recordId}
 */
export async function GET(request: NextRequest) {
  try {
    // 获取数据库实例
    const db = await getDb();

    // 初始化对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    // 获取记录 ID
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('id');

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: '缺少记录 ID' },
        { status: 400 }
      );
    }

    // 查询数据库获取文件信息
    const records = await db
      .select({
        fileName: musicAnalyses.fileName,
        fileKey: musicAnalyses.fileKey,
      })
      .from(musicAnalyses)
      .where(eq(musicAnalyses.id, recordId))
      .limit(1);

    if (!records || records.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到音乐记录' },
        { status: 404 }
      );
    }

    const record = records[0];

    // 检查是否有 fileKey
    if (!record.fileKey) {
      return NextResponse.json(
        { success: false, error: '该音乐文件未上传到对象存储，无法下载' },
        { status: 400 }
      );
    }

    // 生成签名 URL（有效期 1 小时）
    const downloadUrl = await storage.generatePresignedUrl({
      key: record.fileKey,
      expireTime: 3600, // 1 小时
    });

    // 返回下载 URL
    return NextResponse.json({
      success: true,
      data: {
        fileName: record.fileName,
        downloadUrl,
      },
    });
  } catch (error) {
    console.error('下载音乐失败:', error);
    return NextResponse.json(
      { success: false, error: '下载音乐失败' },
      { status: 500 }
    );
  }
}
