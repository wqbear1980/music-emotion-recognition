/**
 * 混合分析引擎总览
 *
 * 【混合方案架构】
 * 本系统采用多方案混合架构，结合多种分析策略的优势：
 *
 * 1. 【词库管理混合模式 - 方案C】
 *    - 近义词独立：每个近义词作为独立标准词，丰富描述能力
 *    - 真正同义词映射：仅保留意思完全相同的同义词映射
 *    - 实现：src/lib/standardTerms.ts
 *
 * 2. 【情绪识别混合方案 - 方案C】
 *    - 规则引擎：快速筛选候选情绪，提供初步判断
 *    - LLM引擎：精细化识别，考虑上下文和细微差别
 *    - 结果融合：规则权重 + LLM精细化决策
 *    - 实现：src/lib/hybridEmotionRecognizer.ts
 *
 * 3. 【复杂音乐多段落分析 - 方案B】
 *    - 自动检测复杂音乐特征
 *    - 四段式结构分析（前奏、发展、高潮、尾声）
 *    - 情绪轨迹生成和主导情绪计算
 *    - 实现：src/lib/multiSegmentAnalysis.ts
 *
 * 4. 【音乐出处识别 - 方案B】
 *    - 元数据优先：专辑栏元数据是出处的最权威来源
 *    - 三步法：提取→验证→补充
 *    - 冲突处理：以专辑信息为准，标注警告
 *    - 实现：src/app/api/analyze-music/route.ts
 *
 * 5. 【场景识别混合决策 - 方案C】
 *    - 维度A：影视类型+情绪→场景联动映射
 *    - 维度B：音频特征匹配（≥75%阈值）
 *    - 维度C：6类目标场景特征匹配
 *    - 维度D：LLM精细化识别
 *    - 融合策略：多维度加权计算
 *    - 实现：src/lib/hybridSceneRecognizer.ts
 *
 * 【使用方式】
 * 通过本模块提供的统一接口调用所有混合方案
 */

import { AudioFeatures } from './audioFeatureExtractor';
import {
  recognizeEmotionHybrid,
  EmotionResult,
  HybridEmotionConfig,
} from './hybridEmotionRecognizer';
import {
  recognizeSceneHybrid,
  SceneMatch,
  HybridSceneConfig,
} from './hybridSceneRecognizer';
import {
  isComplexMusic,
  performMultiSegmentAnalysis,
  MultiSegmentAnalysisResult,
} from './multiSegmentAnalysis';

export interface MusicMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  track?: number;
  genre?: string;
}

export interface HybridAnalysisConfig {
  // 情绪识别配置
  emotion: Partial<HybridEmotionConfig>;
  // 场景识别配置
  scene: Partial<HybridSceneConfig>;
  // 是否启用复杂音乐分析
  enableMultiSegment: boolean;
  // 是否并行执行
  parallel: boolean;
}

export interface HybridAnalysisResult {
  // 基础信息
  fileName: string;

  // 情绪识别结果
  emotion: EmotionResult;

  // 场景识别结果
  scene: SceneMatch;

  // 复杂音乐分析（如果启用）
  multiSegment?: MultiSegmentAnalysisResult;

  // 综合置信度
  overallConfidence: number;

  // 分析方法
  analysisMethod: {
    emotion: 'rule-only' | 'llm-only' | 'hybrid';
    scene: 'linkage' | 'audio' | 'target' | 'llm' | 'hybrid';
    complexAnalysis: boolean;
  };
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: HybridAnalysisConfig = {
  emotion: {
    ruleWeight: 0.3,
    llmWeight: 0.7,
    enableComplexDetection: true,
    ruleConfidenceThreshold: 0.7,
    parallel: true,
  },
  scene: {
    linkageWeight: 0.3,
    audioWeight: 0.25,
    targetWeight: 0.25,
    llmWeight: 0.2,
    linkageThreshold: 0.8,
    audioThreshold: 0.75,
    targetThreshold: 0.8,
    enableLLM: true,
    enableTargetPriority: true,
  },
  enableMultiSegment: false, // 禁用复杂音乐分析（AudioFeatures类型不兼容）
  parallel: true,
};

/**
 * 完整的混合分析（主函数）
 *
 * @param features 音频特征
 * @param fileName 文件名
 * @param metadata 音频元数据（用于影视类型和出处识别）
 * @param config 配置（可选）
 * @returns 完整的分析结果
 */
export async function analyzeMusicHybrid(
  features: AudioFeatures,
  fileName: string,
  metadata: MusicMetadata = {},
  config: Partial<HybridAnalysisConfig> = {}
): Promise<HybridAnalysisResult> {
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    emotion: { ...DEFAULT_CONFIG.emotion, ...config.emotion },
    scene: { ...DEFAULT_CONFIG.scene, ...config.scene },
  };

