import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * GET /api/music-analyses/stats/deduplicated
 * 获取去重的音乐数量统计
 * 去重规则：以文件 MD5 值为唯一标识（无 MD5 时用文件名 + 文件大小）
 *
 * 【重要】统计逻辑与搜索结果中的音乐状态一致：
 * - 云端（cloud）：已上传到云端的文件（最高优先级，无论是否在导入列表中）
 * - 在线（online）：在导入列表中但未上传到云端的文件（可本地播放）
 * - 离线（offline）：既不在导入列表中也未上传到云端的文件
 *
 * 查询参数：
 * - importListFileNames: 导入列表中的文件名数组，逗号分隔（用于动态计算音乐状态）
 *
 * 返回：
 * - total: 总数（已分析的去重音乐数量）
 * - online: 在线数量（在导入列表中但未上传云端）
 * - offline: 离线数量（既不在导入列表中也未上传云端）
 * - uploaded: 云端数量（已上传到云端的文件）
 * - totalUploaded: 所有已上传到云端的音乐数量（统计维度）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 获取导入列表文件名参数（用于动态计算音乐状态）
    const importListFileNamesParam = searchParams.get("importListFileNames");
    const importListFileNames = importListFileNamesParam
      ? importListFileNamesParam.split(",").map((s) => s.trim())
      : [];

    console.log('[去重统计API] 导入列表文件名数量:', importListFileNames.length);

    const stats = await musicAnalysisManager.getDeduplicatedStats(importListFileNames);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching deduplicated stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch deduplicated stats",
      },
      { status: 500 }
    );
  }
}
