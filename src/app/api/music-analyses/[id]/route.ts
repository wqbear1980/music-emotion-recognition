import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";
import type { UpdateMusicAnalysis } from "@/storage/database";
import { parseTags } from "@/lib/parseTags";

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
 * GET /api/music-analyses/[id]
 * 根据 ID 获取单条音乐分析记录
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const analysis = await musicAnalysisManager.getAnalysisById(id);

    if (!analysis) {
      return NextResponse.json(
        {
          success: false,
          error: "Music analysis not found",
        },
        { status: 404 }
      );
    }

    // 转换字段名（snake_case -> camelCase）
    const camelCaseAnalysis = convertToCamelCase(analysis);

    return NextResponse.json({
      success: true,
      data: camelCaseAnalysis,
    });
  } catch (error: any) {
    console.error("Error fetching music analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch music analysis",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/music-analyses/[id]
 * 更新音乐分析记录
 *
 * 【重要】标签解析规则：
 * - 顿号（、）作为标签内部的分隔符，整个带顿号的内容视为一个完整标签
 * - 逗号（，）作为标签之间的分隔符，逗号分隔的内容视为多个独立标签
 * - 兼容中文逗号（，）和英文逗号（,）
 * - 自动去除标签首尾空格，空输入/全空格输入返回空数组
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updateData = body as UpdateMusicAnalysis;

    // 解析标签字段（遵循顿号整体、逗号拆分规则）
    if (body.emotionTags !== undefined) {
      updateData.emotionTags = parseTags(body.emotionTags as any as string);
    }
    if (body.filmScenes !== undefined) {
      updateData.filmScenes = parseTags(body.filmScenes as any as string);
    }
    if (body.scenarios !== undefined) {
      updateData.scenarios = parseTags(body.scenarios as any as string);
    }
    if (body.instruments !== undefined) {
      updateData.instruments = parseTags(body.instruments as any as string);
    }
    if (body.styles !== undefined) {
      updateData.styles = parseTags(body.styles as any as string);
    }

    const updated = await musicAnalysisManager.updateAnalysis(id, updateData);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: "Music analysis not found",
        },
        { status: 404 }
      );
    }

    // 转换字段名（snake_case -> camelCase）
    const camelCaseUpdated = convertToCamelCase(updated);

    return NextResponse.json({
      success: true,
      data: camelCaseUpdated,
    });
  } catch (error: any) {
    console.error("Error updating music analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update music analysis",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/music-analyses/[id]
 * 删除音乐分析记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await musicAnalysisManager.deleteAnalysis(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Music analysis not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Music analysis deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting music analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete music analysis",
      },
      { status: 500 }
    );
  }
}
