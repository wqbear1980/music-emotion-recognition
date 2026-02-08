import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

/**
 * 音乐分析结果表
 * 存储每首音乐的总结分析结果，包含5大分类维度的标签
 */
export const musicAnalyses = pgTable(
  "music_analyses",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // 基础音乐信息
    fileName: varchar("file_name", { length: 512 }).notNull(),
    fileKey: text("file_key"), // 对象存储 key（用于文件下载）
    fileSize: integer("file_size").notNull(), // 文件大小（字节）
    musicMd5: varchar("music_md5", { length: 64 }), // 音乐文件的MD5值，作为唯一标识
    duration: integer("duration"), // 时长（秒）
    bpm: integer("bpm"), // BPM
    isOnline: boolean("is_online").notNull().default(false), // 文件在线状态：true=文件在线，false=未在线
    isUploaded: boolean("is_uploaded").notNull().default(false), // 云端上传状态：true=已上传至云端，false=仅本地存储
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }), // 上传至云端的时间
    
    // 整体总结文本
    summary: text("summary"),

    // 影片类型（标准术语，自动识别的唯一依据）
    filmType: text("film_type"), // 影片类型：恐怖片、职场剧（医护题材）、魔幻片等

    // 5大分类维度的标签（JSON数组）
    emotionTags: jsonb("emotion_tags").$type<string[]>(), // 情绪识别类：治愈、悲伤、欢快等
    filmScenes: jsonb("film_scenes").$type<string[]>(), // 影视配乐建议类：悬疑剧、爱情片等
    scenarios: jsonb("scenarios").$type<string[]>(), // 场景建议类：咖啡厅、健身房等
    instruments: jsonb("instruments").$type<string[]>(), // 乐器分析类：钢琴独奏、吉他+鼓等
    styles: jsonb("styles").$type<string[]>(), // 音乐风格类：流行、古典、爵士等
    
    // 音乐出处识别信息
    sourceType: text("source_type"), // 出处类型：album（专辑）、film（影视）、creator（创作者）、unknown（未识别）
    album: text("album"), // 专辑名称（标准化）
    albumTranslated: text("album_translated"), // 专辑名称（中文翻译）
    filmName: text("film_name"), // 影视/综艺名称（标准化）
    filmScene: text("film_scene"), // 具体场景：第X集片尾/第X集第X分钟XX场景
    creators: jsonb("creators").$type<{
      composer?: string[]; // 作曲
      singer?: string[]; // 演唱
      arranger?: string[]; // 编曲
      lyricist?: string[]; // 作词
      producer?: string[]; // 制作人
    }>(), // 创作者信息
    publisher: text("publisher"), // 发行方：唱片公司/影视公司
    platform: text("platform"), // 首发平台：腾讯音乐/网易云音乐/Netflix等
    confidence: text("confidence"), // 置信度等级：high（90%+）、medium（50-89%）、low（<50%）
    confidenceReason: text("confidence_reason"), // 判断依据和说明
    
    // 音频元数据（从文件提取）
    metadata: jsonb("metadata").$type<{
      title?: string; // 歌曲标题
      artist?: string; // 艺术家
      album?: string; // 专辑
      year?: number; // 发行年份
      track?: number; // 曲目序号
      genre?: string; // 流派
    }>(), // 原始元数据
    
    // 其他信息
    otherFeatures: jsonb("other_features").$type<{
      structure?: string;
      harmony?: string;
      rhythm?: string;
      culture?: string;
    }>(), // 其他特征（结构、和声、节奏、文化等）
    
    // 候选新词（用于智能扩充）
    candidateTerms: jsonb("candidate_terms").$type<{
      scenarios?: Array<{
        term: string;          // 候选词
        synonyms: string[];    // 近义词
        filmTypes: string[];   // 适配类型
        confidence: number;    // 置信度
        reason: string;        // 理由
      }>;
      dubbing?: Array<{
        term: string;          // 候选词
        synonyms: string[];    // 近义词
        filmTypes: string[];   // 适配类型
        confidence: number;    // 置信度
        reason: string;        // 理由
      }>;
    }>(), // 候选新词
    
    // 时间戳
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    // 为常用查询字段添加索引
    fileNameIdx: index("music_analyses_file_name_idx").on(table.fileName),
    createdAtIdx: index("music_analyses_created_at_idx").on(table.createdAt),
    albumIdx: index("music_analyses_album_idx").on(table.album),
    filmNameIdx: index("music_analyses_film_name_idx").on(table.filmName),
    confidenceIdx: index("music_analyses_confidence_idx").on(table.confidence),
    musicMd5Idx: index("music_analyses_music_md5_idx").on(table.musicMd5), // 添加MD5索引
  })
);

