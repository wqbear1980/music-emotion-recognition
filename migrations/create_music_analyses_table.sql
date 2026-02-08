-- 创建音乐分析结果表
CREATE TABLE IF NOT EXISTS music_analyses (
  id VARCHAR(36) PRIMARY KEY,
  file_name VARCHAR(512) NOT NULL,
  file_key TEXT,
  file_size INTEGER NOT NULL,
  duration INTEGER,
  bpm INTEGER,
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

-- 创建索引
CREATE INDEX IF NOT EXISTS music_analyses_file_name_idx ON music_analyses(file_name);
CREATE INDEX IF NOT EXISTS music_analyses_created_at_idx ON music_analyses(created_at);
CREATE INDEX IF NOT EXISTS music_analyses_album_idx ON music_analyses(album);
CREATE INDEX IF NOT EXISTS music_analyses_film_name_idx ON music_analyses(film_name);
CREATE INDEX IF NOT EXISTS music_analyses_confidence_idx ON music_analyses(confidence);
