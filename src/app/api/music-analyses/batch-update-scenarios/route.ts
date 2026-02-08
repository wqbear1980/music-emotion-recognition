import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * POST /api/music-analyses/batch-update-scenarios
 * 批量更新场景建议字段
 * 从数据库中的otherFeatures字段提取filmMusic.scenes，验证后更新到scenarios字段
 *
 * 场景词验证规则：
 * - 标准场景词：追逐、吵架、调查、潜入
 * - 遇到近义词（如"追击"）转换为标准词（"追逐"）
 * - 场景词与影片类型不匹配时忽略该场景词
 * - 无有效场景词时，不添加任何场景词（空数组）
 */
export async function POST(request: NextRequest) {
  try {
    // 获取所有分析记录
    const allAnalyses = await musicAnalysisManager.getAnalyses({
      skip: 0,
      limit: 10000, // 足够大的值
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // 遍历每个分析记录
    for (const analysis of allAnalyses) {
      try {
        // 从otherFeatures中提取filmMusic数据
        let filmMusic: any = null;

        if (analysis.otherFeatures && typeof analysis.otherFeatures === 'string') {
          try {
            filmMusic = JSON.parse(analysis.otherFeatures);
          } catch (parseError) {
            // otherFeatures不是有效的JSON，跳过
            results.failed++;
            results.errors.push(`${analysis.fileName}: otherFeatures格式错误`);
            continue;
          }
        }

        if (!filmMusic || !filmMusic.scenes || !Array.isArray(filmMusic.scenes)) {
          // 没有场景数据，跳过（这不是错误）
          continue;
        }

        const filmType = filmMusic.filmType || analysis.filmType || '未分类';

        // 提取和验证场景建议标签
        const validatedScenarios: string[] = [];

        for (const scene of filmMusic.scenes) {
          const sceneType = scene.type;

          if (!sceneType || !sceneType.trim()) {
            continue;
          }

          // 标准化场景词（将近义词转换为标准词）
          let standardizedScene = sceneType;

          for (const [key, value] of Object.entries({
            '追逐': '追逐', '追击': '追逐', '追赶': '追逐', '追逐戏': '追逐', '追逃': '追逐',
            '吵架': '吵架', '争执': '吵架', '争吵': '吵架', '拌嘴': '吵架', '口角': '吵架',
            '调查': '调查', '侦查': '调查', '查案': '调查', '调查取证': '调查', '摸排': '调查',
            '潜入': '潜入', '秘密潜入': '潜入', '潜入行动': '潜入', '潜入侦查': '潜入',
          })) {
            if (sceneType.includes(key) || key.includes(sceneType)) {
              standardizedScene = value;
              break;
            }
          }

          // 验证场景词是否为标准词
          const standardScenes = ['追逐', '吵架', '调查', '潜入'];
          if (standardScenes.includes(standardizedScene)) {
            // 检查场景词与影片类型是否匹配
            const sceneRules: Record<string, { allowed: string[] }> = {
              '追逐': { allowed: ['动作片', '警匪片', '灾难片', '战争片'] },
              '吵架': { allowed: ['家庭剧', '职场剧（医护题材）', '职场剧（警察题材）', '职场剧（律政题材）', '职场剧（美食题材）', '校园剧', '爱情片'] },
              '调查': { allowed: ['推理剧', '警匪片', '悬疑片'] },
              '潜入': { allowed: ['警匪片', '谍战片', '战争片'] },
            };

            const rule = sceneRules[standardizedScene];
            if (rule && rule.allowed.includes(filmType)) {
              validatedScenarios.push(standardizedScene);
            } else {
              console.warn(`场景词"${standardizedScene}"与影片类型"${filmType}"不匹配，已忽略`);
            }
          } else {
            console.warn(`场景词"${sceneType}"不是标准场景词，已忽略`);
          }
        }

        // 更新场景建议字段（使用验证后的场景词列表，可能为空）
        await musicAnalysisManager.updateAnalysis(analysis.id, {
          scenarios: validatedScenarios,
        });

        if (validatedScenarios.length > 0) {
          results.success++;
        }
      } catch (error: any) {
        results.failed++;
        const errorMsg = error?.message || error?.toString() || '未知错误';
        results.errors.push(`${analysis.fileName || '未知文件'}: ${errorMsg}`);
        console.error(`Error processing file ${analysis.fileName}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        total: allAnalyses.length,
      },
    });
  } catch (error: any) {
    console.error("Error in batch update scenarios:", error);
    const errorMsg = error?.message || error?.toString() || "批量更新场景建议失败";
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
