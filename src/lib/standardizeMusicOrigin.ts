/**
 * 音乐出处标准化与校验工具
 * 用于从AI分析结果中提取、标准化和验证音乐出处信息
 */

import {
  standardizeAlbumName,
  standardizeFilmName,
  standardizeCreatorName,
  standardizePublisherName,
  standardizePlatformName,
  validateAlbumDuration,
  getAlbumInfo,
  getFilmInfo,
  ConfidenceLevel,
  SourceType,
} from './standardMusicSources';

/**
 * AI分析结果中的音乐出处信息
 */
export interface MusicOriginAnalysis {
  confidenceLevel: string; // 高/中/低
  sourceType: string; // 影视原声/专辑/独立单曲/综艺/游戏配乐/广告/不确定
  filmOrTV?: {
    name?: string;
    episode?: string;
    scene?: string;
    platform?: string;
  };
  album?: {
    name?: string;
    releaseYear?: number;
    label?: string;
  };
  creators?: {
    composer?: string;
    arranger?: string;
    singer?: string;
    lyricist?: string;
  };
  reasoning?: string;
  uncertaintyReason?: string;
}

/**
 * 标准化后的音乐出处信息
 */
export interface StandardizedMusicOrigin {
  sourceType: SourceType;
  album?: string;
  filmName?: string;
  filmScene?: string;
  creators?: {
    composer?: string[];
    singer?: string[];
    arranger?: string[];
    lyricist?: string[];
    producer?: string[];
  };
  publisher?: string;
  platform?: string;
  confidence: ConfidenceLevel;
  confidenceReason?: string;
}

/**
 * 解析AI分析结果中的musicOrigin字段
 * @param analysis AI分析结果（JSON对象）
 * @returns 解析后的音乐出处信息
 */
export function parseMusicOrigin(analysis: any): MusicOriginAnalysis | null {
  if (!analysis || !analysis.musicOrigin) {
    return null;
  }

  return analysis.musicOrigin;
}

/**
 * 标准化音乐出处信息
 * @param origin 音乐出处信息（AI分析结果）
 * @param duration 音频时长（秒），用于验证
 * @returns 标准化后的音乐出处信息
 */
export function standardizeMusicOrigin(
  origin: MusicOriginAnalysis,
  duration?: number
): StandardizedMusicOrigin {
  const standardized: StandardizedMusicOrigin = {
    sourceType: SourceType.UNKNOWN,
    confidence: ConfidenceLevel.LOW,
  };

  // 1. 标准化置信度
  if (origin.confidenceLevel === '高') {
    standardized.confidence = ConfidenceLevel.HIGH;
  } else if (origin.confidenceLevel === '中') {
    standardized.confidence = ConfidenceLevel.MEDIUM;
  } else {
    standardized.confidence = ConfidenceLevel.LOW;
  }

  // 2. 标准化出处类型
  if (origin.sourceType === '影视原声') {
    standardized.sourceType = SourceType.FILM;
  } else if (origin.sourceType === '专辑') {
    standardized.sourceType = SourceType.ALBUM;
  } else if (origin.sourceType === '独立单曲') {
    standardized.sourceType = SourceType.CREATOR;
  } else {
    standardized.sourceType = SourceType.UNKNOWN;
  }

  // 3. 标准化专辑信息
  if (origin.album?.name) {
    const standardAlbumName = standardizeAlbumName(origin.album.name);
    if (standardAlbumName) {
      standardized.album = standardAlbumName;

      // 验证时长是否合理
      if (duration && !validateAlbumDuration(standardAlbumName, duration)) {
        console.warn(`专辑${standardAlbumName}的时长${duration}秒不在标准范围内，可能识别错误`);
        // 可以考虑降低置信度
        if (standardized.confidence === ConfidenceLevel.HIGH) {
          standardized.confidence = ConfidenceLevel.MEDIUM;
        }
      }

      // 获取专辑信息中的发行方和平台
      const albumInfo = getAlbumInfo(standardAlbumName);
      if (albumInfo) {
        if (albumInfo.publisher) {
          standardized.publisher = albumInfo.publisher;
        }
        if (albumInfo.platform) {
          standardized.platform = albumInfo.platform;
        }
      }
    } else {
      // 专辑名称不在标准库中，保持原值（但可能不是标准名称）
      console.warn(`专辑"${origin.album.name}"不在标准库中`);
      standardized.album = origin.album.name;
    }
  }

  // 4. 标准化影视信息
  if (origin.filmOrTV?.name) {
    const standardFilmName = standardizeFilmName(origin.filmOrTV.name);
    if (standardFilmName) {
      standardized.filmName = standardFilmName;
      // 将影视类型作为sourceType
      standardized.sourceType = SourceType.FILM;

      // 获取影视信息中的发行方和平台
      const filmInfo = getFilmInfo(standardFilmName);
      if (filmInfo) {
        if (filmInfo.publisher) {
          standardized.publisher = filmInfo.publisher;
        }
        if (filmInfo.platform) {
          standardized.platform = filmInfo.platform;
        }
      }
    } else {
      // 影视名称不在标准库中，保持原值
      console.warn(`影视"${origin.filmOrTV.name}"不在标准库中`);
      standardized.filmName = origin.filmOrTV.name;
    }
  }

  // 5. 标准化具体场景
  if (origin.filmOrTV?.scene) {
    standardized.filmScene = origin.filmOrTV.scene;
  } else if (origin.filmOrTV?.episode) {
    standardized.filmScene = origin.filmOrTV.episode;
  }

  // 6. 标准化创作者信息
  if (origin.creators) {
    standardized.creators = {};

    if (origin.creators.composer) {
      const standardName = standardizeCreatorName(origin.creators.composer, 'composer');
      standardized.creators.composer = standardName ? [standardName] : [origin.creators.composer];
    }

    if (origin.creators.singer) {
      const standardName = standardizeCreatorName(origin.creators.singer, 'singer');
      standardized.creators.singer = standardName ? [standardName] : [origin.creators.singer];
    }

    if (origin.creators.arranger) {
      const standardName = standardizeCreatorName(origin.creators.arranger, 'arranger');
      standardized.creators.arranger = standardName ? [standardName] : [origin.creators.arranger];
    }

    if (origin.creators.lyricist) {
      const standardName = standardizeCreatorName(origin.creators.lyricist, 'lyricist');
      standardized.creators.lyricist = standardName ? [standardName] : [origin.creators.lyricist];
    }
  }

  // 7. 标准化发行方（优先使用专辑/影视信息中的，其次使用origin中的）
  if (origin.album?.label && !standardized.publisher) {
    const standardName = standardizePublisherName(origin.album.label);
    standardized.publisher = standardName || origin.album.label;
  }

  // 8. 标准化平台（优先使用专辑/影视信息中的，其次使用origin中的）
  if (origin.filmOrTV?.platform && !standardized.platform) {
    const standardName = standardizePlatformName(origin.filmOrTV.platform);
    standardized.platform = standardName || origin.filmOrTV.platform;
  }

  // 9. 添加置信度说明
  if (origin.reasoning) {
    standardized.confidenceReason = origin.reasoning;
  }
  if (origin.uncertaintyReason) {
    standardized.confidenceReason = standardized.confidenceReason
      ? `${standardized.confidenceReason}。不确定原因：${origin.uncertaintyReason}`
      : origin.uncertaintyReason;
  }

  return standardized;
}

