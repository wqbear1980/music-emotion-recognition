import { NextRequest, NextResponse } from 'next/server';
import { insertUserFeedbackSchema } from '@/storage/database/shared/schema';
import { getRawClient } from '@/storage/database/rawClient';
import { sql } from 'drizzle-orm';

/**
 * POST /api/user-feedback
 * 提交用户反馈
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 简单验证必填字段
    if (!body.analysisId || !body.fileName || !body.feedbackType) {
      return NextResponse.json({
        success: false,
        error: '缺少必填字段：analysisId, fileName, feedbackType'
      }, { status: 400 });
    }

    // 使用原始SQL插入
    const client = await getRawClient();
    const insertSQL = `
      INSERT INTO user_feedback (
        analysis_id,
        file_name,
        feedback_type,
        corrected_fields,
        user_reason
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const values = [
      body.analysisId,
      body.fileName,
      body.feedbackType,
      body.correctedFields ? JSON.stringify(body.correctedFields) : null,
      body.userReason || null
    ];

    const result = await client.query(insertSQL, values);
    const newFeedback = result.rows[0];

    // 解析 JSON 字段
    if (newFeedback.corrected_fields) {
      try {
        newFeedback.corrected_fields = JSON.parse(newFeedback.corrected_fields);
      } catch (e) {
        // 解析失败，保持原样
      }
    }

    return NextResponse.json({
      success: true,
      data: newFeedback,
      message: '反馈提交成功'
    });
  } catch (error: any) {
    console.error('[用户反馈] 提交失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '反馈提交失败'
    }, { status: 400 });
  }
}

/**
 * GET /api/user-feedback
 * 获取用户反馈列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const analysisId = searchParams.get('analysisId');
    const feedbackType = searchParams.get('feedbackType');
    const isProcessed = searchParams.get('isProcessed');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const client = await getRawClient();

    // 构建查询
    let query = `
      SELECT * FROM user_feedback
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (analysisId) {
      query += ` AND analysis_id = $${paramIndex}`;
      params.push(analysisId);
      paramIndex++;
    }

    if (feedbackType) {
      query += ` AND feedback_type = $${paramIndex}`;
      params.push(feedbackType);
      paramIndex++;
    }

    if (isProcessed !== null) {
      query += ` AND is_processed = $${paramIndex}`;
      params.push(isProcessed === 'true');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // 解析 JSON 字段
    const feedbacks = result.rows.map((row: any) => {
      if (row.corrected_fields && typeof row.corrected_fields === 'string') {
        try {
          row.corrected_fields = JSON.parse(row.corrected_fields);
        } catch (e) {
          // 解析失败，保持原样
        }
      }
      return row;
    });

    return NextResponse.json({
      success: true,
      data: feedbacks,
      count: feedbacks.length
    });
  } catch (error: any) {
    console.error('[用户反馈] 获取失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '获取反馈列表失败'
    }, { status: 500 });
  }
}
