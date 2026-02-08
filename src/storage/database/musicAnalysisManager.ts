import { eq, and, SQL, like, sql, desc, or } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import {
  musicAnalyses,
  insertMusicAnalysisSchema,
  updateMusicAnalysisSchema,
  type MusicAnalysis,
  type InsertMusicAnalysis,
  type UpdateMusicAnalysis,
  type CategoryStats,
} from "./shared/schema";
import { getRawClient } from "./rawClient";
import { STANDARD_TERMS } from "@/lib/standardTerms";

export class MusicAnalysisManager {
  /**
   * 创建单条音乐分析记录
   * 数据库字段已改为TEXT类型，可存储任意格式字符串
   */
  async createAnalysis(data: InsertMusicAnalysis): Promise<MusicAnalysis> {
    const client = await getRawClient();

    // ====================== 第一步：转换数据为字符串 ======================
    // TEXT类型可以接受任意字符串，直接JSON.stringify或toString即可
    const toText = (value: any): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "string") return value;
      return JSON.stringify(value);
    };

    const emotionTagsText = toText(data.emotionTags);
    const filmScenesText = toText(data.filmScenes);
    const scenariosText = toText(data.scenarios);
    const instrumentsText = toText(data.instruments);
    const stylesText = toText(data.styles);
    const creatorsText = toText(data.creators);
    const metadataText = toText(data.metadata);
    const otherFeaturesText = toText(data.otherFeatures);
    const candidateTermsText = toText(data.candidateTerms);

    // ====================== 第二步：执行数据库插入 ======================
    // 使用原始SQL插入，避免Drizzle ORM的bug
    // 列名：28个（file_name, file_key, file_size, duration, bpm, is_online, is_uploaded, uploaded_at, summary, film_type = 10个；
    //       emotion_tags, film_scenes, scenarios, instruments, styles = 5个，共15个；
    //       source_type, album, album_translated, film_name, film_scene, creators, publisher, platform = 8个，共23个；
    //       confidence, confidence_reason, metadata, other_features, candidate_terms = 5个，共28个）
    // VALUES：28个（$1-$28），注意：字段已改为TEXT，无需::jsonb类型转换
    const insertSQL = `
      INSERT INTO music_analyses (
        file_name, file_key, file_size, duration, bpm, is_online, is_uploaded, uploaded_at, summary, film_type,
        emotion_tags, film_scenes, scenarios, instruments, styles,
        source_type, album, album_translated, film_name, film_scene, creators, publisher, platform,
        confidence, confidence_reason, metadata, other_features, candidate_terms
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28
      ) RETURNING *
    `;

    const params = [
      data.fileName,
      data.fileKey ?? null,
      data.fileSize,
      data.duration ?? null,
      data.bpm ?? null,
      data.isOnline ?? false,
      data.isUploaded ?? false,
      data.uploadedAt ?? null,
      data.summary ?? null,
      data.filmType ?? null,
      emotionTagsText,
      filmScenesText,
      scenariosText,
      instrumentsText,
      stylesText,
      data.sourceType ?? null,
      data.album ?? null,
      data.albumTranslated ?? null,
      data.filmName ?? null,
      data.filmScene ?? null,
      creatorsText,
      data.publisher ?? null,
      data.platform ?? null,
      data.confidence ?? null,
      data.confidenceReason ?? null,
      metadataText,
      otherFeaturesText,
      candidateTermsText,
    ];

    console.log(`[INSERT] 执行数据库插入: ${data.fileName}...`);
    const result = await client.query(insertSQL, params);
    console.log(`[INSERT] 成功插入记录，ID: ${result.rows[0].id}`);
    return result.rows[0] as MusicAnalysis;
  }

  /**
   * 创建或替换音乐分析记录（根据文件名）
   * 使用 PostgreSQL 的 UPSERT 语法（ON CONFLICT），确保原子性操作
   * 如果文件名已存在，更新该记录
   * 如果文件名不存在，插入新记录
   * 这种方式比先 DELETE 再 INSERT 更安全，保证操作原子性
   *
   * 核心修复：数据库字段已改为TEXT类型，可存储任意格式字符串，无需JSON格式化
   */
  async createOrReplaceByFileName(data: InsertMusicAnalysis): Promise<MusicAnalysis> {
    const client = await getRawClient();

    // ====================== 第一步：转换数据为字符串 ======================
    // TEXT类型可以接受任意字符串，直接JSON.stringify或toString即可
    const toText = (value: any): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "string") return value;
      return JSON.stringify(value);
    };

    const emotionTagsText = toText(data.emotionTags);
    const filmScenesText = toText(data.filmScenes);
    const scenariosText = toText(data.scenarios);
    const instrumentsText = toText(data.instruments);
    const stylesText = toText(data.styles);
    const creatorsText = toText(data.creators);
    const metadataText = toText(data.metadata);
    const otherFeaturesText = toText(data.otherFeatures);
    const candidateTermsText = toText(data.candidateTerms);

    console.log(`[UPSERT] 保存文件"${data.fileName}"的分析结果...`);
    console.log(`[UPSERT] 参数调试: isOnline=${data.isOnline}, isUploaded=${data.isUploaded}, fileKey=${data.fileKey}`);

    // ====================== 第二步：执行数据库操作（UPSERT） ======================
    // 使用 UPSERT 语法（ON CONFLICT），原子性操作
    // 27个列，27个值（$1-$27），注意：字段已改为TEXT，无需::jsonb类型转换
    //
    // 【重要修复】防止分析操作覆盖上传状态：
    // - is_online, is_uploaded, uploaded_at 只有在新值明确为 true 时才更新
    // - 这样可以确保分析操作不会错误地将已上传的文件标记为未上传
    const upsertSQL = `
      INSERT INTO music_analyses (
        file_name, file_key, file_size, duration, bpm, is_online, is_uploaded, uploaded_at, summary, film_type,
        emotion_tags, film_scenes, scenarios, instruments, styles,
        source_type, album, album_translated, film_name, film_scene, creators, publisher, platform,
        confidence, confidence_reason, metadata, other_features, candidate_terms
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28
      )
      ON CONFLICT (file_name)
      DO UPDATE SET
        file_key = EXCLUDED.file_key,
        file_size = EXCLUDED.file_size,
        duration = EXCLUDED.duration,
        bpm = EXCLUDED.bpm,
        -- 【重要修复】根据 fileKey 判断操作类型：
        -- - 如果 fileKey 存在（云端上传），则更新所有上传相关字段
        -- - 如果 fileKey 不存在（分析完成），则只更新 isOnline=true，不修改 is_uploaded
        -- 【新增】如果前端传入 isOnline=true，强制设置数据库 is_online=true，不受其他条件影响
        is_online = CASE
          WHEN EXCLUDED.is_online = true THEN true         -- 前端明确传入isOnline=true，强制设置为在线
          WHEN EXCLUDED.file_key IS NOT NULL THEN true     -- 云端上传：始终在线
          ELSE music_analyses.is_online                    -- 保持原值
        END,
        is_uploaded = CASE
          WHEN EXCLUDED.file_key IS NOT NULL THEN true   -- 云端上传：标记为已上传
          WHEN music_analyses.is_uploaded = true THEN true  -- 保持原上传状态
          ELSE false
        END,
        uploaded_at = CASE
          WHEN EXCLUDED.file_key IS NOT NULL THEN EXCLUDED.uploaded_at  -- 云端上传：更新上传时间
          ELSE music_analyses.uploaded_at                           -- 保持原上传时间
        END,
        summary = EXCLUDED.summary,
        film_type = EXCLUDED.film_type,
        emotion_tags = EXCLUDED.emotion_tags,
        film_scenes = EXCLUDED.film_scenes,
        scenarios = EXCLUDED.scenarios,
        instruments = EXCLUDED.instruments,
        styles = EXCLUDED.styles,
        source_type = EXCLUDED.source_type,
        album = EXCLUDED.album,
        album_translated = EXCLUDED.album_translated,
        film_name = EXCLUDED.film_name,
        film_scene = EXCLUDED.film_scene,
        creators = EXCLUDED.creators,
        publisher = EXCLUDED.publisher,
        platform = EXCLUDED.platform,
        confidence = EXCLUDED.confidence,
        confidence_reason = EXCLUDED.confidence_reason,
        metadata = EXCLUDED.metadata,
        other_features = EXCLUDED.other_features,
        candidate_terms = EXCLUDED.candidate_terms,
        updated_at = NOW()
      RETURNING *
    `;

    const params = [
      data.fileName,
      data.fileKey ?? null,
      data.fileSize,
      data.duration ?? null,
      data.bpm ?? null,
      data.isOnline ?? false,
      data.isUploaded ?? false,
      data.uploadedAt ?? null,
      data.summary ?? null,
      data.filmType ?? null,
      emotionTagsText,
      filmScenesText,
      scenariosText,
      instrumentsText,
      stylesText,
      data.sourceType ?? null,
      data.album ?? null,
      data.albumTranslated ?? null,
      data.filmName ?? null,
      data.filmScene ?? null,
      creatorsText,
      data.publisher ?? null,
      data.platform ?? null,
      data.confidence ?? null,
      data.confidenceReason ?? null,
      metadataText,
      otherFeaturesText,
      candidateTermsText,
    ];

    try {
      const result = await client.query(upsertSQL, params);
      console.log(`[UPSERT] 成功保存文件"${data.fileName}"的分析结果，记录ID: ${result.rows[0].id}`);
      return result.rows[0] as MusicAnalysis;
    } catch (error: any) {
      console.error(`[UPSERT] 保存失败: ${data.fileName}`);
      console.error('[UPSERT] 错误详情:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        table: error.table,
        column: error.column,
        constraint: error.constraint,
      });
      throw error;
    }
  }

  /**
   * 批量创建音乐分析记录
   */
  async createAnalysesBatch(data: InsertMusicAnalysis[]): Promise<MusicAnalysis[]> {
    const db = await getDb();
    const validated = data.map((item) => insertMusicAnalysisSchema.parse(item));
    const results = await db
      .insert(musicAnalyses)
      .values(validated)
      .returning();
    return results;
  }

  /**
   * 根据 ID 查询音乐分析记录
   */
  async getAnalysisById(id: string): Promise<MusicAnalysis | null> {
    const db = await getDb();
    const [analysis] = await db
      .select()
      .from(musicAnalyses)
      .where(eq(musicAnalyses.id, id));
    return analysis || null;
  }

  /**
   * 根据文件名查询音乐分析记录
   * 返回该文件名的最新一条记录（按创建时间降序）
   */
  async getAnalysisByFileName(fileName: string): Promise<MusicAnalysis | null> {
    const db = await getDb();
    const [analysis] = await db
      .select()
      .from(musicAnalyses)
      .where(eq(musicAnalyses.fileName, fileName))
      .orderBy(desc(musicAnalyses.createdAt)); // 按创建时间降序，确保返回最新记录
    return analysis || null;
  }

  /**
   * 根据MD5查询音乐分析记录
   * 用于检测重复上传，返回该MD5对应的分析记录（如果有）
   */
  async getAnalysisByMD5(musicMd5: string): Promise<MusicAnalysis | null> {
    const db = await getDb();
    const [analysis] = await db
      .select()
      .from(musicAnalyses)
      .where(eq(musicAnalyses.musicMd5, musicMd5));
    return analysis || null;
  }

  /**
   * 获取音乐分析列表
   */
  async getAnalyses(options: {
    skip?: number;
    limit?: number;
    sortBy?: "createdAt" | "fileName";
    sortOrder?: "asc" | "desc";
    isOnline?: boolean; // 在线状态过滤：true=仅在线，false=仅未在线，undefined=全部
    isUploaded?: boolean; // 上传状态过滤：true=仅上传，undefined=不限制
  } = {}): Promise<MusicAnalysis[]> {
    /**
     * 【重要】isOnline 和 isUploaded 的组合用法：
     * - 在线状态（musicStatus='online'）：isOnline=true && isUploaded=false
     * - 云端状态（musicStatus='cloud'）：isUploaded=true
     * - 离线状态（musicStatus='offline'）：isOnline=false && isUploaded=false
     */
    const {
      skip = 0,
      limit = 100,
      sortBy = "createdAt",
      sortOrder = "desc",
      isOnline,
      isUploaded,
    } = options;
    const db = await getDb();

    // 构建WHERE条件
    const whereConditions: string[] = [];
    if (isOnline !== undefined) {
      whereConditions.push(`is_online = ${isOnline}`);
    }
    if (isUploaded !== undefined) {
      whereConditions.push(`is_uploaded = ${isUploaded}`);
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 使用原始SQL查询，避免Drizzle ORM的查询构建问题
    const orderColumn = sortBy === "fileName" ? "file_name" : "created_at";
    const sqlQuery = `
      SELECT * FROM music_analyses
      ${whereClause}
      ORDER BY ${orderColumn} ${sortOrder.toUpperCase()}
      LIMIT ${limit} OFFSET ${skip}
    `;

    const result = await db.execute(sql.raw(sqlQuery));

    return result.rows as MusicAnalysis[];
  }

  /**
   * 按分类维度检索
   * @param category 分类维度（emotion, film, scenario, instrument, style）
   * @param labels 标签值数组（可多选）
   * @param isOnline 在线状态过滤：true=仅在线，false=仅未在线，undefined=全部
   */
  async searchByCategory(
    category: "emotion" | "film" | "scenario" | "instrument" | "style",
    labels: string[],
    isOnline?: boolean
  ): Promise<MusicAnalysis[]> {
    const client = await getRawClient();

    // 构建WHERE条件
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (isOnline !== undefined) {
      whereConditions.push(`is_online = $${paramIndex}`);
      params.push(isOnline);
      paramIndex++;
    }

    // 情绪维度使用核心情绪词（summary字段），其他维度使用TEXT字段
    if (category === "emotion") {
      // 情绪搜索基于核心情绪词（summary字段）
      const conditions: string[] = [];
      for (const label of labels) {
        conditions.push(`summary LIKE $${paramIndex}`);
        params.push(`%${label}%`);
        paramIndex++;
      }
      whereConditions.push(`(${conditions.join(' OR ')})`);

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const sqlQuery = `
        SELECT * FROM music_analyses
        ${whereClause}
        ORDER BY created_at DESC
      `;

      const result = await client.query(sqlQuery, params);
      return result.rows as MusicAnalysis[];
    }

    // 根据分类维度选择对应的 TEXT 字段名
    let columnName: string;
    switch (category) {
      case "film":
        columnName = "film_scenes";
        break;
      case "scenario":
        columnName = "scenarios";
        break;
      case "instrument":
        columnName = "instruments";
        break;
      case "style":
        columnName = "styles";
        break;
    }

    // 构建查询条件：TEXT 字段（存储JSON字符串）包含任一指定标签
    // 字段格式：["标签1", "标签2"]，用LIKE '%"标签1"%' 匹配
    const labelConditions: string[] = [];
    for (const label of labels) {
      labelConditions.push(`${columnName} LIKE $${paramIndex}`);
      params.push(`%"${label}"%`);
      paramIndex++;
    }
    whereConditions.push(`(${labelConditions.join(' OR ')})`);

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT * FROM music_analyses
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await client.query(sqlQuery, params);
    return result.rows as MusicAnalysis[];
  }

  /**
   * 多维度组合检索
   * @param filters 检索条件对象，每个字段都是可选的标签数组
   * @param isOnline 在线状态过滤：true=仅在线，false=仅未在线，undefined=全部
   * @param isUploaded 上传状态过滤：true=仅上传，undefined=不限制
   */
  async searchByFilters(
    filters: {
      emotions?: string[];
      films?: string[];
      scenarios?: string[];
      instruments?: string[];
      styles?: string[];
    },
    isOnline?: boolean,
    isUploaded?: boolean
  ): Promise<MusicAnalysis[]> {
    const client = await getRawClient();

    // 构建WHERE条件
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // 添加在线状态过滤
    if (isOnline !== undefined) {
      whereConditions.push(`is_online = $${paramIndex}`);
      params.push(isOnline);
      paramIndex++;
    }

    // 添加上传状态过滤
    if (isUploaded !== undefined) {
      whereConditions.push(`is_uploaded = $${paramIndex}`);
      params.push(isUploaded);
      paramIndex++;
    }

    if (filters.emotions && filters.emotions.length > 0) {
      // 情绪搜索基于核心情绪词（summary字段），使用LIKE匹配
      const emotionConditions: string[] = [];
      for (const emotion of filters.emotions) {
        emotionConditions.push(`summary LIKE $${paramIndex}`);
        params.push(`%${emotion}%`);
        paramIndex++;
      }
      whereConditions.push(`(${emotionConditions.join(' OR ')})`);
    }

    if (filters.films && filters.films.length > 0) {
      // 影视配乐搜索：film_scenes 是 TEXT（JSON字符串），使用LIKE匹配
      const filmConditions: string[] = [];
      for (const film of filters.films) {
        filmConditions.push(`film_scenes LIKE $${paramIndex}`);
        params.push(`%"${film}"%`);
        paramIndex++;
      }
      whereConditions.push(`(${filmConditions.join(' OR ')})`);
    }

    if (filters.scenarios && filters.scenarios.length > 0) {
      // 场景搜索：scenarios 是 TEXT（JSON字符串），使用LIKE匹配
      const scenarioConditions: string[] = [];
      for (const scenario of filters.scenarios) {
        scenarioConditions.push(`scenarios LIKE $${paramIndex}`);
        params.push(`%"${scenario}"%`);
        paramIndex++;
      }
      whereConditions.push(`(${scenarioConditions.join(' OR ')})`);
    }

    if (filters.instruments && filters.instruments.length > 0) {
      // 乐器搜索：instruments 是 TEXT（JSON字符串），使用LIKE匹配
      const instrumentConditions: string[] = [];
      for (const instrument of filters.instruments) {
        instrumentConditions.push(`instruments LIKE $${paramIndex}`);
        params.push(`%"${instrument}"%`);
        paramIndex++;
      }
      whereConditions.push(`(${instrumentConditions.join(' OR ')})`);
    }

    if (filters.styles && filters.styles.length > 0) {
      // 【音乐风格分类搜索】
      // 如果搜索"传统音乐"，需要搜索所有传统风格的音乐
      // 如果搜索"场景氛围音乐"，需要搜索所有场景/氛围风格的音乐
      // 如果搜索"其他"，需要搜索所有未在标准词库中定义的风格
      // 否则搜索具体的标签（可能是映射值或原始标签名）
      const styleSearches: string[] = [];

      for (const style of filters.styles) {
        if (style === "传统音乐") {
          // 搜索所有传统风格
          // 获取所有传统风格的原始名称
          const traditionalStyles = Object.keys(STANDARD_TERMS.style.traditionalMapping);
          const traditionalConditions: string[] = [];
          for (const s of traditionalStyles) {
            traditionalConditions.push(`styles LIKE $${paramIndex}`);
            params.push(`%"${s}"%`);
            paramIndex++;
          }
          styleSearches.push(`(${traditionalConditions.join(' OR ')})`);
        } else if (style === "场景氛围音乐") {
          // 搜索所有场景/氛围风格
          // 获取所有场景/氛围风格的原始名称
          const atmosphericStyles = Object.keys(STANDARD_TERMS.style.atmosphericMapping);
          const atmosphericConditions: string[] = [];
          for (const s of atmosphericStyles) {
            atmosphericConditions.push(`styles LIKE $${paramIndex}`);
            params.push(`%"${s}"%`);
            paramIndex++;
          }
          styleSearches.push(`(${atmosphericConditions.join(' OR ')})`);
        } else if (style === "其他") {
          // 搜索所有未在标准词库中定义的风格
          // 这比较复杂，需要在客户端进行过滤
          styleSearches.push("styles IS NOT NULL");
        } else if (STANDARD_TERMS.style.atmosphericMapping[style as keyof typeof STANDARD_TERMS.style.atmosphericMapping] !== undefined) {
          // 搜索具体的场景/氛围风格（如"电影氛围"、"场景氛围"等）
          styleSearches.push(`styles LIKE $${paramIndex}`);
          params.push(`%"${style}"%`);
          paramIndex++;
        } else {
          // 搜索具体的传统风格
          // 需要查找所有映射到该风格的标准名称
          // 例如：用户选择"古典"，需要搜索"古典"、"古典音乐"、"管弦乐"、"交响乐"、"巴洛克"等
          const traditionalStyles = Object.entries(STANDARD_TERMS.style.traditionalMapping)
            .filter(([_, value]) => value === style)
            .map(([key, _]) => key) as string[];
          if (traditionalStyles.length > 0) {
            const traditionalConditions: string[] = [];
            for (const s of traditionalStyles) {
              traditionalConditions.push(`styles LIKE $${paramIndex}`);
              params.push(`%"${s}"%`);
              paramIndex++;
            }
            styleSearches.push(`(${traditionalConditions.join(' OR ')})`);
          } else {
            // 如果没有找到映射，直接搜索该标签
            styleSearches.push(`styles LIKE $${paramIndex}`);
            params.push(`%"${style}"%`);
            paramIndex++;
          }
        }
      }

      if (styleSearches.length > 0) {
        whereConditions.push(`(${styleSearches.join(' OR ')})`);
      }
    }

    // 检查是否有任何过滤条件
    const hasFilters = whereConditions.length > 0;
    if (!hasFilters) {
      // 如果没有任何过滤条件，返回所有记录（考虑在线和上传状态过滤）
      return this.getAnalyses({
        isOnline,
        isUploaded,
      });
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // 使用原始SQL查询
    const sqlQuery = `
      SELECT * FROM music_analyses
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await client.query(sqlQuery, params);

    let results = result.rows as MusicAnalysis[];

    // 【音乐风格分类搜索】
    // 如果搜索"其他"，需要在客户端进行二次过滤
    if (filters.styles && filters.styles.includes("其他")) {
      results = results.filter(item => {
        if (!item.styles || item.styles.length === 0) return false;

        // 检查是否所有风格都不在标准词库中
        return item.styles.every((style: string) => {
          const standardized = STANDARD_TERMS.style.standardize(style);
          return !STANDARD_TERMS.style.isTraditional(standardized) &&
                 !STANDARD_TERMS.style.isAtmospheric(standardized);
        });
      });
    }

    return results;
  }

  /**
   * 分类汇总统计
   * 统计各分类维度下每个标签的音乐数量
   */
  async getCategoryStats(
    category: "emotion" | "film" | "scenario" | "instrument" | "style"
  ): Promise<CategoryStats[]> {
    const db = await getDb();

    // 构建过滤条件，只统计已分析的数据
    let whereClause = '';
    switch (category) {
      case "emotion":
        whereClause = 'WHERE summary IS NOT NULL AND summary != \'\'';
        break;
      case "film":
        whereClause = 'WHERE film_scenes IS NOT NULL AND film_scenes != \'\'';
        break;
      case "scenario":
        whereClause = 'WHERE scenarios IS NOT NULL AND scenarios != \'\'';
        break;
      case "instrument":
        whereClause = 'WHERE instruments IS NOT NULL AND instruments != \'\'';
        break;
      case "style":
        whereClause = 'WHERE styles IS NOT NULL AND styles != \'\'';
        break;
    }

    // 使用原始SQL查询，只查询已分析的数据
    const sqlQuery = `
      SELECT * FROM music_analyses
      ${whereClause}
    `;

    const result = await db.execute(sql.raw(sqlQuery));

    const analyses = result.rows as any[];

    console.log(`[getCategoryStats] 分类: ${category}, 已分析记录数: ${analyses.length}`);

    // 根据分类维度获取对应的标签数组
    let allTags: string[] = [];
    switch (category) {
      case "emotion":
        // 情绪统计基于核心情绪词（summary字段）
        allTags = analyses
          .map((a) => a.summary)
          .filter((s): s is string => Boolean(s && s.trim()));
        break;
      case "film":
        // 影视字段是JSON字符串，需要解析
        for (const analysis of analyses) {
          if (!analysis.film_scenes) continue;

          let filmList: string[] = [];

          try {
            // 尝试解析JSON字符串
            const filmsData = JSON.parse(analysis.film_scenes);

            if (Array.isArray(filmsData)) {
              filmList = filmsData;
            }
          } catch (error) {
            // 解析失败，跳过这条记录
            console.warn(`[getCategoryStats] 解析影视数据失败:`, analysis.film_scenes);
            continue;
          }

          // 收集影视标签
          allTags.push(...filmList);
        }
        break;
      case "scenario":
        // 场景字段是JSON字符串，需要解析
        for (const analysis of analyses) {
          if (!analysis.scenarios) continue;

          let scenarioList: string[] = [];

          try {
            // 尝试解析JSON字符串
            const scenariosData = JSON.parse(analysis.scenarios);

            if (Array.isArray(scenariosData)) {
              scenarioList = scenariosData;
            }
          } catch (error) {
            // 解析失败，跳过这条记录
            console.warn(`[getCategoryStats] 解析场景数据失败:`, analysis.scenarios);
            continue;
          }

          // 收集场景标签
          allTags.push(...scenarioList);
        }
        break;
      case "instrument":
        // 乐器字段是JSON字符串，需要解析
        // 结构可能是对象（包含primary、accompaniment、percussion等）或数组
        for (const analysis of analyses) {
          if (!analysis.instruments) continue;

          let instrumentList: string[] = [];

          try {
            // 尝试解析JSON字符串
            const instrumentsData = JSON.parse(analysis.instruments);

            if (Array.isArray(instrumentsData)) {
              // 如果是数组，直接使用
              instrumentList = instrumentsData;
            } else if (typeof instrumentsData === 'object' && instrumentsData !== null) {
              // 如果是对象，合并所有子类别的乐器
              instrumentList = [
                ...(instrumentsData.primary || []),
                ...(instrumentsData.accompaniment || []),
                ...(instrumentsData.percussion || []),
              ];
            }
          } catch (error) {
            // 解析失败，跳过这条记录
            console.warn(`[getCategoryStats] 解析乐器数据失败:`, analysis.instruments);
            continue;
          }

          // 收集乐器标签
          allTags.push(...instrumentList);
        }
        break;
      case "style":
        // 【音乐风格分类规则】
        // 第一类：传统风格（古典、流行、电子等）- 单独展示
        // 第二类：场景/氛围风格（氛围音乐、史诗氛围等）- 统一为"场景氛围"
        // 第三类：其他未定义的风格 - 统一为"其他"

        // 初始化统计数组
        const stats: CategoryStats[] = [];

        // 收集所有原始风格标签及其分类
        const allStylesWithCategory: Array<{ original: string; category: string; standardized: string }> = [];
        for (const analysis of analyses) {
          if (!analysis.styles) continue;

          let styleList: string[] = [];

          try {
            // 尝试解析JSON字符串
            const stylesData = JSON.parse(analysis.styles);

            if (Array.isArray(stylesData)) {
              styleList = stylesData;
            }
          } catch (error) {
            // 解析失败，跳过这条记录
            console.warn(`[getCategoryStats] 解析风格数据失败:`, analysis.styles);
            continue;
          }

          for (const style of styleList) {
            const standardizedStyle = STANDARD_TERMS.style.standardize(style);

            let category = '';
            if (STANDARD_TERMS.style.isTraditional(standardizedStyle)) {
              category = '传统音乐';
            } else if (STANDARD_TERMS.style.isAtmospheric(standardizedStyle)) {
              category = '场景氛围音乐';
            } else {
              category = '其他';
            }

            allStylesWithCategory.push({
              original: style,
              category,
              standardized: standardizedStyle,
            });
          }
        }

        // 为三大类统计总数和子分类详情
        const styleStatsMap = new Map<string, { count: number; details: Map<string, number> }>();

        for (const item of allStylesWithCategory) {
          if (!styleStatsMap.has(item.category)) {
            styleStatsMap.set(item.category, { count: 0, details: new Map() });
          }

          const styleStats = styleStatsMap.get(item.category)!;
          styleStats.count += 1;

          // 记录子分类（使用标准化后的名称）
          const detailKey = item.category === '传统音乐' ? item.standardized : item.original;
          styleStats.details.set(detailKey, (styleStats.details.get(detailKey) || 0) + 1);
        }

        // 转换为数组并添加details字段
        for (const [label, { count, details }] of styleStatsMap.entries()) {
          stats.push({
            category,
            label,
            count,
            details: Array.from(details.entries())
              .map(([detailLabel, detailCount]) => ({ label: detailLabel, count: detailCount }))
              .sort((a, b) => b.count - a.count),
          });
        }

        // 风格分类直接返回，不需要后续的通用统计逻辑
        stats.sort((a, b) => b.count - a.count);
        return stats;
    }

    // 统计每个标签的出现次数（通用逻辑）
    const statsMap = new Map<string, number>();
    for (const tag of allTags) {
      statsMap.set(tag, (statsMap.get(tag) || 0) + 1);
    }

    // 转换为数组并排序
    const stats = Array.from(statsMap.entries()).map(([label, count]) => ({
      category,
      label,
      count,
    }));

    // 按数量降序排序
    stats.sort((a, b) => b.count - a.count);

    return stats;
  }

  /**
   * 获取所有分类的统计概览
   */
  async getAllCategoryStats(): Promise<{
    emotions: CategoryStats[];
    films: CategoryStats[];
    scenarios: CategoryStats[];
    instruments: CategoryStats[];
    styles: CategoryStats[];
  }> {
    const [emotions, films, scenarios, instruments, styles] =
      await Promise.all([
        this.getCategoryStats("emotion"),
        this.getCategoryStats("film"),
        this.getCategoryStats("scenario"),
        this.getCategoryStats("instrument"),
        this.getCategoryStats("style"),
      ]);

    return { emotions, films, scenarios, instruments, styles };
  }

  /**
   * 更新音乐分析记录
   */
  async updateAnalysis(
    id: string,
    data: UpdateMusicAnalysis
  ): Promise<MusicAnalysis | null> {
    const db = await getDb();
    const validated = updateMusicAnalysisSchema.parse(data);
    const [analysis] = await db
      .update(musicAnalyses)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(musicAnalyses.id, id))
      .returning();
    return analysis || null;
  }

  /**
   * 删除音乐分析记录
   */
  async deleteAnalysis(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db
      .delete(musicAnalyses)
      .where(eq(musicAnalyses.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 获取音乐分析总数
   */
  async getTotalCount(): Promise<number> {
    const db = await getDb();
    const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM music_analyses`));
    return Number(result.rows?.[0]?.count || 0);
  }

  /**
   * 获取去重的音乐数量统计
   * 去重规则：以文件 MD5 值为唯一标识（无 MD5 时用文件名 + 文件大小）
   * 返回总数量、在线状态数、未在线状态数、云端状态数
   */
  /**
   * 获取去重的音乐数量统计
   *
   * 【重要】统计逻辑与搜索结果中的音乐状态一致：
   * - 在线（online）：在导入列表中的文件（可本地播放）
   * - 云端（cloud）：已上传到云端但不在导入列表中的文件
   * - 离线（offline）：既不在导入列表中也未上传到云端的文件
   *
   * @param importListFileNames - 导入列表中的文件名数组（用于动态计算音乐状态）
   */
  async getDeduplicatedStats(
    importListFileNames: string[] = []
  ): Promise<{
    total: number;
    online: number;
    offline: number;
    uploaded: number;
    totalUploaded: number; // 所有已上传到云端的音乐数量（不管是否在导入列表中）
  }> {
    const client = await getRawClient();

    // 去重统计SQL，获取所有必要的字段
    // 使用 DISTINCT ON 实现去重，根据 music_md5 或 file_name + file_size 组合
    // 【重要】只统计已分析的数据：至少有一个分析字段不为空
    const dedupStatsSQL = `
      WITH deduplicated_records AS (
        SELECT DISTINCT ON (
          COALESCE(music_md5, file_name || '|' || file_size)
        )
          id,
          file_name,
          is_online,
          is_uploaded
        FROM music_analyses
        WHERE
          (summary IS NOT NULL AND summary != '')
          OR (styles IS NOT NULL AND styles != '')
          OR (instruments IS NOT NULL AND instruments != '')
          OR (film_scenes IS NOT NULL AND film_scenes != '')
          OR (scenarios IS NOT NULL AND scenarios != '')
      )
      SELECT
        id,
        file_name,
        is_online,
        is_uploaded
      FROM deduplicated_records
    `;

    const result = await client.query(dedupStatsSQL);
    const records = result.rows;

    // 统计各状态数量
    let total = 0;
    let online = 0;
    let offline = 0;
    let uploaded = 0;
    let totalUploaded = 0; // 所有已上传到云端的音乐数量（不管是否在导入列表中）

    for (const record of records) {
      total++;

      // 统计所有已上传到云端的音乐
      if (record.is_uploaded === true) {
        totalUploaded++;
      }

      // 计算音乐状态（与搜索 API 逻辑一致）
      const musicStatus = this.calculateMusicStatus(
        record.is_uploaded,
        record.file_name,
        importListFileNames
      );

      if (musicStatus === 'online') {
        online++;
      } else if (musicStatus === 'cloud') {
        uploaded++;
      } else {
        offline++;
      }
    }

    console.log(`[getDeduplicatedStats] 已分析去重统计 - 总数: ${total}, 在线: ${online}, 离线: ${offline}, 云端: ${uploaded}, 已上传云端: ${totalUploaded}, 导入列表文件数: ${importListFileNames.length}`);

    return {
      total,
      online,
      offline,
      uploaded,
      totalUploaded,
    };
  }

  /**
   * 计算音乐状态（与搜索 API 逻辑一致）
   *
   * 优先级规则：
   * 1. 已上传到云端（isUploaded = true）→ "cloud"（云端）
   * 2. 在导入列表中（fileName 在 importListFileNames 中）→ "online"（在线）
   * 3. 不在导入列表中，且未上传到云端（isUploaded = false）→ "offline"（离线）
   */
  private calculateMusicStatus(
    isUploaded: boolean,
    fileName: string,
    importListFileNames: string[]
  ): "cloud" | "online" | "offline" {
    // 优先级1：已上传到云端（可云端播放）
    if (isUploaded === true) {
      return "cloud";
    }

    // 优先级2：在导入列表中（可本地播放）
    // 使用更宽松的匹配逻辑：忽略大小写和首尾空格
    const normalizedFileName = fileName.trim().toLowerCase();
    const isInImportList = importListFileNames.some(
      (importFileName) => importFileName.trim().toLowerCase() === normalizedFileName
    );

    if (isInImportList) {
      return "online";
    }

    // 优先级3：离线（无法播放）
    return "offline";
  }

  /**
   * 清空所有音乐分析记录
   */
  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.delete(musicAnalyses);
  }

  /**
   * 将所有在线记录设置为未在线状态
   * 用于"清空音乐列表"操作，保留记录但标记为未在线
   */
  async setAllOffline(): Promise<number> {
    const db = await getDb();

    // 使用原始SQL更新，将所有is_online=true的记录设置为false
    const updateSQL = `
      UPDATE music_analyses
      SET is_online = false, updated_at = NOW()
      WHERE is_online = true
    `;

    const result = await db.execute(sql.raw(updateSQL));
    return result.rowCount ?? 0;
  }

  /**
   * 批量修复 is_online 字段
   * 将所有未上传到云端的音乐（is_uploaded = false）的 is_online 设置为 true
   * 用于修复历史数据中的状态错误
   *
   * @return 更新的记录数
   */
  async setAllOnline(): Promise<number> {
    const client = await getRawClient();

    // 更新所有未上传到云端的音乐记录为在线状态
    const updateSQL = `
      UPDATE music_analyses
      SET is_online = true, updated_at = NOW()
      WHERE is_online = false AND is_uploaded = false
    `;

    const result = await client.query(updateSQL);
    console.log(`[批量修复] 已将 ${result.rowCount} 条记录的 is_online 设置为 true`);
    return result.rowCount;
  }
}

export const musicAnalysisManager = new MusicAnalysisManager();
