import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";
import type {
  InsertMusicAnalysis,
  UpdateMusicAnalysis,
} from "@/storage/database";
import { autoAddToVocabulary } from "@/lib/autoAddToVocabulary";

/**
 * 将数据库字段名（snake_case）转换为前端字段名（camelCase）
 * 并解析JSON字符串字段
 */
function convertToCamelCase<T extends Record<string, any>>(item: T): Record<string, any> {
  const result: Record<string, any> = {};

  // 需要解析为JSON的字段名（snake_case格式）
  const jsonFields = ['instruments', 'scenarios', 'film_scenes', 'styles', 'creators', 'metadata', 'other_features', 'candidate_terms', 'emotion_tags'];

  for (const [key, value] of Object.entries(item)) {
    // 转换 snake_case 到 camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // 如果是需要解析的字段且是字符串，尝试解析JSON
    if (jsonFields.includes(key) && typeof value === 'string' && value.trim()) {
      try {
        result[camelKey] = JSON.parse(value);
      } catch (error) {
        // 解析失败，保持原样
        result[camelKey] = value;
      }
    } else {
      result[camelKey] = value;
    }
  }

  return result;
}

/**
 * GET /api/music-analyses
 * 获取音乐分析列表
 * 支持根据文件名查询：fileName=<filename>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");

    // 如果指定了文件名，查询单条记录
    if (fileName) {
      const analysis = await musicAnalysisManager.getAnalysisByFileName(fileName);
      if (analysis) {
        const camelCaseAnalysis = convertToCamelCase(analysis);
        return NextResponse.json({
          success: true,
          data: camelCaseAnalysis,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: "未找到该文件的分析记录",
        }, { status: 404 });
      }
    }

    // 否则返回列表
    const skip = parseInt(searchParams.get("skip") || "0");
    const limit = parseInt(searchParams.get("limit") || "100");
    const sortBy = (searchParams.get("sortBy") || "createdAt") as
      | "createdAt"
      | "fileName";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as
      | "asc"
      | "desc";

    const analyses = await musicAnalysisManager.getAnalyses({
      skip,
      limit,
      sortBy,
      sortOrder,
    });

    // 转换字段名（snake_case -> camelCase）
    const camelCaseAnalyses = analyses.map(convertToCamelCase);

    return NextResponse.json({
      success: true,
      data: camelCaseAnalyses,
    });
  } catch (error: any) {
    console.error("Error fetching music analyses:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch music analyses",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/music-analyses
 * 创建音乐分析记录（支持单条或批量）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 判断是单条还是批量
    if (Array.isArray(body)) {
      // 批量创建
      const results = await musicAnalysisManager.createAnalysesBatch(
        body as InsertMusicAnalysis[]
      );

      // 转换字段名（snake_case -> camelCase）
      const camelCaseResults = results.map(convertToCamelCase);

      // 批量加入词库（异步，不影响主流程）
      const addVocabularyPromises = body.map(async (item: InsertMusicAnalysis) => {
        try {
          const vocabResult = await autoAddToVocabulary({
            emotionTags: item.emotionTags,
            styles: item.styles,
            instruments: item.instruments,
            filmType: item.filmType,
            scenarios: item.scenarios,
          });

          if (vocabResult.success && vocabResult.addedCount > 0) {
            console.log(`[自动加入词库] 文件"${item.fileName}"：成功添加 ${vocabResult.addedCount} 个词汇到词库`);
          }
        } catch (vocabError) {
          console.error(`[自动加入词库] 文件"${item.fileName}"：词库更新失败`, vocabError);
        }
      });

      // 等待所有词库更新完成（使用Promise.allSettled，避免一个失败影响其他）
      await Promise.allSettled(addVocabularyPromises);

      return NextResponse.json({
        success: true,
        data: camelCaseResults,
        count: results.length,
      });
    } else {
      // 单条创建
      const result = await musicAnalysisManager.createAnalysis(
        body as InsertMusicAnalysis
      );

      // 转换字段名（snake_case -> camelCase）
      const camelCaseResult = convertToCamelCase(result);

      // 自动加入词库
      try {
        const vocabResult = await autoAddToVocabulary({
          emotionTags: body.emotionTags,
          styles: body.styles,
          instruments: body.instruments,
          filmType: body.filmType,
          scenarios: body.scenarios,
        });

        if (vocabResult.success && vocabResult.addedCount > 0) {
          console.log(`[自动加入词库] 文件"${body.fileName}"：成功添加 ${vocabResult.addedCount} 个词汇到词库`);
        }
      } catch (vocabError) {
        console.error(`[自动加入词库] 文件"${body.fileName}"：词库更新失败`, vocabError);
      }

      return NextResponse.json({
        success: true,
        data: camelCaseResult,
      });
    }
  } catch (error: any) {
    console.error("Error creating music analysis:", error);
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
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create music analysis",
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
