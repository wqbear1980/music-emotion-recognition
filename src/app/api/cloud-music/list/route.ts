import { NextRequest, NextResponse } from "next/server";
import { getDb } from "coze-coding-dev-sdk";
import { musicAnalyses } from "@/storage/database/shared/schema";
import { eq, desc, like, or, and, sql } from "drizzle-orm";

/**
 * GET /api/cloud-music/list
 * 查询已上传至云端的音乐文件列表
 *
 * 查询参数：
 * - query: string（可选）- 搜索文本（按文件名或ID搜索）
 * - sortBy: 'uploadedAt' | 'fileName'（可选，默认'uploadedAt'）
 * - sortOrder: 'asc' | 'desc'（可选，默认'desc'）
 * - page: number（可选，从1开始）
 * - limit: number（可选，默认20）
 *
 * 响应：{
 *   success: true,
 *   data: {
 *     files: Array<{
 *       id: string,
 *       fileName: string,
 *       fileKey: string,
 *       fileSize: number,
 *       uploadedAt: string,
 *       duration: number,
 *       bpm: number,
 *       emotionTags: string[],
 *       filmType: string,
 *       scenarios: string[]
 *     }>,
 *     pagination: {
 *       total: number,
 *       page: number,
 *       limit: number,
 *       totalPages: number
 *     }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const sortBy = (searchParams.get("sortBy") as "uploadedAt" | "fileName") || "uploadedAt";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const db = await getDb();

    // 构建查询条件：只查询已上传的文件
    let whereClause;

    // 添加搜索条件
    if (query) {
      const searchCondition = or(
        like(musicAnalyses.fileName, `%${query}%`),
        like(musicAnalyses.id, `%${query}%`)
      );
      whereClause = and(
        eq(musicAnalyses.isUploaded, true),
        searchCondition
      );
    } else {
      whereClause = eq(musicAnalyses.isUploaded, true);
    }

    // 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(musicAnalyses)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // 查询文件列表（使用链式调用避免 TypeScript 类型推断问题）
    // 构建查询并添加排序和分页（使用类型断言绕过 TypeScript 限制）
    let dbQuery = db
      .select()
      .from(musicAnalyses)
      .where(whereClause) as any;

    // 排序
    if (sortBy === "uploadedAt") {
      dbQuery = sortOrder === "asc"
        ? dbQuery.orderBy(musicAnalyses.uploadedAt!)
        : dbQuery.orderBy(desc(musicAnalyses.uploadedAt!));
    } else if (sortBy === "fileName") {
      dbQuery = sortOrder === "asc"
        ? dbQuery.orderBy(musicAnalyses.fileName)
        : dbQuery.orderBy(desc(musicAnalyses.fileName));
    }

    // 分页
    const skip = (page - 1) * limit;
    const files = await dbQuery.limit(limit).offset(skip);

    // 计算总页数
    const totalPages = Math.ceil(total / limit);

    // 转换字段名（snake_case -> camelCase）
    const camelCaseFiles = files.map((file: any) => ({
      id: file.id,
      fileName: file.fileName,
      fileKey: file.fileKey,
      fileSize: file.fileSize,
      uploadedAt: file.uploadedAt || null, // 数据库返回的已经是字符串，不需要转换
      duration: file.duration,
      bpm: file.bpm,
      emotionTags: file.emotionTags || [],
      filmType: file.filmType,
      scenarios: file.scenarios || [],
      isOnline: file.isOnline,
      isUploaded: file.isUploaded,
    }));

    return NextResponse.json({
      success: true,
      data: {
        files: camelCaseFiles,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching cloud music list:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "查询云端文件列表失败"
      },
      { status: 500 }
    );
  }
}
