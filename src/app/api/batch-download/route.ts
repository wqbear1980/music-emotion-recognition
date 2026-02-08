import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { musicAnalyses } from '@/storage/database/shared/schema';
import { sql, and, inArray } from 'drizzle-orm';
import JSZip from 'jszip';

interface DownloadRecord {
  id: string;
  fileName: string;
  fileKey: string | null;
  summary: string | null;
  filmType: string | null;
  scenarios: string[] | null;
  emotionTags: string[] | null;
  styles: string[] | null;
  isOnline: boolean;
  isUploaded: boolean;
}

/**
 * 批量打包下载音乐
 * POST /api/batch-download
 * Body: {
 *   recordIds?: string[],  // 可选：指定要下载的记录ID列表
 *   packBy?: 'emotion' | 'filmType' | 'scenario' | 'style' | 'none',  // 打包方式
 *   filters?: {  // 可选：按分类筛选
 *     emotions?: string[],
 *     filmTypes?: string[],
 *     scenarios?: string[],
 *     styles?: string[],
 *   },
 *   statusFilter?: 'online' | 'cloud' | 'all',  // 可选：状态筛选，online=仅在线，cloud=仅云端，all=所有
 *   checkOnly?: boolean,  // 可选：仅检查，不下载，返回未在线文件信息
 * }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { recordIds, packBy = 'none', filters, statusFilter, checkOnly = false } = body;

    // 查询符合条件的音乐记录
    let records: DownloadRecord[];

    // 如果指定了记录ID，只查询这些记录
    if (recordIds && Array.isArray(recordIds) && recordIds.length > 0) {
      records = (await db
        .select({
          id: musicAnalyses.id,
          fileName: musicAnalyses.fileName,
          fileKey: musicAnalyses.fileKey,
          summary: musicAnalyses.summary,
          filmType: musicAnalyses.filmType,
          scenarios: musicAnalyses.scenarios,
          emotionTags: musicAnalyses.emotionTags,
          styles: musicAnalyses.styles,
          isOnline: musicAnalyses.isOnline,
          isUploaded: musicAnalyses.isUploaded,
        })
        .from(musicAnalyses)
        .where(inArray(musicAnalyses.id, recordIds))) as DownloadRecord[];
    } else if (filters) {
      // 否则，按分类筛选
      const conditions: any[] = [];

      if (filters.emotions && filters.emotions.length > 0) {
        conditions.push(
          sql`${musicAnalyses.emotionTags}::jsonb ?| ${filters.emotions}`
        );
      }

      if (filters.filmTypes && filters.filmTypes.length > 0) {
        conditions.push(
          sql`${musicAnalyses.filmType} = ANY(${filters.filmTypes})`
        );
      }

      if (filters.scenarios && filters.scenarios.length > 0) {
        conditions.push(
          sql`${musicAnalyses.scenarios}::jsonb ?| ${filters.scenarios}`
        );
      }

      if (filters.styles && filters.styles.length > 0) {
        conditions.push(
          sql`${musicAnalyses.styles}::jsonb ?| ${filters.styles}`
        );
      }

      // 添加状态筛选
      if (statusFilter === 'online') {
        conditions.push(sql`${musicAnalyses.isOnline} = true`);
      } else if (statusFilter === 'cloud') {
        conditions.push(sql`${musicAnalyses.isUploaded} = true`);
      }

      const query = db
        .select({
          id: musicAnalyses.id,
          fileName: musicAnalyses.fileName,
          fileKey: musicAnalyses.fileKey,
          summary: musicAnalyses.summary,
          filmType: musicAnalyses.filmType,
          scenarios: musicAnalyses.scenarios,
          emotionTags: musicAnalyses.emotionTags,
          styles: musicAnalyses.styles,
          isOnline: musicAnalyses.isOnline,
          isUploaded: musicAnalyses.isUploaded,
        })
        .from(musicAnalyses);

      if (conditions.length > 0) {
        records = (await query.where(and(...conditions))) as DownloadRecord[];
      } else {
        records = (await query) as DownloadRecord[];
      }
    } else {
      // 没有筛选条件，查询所有记录
      records = (await db
        .select({
          id: musicAnalyses.id,
          fileName: musicAnalyses.fileName,
          fileKey: musicAnalyses.fileKey,
          summary: musicAnalyses.summary,
          filmType: musicAnalyses.filmType,
          scenarios: musicAnalyses.scenarios,
          emotionTags: musicAnalyses.emotionTags,
          styles: musicAnalyses.styles,
          isOnline: musicAnalyses.isOnline,
          isUploaded: musicAnalyses.isUploaded,
        })
        .from(musicAnalyses)) as DownloadRecord[];
    }

    // 如果指定了状态筛选，应用筛选
    if (statusFilter) {
      if (statusFilter === 'online') {
        records = records.filter(r => r.isOnline);
      } else if (statusFilter === 'cloud') {
        records = records.filter(r => r.isUploaded);
      }
    }

    // 过滤掉没有 fileKey 的记录
    const validRecords = records.filter((r) => r.fileKey);

    // 调试信息：记录查询结果
    console.log(`[批量下载] 总记录数: ${records.length}, 有 fileKey 的记录数: ${validRecords.length}`);
    if (records.length > 0 && validRecords.length === 0) {
      console.log('[批量下载] 所有记录都没有 fileKey，前3条记录:', records.slice(0, 3).map(r => ({
        id: r.id,
        fileName: r.fileName,
        fileKey: r.fileKey,
        isOnline: r.isOnline,
        isUploaded: r.isUploaded
      })));
    }

    // 如果只是检查模式，返回未在线文件信息
    if (checkOnly) {
      const offlineFiles = validRecords.filter(r => !r.isOnline && !r.isUploaded);

      if (offlineFiles.length > 0) {
        return NextResponse.json(
          {
            success: false,
            hasOfflineFiles: true,
            offlineFileCount: offlineFiles.length,
            offlineFileNames: offlineFiles.map(f => f.fileName),
            totalFileCount: validRecords.length,
            onlineFileCount: validRecords.length - offlineFiles.length,
            message: '检测到部分文件处于「未在线」状态，请先将这些音乐转为「在线」状态后再下载',
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          hasOfflineFiles: false,
          totalFileCount: validRecords.length,
          message: '所有文件均可下载',
        },
        { status: 200 }
      );
    }

    if (validRecords.length === 0) {
      let errorMessage = '暂无符合条件的音乐可打包';

      if (records.length > 0) {
        errorMessage = `找到 ${records.length} 条记录，但所有记录都没有文件数据（fileKey）。这些音乐可能未正确上传到对象存储。`;
      } else {
        errorMessage = '未找到符合条件的记录。请检查选择的音乐是否存在于数据库中。';
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          debug: {
            totalRecordsFound: records.length,
            recordsWithFileKey: validRecords.length,
            recordIds: recordIds?.slice(0, 5) // 只返回前5个ID用于调试
          }
        },
        { status: 400 }
      );
    }

    // 创建 ZIP
    const zip = new JSZip();

    // 按分类分组（只包含在线和云端的文件）
    const groupedRecords = new Map<string, DownloadRecord[]>();

    // 过滤出在线和云端的文件
    const downloadableRecords = validRecords.filter(r => r.isOnline || r.isUploaded);

    if (packBy === 'none') {
      // 不按分类，直接打包
      groupedRecords.set('全部音乐', downloadableRecords);
    } else {
      // 按指定分类分组
      downloadableRecords.forEach((record) => {
        let category = '未分类';

        switch (packBy) {
          case 'emotion':
            category = record.summary || '未分类';
            break;
          case 'filmType':
            category = record.filmType || '未分类';
            break;
          case 'scenario':
            category =
              record.scenarios && record.scenarios.length > 0
                ? record.scenarios[0]
                : '无场景';
            break;
          case 'style':
            category =
              record.styles && record.styles.length > 0
                ? record.styles[0]
                : '未分类';
            break;
        }

        if (!groupedRecords.has(category)) {
          groupedRecords.set(category, []);
        }
        groupedRecords.get(category)!.push(record);
      });
    }

    // 按分组添加文件到 ZIP
    for (const [category, recordsInGroup] of groupedRecords.entries()) {
      const folder = zip.folder(category);

      for (const record of recordsInGroup) {
        try {
          // 从对象存储读取文件
          const fileBuffer = await storage.readFile({
            fileKey: record.fileKey!,
          });

          // 添加到 ZIP
          if (folder) {
            folder.file(record.fileName, new Uint8Array(fileBuffer));
          } else {
            zip.file(record.fileName, new Uint8Array(fileBuffer));
          }
        } catch (error) {
          console.error(`读取文件失败: ${record.fileName}`, error);
          // 继续处理其他文件
        }
      }
    }

    // 生成 ZIP 文件
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 设置文件名（带时间戳）
    const timestamp = new Date().toISOString().slice(0, 10);
    const zipFileName = `音乐_${timestamp}.zip`;

    // 返回 ZIP 文件
    return new NextResponse(zipBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(zipFileName)}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('批量打包下载失败:', error);
    return NextResponse.json(
      { success: false, error: '批量打包下载失败' },
      { status: 500 }
    );
  }
}
