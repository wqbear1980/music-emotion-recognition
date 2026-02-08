/**
 * 场景识别混合引擎 - 多维度混合决策
 *
 * 【多维度混合策略】
 * 1. 维度A：影视类型+情绪→场景联动映射（快速筛选）
 * 2. 维度B：音频特征匹配（精准匹配，≥75%阈值）
 * 3. 维度C：6类目标场景特征匹配（特殊场景优先）
 * 4. 维度D：LLM精细化识别（上下文理解）
 *
 * 【融合策略】
 * - 优先级：目标场景 > 联动映射 > 音频特征 > LLM
 * - 置信度：多个维度加权计算
 * - 冲突处理：高置信度维度优先
 *
 * 【降低阈值，减少"未识别场景"】
 * - 音频特征阈值降低至75%
 * - 联动映射阈值降低至80%
 * - 候选词置信度降低至65%
 */

import { AudioFeatures } from './audioFeatureExtractor';
import { TARGET_SCENES } from './targetScenes';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getApprovedStandardTerms } from './getStandardTerms';
import { getLLMProviderConfig } from './llmConfig';

export interface SceneMatch {
  scene: string;
  confidence: number; // 0-100
  source: 'linkage' | 'audio' | 'target' | 'llm' | 'hybrid';
  description: string;
  reasoning: string;
}

export interface HybridSceneConfig {
  // 各维度权重
  linkageWeight: number;
  audioWeight: number;
  targetWeight: number;
  llmWeight: number;

  // 阈值设置
  linkageThreshold: number;
  audioThreshold: number;
  targetThreshold: number;

  // 是否启用LLM
  enableLLM: boolean;