/**
 * 从AI分析结果中提取和标准化音乐出处信息
 * @param analysis AI分析结果（JSON对象）
 * @param duration 音频时长（秒）
 * @returns 标准化后的音乐出处信息
 */
export function extractStandardizedOrigin(
  analysis: any,
  duration?: number
): StandardizedMusicOrigin | null {
  const origin = parseMusicOrigin(analysis);
  if (!origin) {
    return null;
  }

  return standardizeMusicOrigin(origin, duration);
}

/**
 * 验证音乐出处信息的有效性
 * @param origin 音乐出处信息
 * @returns 验证结果和警告信息
 */
export function validateMusicOrigin(origin: StandardizedMusicOrigin): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // 1. 高置信度必须有完整信息
  if (origin.confidence === ConfidenceLevel.HIGH) {
    if (origin.sourceType === SourceType.FILM && !origin.filmName) {
      warnings.push('高置信度的影视原声必须包含影视名称');
    }
    if (origin.sourceType === SourceType.ALBUM && !origin.album) {
      warnings.push('高置信度的专辑必须包含专辑名称');
    }
    if (!origin.confidenceReason) {
      warnings.push('高置信度必须提供判断依据');
    }
  }

  // 2. 检查未识别情况
  if (origin.sourceType === SourceType.UNKNOWN && origin.confidence === ConfidenceLevel.HIGH) {
    warnings.push('未识别出处不能是高置信度');
  }

  // 3. 检查创作者信息
  if (origin.creators && Object.values(origin.creators).filter(Boolean).length > 0) {
    // 如果有创作者信息，但sourceType还是UNKNOWN，调整为CREATOR
    if (origin.sourceType === SourceType.UNKNOWN) {
      origin.sourceType = SourceType.CREATOR;
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * 将标准化后的音乐出处信息转换为数据库格式
 * @param origin 标准化后的音乐出处信息
 * @returns 数据库格式对象
 */
export function convertToDatabaseFormat(origin: StandardizedMusicOrigin): {
  sourceType: string;
  album: string | null;
  filmName: string | null;
  filmScene: string | null;
  creators: object | null;
  publisher: string | null;
  platform: string | null;
  confidence: string;
  confidenceReason: string | null;
} {
  return {
    sourceType: origin.sourceType,
    album: origin.album || null,
    filmName: origin.filmName || null,
    filmScene: origin.filmScene || null,
    creators: origin.creators || null,
    publisher: origin.publisher || null,
    platform: origin.platform || null,
    confidence: origin.confidence,
    confidenceReason: origin.confidenceReason || null,
  };
}

/**
 * 合并音频元数据和AI分析结果
 * @param metadata 音频元数据（从文件提取）
 * @param aiOrigin AI分析的音乐出处
 * @returns 合并后的音乐出处信息
 */
export function mergeMetadataWithAIOrigin(
  metadata: any,
  aiOrigin: MusicOriginAnalysis
): MusicOriginAnalysis {
  const merged: MusicOriginAnalysis = { ...aiOrigin };

  // 如果AI没有识别出专辑，但元数据有专辑信息，尝试使用元数据
  if (!aiOrigin.album?.name && metadata.album) {
    merged.album = {
      name: metadata.album,
      releaseYear: metadata.year,
    };
    // 降低置信度，因为是基于元数据而非AI分析
    if (merged.confidenceLevel === '高') {
      merged.confidenceLevel = '中';
    }
    if (!merged.reasoning) {
      merged.reasoning = `基于音频文件元数据（专辑：${metadata.album}）`;
    }
  }

  // 如果AI没有识别出创作者，但元数据有艺术家信息，尝试使用元数据
  if (!aiOrigin.creators?.singer && metadata.artist) {
    merged.creators = merged.creators || {};
    merged.creators.singer = metadata.artist;
    if (merged.confidenceLevel === '高') {
      merged.confidenceLevel = '中';
    }
    if (!merged.reasoning) {
      merged.reasoning = `基于音频文件元数据（艺术家：${metadata.artist}）`;
    }
  }

  return merged;
}
