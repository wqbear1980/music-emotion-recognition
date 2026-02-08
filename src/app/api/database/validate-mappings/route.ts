import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

/**
 * 验证映射表数据完整性
 * 【新增】后置校验API，用于检查导入后的映射表数据是否存在问题
 *
 * 功能：
 * 1. 检查映射表数据是否存在非法值
 * 2. 检查映射表数据是否存在null/undefined
 * 3. 检查映射表数据是否存在重复记录
 * 4. 检查映射表数据是否与其他表（如标准词库）关联正确
 * 5. 提供修复建议
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // 可选：只验证特定分类

    console.log('[映射表验证] 开始验证映射表数据完整性');

    const validationResults: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 验证标准词库表（standard_terms）
    try {
      console.log('[映射表验证] 验证 standard_terms 表...');

      // 1.1 检查是否存在null值
      const nullCheckResult = await db.execute(sql`
        SELECT
          COUNT(*) as total_records,
          COUNT(CASE WHEN term IS NULL THEN 1 END) as null_terms,
          COUNT(CASE WHEN category IS NULL THEN 1 END) as null_categories,
          COUNT(CASE WHEN review_status IS NULL THEN 1 END) as null_review_status
        FROM standard_terms
      `);

      const nullCheckRow = nullCheckResult.rows[0] as any;
      if (nullCheckRow?.null_terms > 0) {
        errors.push(`standard_terms 表有 ${nullCheckRow.null_terms} 条记录的 term 字段为 null`);
      }
      if (nullCheckRow?.null_categories > 0) {
        warnings.push(`standard_terms 表有 ${nullCheckRow.null_categories} 条记录的 category 字段为 null`);
      }
      if (nullCheckRow?.null_review_status > 0) {
        warnings.push(`standard_terms 表有 ${nullCheckRow.null_review_status} 条记录的 review_status 字段为 null`);
      }

      validationResults.push({
        table: 'standard_terms',
        check: 'null_values',
        result: nullCheckRow,
        status: (nullCheckRow.null_terms > 0) ? 'error' : 'ok',
      });

      // 1.2 检查是否存在重复记录
      const duplicateCheckResult = await db.execute(sql`
        SELECT term, COUNT(*) as count
        FROM standard_terms
        GROUP BY term
        HAVING COUNT(*) > 1
      `);

      if (duplicateCheckResult.rows.length > 0) {
        errors.push(`standard_terms 表有 ${duplicateCheckResult.rows.length} 个重复的 term 值`);
        validationResults.push({
          table: 'standard_terms',
          check: 'duplicates',
          result: {
            count: duplicateCheckResult.rows.length,
            duplicates: duplicateCheckResult.rows.slice(0, 10), // 只返回前10个
          },
          status: 'error',
        });
      } else {
        validationResults.push({
          table: 'standard_terms',
          check: 'duplicates',
          result: { count: 0 },
          status: 'ok',
        });
      }

      // 1.3 检查非法值（如超长字符串、特殊字符等）
      const invalidValuesResult = await db.execute(sql`
        SELECT
          COUNT(*) as total_records,
          COUNT(CASE WHEN LENGTH(term) > 500 THEN 1 END) as long_terms,
          COUNT(CASE WHEN LENGTH(term) > 1000 THEN 1 END) as very_long_terms
        FROM standard_terms
      `);

      const invalidValuesRow = invalidValuesResult.rows[0] as any;
      if (invalidValuesRow?.long_terms > 0) {
        warnings.push(`standard_terms 表有 ${invalidValuesRow.long_terms} 条记录的 term 超过 500 字符`);
      }
      if (invalidValuesRow?.very_long_terms > 0) {
        errors.push(`standard_terms 表有 ${invalidValuesRow.very_long_terms} 条记录的 term 超过 1000 字符（可能影响性能）`);
      }

      validationResults.push({
        table: 'standard_terms',
        check: 'invalid_values',
        result: invalidValuesRow,
        status: (invalidValuesRow.very_long_terms > 0) ? 'error' : 'ok',
      });

      // 1.4 检查category值的合法性
      const categoryCheckResult = await db.execute(sql`
        SELECT DISTINCT category, COUNT(*) as count
        FROM standard_terms
        GROUP BY category
        ORDER BY category
      `);

      const validCategories = ['emotion', 'style', 'instrument', 'film', 'scenario', 'dubbing'];
      const invalidCategories = categoryCheckResult.rows.filter(
        (row: any) => !validCategories.includes(row.category)
      );

      if (invalidCategories.length > 0) {
        warnings.push(`standard_terms 表包含 ${invalidCategories.length} 个未知的分类: ${invalidCategories.map((r: any) => r.category).join(', ')}`);
      }

      validationResults.push({
        table: 'standard_terms',
        check: 'category_validity',
        result: {
          validCategories: categoryCheckResult.rows.length - invalidCategories.length,
          invalidCategories: invalidCategories.length,
          invalidList: invalidCategories.slice(0, 10),
        },
        status: (invalidCategories.length > 0) ? 'warning' : 'ok',
      });

    } catch (error: any) {
      errors.push(`验证 standard_terms 表时出错: ${error.message}`);
      console.error('[映射表验证] standard_terms 表验证失败:', error);
    }

    // 2. 验证词库扩充记录表（term_expansion_records）
    try {
      console.log('[映射表验证] 验证 term_expansion_records 表...');

      // 2.0 先检查表是否存在
      const tableExistsResult = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'term_expansion_records'
        )
      `);

      const tableExists = (tableExistsResult.rows[0] as any)?.exists;
      if (!tableExists) {
        warnings.push('term_expansion_records 表不存在，跳过验证');
      } else {
        // 2.1 检查是否存在null值
        const nullCheckResult = await db.execute(sql`
          SELECT
            COUNT(*) as total_records,
            COUNT(CASE WHEN term IS NULL THEN 1 END) as null_terms,
            COUNT(CASE WHEN category IS NULL THEN 1 END) as null_categories
          FROM term_expansion_records
        `);

        const nullCheckRow = nullCheckResult.rows[0] as any;
        if (nullCheckRow?.null_terms > 0) {
          errors.push(`term_expansion_records 表有 ${nullCheckRow.null_terms} 条记录的 term 字段为 null`);
        }

        validationResults.push({
          table: 'term_expansion_records',
          check: 'null_values',
          result: nullCheckRow,
          status: (nullCheckRow?.null_terms > 0) ? 'error' : 'ok',
        });

        // 2.2 检查数据统计
        const statsResult = await db.execute(sql`
          SELECT
            COUNT(*) as total_records,
            COUNT(DISTINCT term) as unique_terms,
            COUNT(CASE WHEN expansion_type = 'auto' THEN 1 END) as auto_count,
            COUNT(CASE WHEN expansion_type = 'manual' THEN 1 END) as manual_count
          FROM term_expansion_records
        `);

        validationResults.push({
          table: 'term_expansion_records',
          check: 'statistics',
          result: statsResult.rows[0],
          status: 'ok',
        });
      }

    } catch (error: any) {
      warnings.push(`验证 term_expansion_records 表时出错: ${error.message}`);
      console.error('[映射表验证] term_expansion_records 表验证失败:', error);
    }

    // 3. 检查数据一致性（确保两个表的数据一致）
    try {
      console.log('[映射表验证] 检查数据一致性...');

      // 3.0 先检查两个表是否都存在
      const tablesExistResult = await db.execute(sql`
        SELECT
          (SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'term_expansion_records'
          )) as expansion_exists,
          (SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'standard_terms'
          )) as standard_exists
      `);

      const tablesExist = tablesExistResult.rows[0] as any;
      if (!tablesExist?.expansion_exists) {
        warnings.push('term_expansion_records 表不存在，跳过数据一致性检查');
      } else if (!tablesExist?.standard_exists) {
        warnings.push('standard_terms 表不存在，跳过数据一致性检查');
      } else {
        // 3.1 检查 term_expansion_records 中的词是否都在 standard_terms 中
        // 注意：term_expansion_records 存储的是扩充词的标准词（term），需要检查是否在标准词库中
        const consistencyCheckResult = await db.execute(sql`
          SELECT COUNT(*) as missing_count
          FROM term_expansion_records ter
          LEFT JOIN standard_terms st ON ter.term = st.term
          WHERE st.id IS NULL
        `);

        const missingCount = (consistencyCheckResult.rows[0] as any)?.missing_count || 0;
        if (missingCount > 0) {
          warnings.push(`有 ${missingCount} 个已审核通过的扩充词未同步到标准词库表`);
        }

        validationResults.push({
          check: 'data_consistency',
          result: {
            missingTermsInStandardTerms: missingCount,
          },
          status: (missingCount > 0) ? 'warning' : 'ok',
        });
      }

    } catch (error: any) {
      warnings.push(`检查数据一致性时出错: ${error.message}`);
      console.error('[映射表验证] 数据一致性检查失败:', error);
    }

    // 4. 生成修复建议
    const suggestions: string[] = [];
    if (errors.length > 0) {
      suggestions.push('1. 备份数据库，防止误操作');
      suggestions.push('2. 清理null值和重复记录');
      suggestions.push('3. 使用数据校验脚本修复格式问题');
    }
    if (warnings.length > 0) {
      suggestions.push('4. 检查非法分类和超长字符串');
      suggestions.push('5. 同步扩充词到标准词库表');
    }
    if (errors.length === 0 && warnings.length === 0) {
      suggestions.push('✅ 数据完整性良好，无需修复');
    }

    // 返回验证结果
    const overallStatus = errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'ok');

    return NextResponse.json({
      success: true,
      data: {
        overallStatus,
        errors,
        warnings,
        validationResults,
        suggestions,
        validatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[映射表验证] 验证失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: `验证失败: ${error.message || '未知错误'}`,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
