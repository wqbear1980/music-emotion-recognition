-- 添加缺失的字段到 music_analyses 表

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS source_type TEXT;

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS film_name TEXT;

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS film_scene TEXT;

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS creators JSONB;

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS publisher TEXT;

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS platform TEXT;

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS confidence TEXT;

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS confidence_reason TEXT;

ALTER TABLE music_analyses
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 创建缺失的索引
CREATE INDEX IF NOT EXISTS music_analyses_film_name_idx
ON music_analyses(film_name);

CREATE INDEX IF NOT EXISTS music_analyses_confidence_idx
ON music_analyses(confidence);

-- 添加注释
COMMENT ON COLUMN music_analyses.source_type IS '出处类型：album（专辑）、film（影视）、creator（创作者）、unknown（未识别）';
COMMENT ON COLUMN music_analyses.film_name IS '影视/综艺名称（标准化）';
COMMENT ON COLUMN music_analyses.film_scene IS '具体场景：第X集片尾/第X集第X分钟XX场景';
COMMENT ON COLUMN music_analyses.creators IS '创作者信息（作曲、演唱、编曲、作词、制作人）';
COMMENT ON COLUMN music_analyses.publisher IS '发行方：唱片公司/影视公司';
COMMENT ON COLUMN music_analyses.platform IS '首发平台：腾讯音乐/网易云音乐/Netflix等';
COMMENT ON COLUMN music_analyses.confidence IS '置信度等级：high（90%+）、medium（50-89%）、low（<50%）';
COMMENT ON COLUMN music_analyses.confidence_reason IS '判断依据和说明';
COMMENT ON COLUMN music_analyses.metadata IS '音频元数据（从文件提取）';
