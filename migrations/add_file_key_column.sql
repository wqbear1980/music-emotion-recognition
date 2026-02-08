-- 添加 fileKey 字段到 music_analyses 表
ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS file_key TEXT;

-- 为 fileKey 字段添加索引
CREATE INDEX IF NOT EXISTS music_analyses_file_key_idx
ON music_analyses(file_key);

COMMENT ON COLUMN music_analyses.file_key IS '对象存储 key（用于文件下载）';
