import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

/**
 * 列出music_analyses表的所有列
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();

    const columnsResult = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'music_analyses'
      ORDER BY ordinal_position;
    `);

    const columns = columnsResult.rows?.map(r => r.column_name) || [];

    return NextResponse.json({
      success: true,
      columns,
    });
  } catch (error: any) {
    console.error('列出列失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '列出列失败',
      },
      { status: 500 }
    );
  }
}
