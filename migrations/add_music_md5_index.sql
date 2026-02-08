-- 添加music_md5字段索引
-- 用于提高重复上传检测的查询性能

-- 创建索引
CREATE INDEX IF NOT EXISTS music_analyses_music_md5_idx ON music_analyses(music_md5);

COMMENT ON INDEX music_analyses_music_md5_idx IS '用于根据MD5快速查询音乐分析记录，支持重复上传检测';
