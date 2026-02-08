import { NextRequest, NextResponse } from 'next/server';
import { parseBuffer } from 'music-metadata';

/**
 * 音频元数据提取API
 * 从音频文件中提取ID3标签等元数据信息
 */

interface AudioMetadata {
  title?: string; // 歌曲标题
  artist?: string; // 艺术家
  album?: string; // 专辑
  year?: number; // 发行年份
  track?: number; // 曲目序号
  genre?: string; // 流派
  duration?: number; // 时长（秒）
  format?: string; // 音频格式
  bitrate?: number; // 比特率
  sampleRate?: number; // 采样率
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: '未提供音频文件' },
        { status: 400 }
      );
    }

    // 将文件转换为Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 提取元数据
    const metadata = await parseBuffer(buffer, {
      mimeType: audioFile.type,
    });

    // 构建返回的元数据对象
    const audioMetadata: AudioMetadata = {
      title: metadata.common.title || undefined,
      artist: metadata.common.artist || undefined,
      album: metadata.common.album || undefined,
      year: metadata.common.year || undefined,
      track: metadata.common.track?.no || undefined,
      genre: metadata.common.genre?.[0] || undefined,
      duration: metadata.format.duration || undefined,
      format: metadata.format.container || audioFile.type,
      bitrate: metadata.format.bitrate || undefined,
      sampleRate: metadata.format.sampleRate || undefined,
    };

    return NextResponse.json({
      success: true,
      metadata: audioMetadata,
    });
  } catch (error) {
    console.error('提取音频元数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '提取音频元数据失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
