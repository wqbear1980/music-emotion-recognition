import { NextRequest, NextResponse } from "next/server";
import { getDb } from "coze-coding-dev-sdk";
import { sql } from "drizzle-orm";

/**
 * 验证SQL语句
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();

    console.log('Testing manual insert...');

    // 手动构建INSERT语句，只插入11个字段
    const insertSQL = sql`
      INSERT INTO music_analyses (
        file_name, file_key, file_size, duration, bpm, summary, film_type,
        source_type, album, film_name, film_scene
      ) VALUES (
        'verify-test.m4a', 'verify-key', 1024000, 180, 120, 'verify summary', '动作片',
        'album', 'verify album', 'verify film', 'verify scene'
      ) RETURNING id, file_name
    `;

    console.log('Executing manual insert...');
    const result = await db.execute(insertSQL);
    console.log('Manual insert result:', result.rows[0]);

    return NextResponse.json({
      success: true,
      message: 'Manual insert successful',
      result: result.rows[0],
    });
  } catch (error: any) {
    console.error('Manual insert failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Manual insert failed',
        details: error.stack
      },
      { status: 500 }
    );
  }
}