// 使用 createSchemaFactory 配置 date coercion
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// Zod schemas for validation
export const insertMusicAnalysisSchema = createCoercedInsertSchema(musicAnalyses).pick({
  // 排除有默认值的字段（id, created_at），只包含需要手动赋值的字段
  fileName: true,
  fileKey: true,
  fileSize: true,
  musicMd5: true, // 添加musicMd5字段
  duration: true,
  bpm: true,
  isOnline: true,
  isUploaded: true,
  uploadedAt: true,
  summary: true,
  filmType: true,
  emotionTags: true,
  filmScenes: true,
  scenarios: true,
  instruments: true,
  styles: true,
  sourceType: true,
  album: true,
  albumTranslated: true,
  filmName: true,
  filmScene: true,
  creators: true,
  publisher: true,
  platform: true,
  confidence: true,
  confidenceReason: true,
  metadata: true,
  otherFeatures: true,
  candidateTerms: true,
});

export const updateMusicAnalysisSchema = createCoercedInsertSchema(musicAnalyses)
  .pick({
    summary: true,
    filmType: true,
    emotionTags: true,
    filmScenes: true,
    scenarios: true,
    instruments: true,
    styles: true,
    album: true,
    albumTranslated: true,
    otherFeatures: true,
    candidateTerms: true,
    sourceType: true,
    filmName: true,
    filmScene: true,
    creators: true,
    publisher: true,
    platform: true,
    confidence: true,
    confidenceReason: true,
    metadata: true,
    isOnline: true,
    isUploaded: true,
    uploadedAt: true,
  })
  .partial();

// TypeScript types
export type MusicAnalysis = typeof musicAnalyses.$inferSelect;
export type InsertMusicAnalysis = z.infer<typeof insertMusicAnalysisSchema>;
export type UpdateMusicAnalysis = z.infer<typeof updateMusicAnalysisSchema>;

/**
 * 用户反馈表
 * 存储用户对AI分析结果的反馈，用于优化识别准确率
 */
export const userFeedback = pgTable(
  "user_feedback",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // 关联的音乐分析记录
    analysisId: varchar("analysis_id", { length: 36 }).notNull(),
    fileName: varchar("file_name", { length: 512 }).notNull(),

    // 反馈类型
    feedbackType: text("feedback_type", { enum: ["correct", "incorrect", "partial"] }).notNull(),

    // 修正的字段
    correctedFields: jsonb("corrected_fields").$type<{
      mood?: { original: string; corrected: string };
      style?: { original: string; corrected: string };
      filmType?: { original: string; corrected: string };
      scenarios?: { original: string[]; corrected: string[] };
      emotionTags?: { original: string[]; corrected: string[] };
      instruments?: { original: string[]; corrected: string[] };
    }>(),

    // 用户说明
    userReason: text("user_reason"),

    // 反馈质量评分（管理员评审后打分）
    qualityScore: integer("quality_score"), // 0-100

    // 是否已处理
    isProcessed: boolean("is_processed").notNull().default(false),

    // 处理人
    processedBy: varchar("processed_by", { length: 256 }),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    // 是否标记为训练数据
    markedForTraining: boolean("marked_for_training").notNull().default(false),

    // 时间戳
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    analysisIdIdx: index("user_feedback_analysis_id_idx").on(table.analysisId),
    feedbackTypeIdx: index("user_feedback_feedback_type_idx").on(table.feedbackType),
    createdAtIdx: index("user_feedback_created_at_idx").on(table.createdAt),
  })
);

export const insertUserFeedbackSchema = createCoercedInsertSchema(userFeedback).pick({
  analysisId: true,
  fileName: true,
  feedbackType: true,
  correctedFields: true,
  userReason: true,
});

export const updateUserFeedbackSchema = createCoercedInsertSchema(userFeedback)
  .pick({
    qualityScore: true,
    isProcessed: true,
    processedBy: true,
    processedAt: true,
    markedForTraining: true,
    userReason: true,
  })
  .partial();

export type UserFeedback = typeof userFeedback.$inferSelect;
export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;
export type UpdateUserFeedback = z.infer<typeof updateUserFeedbackSchema>;

/**
 * 分类统计结果类型
 */
