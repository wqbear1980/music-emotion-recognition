import { NextRequest, NextResponse } from "next/server";
import { getRawClient } from "@/storage/database/rawClient";

/**
 * POST /api/database/clear
 * 清空用户数据，保留系统数据
 *
 * 需清空的数据：
 * 1. music_analyses - 用户上传的音乐分析数据
 * 2. scene_optimization_samples - 基于用户音乐生成的优化样本
 *
 * 需保留的数据：
 * 1. standard_terms - 系统内置的标准影视词库数据
 * 2. term_expansion_records - 词库扩充的历史记录
 * 3. unrecognized_terms - 未识别内容的统计数据
 *
 * 执行要求：
 * - 仅删除上述"需清空"的内容
 * - 保留数据需完整无丢失
 * - 不影响后续音乐分析与词库匹配功能
 */
export async function POST(request: NextRequest) {
  try {
    const client = await getRawClient();

    // 定义需清空的用户数据表
    const userTables = [
      'music_analyses',
      'scene_optimization_samples',
    ];

    // 定义需保留的系统数据表
    const systemTables = [
      'standard_terms',
      'term_expansion_records',
      'unrecognized_terms',
    ];

    // 统计清空前的用户数据记录数
    const beforeUserStats: { [key: string]: number } = {};
    const existingUserTables: string[] = [];

    for (const table of userTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        beforeUserStats[table] = parseInt(result.rows[0].count);
        existingUserTables.push(table);
      } catch (error: any) {
        // 表不存在，跳过
        console.warn(`Table ${table} does not exist, skipping`);
      }
    }

    // 统计清空前的系统数据记录数（用于验证）
    const beforeSystemStats: { [key: string]: number } = {};
    for (const table of systemTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        beforeSystemStats[table] = parseInt(result.rows[0].count);
      } catch (error: any) {
        // 表不存在，跳过
        console.warn(`Table ${table} does not exist, skipping`);
      }
    }

    // 使用 TRUNCATE 清空用户数据表
    // 先清空 scene_optimization_samples（因为它有外键引用到 music_analyses）
    const clearSQL = `
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'scene_optimization_samples') THEN
          TRUNCATE TABLE scene_optimization_samples CASCADE;
        END IF;
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'music_analyses') THEN
          TRUNCATE TABLE music_analyses CASCADE;
        END IF;
      END $$;
    `;

    await client.query(clearSQL);

    // 验证清空后的用户数据
    const afterUserStats: { [key: string]: number } = {};
    for (const table of existingUserTables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      afterUserStats[table] = parseInt(result.rows[0].count);
    }

    // 验证系统数据是否完整
    const afterSystemStats: { [key: string]: number } = {};
    for (const table of systemTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        afterSystemStats[table] = parseInt(result.rows[0].count);
      } catch (error: any) {
        // 表不存在，跳过
      }
    }

    // 检查是否所有用户数据都已清空
    const allUserCleared = Object.values(afterUserStats).every((count: number) => count === 0);

    // 验证系统数据是否被误删
    const systemDataPreserved = Object.keys(beforeSystemStats).every(
      (table) => afterSystemStats[table] === beforeSystemStats[table]
    );

    if (!systemDataPreserved) {
      console.error("System data was affected by clear operation:", {
        before: beforeSystemStats,
        after: afterSystemStats,
      });
      return NextResponse.json(
        {
          success: false,
          error: "清空操作影响了保留的系统数据，操作已中止",
          details: {
            beforeSystemStats,
            afterSystemStats,
          },
        },
        { status: 500 }
      );
    }

    // 生成详细报告
    const userReport = existingUserTables.map((table: string) => ({
      table,
      beforeCount: beforeUserStats[table],
      afterCount: afterUserStats[table],
      cleared: afterUserStats[table] === 0,
    }));

    const totalUserBefore = Object.values(beforeUserStats).reduce((sum: number, count: number) => sum + count, 0);
    const totalUserAfter = Object.values(afterUserStats).reduce((sum: number, count: number) => sum + count, 0);

    return NextResponse.json({
      success: allUserCleared && systemDataPreserved,
      message: allUserCleared
        ? `成功清空用户数据，删除 ${totalUserBefore} 条记录`
        : '部分用户数据清空失败，请检查日志',
      deletedData: {
        musicAnalyses: {
          count: beforeUserStats['music_analyses'] || 0,
          beforeCount: beforeUserStats['music_analyses'] || 0,
        },
        sceneOptimizationSamples: {
          count: beforeUserStats['scene_optimization_samples'] || 0,
          beforeCount: beforeUserStats['scene_optimization_samples'] || 0,
        },
      },
      preservedData: {
        standardTerms: afterSystemStats['standard_terms'] || 0,
        termExpansionRecords: afterSystemStats['term_expansion_records'] || 0,
        unrecognizedTerms: afterSystemStats['unrecognized_terms'] || 0,
      },
      summary: {
        totalDeleted: totalUserBefore,
        totalRemaining: totalUserAfter,
        tablesProcessed: existingUserTables.length,
        allCleared: allUserCleared,
        systemDataPreserved,
      },
      details: userReport,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error clearing user data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "清空用户数据失败",
        details: {
          stack: error.stack,
          message: error.message,
        },
      },
      { status: 500 }
    );
  }
}
