import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

/**
 * 上传音乐文件到对象存储（支持大文件流式上传）
 * POST /api/upload-music
 * Headers:
 *   - x-file-name: 文件名
 *   - x-file-size: 文件大小（字节）
 * Body: 二进制文件流
 */
export async function POST(request: NextRequest) {
  try {
    // 初始化对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    // 从请求头获取文件元数据
    const encodedFileName = request.headers.get('x-file-name') || '';
    const fileName = encodedFileName ? decodeURIComponent(encodedFileName) : `music-${Date.now()}.mp3`;
    const fileSize = request.headers.get('x-file-size');
    const contentType = request.headers.get('content-type') || 'audio/mpeg';

    // 验证文件大小（限制200MB）
    if (fileSize) {
      const maxSize = 200 * 1024 * 1024; // 200MB
      const size = parseInt(fileSize, 10);
      if (size > maxSize) {
        return NextResponse.json(
          { success: false, error: `文件大小超过限制（最大200MB），当前文件大小：${(size / 1024 / 1024).toFixed(2)}MB` },
          { status: 413 }
        );
      }
    }

    // 验证文件类型（音频文件）
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/ogg',
      'audio/x-m4a',
      'audio/mp4',
      'audio/flac',
      'audio/x-flac',
    ];

    // 验证文件类型
    if (!allowedTypes.includes(contentType) && !fileName.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
      return NextResponse.json(
        { success: false, error: '不支持的文件类型，请上传音频文件' },
        { status: 400 }
      );
    }

    // 直接使用请求体流上传到对象存储
    const stream = request.body;
    if (!stream) {
      return NextResponse.json(
        { success: false, error: '未找到文件流' },
        { status: 400 }
      );
    }

    // 生成安全的文件名
    const safeName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\s+/g, '_');
    const fileKey = `music/${safeName}`;

    // 使用流式上传，避免请求体大小限制问题
    // 将 ReadableStream 转换为 Node.js Readable 流
    const { Readable } = await import('stream');
    const nodeStream = Readable.fromWeb(stream as any);

    const uploadedFileKey = await storage.streamUploadFile({
      stream: nodeStream as any,
      fileName: fileKey,
      contentType,
    });

    console.log('文件上传成功:', uploadedFileKey);

    // 返回文件 key
    return NextResponse.json({
      success: true,
      data: {
        fileKey: uploadedFileKey,
        fileName: safeName,
        fileSize: fileSize ? parseInt(fileSize, 10) : 0,
      },
    });
  } catch (error) {
    console.error('上传文件失败:', error);

    // 详细记录错误信息
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const errorStack = error instanceof Error ? error.stack : '';

    return NextResponse.json(
      {
        success: false,
        error: `上传文件失败: ${errorMessage}`,
        details: errorStack,
      },
      { status: 500 }
    );
  }
}