export interface CategoryStats {
  category: string; // 分类名称（emotion、film、scenario、instrument、style）
  label: string; // 标签值
  count: number; // 音乐数量
  details?: Array<{ label: string; count: number }>; // 子分类详情（可选）
}




/**
 * 标准词库表
 * 存储所有标准术语，包括核心词和扩展词，支持自动扩充和审核
 */
export const standardTerms = pgTable(
  "standard_terms",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // 词的基础信息
    term: varchar("term", { length: 100 }).notNull().unique(), // 标准词（唯一）
    category: varchar("category", { length: 50 }).notNull(), // 分类：emotion、film、scenario、instrument、style、dubbing
    termType: varchar("term_type", { length: 20 }).notNull(), // 词类型：core（核心词）、extended（扩展词）
    
    // 类型绑定（影视类型/适用场景）
    filmTypes: jsonb("film_types").$type<string[]>(), // 适配的影视类型数组
    
    // 近义词管理
    synonyms: jsonb("synonyms").$type<string[]>(), // 禁用近义词列表
    
    // 扩充信息
    isAutoExpanded: boolean("is_auto_expanded").default(false), // 是否自动扩充
    expansionSource: varchar("expansion_source", { length: 50 }), // 扩充来源：auto（自动）、manual（人工）
    expansionReason: text("expansion_reason"), // 扩充原因说明
    
    // 审核状态
    reviewStatus: varchar("review_status", { length: 20 }).notNull().default("approved"), // 审核状态：pending（待审核）、approved（已通过）、rejected（已拒绝）
    reviewedBy: varchar("reviewed_by", { length: 100 }), // 审核人
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }), // 审核时间
    reviewComment: text("review_comment"), // 审核意见
    
    // 统计信息
    usageCount: integer("usage_count").default(0), // 使用次数
    
    // 时间戳
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    // 为常用查询字段添加索引
    categoryIdx: index("standard_terms_category_idx").on(table.category),
    termTypeIdx: index("standard_terms_term_type_idx").on(table.termType),
    reviewStatusIdx: index("standard_terms_review_status_idx").on(table.reviewStatus),
    isAutoExpandedIdx: index("standard_terms_is_auto_expanded_idx").on(table.isAutoExpanded),
  })
);

/**
 * 词库扩充记录表
 * 记录每次自动扩充或手动扩充的详细信息
 */
export const termExpansionRecords = pgTable(
  "term_expansion_records",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // 扩充的词信息
    termId: varchar("term_id", { length: 36 }).references(() => standardTerms.id), // 关联的标准词ID
    term: varchar("term", { length: 100 }).notNull(), // 标准词
    category: varchar("category", { length: 50 }).notNull(), // 分类
    termType: varchar("term_type", { length: 20 }).notNull(), // 词类型：core、extended
    
    // 触发条件
    triggerCount: integer("trigger_count").notNull(), // 触发频率（未识别次数）
    boundFilmTypes: jsonb("bound_film_types").$type<string[]>(), // 绑定的影视类型
    
    // 校验结果
    validationPassed: boolean("validation_passed").notNull(), // 是否通过校验
    validationDetails: jsonb("validation_details").$type<{
      namingNormalized?: boolean; // 命名是否标准化
      synonymsChecked?: boolean; // 近义词是否已检查
      conflictsResolved?: boolean; // 冲突是否已解决
    }>(), // 校验详情
    
    // 扩充操作
    expansionType: varchar("expansion_type", { length: 20 }).notNull(), // 扩充类型：auto（自动）、manual（人工）
    expandedBy: varchar("expanded_by", { length: 100 }), // 操作人（auto 表示系统）
    expansionBatchId: varchar("expansion_batch_id", { length: 50 }), // 批次ID（批量扩充时使用）
    
    // 数据清洗
    historicalDataCleaned: boolean("historical_data_cleaned").default(false), // 历史数据是否已清洗
    cleanedCount: integer("cleaned_count").default(0), // 清洗的记录数
    
    // 时间戳
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 为常用查询字段添加索引
    expansionBatchIdIdx: index("term_expansion_records_batch_idx").on(table.expansionBatchId),
    categoryIdx: index("term_expansion_records_category_idx").on(table.category),
    expansionTypeIdx: index("term_expansion_records_type_idx").on(table.expansionType),
    createdAtIdx: index("term_expansion_records_created_at_idx").on(table.createdAt),
  })
);

/**
 * 未识别内容统计表
 * 定期统计未分类/未识别的内容，为自动扩充提供数据支持
 */
