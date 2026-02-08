-- 添加 is_online 字段到 music_analyses 表
-- 用于标识文件是否在线：true=文件在线，false=未在线

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

-- 为现有记录设置默认值：如果有 file_key，说明文件在线，设置为 true；否则设置为 false
UPDATE music_analyses
SET is_online = CASE
  WHEN file_key IS NOT NULL AND file_key != '' THEN true
  ELSE false
END;

-- 创建索引以加速在线状态查询
CREATE INDEX IF NOT EXISTS music_analyses_is_online_idx
ON music_analyses(is_online);
