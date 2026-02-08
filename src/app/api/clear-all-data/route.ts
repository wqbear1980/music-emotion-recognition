import { NextRequest, NextResponse } from "next/server";
import { getRawClient } from "@/storage/database/rawClient";

/**
 * DELETE /api/clear-all-data
 * 清空数据库中所有业务数据
 *
 * 业务数据包括：
 * - music_analyses（音乐分析结果）
 * - standard_terms（标准词库）
 * - term_expansion_records（词库扩充记录）
 * - unrecognized_terms（未识别内容统计）
 * - scene_optimization_samples（待优化样本库）
 *
 * 注意：
 * - 此操作将删除所有业务数据，不可恢复
 * - 不影响数据库表结构、字段定义、索引、存储过程等基础架构
 * - 不删除系统配置类数据（如管理员账号、权限规则、词库审核流程配置等）
 */
export async function DELETE(_request: NextRequest) {
  try {
    const client = await getRawClient();

    // 定义需要清空的所有业务数据表
    const businessTables = [
      'music_analyses',
      'standard_terms',
      'term_expansion_records',
      'unrecognized_terms',
      'scene_optimization_samples',
    ];

    // 统计清空前的记录数（仅统计存在的表）
    const beforeStats: { [key: string]: number } = {};
    const existingTables: string[] = [];

    for (const table of businessTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        beforeStats[table] = parseInt(result.rows[0].count);
        existingTables.push(table);
      } catch (_error: any) {
        // 表不存在，跳过
        console.warn(`Table ${table} does not exist, skipping`);
      }
    }

    // 使用 TRUNCATE 清空所有业务数据表
    // TRUNCATE 比 DELETE 更高效，且自动重置自增序列（如果有）
    // 使用 IF EXISTS 避免表不存在时报错
    const truncateSQL = `
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'music_analyses') THEN
          TRUNCATE TABLE music_analyses CASCADE;
        END IF;
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'standard_terms') THEN
          TRUNCATE TABLE standard_terms CASCADE;
        END IF;
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'term_expansion_records') THEN
          TRUNCATE TABLE term_expansion_records CASCADE;
        END IF;
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'unrecognized_terms') THEN
          TRUNCATE TABLE unrecognized_terms CASCADE;
        END IF;
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'scene_optimization_samples') THEN
          TRUNCATE TABLE scene_optimization_samples CASCADE;
        END IF;
      END $$;
    `;

    await client.query(truncateSQL);

    // 验证清空后的结果
    const afterStats: { [key: string]: number } = {};
    for (const table of existingTables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      afterStats[table] = parseInt(result.rows[0].count);
    }

    // 检查是否所有表都已清空
    const allCleared = Object.values(afterStats).every(count => count === 0);

    // 生成详细报告（仅包含存在的表）
    const report = existingTables.map(table => ({
      table,
      beforeCount: beforeStats[table],
      afterCount: afterStats[table],
      cleared: afterStats[table] === 0,
    }));

    const totalBefore = Object.values(beforeStats).reduce((sum, count) => sum + count, 0);
    const totalAfter = Object.values(afterStats).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      success: allCleared,
      message: allCleared
        ? `成功清空所有业务数据，共删除 ${totalBefore} 条记录`
        : '部分数据清空失败，请检查日志',
      summary: {
        totalDeleted: totalBefore,
        totalRemaining: totalAfter,
        tablesProcessed: existingTables.length,
        allCleared,
        skippedTables: businessTables.length - existingTables.length,
      },
      details: report,
    });
  } catch (error: any) {
    console.error("Error clearing all business data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to clear business data",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