export const unrecognizedTerms = pgTable(
  "unrecognized_terms",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // 未识别内容信息
    term: varchar("term", { length: 200 }).notNull(), // 原始内容
    category: varchar("category", { length: 50 }).notNull(), // 分类：dubbing（配音）、scenario（场景）
    
    // 统计信息
    occurrenceCount: integer("occurrence_count").notNull(), // 出现次数
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }), // 首次出现时间
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }), // 最后出现时间
    
    // 分析信息
    relatedFilmTypes: jsonb("related_film_types").$type<{
      filmType: string;
      count: number;
    }[]>(), // 关联的影视类型及出现次数
    
    // 扩充状态
    expansionStatus: varchar("expansion_status", { length: 20 }).default("pending"), // 扩充状态：pending（待处理）、eligible（符合条件）、ineligible（不符合条件）、expanded（已扩充）、rejected（已拒绝）
    rejectionReason: text("rejection_reason"), // 拒绝原因
    
    // 时间戳
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    // 为常用查询字段添加索引
    categoryIdx: index("unrecognized_terms_category_idx").on(table.category),
    expansionStatusIdx: index("unrecognized_terms_status_idx").on(table.expansionStatus),
    occurrenceCountIdx: index("unrecognized_terms_count_idx").on(table.occurrenceCount),
    createdAtIdx: index("unrecognized_terms_created_at_idx").on(table.createdAt),
  })
);

// Zod schemas for standard terms
export const insertStandardTermSchema = createCoercedInsertSchema(standardTerms).pick({
  term: true,
  category: true,
  termType: true,
  filmTypes: true,
  synonyms: true,
  isAutoExpanded: true,
  expansionSource: true,
  expansionReason: true,
  reviewStatus: true,
  reviewedBy: true,
  reviewComment: true,
  usageCount: true,
});

export const updateStandardTermSchema = createCoercedInsertSchema(standardTerms)
  .pick({
    filmTypes: true,
    synonyms: true,
    reviewStatus: true,
    reviewedBy: true,
    reviewComment: true,
    usageCount: true,
  })
  .partial();

// Zod schemas for expansion records
export const insertTermExpansionRecordSchema = createCoercedInsertSchema(termExpansionRecords).pick({
  termId: true,
  term: true,
  category: true,
  termType: true,
  triggerCount: true,
  boundFilmTypes: true,
  validationPassed: true,
  validationDetails: true,
  expansionType: true,
  expandedBy: true,
  expansionBatchId: true,
  historicalDataCleaned: true,
  cleanedCount: true,
});

// Zod schemas for unrecognized terms
export const insertUnrecognizedTermSchema = createCoercedInsertSchema(unrecognizedTerms).pick({
  term: true,
  category: true,
  occurrenceCount: true,
  firstSeenAt: true,
  lastSeenAt: true,
  relatedFilmTypes: true,
  expansionStatus: true,
  rejectionReason: true,
});

export const updateUnrecognizedTermSchema = createCoercedInsertSchema(unrecognizedTerms)
  .pick({
    occurrenceCount: true,
    lastSeenAt: true,
    relatedFilmTypes: true,
    expansionStatus: true,
    rejectionReason: true,
  })
  .partial();

// TypeScript types
export type StandardTerm = typeof standardTerms.$inferSelect;
export type InsertStandardTerm = z.infer<typeof insertStandardTermSchema>;
export type UpdateStandardTerm = z.infer<typeof updateStandardTermSchema>;

export type TermExpansionRecord = typeof termExpansionRecords.$inferSelect;
export type InsertTermExpansionRecord = z.infer<typeof insertTermExpansionRecordSchema>;

export type UnrecognizedTerm = typeof unrecognizedTerms.$inferSelect;
export type InsertUnrecognizedTerm = z.infer<typeof insertUnrecognizedTermSchema>;
export type UpdateUnrecognizedTerm = z.infer<typeof updateUnrecognizedTermSchema>;

/**
 * 待优化样本库表
 * 存储二次识别后仍无法识别的文件音频特征数据
 * 用于人工标注和模型训练优化
 */