  // 是否启用目标场景优先
  enableTargetPriority: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: HybridSceneConfig = {
  linkageWeight: 0.3,
  audioWeight: 0.25,
  targetWeight: 0.25,
  llmWeight: 0.2,

  linkageThreshold: 0.8,
  audioThreshold: 0.75,
  targetThreshold: 0.8,

  enableLLM: true,
  enableTargetPriority: true,
};

/**
 * 【维度A】影视类型+情绪→场景联动映射
 * 快速筛选，基于预定义的映射表
 */
function matchByLinkage(
  filmType: string,
  emotion: string,
  tempo: number
): SceneMatch | null {
  // 联动映射表（简化版，实际应在数据库中维护）
  const linkageMap: Record<string, Record<string, string[]>> = {
    '警匪片': {
      '紧张': ['追逐', '对峙', '潜入'],
      '冷静': ['调查', '潜入'],
      '悲壮': ['埋伏'],
    },
    '推理剧': {
      '冷静': ['调查'],
      '悬疑': ['调查', '对峙'],
    },
    '校园剧': {
      '浪漫': ['回忆闪回'],
      '悲伤': ['回忆闪回'],
    },
    '动作片': {
      '紧张': ['追逐'],
      '激昂': ['追逐'],
    },
  };

  const filmScenes = linkageMap[filmType];
  if (!filmScenes) return null;

  const scenes = filmScenes[emotion];
  if (!scenes || scenes.length === 0) return null;

  // 返回置信度最高的场景
  const scene = scenes[0];
  return {
    scene,
    confidence: 85,
    source: 'linkage',
    description: `基于${filmType}+${emotion}情绪的联动映射`,
    reasoning: `影视类型"${filmType}"和情绪"${emotion}"的组合通常对应场景"${scene}"`,
  };
}

/**
 * 【维度B】音频特征匹配
 * 基于音频特征直接匹配场景
 */
function matchByAudio(
  features: AudioFeatures,
  filmType: string,
  emotion: string
): SceneMatch | null {
  // 音频特征匹配规则（简化版）
  const audioRules = [
    {
      scene: '追逐',
      conditions: [
        { key: 'energy', op: '>', value: 0.6 },
        { key: 'bpm', op: '>', value: 120 },
      ],
      description: '高能量+快节奏',
    },
    {
      scene: '调查',
      conditions: [
        { key: 'energy', op: '<', value: 0.5 },
        { key: 'bpm', op: '<', value: 110 },
      ],
      description: '低能量+慢节奏',
    },
    {
      scene: '对峙',
      conditions: [
        { key: 'energy', op: '>', value: 0.5 },
        { key: 'bpm', op: '<', value: 100 },
      ],
      description: '中等能量+慢节奏',
    },
    {
      scene: '回忆闪回',
      conditions: [
        { key: 'energy', op: '<', value: 0.5 },
        { key: 'bpm', op: '>', value: 70 },
      ],
      description: '低能量+中等节奏',
    },
  ];

  for (const rule of audioRules) {
    const match = rule.conditions.every((cond) => {
      const value = cond.key === 'bpm' ? features.tempo : features[cond.key as keyof AudioFeatures] as number;
      if (cond.op === '>') return value > cond.value;
      if (cond.op === '<') return value < cond.value;
      if (cond.op === '>=') return value >= cond.value;
      if (cond.op === '<=') return value <= cond.value;
      return false;
    });

    if (match) {
      return {
        scene: rule.scene,
        confidence: 80,
        source: 'audio',
        description: rule.description,
        reasoning: `音频特征（${rule.description}）匹配场景"${rule.scene}"`,
      };
    }
  }

  return null;
}

/**
 * 【维度C】6类目标场景特征匹配
 * 特殊场景优先识别
 */
function matchByTargetScene(
  features: AudioFeatures,
  vocabulary: any
): SceneMatch | null {
  // 目标场景特征匹配（简化版）
  const targetRules = [
    {
      scene: '法庭场景',
      category: 'courtroom',
      conditions: [
        { key: 'energy', op: '<', value: 0.5 },
        { key: 'bpm', op: '<', value: 100 },
      ],
      description: '沉稳节奏',
    },
    {
      scene: '审讯场景',
      category: 'interrogation',
      conditions: [
        { key: 'energy', op: '>', value: 0.4 },
        { key: 'bpm', op: '<', value: 110 },
      ],
      description: '紧张但节奏较慢',
    },
    {
      scene: '办公室场景',
      category: 'office',
      conditions: [
        { key: 'energy', op: '<', value: 0.5 },
        { key: 'bpm', op: '>', value: 80 },
      ],
      description: '中等节奏',
    },
  ];

  for (const rule of targetRules) {
    const match = rule.conditions.every((cond) => {
      const value = cond.key === 'bpm' ? features.tempo : features[cond.key as keyof AudioFeatures] as number;
      if (cond.op === '>') return value > cond.value;
      if (cond.op === '<') return value < cond.value;
      if (cond.op === '>=') return value >= cond.value;
      if (cond.op === '<=') return value <= cond.value;
      return false;
    });

    if (match) {
      return {
        scene: rule.scene,
        confidence: 90,
        source: 'target',
        description: rule.description,
        reasoning: `目标场景"${rule.scene}"特征匹配（${rule.description}）`,
      };
    }
  }

  return null;
}

/**
 * 【维度D】LLM精细化识别
 * 上下文理解，处理复杂场景
 */
async function matchByLLM(
  features: AudioFeatures,
  filmType: string,
  emotion: string,
  fileName: string,
  vocabulary: any
): Promise<SceneMatch | null> {
  try {
    // 使用LLM配置管理模块获取配置
    const llmConfig = getLLMProviderConfig();
    const client = new LLMClient(llmConfig.config);

    console.log('[场景识别-LLM引擎] 使用LLM配置:', {
      type: llmConfig.type,
      provider: llmConfig.provider,
      model: llmConfig.model,
    });

    const systemPrompt = `你是一位专业的影视音乐场景分析专家。请根据提供的音频特征和情绪分析，精准识别音乐适合的影视场景。

【标准场景词库】
${vocabulary.scenarios.join('、')}

【分析要求】
1. 优先使用标准词库中的场景词
2. 结合音频特征、影视类型、情绪进行综合判断
3. 给出置信度（0-100）
4. 说明推理过程

【输出格式】（JSON）
{
  "scene": "场景名称",
  "confidence": 85,
  "description": "场景描述",
  "reasoning": "推理过程"
}`;

    const userMessage = `请分析以下音乐适合的影视场景：

文件名：${fileName}
影视类型：${filmType}
主情绪：${emotion}

【音频特征】
BPM（估算）：${features.tempo}
能量值（均方根）：${features.rmsEnergy}
频谱重心：${features.spectralCentroid}
频谱波动：${features.spectralFlux}
低频比例：${features.lowFrequencyEnergy}
中频比例：${features.midFrequencyEnergy}
高频比例：${features.highFrequencyEnergy}

请返回JSON格式的场景识别结果。`;

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
      console.error('[场景识别-LLM引擎] 解析结果失败:', error);
      return null;
    }

    return {
      scene: llmResult.scene || '未识别',
      confidence: llmResult.confidence || 50,
      source: 'llm',
      description: llmResult.description || '',
      reasoning: llmResult.reasoning || '',
    };
  } catch (error) {
    console.error('[场景识别-LLM引擎] 识别失败:', error);
    return null;
  }
}

