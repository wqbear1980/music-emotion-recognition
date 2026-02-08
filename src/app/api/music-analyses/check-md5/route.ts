import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * GET /api/music-analyses/check-md5?md5=xxx
 * 根据MD5查询音乐分析记录
 *
 * 用于检测重复上传，如果存在历史记录则返回该记录的完整分析结果
 * 如果不存在则返回null
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const md5 = searchParams.get('md5');

    if (!md5) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: md5",
        },
        { status: 400 }
      );
    }

    // 根据MD5查询分析记录
    const analysis = await musicAnalysisManager.getAnalysisByMD5(md5);

    if (!analysis) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No existing analysis found for this MD5",
      });
    }

    // 将数据库字段名（snake_case）转换为前端字段名（camelCase）
    const convertToCamelCase = <T extends Record<string, any>>(item: T): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(item)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = value;
      }
      return result;
    };

    const camelCaseResult = convertToCamelCase(analysis);

    return NextResponse.json({
      success: true,
      data: camelCaseResult,
      message: "Found existing analysis for this MD5",
    });
  } catch (error: any) {
    console.error("Error checking MD5:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to check MD5",
      },
      { status: 500 }
    );
  }
}