  console.log('[混合分析引擎] 开始完整分析', {
    fileName,
    config: finalConfig,
  });

  try {
    // 1. 情绪识别
    console.log('[混合分析引擎] 步骤1: 情绪识别');
    const emotionResult = await recognizeEmotionHybrid(
      features,
      fileName,
      finalConfig.emotion
    );

    // 2. 推断影视类型（基于情绪和风格）
    const filmType = inferFilmType(emotionResult.primary, metadata.genre);

    // 3. 场景识别
    console.log('[混合分析引擎] 步骤2: 场景识别');
    const sceneResult = await recognizeSceneHybrid(
      features,
      filmType,
      emotionResult.primary,
      fileName,
      finalConfig.scene
    );

    // 4. 复杂音乐分析（如果启用且检测到复杂音乐）
    // 注意：由于AudioFeatures类型不兼容，暂时禁用此功能
    let multiSegmentResult: MultiSegmentAnalysisResult | undefined;
    /*
    if (finalConfig.enableMultiSegment) {
      console.log('[混合分析引擎] 步骤3: 复杂音乐检测');
      // const isComplex = isComplexMusic(features);
      // if (isComplex) {
      //   console.log('[混合分析引擎] 检测到复杂音乐，进行多段落分析');
      //   multiSegmentResult = performMultiSegmentAnalysis(features);
      // } else {
      //   console.log('[混合分析引擎] 非复杂音乐，跳过多段落分析');
      // }
    }
    */

    // 5. 计算综合置信度
    const overallConfidence = calculateOverallConfidence(
      emotionResult.confidence,
      sceneResult.confidence
    );

    // 6. 组装结果
    const result: HybridAnalysisResult = {
      fileName,
      emotion: emotionResult,
      scene: sceneResult,
      multiSegment: multiSegmentResult,
      overallConfidence,
      analysisMethod: {
        emotion: emotionResult.method,
        scene: sceneResult.source,
        complexAnalysis: !!multiSegmentResult,
      },
    };

    console.log('[混合分析引擎] 分析完成', {
      emotion: emotionResult.primary,
      scene: sceneResult.scene,
      complex: !!multiSegmentResult,
      overallConfidence,
    });

    return result;
  } catch (error) {
    console.error('[混合分析引擎] 分析失败:', error);
    throw error;
  }
}

/**
 * 推断影视类型
 */
function inferFilmType(emotion: string, genre?: string): string {
  // 简化的影视类型推断
  const emotionFilmMap: Record<string, string> = {
    '惊悚': '恐怖片',
    '压抑': '恐怖片',
    '悲壮': '古装剧',
    '热血': '职场剧',
    '浪漫': '爱情片',
    '悬疑': '推理剧',
    '史诗': '魔幻片',
  };

  if (emotionFilmMap[emotion]) {
    return emotionFilmMap[emotion];
  }

  // 基于流派推断
  if (genre) {
    if (genre.includes('classical') || genre.includes('orchestral')) {
      return '古装剧';
    }
    if (genre.includes('jazz') || genre.includes('blues')) {
      return '爱情片';
    }
  }

  return '未分类';
}

/**
 * 计算综合置信度
 */
function calculateOverallConfidence(
  emotionConfidence: number,
  sceneConfidence: number
): number {
  // 简单平均
  return Math.round(((emotionConfidence + sceneConfidence / 100) / 2) * 100) / 100;
}

/**
 * 快速分析（仅情绪识别）
 */
export async function quickAnalyze(
  features: AudioFeatures,
  fileName: string,
  config?: Partial<HybridEmotionConfig>
): Promise<EmotionResult> {
  return recognizeEmotionHybrid(features, fileName, config);
}

/**
 * 完整分析（包含所有维度）
 */
export async function fullAnalyze(
  features: AudioFeatures,
  fileName: string,
  metadata?: MusicMetadata,
  config?: Partial<HybridAnalysisConfig>
): Promise<HybridAnalysisResult> {
  return analyzeMusicHybrid(features, fileName, metadata, config);
}

// 导出所有子模块
export { recognizeEmotionHybrid } from './hybridEmotionRecognizer';
export { recognizeSceneHybrid } from './hybridSceneRecognizer';
export { isComplexMusic, performMultiSegmentAnalysis } from './multiSegmentAnalysis';
export { STANDARD_TERMS } from './standardTerms';