export const sceneOptimizationSamples = pgTable(
  "scene_optimization_samples",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // 关联信息
    musicAnalysisId: varchar("music_analysis_id", { length: 36 }).references(() => musicAnalyses.id), // 关联的音乐分析记录ID
    fileName: varchar("file_name", { length: 512 }).notNull(), // 文件名
    fileKey: text("file_key"), // 对象存储 key

    // 音频特征（从文件提取）
    audioFeatures: jsonb("audio_features").$type<{
      bpm: number;
      duration: number;
      frequencyProfile: {
        low: number;
        mid: number;
        high: number;
      };
      energy: number;
      dynamics: {
        average: number;
        max: number;
        range: number;
      };
      rhythm: {
        consistency: number;
        complexity: number;
      };
      harmonic: {
        brightness: number;
        warmth: number;
      };
      texture: {
        density: number;
        layering: number;
      };
    }>(), // 音频特征

    // 情绪特征
    emotionalFeatures: jsonb("emotional_features").$type<{
      primary: string; // 主情绪
      intensity: string; // 情绪强度（低、中、高）
      secondary: string[]; // 次要情绪
    }>(), // 情绪特征

    // 二次识别结果
    reanalysisStatus: varchar("reanalysis_status", { length: 20 }).notNull().default("pending"), // 二次识别状态：pending（待识别）、processing（识别中）、completed（已完成）
    matchResults: jsonb("match_results").$type<Array<{
      sceneName: string; // 场景名称
      matchScore: number; // 匹配分数（0-100）
      matchDetails: { // 匹配详情
        rhythmMatch: number; // 节奏匹配度
        volumeMatch: number; // 音量匹配度
        emotionMatch: number; // 情绪匹配度
        overallMatch: number; // 综合匹配度
      };
    }>>(), // 匹配结果列表
    bestMatch: jsonb("best_match").$type<{
      sceneName: string; // 最佳匹配场景
      matchScore: number; // 匹配分数
      confidence: string; // 置信度等级（high、medium、low）
      reason: string; // 匹配理由
    }>(), // 最佳匹配结果

    // 人工标注
    manualAnnotation: jsonb("manual_annotation").$type<{
      sceneName?: string; // 人工标注的场景名称
      confidence?: string; // 人工标注置信度
      annotatedBy?: string; // 标注人
      annotatedAt?: string; // 标注时间
      comment?: string; // 标注说明
    }>(), // 人工标注信息

    // 候选场景词（如果识别到新场景）
    candidateScenes: jsonb("candidate_scenes").$type<Array<{
      sceneName: string; // 候选场景名称
      synonyms: string[]; // 近义词
      filmTypes: string[]; // 适配影视类型
      confidence: number; // 置信度（0-100）
      reason: string; // 推荐理由
    }>>(), // 候选场景词（用于词库扩充）

    // 优化状态
    optimizationStatus: varchar("optimization_status", { length: 20 }).default("pending"), // 优化状态：pending（待标注）、annotated（已标注）、optimized（已优化）、rejected（已拒绝）
    usedForTraining: boolean("used_for_training").default(false), // 是否用于模型训练

    // 时间戳
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    // 为常用查询字段添加索引
    musicAnalysisIdIdx: index("scene_optimization_samples_music_analysis_id_idx").on(table.musicAnalysisId),
    reanalysisStatusIdx: index("scene_optimization_samples_status_idx").on(table.reanalysisStatus),
    optimizationStatusIdx: index("scene_optimization_samples_optimization_status_idx").on(table.optimizationStatus),
    createdAtIdx: index("scene_optimization_samples_created_at_idx").on(table.createdAt),
  })
);

// Zod schemas for scene optimization samples
export const insertSceneOptimizationSampleSchema = createCoercedInsertSchema(sceneOptimizationSamples).pick({
  musicAnalysisId: true,
  fileName: true,
  fileKey: true,
  audioFeatures: true,
  emotionalFeatures: true,
  reanalysisStatus: true,
  matchResults: true,
  bestMatch: true,
  manualAnnotation: true,
  candidateScenes: true,
  optimizationStatus: true,
  usedForTraining: true,
});

export const updateSceneOptimizationSampleSchema = createCoercedInsertSchema(sceneOptimizationSamples)
  .pick({
    reanalysisStatus: true,
    matchResults: true,
    bestMatch: true,
    manualAnnotation: true,
    candidateScenes: true,
    optimizationStatus: true,
    usedForTraining: true,
  })
  .partial();

// TypeScript types
export type SceneOptimizationSample = typeof sceneOptimizationSamples.$inferSelect;
export type InsertSceneOptimizationSample = z.infer<typeof insertSceneOptimizationSampleSchema>;
export type UpdateSceneOptimizationSample = z.infer<typeof updateSceneOptimizationSampleSchema>;



