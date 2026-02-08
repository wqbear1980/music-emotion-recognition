/**
 * 情绪识别混合引擎 - LLM + 规则混合方案
 *
 * 【混合策略设计】
 * 1. 规则引擎：快速筛选候选情绪，提供初步判断和置信度
 * 2. LLM引擎：精细化识别，考虑上下文、细微差别、情绪组合
 * 3. 结果融合：规则引擎权重 + LLM精细化决策
 *
 * 【使用场景】
 * - 简单音乐：规则引擎主导，LLM辅助验证
 * - 复杂音乐：LLM主导，规则引擎提供特征参考
 * - 边界情况：两者结合，提高识别准确率
 */

import { AudioFeatures } from './audioFeatureExtractor';
import { emotionRecognizer } from './emotionRecognizer';
import { getApprovedStandardTerms } from './getStandardTerms';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getLLMProviderConfig } from './llmConfig';

export interface EmotionResult {
  primary: string;
  secondary: string[];
  intensity: number; // 1-10
  dimensions: {
    happiness: number;
    sadness: number;
    tension: number;
    romance: number;
    epic: number;
    [key: string]: number;
  };
  confidence: number; // 0-1
  method: 'rule-only' | 'llm-only' | 'hybrid';
}

export interface HybridEmotionConfig {
  // 规则引擎权重（0-1）
  ruleWeight: number;
  // LLM引擎权重（0-1）
  llmWeight: number;
  // 是否启用复杂音乐检测
  enableComplexDetection: boolean;
  // 规则引擎阈值（低于此值时启用LLM）
  ruleConfidenceThreshold: number;
  // 并行执行（同时调用规则引擎和LLM）
  parallel: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: HybridEmotionConfig = {
  ruleWeight: 0.3,
  llmWeight: 0.7,
  enableComplexDetection: true,
  ruleConfidenceThreshold: 0.7,
  parallel: true,
};

/**
 * 判断是否为复杂音乐
 * 基于 audioFeatureExtractor.AudioFeatures 类型
 */
function isComplexMusic(features: AudioFeatures): boolean {
  // 使用 audioFeatureExtractor.AudioFeatures 中的可用字段
  // 动态范围：通过能量和频谱波动判断
  const hasLargeDynamicRange = features.rmsEnergy > 0.4 && features.spectralFlux > 500;

  // 丰富度：通过频段分布判断
  const hasRichTexture = features.lowFrequencyEnergy > 0.3 &&
                         features.midFrequencyEnergy > 0.3 &&
                         features.highFrequencyEnergy > 0.2;

  // 复杂度：通过节奏和频谱特征判断
  const hasComplexRhythm = features.tempo > 100 && features.rhythmStrength > 0.5;

  const hasHighFrequencyActivity = features.highFrequencyEnergy > 0.3;

  return hasLargeDynamicRange || hasRichTexture || hasComplexRhythm || hasHighFrequencyActivity;
}

/**
 * 规则引擎识别（快速筛选）
 */
async function recognizeByRule(features: AudioFeatures): Promise<EmotionResult> {
  try {
    const ruleResult = emotionRecognizer.recognize(features);

    return {
      primary: ruleResult.primaryMood,
      secondary: ruleResult.secondaryMoods,
      intensity: Math.round(ruleResult.intensity * 10),
      dimensions: {
        happiness: 0,
        sadness: 0,
        tension: 0,
        romance: 0,
        epic: 0,
      },
      confidence: ruleResult.confidence,
      method: 'rule-only',
    };
  } catch (error) {
    console.error('[情绪识别-规则引擎] 识别失败:', error);
    throw error;
  }
}

/**
 * LLM引擎识别（精细化）
 */
async function recognizeByLLM(
  features: AudioFeatures,
  fileName: string
): Promise<EmotionResult> {
  try {
    // 使用LLM配置管理模块获取配置
    const llmConfig = getLLMProviderConfig();
    const client = new LLMClient(llmConfig.config);

    console.log('[情绪识别-LLM引擎] 使用LLM配置:', {
      type: llmConfig.type,
      provider: llmConfig.provider,
      model: llmConfig.model,
    });

    // 从数据库获取标准词库
    const vocabulary = await getApprovedStandardTerms();

    // 构建LLM提示词
    const systemPrompt = `你是一位专业的音乐情绪分析专家。请根据提供的音频特征，精准识别音乐的情绪特征。

【标准情绪词库】
${vocabulary.emotions.join('、')}

【分析要求】
1. 优先使用标准词库中的词汇
2. 识别主情绪（最突出的情绪）和辅助情绪（次要情绪）
3. 评估情绪强度（1-10，10为最强烈）
4. 给出情绪维度评分（0-10）
5. 判断置信度（0-1）

【输出格式】（JSON）
{
  "primary": "主情绪",
  "secondary": ["辅助情绪1", "辅助情绪2"],
  "intensity": 7,
  "dimensions": {
    "happiness": 6,
    "sadness": 2,
    "tension": 4,
    "romance": 3,
    "epic": 5
  },
  "confidence": 0.85
}`;

    const userMessage = `请分析以下音频特征：

文件名：${fileName}

【节奏特征】
BPM（估算）：${features.tempo}
节奏强度：${features.rhythmStrength}

【频谱特征】
低频比例：${features.lowFrequencyEnergy.toFixed(2)}
中频比例：${features.midFrequencyEnergy.toFixed(2)}
高频比例：${features.highFrequencyEnergy.toFixed(2)}

【能量特征】
均方根能量：${features.rmsEnergy.toFixed(2)}

【音色特征】
频谱重心：${features.spectralCentroid.toFixed(2)}
频谱波动：${features.spectralFlux.toFixed(2)}
谐波比：${features.harmonicRatio.toFixed(2)}
过零率：${features.zeroCrossingRate.toFixed(2)}

请返回JSON格式的情绪分析结果。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ];

    // 调用LLM（使用stream方法获取完整响应）
    const llmStream = client.stream(messages, {
      model: llmConfig.model,
      temperature: llmConfig.defaultTemperature,
      streaming: llmConfig.defaultStreaming,
      caching: llmConfig.defaultCaching,
      thinking: llmConfig.defaultThinking,
    });

    let llmResponse = '';
    for await (const chunk of llmStream) {
      if (chunk.content) {
        llmResponse += chunk.content.toString();
      }
    }

    // 解析LLM返回结果
    let llmResult: any;
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM返回结果中未找到JSON');
      }
      llmResult = JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('[情绪识别-LLM引擎] 解析结果失败:', error);
      throw error;
    }

    return {
      primary: llmResult.primary || '中性',
      secondary: llmResult.secondary || [],
      intensity: llmResult.intensity || 5,
      dimensions: {
        happiness: llmResult.dimensions?.happiness || 0,
        sadness: llmResult.dimensions?.sadness || 0,
        tension: llmResult.dimensions?.tension || 0,
        romance: llmResult.dimensions?.romance || 0,
        epic: llmResult.dimensions?.epic || 0,
      },
      confidence: llmResult.confidence || 0.5,
      method: 'llm-only',
    };
  } catch (error) {
    console.error('[情绪识别-LLM引擎] 识别失败:', error);
    throw error;
  }
}

/**
 * 融合规则引擎和LLM的结果
 */
function fuseResults(
  ruleResult: EmotionResult,
  llmResult: EmotionResult,
  config: HybridEmotionConfig
): EmotionResult {
  // 简单融合策略：优先LLM，规则引擎提供验证
  const fused: EmotionResult = {
    primary: llmResult.confidence >= ruleResult.confidence
      ? llmResult.primary
      : ruleResult.primary,
    secondary: [...new Set([...llmResult.secondary, ...ruleResult.secondary])].slice(0, 5),
    intensity: Math.round(
      (llmResult.intensity * config.llmWeight + ruleResult.intensity * config.ruleWeight)
    ),
    dimensions: {
      happiness: Math.round(
        (llmResult.dimensions.happiness * config.llmWeight +
          ruleResult.dimensions.happiness * config.ruleWeight)
      ),
      sadness: Math.round(
        (llmResult.dimensions.sadness * config.llmWeight +
          ruleResult.dimensions.sadness * config.ruleWeight)
      ),
      tension: Math.round(
        (llmResult.dimensions.tension * config.llmWeight +
          ruleResult.dimensions.tension * config.ruleWeight)
      ),
      romance: Math.round(
        (llmResult.dimensions.romance * config.llmWeight +
          ruleResult.dimensions.romance * config.ruleWeight)
      ),
      epic: Math.round(
        (llmResult.dimensions.epic * config.llmWeight + ruleResult.dimensions.epic * config.ruleWeight)
      ),
    },
    confidence: Math.round(
      (llmResult.confidence * config.llmWeight + ruleResult.confidence * config.ruleWeight) * 100
    ) / 100,
    method: 'hybrid',
  };

  return fused;
}

/**
 * 混合情绪识别（主函数）
 *
 * @param features 音频特征
 * @param fileName 文件名
 * @param config 配置（可选）
 * @returns 情绪识别结果
 */
export async function recognizeEmotionHybrid(
  features: AudioFeatures,
  fileName: string,
  config: Partial<HybridEmotionConfig> = {}
): Promise<EmotionResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 判断是否为复杂音乐
  const complex = finalConfig.enableComplexDetection ? isComplexMusic(features) : false;

  console.log('[情绪识别-混合引擎] 开始识别', {
    fileName,
    complex,
    config: finalConfig,
  });

  try {
    // 并行执行规则引擎和LLM
    if (finalConfig.parallel) {
      const [ruleResult, llmResult] = await Promise.all([
        recognizeByRule(features).catch((error) => {
          console.warn('[情绪识别-混合引擎] 规则引擎失败，将使用LLM结果:', error);
          return null;
        }),
        recognizeByLLM(features, fileName).catch((error) => {
          console.warn('[情绪识别-混合引擎] LLM引擎失败，将使用规则结果:', error);
          return null;
        }),
      ]);

      // 如果只有一个成功，直接返回该结果
      if (!ruleResult && llmResult) {
        console.log('[情绪识别-混合引擎] 仅LLM成功');
        return llmResult;
      }
      if (ruleResult && !llmResult) {
        console.log('[情绪识别-混合引擎] 仅规则引擎成功');
        return ruleResult;
      }
      if (!ruleResult && !llmResult) {
        throw new Error('规则引擎和LLM均失败');
      }

      // 融合结果
      const fused = fuseResults(ruleResult!, llmResult!, finalConfig);
      console.log('[情绪识别-混合引擎] 融合结果', {
        rule: ruleResult!.primary,
        llm: llmResult!.primary,
        fused: fused.primary,
        confidence: fused.confidence,
      });
      return fused;
    }

    // 串行执行（规则引擎优先）
    const ruleResult = await recognizeByRule(features);

    // 如果规则引擎置信度足够高，直接返回
    if (ruleResult.confidence >= finalConfig.ruleConfidenceThreshold && !complex) {
      console.log('[情绪识别-混合引擎] 规则引擎置信度足够，直接返回');
      return ruleResult;
    }

    // 复杂音乐或低置信度，调用LLM
    console.log('[情绪识别-混合引擎] 调用LLM引擎', {
      complex,
      ruleConfidence: ruleResult.confidence,
    });
    const llmResult = await recognizeByLLM(features, fileName);

    // 融合结果
    const fused = fuseResults(ruleResult, llmResult, finalConfig);
    console.log('[情绪识别-混合引擎] 融合结果', {
      rule: ruleResult.primary,
      llm: llmResult.primary,
      fused: fused.primary,
      confidence: fused.confidence,
    });
    return fused;
  } catch (error) {
    console.error('[情绪识别-混合引擎] 识别失败:', error);
    throw error;
  }
}
