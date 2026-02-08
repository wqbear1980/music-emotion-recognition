import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

/**
 * 保存待优化样本数据
 * 当二次识别后仍无法匹配到明确场景时，将数据存入待优化样本库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      musicAnalysisId,
      fileName,
      fileKey,
      audioFeatures,
      emotionalFeatures,
      matchResults,
      bestMatch,
      candidateScenes,
    } = body;

    if (!fileName || !audioFeatures || !emotionalFeatures) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数：fileName、audioFeatures、emotionalFeatures',
        },
        { status: 400 }
      );
    }

    const db = await getDb();

    // 检查是否已存在相同文件的记录
    const existingResult = await db.execute(sql`
      SELECT id FROM "scene_optimization_samples"
      WHERE "file_name" = ${fileName}
      LIMIT 1
    `);

    if (existingResult.rows && existingResult.rows.length > 0) {
      // 更新现有记录
      await db.execute(sql`
        UPDATE "scene_optimization_samples"
        SET
          "audio_features" = ${JSON.stringify(audioFeatures)}::jsonb,
          "emotional_features" = ${JSON.stringify(emotionalFeatures)}::jsonb,
          "reanalysis_status" = 'completed',
          "match_results" = ${JSON.stringify(matchResults)}::jsonb,
          "best_match" = ${JSON.stringify(bestMatch)}::jsonb,
          "candidate_scenes" = ${JSON.stringify(candidateScenes)}::jsonb,
          "optimization_status" = 'pending',
          "updated_at" = NOW()
        WHERE "file_name" = ${fileName}
      `);

      console.log(`[待优化样本] 更新文件"${fileName}"的样本数据`);
    } else {
      // 插入新记录
      await db.execute(sql`
        INSERT INTO "scene_optimization_samples" (
          file_name,
          file_key,
          audio_features,
          emotional_features,
          reanalysis_status,
          match_results,
          best_match,
          candidate_scenes,
          optimization_status,
          created_at,
          updated_at
        ) VALUES (
          ${fileName},
          ${fileKey || null},
          ${JSON.stringify(audioFeatures)}::jsonb,
          ${JSON.stringify(emotionalFeatures)}::jsonb,
          'completed',
          ${JSON.stringify(matchResults)}::jsonb,
          ${JSON.stringify(bestMatch)}::jsonb,
          ${JSON.stringify(candidateScenes)}::jsonb,
          'pending',
          NOW(),
          NOW()
        )
      `);

      console.log(`[待优化样本] 保存文件"${fileName}"的样本数据`);
    }

    return NextResponse.json({
      success: true,
      message: '待优化样本数据保存成功',
    });
  } catch (error: any) {
    console.error('[待优化样本] 保存失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '保存待优化样本数据失败',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

/**
 * 获取待优化样本列表
 * 用于人工标注和模型训练
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') || 'pending'; // pending, annotated, optimized, rejected

    const db = await getDb();
    const offset = (page - 1) * pageSize;

    // 查询待优化样本列表
    const result = await db.execute(sql`
      SELECT
        id,
        file_name,
        file_key,
        audio_features,
        emotional_features,
        reanalysis_status,
        best_match,
        manual_annotation,
        candidate_scenes,
        optimization_status,
        used_for_training,
        created_at,
        updated_at
      FROM "scene_optimization_samples"
      WHERE "optimization_status" = ${status}
      ORDER BY "created_at" DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    // 查询总数
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM "scene_optimization_samples"
      WHERE "optimization_status" = ${status}
    `);

    const countRow = countResult.rows?.[0] as any;
    const total = parseInt(countRow?.count || '0');
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('[待优化样本] 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '查询待优化样本失败',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

/**
 * 更新待优化样本的标注信息
 * 用于人工标注
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, sceneName, confidence, annotatedBy, comment } = body;

    if (!id || !sceneName) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数：id, sceneName',
        },
        { status: 400 }
      );
    }

    const db = await getDb();

    // 更新标注信息
    await db.execute(sql`
      UPDATE "scene_optimization_samples"
      SET
        "manual_annotation" = ${JSON.stringify({
          sceneName,
          confidence,
          annotatedBy,
          annotatedAt: new Date().toISOString(),
          comment,
        })}::jsonb,
        "optimization_status" = 'annotated',
        "updated_at" = NOW()
      WHERE "id" = ${id}
    `);

    console.log(`[待优化样本] 更新样本"${id}"的标注信息`);

    return NextResponse.json({
      success: true,
      message: '标注信息更新成功',
    });
  } catch (error: any) {
    console.error('[待优化样本] 更新标注失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '更新标注信息失败',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
