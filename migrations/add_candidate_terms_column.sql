-- 添加候选新词字段到音乐分析表
-- 用于支持智能扩充机制

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS candidate_terms JSONB;

-- 添加注释
COMMENT ON COLUMN music_analyses.candidate_terms IS '候选新词（用于智能扩充），包含场景词和配音建议词的候选推荐';

-- 添加索引（可选，如果需要频繁查询候选词）
-- CREATE INDEX IF NOT EXISTS idx_music_analyses_candidate_terms ON music_analyses USING GIN(candidate_terms);
