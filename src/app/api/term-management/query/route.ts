import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms, termExpansionRecords } from '@/storage/database/shared/schema';
import { eq, and, like, or, desc, sql } from 'drizzle-orm';

/**
 * 查询词库API
 * 
 * 功能：
 * 1. 查询所有标准词
 * 2. 按分类、词类型、审核状态筛选
 * 3. 搜索术语
 * 4. 分页查询
 * 5. 查询扩充历史
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const queryType = searchParams.get('type') || 'terms'; // 'terms' | 'history'
    const category = searchParams.get('category');
    const termType = searchParams.get('termType'); // 'core' | 'extended'
    const reviewStatus = searchParams.get('reviewStatus'); // 'pending' | 'approved' | 'rejected'
    const keyword = searchParams.get('keyword');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const offset = (page - 1) * limit;

    if (queryType === 'history') {
      // 查询扩充历史
      const conditions = [];

      if (category) {
        conditions.push(eq(termExpansionRecords.category, category));
      }

      if (keyword) {
        conditions.push(
          or(
            like(termExpansionRecords.term, `%${keyword}%`)
          ) as any
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const records = await db
        .select()
        .from(termExpansionRecords)
        .where(whereClause)
        .orderBy(desc(termExpansionRecords.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(termExpansionRecords)
        .where(whereClause);

      const total = countResult[0]?.count || 0;

      return NextResponse.json({
        success: true,
        data: {
          records,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } else {
      // 查询标准词
      const conditions = [];

      if (category) {
        conditions.push(eq(standardTerms.category, category));
      }

      if (termType) {
        conditions.push(eq(standardTerms.termType, termType));
      }

      if (reviewStatus) {
        conditions.push(eq(standardTerms.reviewStatus, reviewStatus));
      }

      if (keyword) {
        conditions.push(
          or(
            like(standardTerms.term, `%${keyword}%`)
          ) as any
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const terms = await db
        .select()
        .from(standardTerms)
        .where(whereClause)
        .orderBy(standardTerms.createdAt)
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(standardTerms)
        .where(whereClause);

      const total = countResult[0]?.count || 0;

      return NextResponse.json({
        success: true,
        data: {
          terms,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }
  } catch (error: any) {
    console.error('查询词库失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '查询词库失败',
      },
      { status: 500 }
    );
  }
}
