import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";
import type { InsertMusicAnalysis } from "@/storage/database";
import { autoAddToVocabulary } from "@/lib/autoAddToVocabulary";

/**
 * 将数据库字段名（snake_case）转换为前端字段名（camelCase）
 */
function convertToCamelCase<T extends Record<string, any>>(item: T): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(item)) {
    // 转换 snake_case 到 camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }

  return result;
}

/**
 * POST /api/music-analyses/replace-or-create
 * 创建或替换音乐分析记录（根据文件名）
 *
 * 如果文件名已存在，先删除所有旧记录，再插入新记录
 * 如果文件名不存在，直接插入新记录
 *
 * 这个方法确保同一音乐文件的分析结果总是最新的，避免重复数据
 */
export async function POST(request: NextRequest) {
  let body: any = null;

  try {
    body = await request.json();

    // 检查是否是单条记录
    if (Array.isArray(body)) {
      return NextResponse.json(
        {
          success: false,
          error: "此端点仅支持单条记录的创建或替换，请使用 POST /api/music-analyses 进行批量操作",
        },
        { status: 400 }
      );
    }

    // 创建或替换记录
    const result = await musicAnalysisManager.createOrReplaceByFileName(
      body as InsertMusicAnalysis
    );

    // 转换字段名（snake_case -> camelCase）
    const camelCaseResult = convertToCamelCase(result);

    // 自动加入词库：将识别出的情绪、风格、乐器等标签加入到词库
    // 使用 try-catch 避免词库更新失败影响主流程
    try {
      const vocabularyResult = await autoAddToVocabulary({
        emotionTags: body.emotionTags,
        styles: body.styles,
        instruments: body.instruments,
        filmType: body.filmType,
        scenarios: body.scenarios,
      });

      if (vocabularyResult.success && vocabularyResult.addedCount > 0) {
        console.log(`[自动加入词库] 文件"${body.fileName}"：成功添加 ${vocabularyResult.addedCount} 个词汇到词库`);
      }
    } catch (vocabError) {
      // 词库更新失败不影响主流程，仅记录日志
      console.error(`[自动加入词库] 文件"${body.fileName}"：词库更新失败`, vocabError);
    }

    return NextResponse.json({
      success: true,
      data: camelCaseResult,
      message: `文件"${body.fileName}"的分析结果已保存`,
    });
  } catch (error: any) {
    console.error("Error creating or replacing music analysis:", error);

    // 详细记录错误信息
    const errorDetails = {
      message: error.message,
      name: error.name,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    };
    console.error("Error details:", JSON.stringify(errorDetails, null, 2));

    // 处理唯一键冲突（UPSERT不应该发生，但防御性编程）
    if (error.code === '23505' || error.constraint?.includes('file_name')) {
      return NextResponse.json(
        {
          success: false,
          error: `文件"${body?.fileName || ''}"已存在`,
          code: 'DUPLICATE_FILE_NAME',
          details: errorDetails,
        },
        { status: 409 }
      );
    }

    // 其他错误
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create or replace music analysis",
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
