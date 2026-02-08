import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

/**
 * 初始化数据库
 * 创建music_analyses和scene_optimization_samples表（如果不存在）
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();

    // 检查 music_analyses 表是否存在
    const checkMusicAnalysesResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'music_analyses'
      );
    `);

    const musicAnalysesTableExists = checkMusicAnalysesResult.rows?.[0]?.exists;

    // 检查 scene_optimization_samples 表是否存在
    const checkSceneOptimizationSamplesResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scene_optimization_samples'
      );
    `);

    const sceneOptimizationSamplesTableExists = checkSceneOptimizationSamplesResult.rows?.[0]?.exists;

    // 检查 user_feedback 表是否存在
    const checkUserFeedbackResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_feedback'
      );
    `);

    const userFeedbackTableExists = checkUserFeedbackResult.rows?.[0]?.exists;

    // 创建 music_analyses 表
    if (!musicAnalysesTableExists) {
      await db.execute(sql`
        CREATE TABLE music_analyses (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          file_name VARCHAR(512) NOT NULL,
          file_key TEXT,
          file_size INTEGER NOT NULL,
          music_md5 VARCHAR(64),
          duration INTEGER,
          bpm INTEGER,
          is_online BOOLEAN NOT NULL DEFAULT false,
          is_uploaded BOOLEAN NOT NULL DEFAULT false,
          uploaded_at TIMESTAMP WITH TIME ZONE,
          summary TEXT,
          film_type TEXT,
          emotion_tags JSONB,
          film_scenes JSONB,
          scenarios JSONB,
          instruments JSONB,
          styles JSONB,
          source_type TEXT,
          album TEXT,
          film_name TEXT,
          film_scene TEXT,
          creators JSONB,
          publisher TEXT,
          platform TEXT,
          confidence TEXT,
          confidence_reason TEXT,
          metadata JSONB,
          other_features JSONB,
          candidate_terms JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // 创建索引
      await db.execute(sql`CREATE INDEX music_analyses_file_name_idx ON music_analyses(file_name);`);
      await db.execute(sql`CREATE INDEX music_analyses_created_at_idx ON music_analyses(created_at);`);
      await db.execute(sql`CREATE INDEX music_analyses_album_idx ON music_analyses(album);`);
      await db.execute(sql`CREATE INDEX music_analyses_film_name_idx ON music_analyses(film_name);`);
      await db.execute(sql`CREATE INDEX music_analyses_confidence_idx ON music_analyses(confidence);`);
      await db.execute(sql`CREATE INDEX music_analyses_music_md5_idx ON music_analyses(music_md5);`);
    }

    // 创建 scene_optimization_samples 表
    if (!sceneOptimizationSamplesTableExists) {
      await db.execute(sql`
        CREATE TABLE scene_optimization_samples (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          file_name VARCHAR(512) NOT NULL,
          scene VARCHAR(100),
          score INTEGER,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // 创建索引
      await db.execute(sql`CREATE INDEX scene_optimization_samples_file_name_idx ON scene_optimization_samples(file_name);`);
      await db.execute(sql`CREATE INDEX scene_optimization_samples_created_at_idx ON scene_optimization_samples(created_at);`);
    }

    // 创建 user_feedback 表
    if (!userFeedbackTableExists) {
      await db.execute(sql`
        CREATE TABLE user_feedback (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          analysis_id VARCHAR(36) NOT NULL,
          file_name VARCHAR(512) NOT NULL,
          feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correct', 'incorrect', 'partial')),
          corrected_fields JSONB,
          user_reason TEXT,
          quality_score INTEGER,
          is_processed BOOLEAN NOT NULL DEFAULT false,
          processed_by VARCHAR(256),
          processed_at TIMESTAMP WITH TIME ZONE,
          marked_for_training BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // 创建索引
      await db.execute(sql`CREATE INDEX user_feedback_analysis_id_idx ON user_feedback(analysis_id);`);
      await db.execute(sql`CREATE INDEX user_feedback_feedback_type_idx ON user_feedback(feedback_type);`);
      await db.execute(sql`CREATE INDEX user_feedback_created_at_idx ON user_feedback(created_at);`);
    }

    return NextResponse.json({
      success: true,
      message: '数据库初始化完成',
      tables: {
        music_analyses: {
          exists: musicAnalysesTableExists,
          status: musicAnalysesTableExists ? '已存在' : '创建成功'
        },
        scene_optimization_samples: {
          exists: sceneOptimizationSamplesTableExists,
          status: sceneOptimizationSamplesTableExists ? '已存在' : '创建成功'
        },
        user_feedback: {
          exists: userFeedbackTableExists,
          status: userFeedbackTableExists ? '已存在' : '创建成功'
        }
      }
    });
  } catch (error: any) {
    console.error('初始化数据库失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '初始化数据库失败',
        details: error.stack
      },
      { status: 500 }
    );
  }
}
