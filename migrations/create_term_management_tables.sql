-- 创建标准词库表
CREATE TABLE IF NOT EXISTS standard_terms (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  term VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL,
  term_type VARCHAR(20) NOT NULL,
  film_types JSONB,
  synonyms JSONB,
  is_auto_expanded BOOLEAN DEFAULT false,
  expansion_source VARCHAR(50),
  expansion_reason TEXT,
  review_status VARCHAR(20) NOT NULL DEFAULT 'approved',
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_comment TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建词库扩充记录表
CREATE TABLE IF NOT EXISTS term_expansion_records (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id VARCHAR(36) REFERENCES standard_terms(id),
  term VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  term_type VARCHAR(20) NOT NULL,
  trigger_count INTEGER NOT NULL,
  bound_film_types JSONB,
  validation_passed BOOLEAN NOT NULL,
  validation_details JSONB,
  expansion_type VARCHAR(20) NOT NULL,
  expanded_by VARCHAR(100),
  expansion_batch_id VARCHAR(50),
  historical_data_cleaned BOOLEAN DEFAULT false,
  cleaned_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 创建未识别内容统计表
CREATE TABLE IF NOT EXISTS unrecognized_terms (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  term VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  occurrence_count INTEGER NOT NULL,
  first_seen_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  related_film_types JSONB,
  expansion_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS standard_terms_category_idx ON standard_terms(category);
CREATE INDEX IF NOT EXISTS standard_terms_term_type_idx ON standard_terms(term_type);
CREATE INDEX IF NOT EXISTS standard_terms_review_status_idx ON standard_terms(review_status);
CREATE INDEX IF NOT EXISTS standard_terms_is_auto_expanded_idx ON standard_terms(is_auto_expanded);

CREATE INDEX IF NOT EXISTS term_expansion_records_batch_idx ON term_expansion_records(expansion_batch_id);
CREATE INDEX IF NOT EXISTS term_expansion_records_category_idx ON term_expansion_records(category);
CREATE INDEX IF NOT EXISTS term_expansion_records_type_idx ON term_expansion_records(expansion_type);
CREATE INDEX IF NOT EXISTS term_expansion_records_created_at_idx ON term_expansion_records(created_at);

CREATE INDEX IF NOT EXISTS unrecognized_terms_category_idx ON unrecognized_terms(category);
CREATE INDEX IF NOT EXISTS unrecognized_terms_status_idx ON unrecognized_terms(expansion_status);
CREATE INDEX IF NOT EXISTS unrecognized_terms_count_idx ON unrecognized_terms(occurrence_count);
CREATE INDEX IF NOT EXISTS unrecognized_terms_created_at_idx ON unrecognized_terms(created_at);
