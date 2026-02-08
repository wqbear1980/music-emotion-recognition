-- 为 file_name 字段添加唯一约束
-- 先删除可能存在的重复记录，只保留每个文件名的最新记录
DELETE FROM music_analyses a
WHERE id NOT IN (
  SELECT MAX(id)
  FROM music_analyses
  GROUP BY file_name
);

-- 添加唯一约束
ALTER TABLE music_analyses
ADD CONSTRAINT music_analyses_file_name_key UNIQUE (file_name);