/**
 * 融合多个维度的匹配结果
 */
function fuseSceneMatches(
  matches: SceneMatch[],
  config: HybridSceneConfig
): SceneMatch | null {
  // 过滤低置信度结果
  const validMatches = matches.filter((m) => m.confidence >= 60);

  if (validMatches.length === 0) {
    return {
      scene: '未识别',
      confidence: 0,
      source: 'hybrid',
      description: '所有维度均未匹配到合适场景',
      reasoning: '音频特征、类型情绪联动、目标场景等维度均未达到匹配阈值',
    };
  }

  // 按优先级排序：目标 > 联动 > 音频 > LLM
  const priorityOrder = ['target', 'linkage', 'audio', 'llm'];
  validMatches.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.source);
    const bIndex = priorityOrder.indexOf(b.source);
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    return b.confidence - a.confidence;
  });

  // 返回优先级最高的结果
  return validMatches[0];
}

/**
 * 混合场景识别（主函数）
 *
 * @param features 音频特征
 * @param filmType 影视类型
 * @param emotion 主情绪
 * @param fileName 文件名
 * @param config 配置（可选）
 * @returns 场景识别结果
 */
export async function recognizeSceneHybrid(
  features: AudioFeatures,
  filmType: string,
  emotion: string,
  fileName: string,
  config: Partial<HybridSceneConfig> = {}
): Promise<SceneMatch> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[场景识别-混合引擎] 开始识别', {
    fileName,
    filmType,
    emotion,
    config: finalConfig,
  });

  try {
    // 获取词库
    const vocabulary = await getApprovedStandardTerms();

    // 并行执行多个维度
    const matches: SceneMatch[] = [];

    // 维度A：联动映射
    const linkageMatch = matchByLinkage(filmType, emotion, features.tempo);
    if (linkageMatch && linkageMatch.confidence >= finalConfig.linkageThreshold * 100) {
      matches.push(linkageMatch);
      console.log('[场景识别-混合引擎] 维度A（联动映射）匹配成功', linkageMatch);
    }

    // 维度B：音频特征匹配
    const audioMatch = matchByAudio(features, filmType, emotion);
    if (audioMatch && audioMatch.confidence >= finalConfig.audioThreshold * 100) {
      matches.push(audioMatch);
      console.log('[场景识别-混合引擎] 维度B（音频特征）匹配成功', audioMatch);
    }

    // 维度C：目标场景特征匹配
    if (finalConfig.enableTargetPriority) {
      const targetMatch = matchByTargetScene(features, vocabulary);
      if (targetMatch && targetMatch.confidence >= finalConfig.targetThreshold * 100) {
        matches.push(targetMatch);
        console.log('[场景识别-混合引擎] 维度C（目标场景）匹配成功', targetMatch);
      }
    }

    // 维度D：LLM精细化识别
    if (finalConfig.enableLLM) {
      try {
        const llmMatch = await matchByLLM(features, filmType, emotion, fileName, vocabulary);
        if (llmMatch && llmMatch.confidence >= 50) {
          matches.push(llmMatch);
          console.log('[场景识别-混合引擎] 维度D（LLM）匹配成功', llmMatch);
        }
      } catch (error) {
        console.warn('[场景识别-混合引擎] LLM识别失败:', error);
      }
    }

    // 融合结果
    const result = fuseSceneMatches(matches, finalConfig);

    // 确保返回非空值
    const finalResult = result || {
      scene: '未识别场景',
      confidence: 50,
      source: 'hybrid',
      description: '未能识别出具体场景',
      reasoning: '所有维度的匹配度均低于阈值',
    };

    console.log('[场景识别-混合引擎] 最终结果', finalResult);

    return finalResult;
  } catch (error) {
    console.error('[场景识别-混合引擎] 识别失败:', error);
    throw error;
  }
}
