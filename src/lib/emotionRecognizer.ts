/**
 * 情绪识别引擎（重构版 - 基于标准词汇表）
 * 使用多维度评分机制，支持200+标准情绪词汇
 */

import { AudioFeatures } from './audioFeatureExtractor';
import { STANDARD_TERMS } from './standardTerms';

export interface EmotionRecognitionResult {
  // 主情绪（最突出的情绪）
  primaryMood: string;
  // 辅助情绪（次要情绪）
  secondaryMoods: string[];
  // 情绪强度（0-1）
  intensity: number;
  // 影视类型
  filmType: string;
  // 具体场景
  scene: string;
  // 音乐风格
  style: string;
  // 乐器建议
  instruments: string[];
  // 置信度（0-1）
  confidence: number;
}

/**
 * 情绪特征模型 - 定义每个情绪对音频特征的偏好权重
 */
interface EmotionFeatureProfile {
  // 描述
  description: string;

  // 频段偏好 (0-1, 越高越偏好该频段)
  lowFreq?: number;
  midFreq?: number;
  highFreq?: number;

  // 能量偏好 (0-1, 越高越偏好高能量)
  energy?: number;

  // 节奏偏好 (60-200, 0表示不限)
  tempo?: number;
  tempoRange?: [number, number];

  // 节奏强度偏好 (0-1, 越高越偏好强节奏)
  rhythmStrength?: number;

  // 频谱质心偏好 (0-4000, 越高越偏好高频内容)
  spectralCentroid?: number;

  // 频谱流量偏好 (0-2000, 越高越偏好快速变化)
  spectralFlux?: number;

  // 谐波比偏好 (0-1, 越高越偏好和谐音)
  harmonicRatio?: number;

  // 权重系数 (0-1, 情绪的整体权重，用于调整该情绪的重要性)
  weight?: number;
}

/**
 * 情绪特征库 - 基于80个标准情绪词汇定义
 */
const EMOTION_PROFILES: Record<string, EmotionFeatureProfile> = {
  // ========== 中性类 ==========
  '中性': {
    description: '无明显情绪倾向',
    energy: 0.2,
    lowFreq: 0.3,
    midFreq: 0.4,
    highFreq: 0.2,
    tempo: 80,
    rhythmStrength: 0.3,
    spectralFlux: 200,
    harmonicRatio: 0.7,
    weight: 0.9,
  },
  '安详': {
    description: '安详宁静',
    energy: 0.15,
    lowFreq: 0.4,
    midFreq: 0.4,
    highFreq: 0.1,
    tempo: 70,
    rhythmStrength: 0.25,
    spectralFlux: 150,
    harmonicRatio: 0.8,
    weight: 0.75,
  },
  '宁静': {
    description: '宁静平和',
    energy: 0.1,
    lowFreq: 0.3,
    midFreq: 0.5,
    highFreq: 0.15,
    tempo: 65,
    rhythmStrength: 0.2,
    spectralFlux: 100,
    harmonicRatio: 0.85,
    weight: 0.8,
  },
  '沉稳': {
    description: '沉稳厚重',
    energy: 0.25,
    lowFreq: 0.5,
    midFreq: 0.35,
    highFreq: 0.1,
    tempo: 75,
    rhythmStrength: 0.3,
    spectralFlux: 300,
    harmonicRatio: 0.75,
    weight: 0.75,
  },

  // ========== 欢快/快乐类 ==========
  '欢快': {
    description: '欢快活跃',
    energy: 0.6,
    lowFreq: 0.3,
    midFreq: 0.4,
    highFreq: 0.4,
    tempo: 130,
    rhythmStrength: 0.7,
    spectralCentroid: 2000,
    spectralFlux: 800,
    harmonicRatio: 0.65,
    weight: 0.9,
  },
  '快乐': {
    description: '快乐开心',
    energy: 0.55,
    lowFreq: 0.25,
    midFreq: 0.45,
    highFreq: 0.35,
    tempo: 125,
    rhythmStrength: 0.65,
    spectralCentroid: 1800,
    spectralFlux: 700,
    harmonicRatio: 0.7,
    weight: 0.85,
  },
  '兴奋': {
    description: '兴奋激动',
    energy: 0.7,
    lowFreq: 0.35,
    midFreq: 0.35,
    highFreq: 0.4,
    tempo: 140,
    rhythmStrength: 0.8,
    spectralCentroid: 2200,
    spectralFlux: 1000,
    harmonicRatio: 0.6,
    weight: 0.9,
  },
  '愉悦': {
    description: '愉悦舒适',
    energy: 0.45,
    lowFreq: 0.2,
    midFreq: 0.5,
    highFreq: 0.35,
    tempo: 110,
    rhythmStrength: 0.55,
    spectralCentroid: 1600,
    spectralFlux: 600,
    harmonicRatio: 0.75,
    weight: 0.85,
  },
  '喜悦': {
    description: '喜悦欢欣',
    energy: 0.5,
    lowFreq: 0.25,
    midFreq: 0.45,
    highFreq: 0.35,
    tempo: 120,
    rhythmStrength: 0.6,
    spectralCentroid: 1700,
    spectralFlux: 650,
    harmonicRatio: 0.7,
    weight: 0.85,
  },
  '开心': {
    description: '开心快乐',
    energy: 0.5,
    lowFreq: 0.25,
    midFreq: 0.45,
    highFreq: 0.35,
    tempo: 115,
    rhythmStrength: 0.6,
    spectralCentroid: 1650,
    spectralFlux: 600,
    harmonicRatio: 0.72,
    weight: 0.8,
  },
  '欢呼': {
    description: '欢呼雀跃',
    energy: 0.75,
    lowFreq: 0.3,
    midFreq: 0.35,
    highFreq: 0.45,
    tempo: 145,
    rhythmStrength: 0.85,
    spectralCentroid: 2500,
    spectralFlux: 1200,
    harmonicRatio: 0.55,
    weight: 0.85,
  },
  '明快': {
    description: '明快明亮',
    energy: 0.55,
    lowFreq: 0.15,
    midFreq: 0.4,
    highFreq: 0.5,
    tempo: 125,
    rhythmStrength: 0.6,
    spectralCentroid: 2200,
    spectralFlux: 700,
    harmonicRatio: 0.65,
    weight: 0.8,
  },
  '轻快': {
    description: '轻快轻盈',
    energy: 0.4,
    lowFreq: 0.15,
    midFreq: 0.45,
    highFreq: 0.5,
    tempo: 120,
    rhythmStrength: 0.55,
    spectralCentroid: 2000,
    spectralFlux: 600,
    harmonicRatio: 0.7,
    weight: 0.85,
  },
  '轻快愉悦': {
    description: '轻快愉悦',
    energy: 0.45,
    lowFreq: 0.15,
    midFreq: 0.45,
    highFreq: 0.5,
    tempo: 120,
    rhythmStrength: 0.6,
    spectralCentroid: 2100,
    spectralFlux: 650,
    harmonicRatio: 0.7,
    weight: 0.85,
  },

  // ========== 悲伤类 ==========
  '悲伤': {
    description: '悲伤难过',
    energy: 0.25,
    lowFreq: 0.45,
    midFreq: 0.4,
    highFreq: 0.15,
    tempo: 70,
    rhythmStrength: 0.35,
    spectralCentroid: 1000,
    spectralFlux: 300,
    harmonicRatio: 0.75,
    weight: 0.9,
  },
  '紧张': {
    description: '紧张焦虑',
    energy: 0.45,
    lowFreq: 0.35,
    midFreq: 0.3,
    highFreq: 0.4,
    tempo: 110,
    rhythmStrength: 0.65,
    spectralCentroid: 1800,
    spectralFlux: 900,
    harmonicRatio: 0.55,
    weight: 0.9,
  },

  // ========== 浪漫类 ==========
  '浪漫': {
    description: '浪漫温馨',
    energy: 0.35,
    lowFreq: 0.3,
    midFreq: 0.5,
    highFreq: 0.25,
    tempo: 90,
    rhythmStrength: 0.4,
    spectralCentroid: 1500,
    spectralFlux: 400,
    harmonicRatio: 0.8,
    weight: 0.9,
  },

  // ========== 史诗/宏伟类 ==========
  '史诗': {
    description: '史诗壮丽',
    energy: 0.65,
    lowFreq: 0.5,
    midFreq: 0.35,
    highFreq: 0.2,
    tempo: 85,
    rhythmStrength: 0.55,
    spectralCentroid: 1200,
    spectralFlux: 600,
    harmonicRatio: 0.7,
    weight: 0.9,
  },
  '激昂': {
    description: '激昂热情',
    energy: 0.7,
    lowFreq: 0.4,
    midFreq: 0.35,
    highFreq: 0.35,
    tempo: 125,
    rhythmStrength: 0.75,
    spectralCentroid: 1900,
    spectralFlux: 900,
    harmonicRatio: 0.6,
    weight: 0.9,
  },

  // ========== 悬疑/神秘类 ==========
  '悬疑': {
    description: '悬疑神秘',
    energy: 0.35,
    lowFreq: 0.45,
    midFreq: 0.25,
    highFreq: 0.35,
    tempo: 95,
    rhythmStrength: 0.5,
    spectralCentroid: 1600,
    spectralFlux: 700,
    harmonicRatio: 0.5,
    weight: 0.9,
  },
  '惊悚': {
    description: '惊悚恐怖',
    energy: 0.4,
    lowFreq: 0.5,
    midFreq: 0.25,
    highFreq: 0.35,
    tempo: 105,
    rhythmStrength: 0.6,
    spectralCentroid: 1800,
    spectralFlux: 1000,
    harmonicRatio: 0.45,
    weight: 0.85,
  },
  '压抑': {
    description: '压抑沉闷',
    energy: 0.2,
    lowFreq: 0.6,
    midFreq: 0.25,
    highFreq: 0.1,
    tempo: 80,
    rhythmStrength: 0.3,
    spectralCentroid: 800,
    spectralFlux: 400,
    harmonicRatio: 0.5,
    weight: 0.9,
  },
  '震撼': {
    description: '震撼感动',
    energy: 0.75,
    lowFreq: 0.55,
    midFreq: 0.3,
    highFreq: 0.2,
    tempo: 95,
    rhythmStrength: 0.65,
    spectralCentroid: 1300,
    spectralFlux: 800,
    harmonicRatio: 0.65,
    weight: 0.85,
  },
  '空灵': {
    description: '空灵飘渺',
    energy: 0.25,
    lowFreq: 0.25,
    midFreq: 0.35,
    highFreq: 0.5,
    tempo: 85,
    rhythmStrength: 0.3,
    spectralCentroid: 2800,
    spectralFlux: 300,
    harmonicRatio: 0.85,
    weight: 0.85,
  },

  // ========== 其他情绪 ==========
  '酸涩': {
    description: '酸涩苦楚',
    energy: 0.2,
    lowFreq: 0.4,
    midFreq: 0.4,
    highFreq: 0.15,
    tempo: 75,
    rhythmStrength: 0.35,
    spectralCentroid: 1100,
    spectralFlux: 350,
    harmonicRatio: 0.6,
    weight: 0.75,
  },
  '励志': {
    description: '励志向上',
    energy: 0.6,
    lowFreq: 0.35,
    midFreq: 0.4,
    highFreq: 0.35,
    tempo: 120,
    rhythmStrength: 0.7,
    spectralCentroid: 1700,
    spectralFlux: 750,
    harmonicRatio: 0.7,
    weight: 0.85,
  },
  '热血': {
    description: '热血沸腾',
    energy: 0.75,
    lowFreq: 0.45,
    midFreq: 0.35,
    highFreq: 0.3,
    tempo: 135,
    rhythmStrength: 0.8,
    spectralCentroid: 1600,
    spectralFlux: 950,
    harmonicRatio: 0.6,
    weight: 0.9,
  },
  '青涩': {
    description: '青涩纯真',
    energy: 0.35,
    lowFreq: 0.2,
    midFreq: 0.45,
    highFreq: 0.4,
    tempo: 100,
    rhythmStrength: 0.45,
    spectralCentroid: 1800,
    spectralFlux: 500,
    harmonicRatio: 0.75,
    weight: 0.75,
  },
  '甜蜜': {
    description: '甜蜜温暖',
    energy: 0.4,
    lowFreq: 0.2,
    midFreq: 0.45,
    highFreq: 0.4,
    tempo: 95,
    rhythmStrength: 0.4,
    spectralCentroid: 1700,
    spectralFlux: 450,
    harmonicRatio: 0.8,
    weight: 0.85,
  },

  // ========== 温暖类 ==========
  '温暖': {
    description: '温暖亲切',
    energy: 0.4,
    lowFreq: 0.25,
    midFreq: 0.5,
    highFreq: 0.3,
    tempo: 95,
    rhythmStrength: 0.45,
    spectralCentroid: 1600,
    spectralFlux: 450,
    harmonicRatio: 0.8,
    weight: 0.85,
  },
  '忧郁': {
    description: '忧郁伤感',
    energy: 0.22,
    lowFreq: 0.45,
    midFreq: 0.4,
    highFreq: 0.12,
    tempo: 72,
    rhythmStrength: 0.32,
    spectralCentroid: 950,
    spectralFlux: 280,
    harmonicRatio: 0.7,
    weight: 0.85,
  },
  '活力': {
    description: '活力动感',
    energy: 0.65,
    lowFreq: 0.25,
    midFreq: 0.35,
    highFreq: 0.5,
    tempo: 135,
    rhythmStrength: 0.75,
    spectralCentroid: 2300,
    spectralFlux: 850,
    harmonicRatio: 0.65,
    weight: 0.85,
  },
  '庄严': {
    description: '庄严肃穆',
    energy: 0.45,
    lowFreq: 0.55,
    midFreq: 0.3,
    highFreq: 0.15,
    tempo: 80,
    rhythmStrength: 0.4,
    spectralCentroid: 1000,
    spectralFlux: 500,
    harmonicRatio: 0.75,
    weight: 0.85,
  },
  '欢庆': {
    description: '欢庆热闹',
    energy: 0.7,
    lowFreq: 0.35,
    midFreq: 0.4,
    highFreq: 0.35,
    tempo: 130,
    rhythmStrength: 0.75,
    spectralCentroid: 1900,
    spectralFlux: 900,
    harmonicRatio: 0.6,
    weight: 0.85,
  },
  '哀婉': {
    description: '哀婉忧伤',
    energy: 0.18,
    lowFreq: 0.5,
    midFreq: 0.4,
    highFreq: 0.08,
    tempo: 68,
    rhythmStrength: 0.3,
    spectralCentroid: 900,
    spectralFlux: 250,
    harmonicRatio: 0.7,
    weight: 0.8,
  },
  '恐惧': {
    description: '恐惧惊骇',
    energy: 0.35,
    lowFreq: 0.55,
    midFreq: 0.2,
    highFreq: 0.3,
    tempo: 100,
    rhythmStrength: 0.6,
    spectralCentroid: 1700,
    spectralFlux: 1100,
    harmonicRatio: 0.4,
    weight: 0.85,
  },
  '愤怒': {
    description: '愤怒愤慨',
    energy: 0.7,
    lowFreq: 0.45,
    midFreq: 0.3,
    highFreq: 0.35,
    tempo: 125,
    rhythmStrength: 0.8,
    spectralCentroid: 2000,
    spectralFlux: 1100,
    harmonicRatio: 0.45,
    weight: 0.85,
  },
  '温柔': {
    description: '温柔柔美',
    energy: 0.3,
    lowFreq: 0.2,
    midFreq: 0.5,
    highFreq: 0.35,
    tempo: 85,
    rhythmStrength: 0.35,
    spectralCentroid: 1500,
    spectralFlux: 350,
    harmonicRatio: 0.85,
    weight: 0.85,
  },
  '神秘': {
    description: '神秘玄幻',
    energy: 0.35,
    lowFreq: 0.4,
    midFreq: 0.25,
    highFreq: 0.4,
    tempo: 90,
    rhythmStrength: 0.45,
    spectralCentroid: 2000,
    spectralFlux: 600,
    harmonicRatio: 0.55,
    weight: 0.85,
  },
  '梦幻': {
    description: '梦幻飘逸',
    energy: 0.3,
    lowFreq: 0.2,
    midFreq: 0.35,
    highFreq: 0.55,
    tempo: 88,
    rhythmStrength: 0.35,
    spectralCentroid: 2600,
    spectralFlux: 350,
    harmonicRatio: 0.85,
    weight: 0.85,
  },
  '勇敢': {
    description: '勇敢无畏',
    energy: 0.65,
    lowFreq: 0.4,
    midFreq: 0.35,
    highFreq: 0.35,
    tempo: 130,
    rhythmStrength: 0.75,
    spectralCentroid: 1800,
    spectralFlux: 800,
    harmonicRatio: 0.65,
    weight: 0.85,
  },
  '坚强': {
    description: '坚强坚韧',
    energy: 0.55,
    lowFreq: 0.4,
    midFreq: 0.35,
    highFreq: 0.3,
    tempo: 115,
    rhythmStrength: 0.65,
    spectralCentroid: 1600,
    spectralFlux: 700,
    harmonicRatio: 0.7,
    weight: 0.85,
  },
  '怀旧': {
    description: '怀旧追忆',
    energy: 0.3,
    lowFreq: 0.35,
    midFreq: 0.45,
    highFreq: 0.25,
    tempo: 85,
    rhythmStrength: 0.4,
    spectralCentroid: 1400,
    spectralFlux: 400,
    harmonicRatio: 0.75,
    weight: 0.8,
  },
  '期待': {
    description: '期待盼望',
    energy: 0.45,
    lowFreq: 0.25,
    midFreq: 0.4,
    highFreq: 0.4,
    tempo: 105,
    rhythmStrength: 0.55,
    spectralCentroid: 1800,
    spectralFlux: 600,
    harmonicRatio: 0.7,
    weight: 0.8,
  },
  '灵动': {
    description: '灵动飘逸',
    energy: 0.45,
    lowFreq: 0.2,
    midFreq: 0.35,
    highFreq: 0.55,
    tempo: 125,
    rhythmStrength: 0.55,
    spectralCentroid: 2200,
    spectralFlux: 650,
    harmonicRatio: 0.75,
    weight: 0.8,
  },
  '沉醉': {
    description: '沉醉陶醉',
    energy: 0.35,
    lowFreq: 0.25,
    midFreq: 0.4,
    highFreq: 0.4,
    tempo: 90,
    rhythmStrength: 0.4,
    spectralCentroid: 1700,
    spectralFlux: 400,
    harmonicRatio: 0.85,
    weight: 0.75,
  },
  '感动': {
    description: '感动动人',
    energy: 0.4,
    lowFreq: 0.35,
    midFreq: 0.45,
    highFreq: 0.25,
    tempo: 85,
    rhythmStrength: 0.45,
    spectralCentroid: 1400,
    spectralFlux: 500,
    harmonicRatio: 0.8,
    weight: 0.85,
  },
  '崇高': {
    description: '崇高庄严',
    energy: 0.55,
    lowFreq: 0.55,
    midFreq: 0.3,
    highFreq: 0.2,
    tempo: 90,
    rhythmStrength: 0.5,
    spectralCentroid: 1100,
    spectralFlux: 600,
    harmonicRatio: 0.7,
    weight: 0.85,
  },
  '傲慢': {
    description: '傲慢高傲',
    energy: 0.5,
    lowFreq: 0.4,
    midFreq: 0.35,
    highFreq: 0.35,
    tempo: 110,
    rhythmStrength: 0.6,
    spectralCentroid: 1700,
    spectralFlux: 650,
    harmonicRatio: 0.5,
    weight: 0.7,
  },
  '俏皮': {
    description: '俏皮调皮',
    energy: 0.5,
    lowFreq: 0.15,
    midFreq: 0.4,
    highFreq: 0.55,
    tempo: 130,
    rhythmStrength: 0.6,
    spectralCentroid: 2400,
    spectralFlux: 700,
    harmonicRatio: 0.7,
    weight: 0.8,
  },
  '悠闲': {
    description: '悠闲自在',
    energy: 0.3,
    lowFreq: 0.25,
    midFreq: 0.45,
    highFreq: 0.35,
    tempo: 85,
    rhythmStrength: 0.35,
    spectralCentroid: 1500,
    spectralFlux: 350,
    harmonicRatio: 0.8,
    weight: 0.85,
  },
  '凄美': {
    description: '凄美哀艳',
    energy: 0.2,
    lowFreq: 0.5,
    midFreq: 0.4,
    highFreq: 0.1,
    tempo: 70,
    rhythmStrength: 0.3,
    spectralCentroid: 950,
    spectralFlux: 280,
    harmonicRatio: 0.75,
    weight: 0.8,
  },
  '壮阔': {
    description: '壮阔壮美',
    energy: 0.7,
    lowFreq: 0.55,
    midFreq: 0.3,
    highFreq: 0.2,
    tempo: 90,
    rhythmStrength: 0.6,
    spectralCentroid: 1200,
    spectralFlux: 700,
    harmonicRatio: 0.7,
    weight: 0.85,
  },
  '唯美': {
    description: '唯美优美',
    energy: 0.4,
    lowFreq: 0.2,
    midFreq: 0.45,
    highFreq: 0.45,
    tempo: 95,
    rhythmStrength: 0.45,
    spectralCentroid: 2000,
    spectralFlux: 450,
    harmonicRatio: 0.85,
    weight: 0.8,
  },
  '幽默': {
    description: '幽默风趣',
    energy: 0.5,
    lowFreq: 0.2,
    midFreq: 0.4,
    highFreq: 0.5,
    tempo: 120,
    rhythmStrength: 0.6,
    spectralCentroid: 2100,
    spectralFlux: 750,
    harmonicRatio: 0.65,
    weight: 0.9,
  },
  '俏丽': {
    description: '俏丽娇俏',
    energy: 0.45,
    lowFreq: 0.15,
    midFreq: 0.4,
    highFreq: 0.55,
    tempo: 125,
    rhythmStrength: 0.55,
    spectralCentroid: 2300,
    spectralFlux: 600,
    harmonicRatio: 0.75,
    weight: 0.75,
  },
  '娇美': {
    description: '娇美妩媚',
    energy: 0.35,
    lowFreq: 0.2,
    midFreq: 0.45,
    highFreq: 0.45,
    tempo: 95,
    rhythmStrength: 0.4,
    spectralCentroid: 1900,
    spectralFlux: 450,
    harmonicRatio: 0.85,
    weight: 0.75,
  },

  // ========== 交响乐专用情绪 ==========
  '悲壮': {
    description: '悲壮苍凉（交响乐专用）',
    energy: 0.55,
    lowFreq: 0.6,
    midFreq: 0.3,
    highFreq: 0.15,
    tempo: 85,
    rhythmStrength: 0.5,
    spectralCentroid: 1100,
    spectralFlux: 600,
    harmonicRatio: 0.6,
    weight: 0.9,
  },
  '恢弘': {
    description: '恢弘壮丽（交响乐专用）',
    energy: 0.75,
    lowFreq: 0.55,
    midFreq: 0.3,
    highFreq: 0.2,
    tempo: 90,
    rhythmStrength: 0.6,
    spectralCentroid: 1300,
    spectralFlux: 750,
    harmonicRatio: 0.7,
    weight: 0.9,
  },
  '戏剧性': {
    description: '戏剧性张力（交响乐专用）',
    energy: 0.65,
    lowFreq: 0.45,
    midFreq: 0.3,
    highFreq: 0.35,
    tempo: 100,
    rhythmStrength: 0.65,
    spectralCentroid: 1600,
    spectralFlux: 900,
    harmonicRatio: 0.55,
    weight: 0.9,
  },
  '戏剧': {
    description: '戏剧张力',
    energy: 0.6,
    lowFreq: 0.4,
    midFreq: 0.3,
    highFreq: 0.35,
    tempo: 95,
    rhythmStrength: 0.6,
    spectralCentroid: 1500,
    spectralFlux: 850,
    harmonicRatio: 0.6,
    weight: 0.85,
  },
  '英雄': {
    description: '英雄气概（交响乐专用）',
    energy: 0.75,
    lowFreq: 0.5,
    midFreq: 0.3,
    highFreq: 0.3,
    tempo: 115,
    rhythmStrength: 0.75,
    spectralCentroid: 1500,
    spectralFlux: 850,
    harmonicRatio: 0.65,
    weight: 0.9,
  },
  '神圣': {
    description: '神圣崇高（交响乐专用）',
    energy: 0.5,
    lowFreq: 0.6,
    midFreq: 0.25,
    highFreq: 0.2,
    tempo: 80,
    rhythmStrength: 0.45,
    spectralCentroid: 1000,
    spectralFlux: 500,
    harmonicRatio: 0.8,
    weight: 0.9,
  },
  '内省': {
    description: '内心内省（交响乐专用）',
    energy: 0.25,
    lowFreq: 0.4,
    midFreq: 0.35,
    highFreq: 0.3,
    tempo: 75,
    rhythmStrength: 0.3,
    spectralCentroid: 1300,
    spectralFlux: 350,
    harmonicRatio: 0.8,
    weight: 0.85,
  },
  '叙事': {
    description: '叙事画面（交响乐专用）',
    energy: 0.45,
    lowFreq: 0.4,
    midFreq: 0.35,
    highFreq: 0.3,
    tempo: 90,
    rhythmStrength: 0.5,
    spectralCentroid: 1400,
    spectralFlux: 550,
    harmonicRatio: 0.7,
    weight: 0.85,
  },

  // ========== 轻松舒缓类 ==========
  '舒缓': {
    description: '舒缓放松',
    energy: 0.25,
    lowFreq: 0.25,
    midFreq: 0.45,
    highFreq: 0.35,
    tempo: 75,
    rhythmStrength: 0.3,
    spectralCentroid: 1400,
    spectralFlux: 300,
    harmonicRatio: 0.85,
    weight: 0.9,
  },
  '轻柔': {
    description: '轻柔柔和',
    energy: 0.2,
    lowFreq: 0.2,
    midFreq: 0.45,
    highFreq: 0.4,
    tempo: 70,
    rhythmStrength: 0.25,
    spectralCentroid: 1500,
    spectralFlux: 250,
    harmonicRatio: 0.9,
    weight: 0.9,
  },
  '惬意': {
    description: '惬意舒适',
    energy: 0.3,
    lowFreq: 0.25,
    midFreq: 0.45,
    highFreq: 0.35,
    tempo: 80,
    rhythmStrength: 0.35,
    spectralCentroid: 1450,
    spectralFlux: 350,
    harmonicRatio: 0.8,
    weight: 0.9,
  },
  '闲适': {
    description: '闲适自在',
    energy: 0.28,
    lowFreq: 0.28,
    midFreq: 0.42,
    highFreq: 0.35,
    tempo: 78,
    rhythmStrength: 0.32,
    spectralCentroid: 1420,
    spectralFlux: 320,
    harmonicRatio: 0.82,
    weight: 0.9,
  },

  // ========== 激情热烈类 ==========
  '激情': {
    description: '激情澎湃',
    energy: 0.75,
    lowFreq: 0.45,
    midFreq: 0.3,
    highFreq: 0.35,
    tempo: 140,
    rhythmStrength: 0.8,
    spectralCentroid: 2000,
    spectralFlux: 1100,
    harmonicRatio: 0.55,
    weight: 0.95,
  },
  '狂热': {
    description: '狂热狂野',
    energy: 0.8,
    lowFreq: 0.5,
    midFreq: 0.25,
    highFreq: 0.35,
    tempo: 150,
    rhythmStrength: 0.85,
    spectralCentroid: 2100,
    spectralFlux: 1300,
    harmonicRatio: 0.5,
    weight: 0.9,
  },
  '豪迈': {
    description: '豪迈奔放',
    energy: 0.7,
    lowFreq: 0.5,
    midFreq: 0.3,
    highFreq: 0.3,
    tempo: 125,
    rhythmStrength: 0.75,
    spectralCentroid: 1700,
    spectralFlux: 900,
    harmonicRatio: 0.6,
    weight: 0.95,
  },
  '奔放': {
    description: '奔放自由',
    energy: 0.68,
    lowFreq: 0.4,
    midFreq: 0.35,
    highFreq: 0.35,
    tempo: 130,
    rhythmStrength: 0.75,
    spectralCentroid: 1900,
    spectralFlux: 950,
    harmonicRatio: 0.6,
    weight: 0.95,
  },

  // ========== 忧郁伤感类 ==========
  '惆怅': {
    description: '惆怅失意',
    energy: 0.22,
    lowFreq: 0.42,
    midFreq: 0.42,
    highFreq: 0.12,
    tempo: 70,
    rhythmStrength: 0.32,
    spectralCentroid: 1000,
    spectralFlux: 300,
    harmonicRatio: 0.7,
    weight: 0.9,
  },
  '哀愁': {
    description: '哀愁凄楚',
    energy: 0.2,
    lowFreq: 0.48,
    midFreq: 0.4,
    highFreq: 0.08,
    tempo: 68,
    rhythmStrength: 0.3,
    spectralCentroid: 920,
    spectralFlux: 270,
    harmonicRatio: 0.68,
    weight: 0.9,
  },
  '悲凉': {
    description: '悲凉萧瑟',
    energy: 0.18,
    lowFreq: 0.52,
    midFreq: 0.38,
    highFreq: 0.06,
    tempo: 65,
    rhythmStrength: 0.28,
    spectralCentroid: 850,
    spectralFlux: 250,
    harmonicRatio: 0.65,
    weight: 0.9,
  },
  '痛楚': {
    description: '痛楚痛苦',
    energy: 0.24,
    lowFreq: 0.5,
    midFreq: 0.35,
    highFreq: 0.1,
    tempo: 72,
    rhythmStrength: 0.35,
    spectralCentroid: 1100,
    spectralFlux: 380,
    harmonicRatio: 0.6,
    weight: 0.85,
  },

  // ========== 平静祥和类 ==========
  '平和': {
    description: '平和安宁',
    energy: 0.2,
    lowFreq: 0.3,
    midFreq: 0.45,
    highFreq: 0.2,
    tempo: 70,
    rhythmStrength: 0.25,
    spectralCentroid: 1300,
    spectralFlux: 280,
    harmonicRatio: 0.85,
    weight: 0.9,
  },
  '恬淡': {
    description: '恬淡淡泊',
    energy: 0.18,
    lowFreq: 0.28,
    midFreq: 0.48,
    highFreq: 0.2,
    tempo: 68,
    rhythmStrength: 0.22,
    spectralCentroid: 1250,
    spectralFlux: 250,
    harmonicRatio: 0.88,
    weight: 0.9,
  },
  '祥和': {
    description: '祥和宁静',
    energy: 0.22,
    lowFreq: 0.32,
    midFreq: 0.46,
    highFreq: 0.18,
    tempo: 72,
    rhythmStrength: 0.28,
    spectralCentroid: 1350,
    spectralFlux: 300,
    harmonicRatio: 0.87,
    weight: 0.9,
  },

  // ========== 紧张刺激类 ==========
  '惊险': {
    description: '惊险刺激',
    energy: 0.55,
    lowFreq: 0.45,
    midFreq: 0.25,
    highFreq: 0.4,
    tempo: 115,
    rhythmStrength: 0.7,
    spectralCentroid: 1900,
    spectralFlux: 1050,
    harmonicRatio: 0.48,
    weight: 0.95,
  },
  '急促': {
    description: '急促紧迫',
    energy: 0.6,
    lowFreq: 0.4,
    midFreq: 0.3,
    highFreq: 0.4,
    tempo: 135,
    rhythmStrength: 0.75,
    spectralCentroid: 2000,
    spectralFlux: 1200,
    harmonicRatio: 0.5,
    weight: 0.9,
  },
  '警觉': {
    description: '警觉警戒',
    energy: 0.45,
    lowFreq: 0.4,
    midFreq: 0.28,
    highFreq: 0.38,
    tempo: 105,
    rhythmStrength: 0.65,
    spectralCentroid: 1750,
    spectralFlux: 950,
    harmonicRatio: 0.52,
    weight: 0.9,
  },

  // ========== 温馨甜蜜类 ==========
  '温馨': {
    description: '温馨温暖',
    energy: 0.38,
    lowFreq: 0.25,
    midFreq: 0.48,
    highFreq: 0.32,
    tempo: 92,
    rhythmStrength: 0.42,
    spectralCentroid: 1550,
    spectralFlux: 420,
    harmonicRatio: 0.82,
    weight: 0.95,
  },
  '柔美': {
    description: '柔美温柔',
    energy: 0.32,
    lowFreq: 0.22,
    midFreq: 0.48,
    highFreq: 0.38,
    tempo: 88,
    rhythmStrength: 0.38,
    spectralCentroid: 1600,
    spectralFlux: 380,
    harmonicRatio: 0.86,
    weight: 0.95,
  },
  '娇憨': {
    description: '娇憨可爱',
    energy: 0.35,
    lowFreq: 0.18,
    midFreq: 0.42,
    highFreq: 0.48,
    tempo: 98,
    rhythmStrength: 0.45,
    spectralCentroid: 1850,
    spectralFlux: 480,
    harmonicRatio: 0.78,
    weight: 0.9,
  },

  // ========== 庄严神圣类 ==========
  '肃穆': {
    description: '肃穆庄重',
    energy: 0.42,
    lowFreq: 0.58,
    midFreq: 0.28,
    highFreq: 0.12,
    tempo: 78,
    rhythmStrength: 0.38,
    spectralCentroid: 950,
    spectralFlux: 450,
    harmonicRatio: 0.72,
    weight: 0.95,
  },
  '虔诚': {
    description: '虔诚敬仰',
    energy: 0.4,
    lowFreq: 0.55,
    midFreq: 0.3,
    highFreq: 0.18,
    tempo: 82,
    rhythmStrength: 0.4,
    spectralCentroid: 1050,
    spectralFlux: 480,
    harmonicRatio: 0.78,
    weight: 0.95,
  },
  '庄严感': {
    description: '庄严气势',
    energy: 0.48,
    lowFreq: 0.52,
    midFreq: 0.32,
    highFreq: 0.14,
    tempo: 85,
    rhythmStrength: 0.45,
    spectralCentroid: 1080,
    spectralFlux: 520,
    harmonicRatio: 0.7,
    weight: 0.95,
  },

  // ========== 充满活力类 ==========
  '朝气': {
    description: '朝气蓬勃',
    energy: 0.62,
    lowFreq: 0.28,
    midFreq: 0.38,
    highFreq: 0.48,
    tempo: 132,
    rhythmStrength: 0.72,
    spectralCentroid: 2200,
    spectralFlux: 900,
    harmonicRatio: 0.68,
    weight: 0.95,
  },
  '青春': {
    description: '青春活力',
    energy: 0.58,
    lowFreq: 0.25,
    midFreq: 0.4,
    highFreq: 0.45,
    tempo: 128,
    rhythmStrength: 0.7,
    spectralCentroid: 2100,
    spectralFlux: 850,
    harmonicRatio: 0.72,
    weight: 0.95,
  },
  '跃动': {
    description: '跃动动感',
    energy: 0.6,
    lowFreq: 0.26,
    midFreq: 0.36,
    highFreq: 0.46,
    tempo: 130,
    rhythmStrength: 0.73,
    spectralCentroid: 2150,
    spectralFlux: 880,
    harmonicRatio: 0.66,
    weight: 0.9,
  },

  // ========== 思考沉静类 ==========
  '沉思': {
    description: '沉思静思',
    energy: 0.26,
    lowFreq: 0.38,
    midFreq: 0.38,
    highFreq: 0.28,
    tempo: 76,
    rhythmStrength: 0.32,
    spectralCentroid: 1350,
    spectralFlux: 320,
    harmonicRatio: 0.78,
    weight: 0.9,
  },
  '深沉': {
    description: '深沉厚重',
    energy: 0.3,
    lowFreq: 0.48,
    midFreq: 0.38,
    highFreq: 0.12,
    tempo: 80,
    rhythmStrength: 0.35,
    spectralCentroid: 1150,
    spectralFlux: 380,
    harmonicRatio: 0.7,
    weight: 0.95,
  },
  '静思': {
    description: '静思冥想',
    energy: 0.22,
    lowFreq: 0.35,
    midFreq: 0.4,
    highFreq: 0.3,
    tempo: 72,
    rhythmStrength: 0.28,
    spectralCentroid: 1300,
    spectralFlux: 280,
    harmonicRatio: 0.82,
    weight: 0.9,
  },

  // ========== 童真天真类 ==========
  '童真': {
    description: '童真无邪',
    energy: 0.42,
    lowFreq: 0.2,
    midFreq: 0.4,
    highFreq: 0.52,
    tempo: 110,
    rhythmStrength: 0.5,
    spectralCentroid: 2200,
    spectralFlux: 550,
    harmonicRatio: 0.75,
    weight: 0.95,
  },
  '天真': {
    description: '天真烂漫',
    energy: 0.4,
    lowFreq: 0.18,
    midFreq: 0.42,
    highFreq: 0.5,
    tempo: 105,
    rhythmStrength: 0.48,
    spectralCentroid: 2100,
    spectralFlux: 520,
    harmonicRatio: 0.78,
    weight: 0.95,
  },
  '顽皮': {
    description: '顽皮调皮',
    energy: 0.48,
    lowFreq: 0.16,
    midFreq: 0.38,
    highFreq: 0.54,
    tempo: 118,
    rhythmStrength: 0.58,
    spectralCentroid: 2350,
    spectralFlux: 620,
    harmonicRatio: 0.72,
    weight: 0.9,
  },

  // ========== 高雅古典类 ==========
  '典雅': {
    description: '典雅优雅',
    energy: 0.35,
    lowFreq: 0.28,
    midFreq: 0.45,
    highFreq: 0.35,
    tempo: 88,
    rhythmStrength: 0.42,
    spectralCentroid: 1600,
    spectralFlux: 420,
    harmonicRatio: 0.82,
    weight: 0.95,
  },
  '雅致': {
    description: '雅致精致',
    energy: 0.32,
    lowFreq: 0.26,
    midFreq: 0.46,
    highFreq: 0.36,
    tempo: 85,
    rhythmStrength: 0.4,
    spectralCentroid: 1550,
    spectralFlux: 400,
    harmonicRatio: 0.85,
    weight: 0.9,
  },
  '清雅': {
    description: '清雅淡雅',
    energy: 0.28,
    lowFreq: 0.22,
    midFreq: 0.48,
    highFreq: 0.38,
    tempo: 82,
    rhythmStrength: 0.36,
    spectralCentroid: 1500,
    spectralFlux: 360,
    harmonicRatio: 0.86,
    weight: 0.9,
  },

  // ========== 华丽璀璨类 ==========
  '华丽': {
    description: '华丽璀璨',
    energy: 0.65,
    lowFreq: 0.35,
    midFreq: 0.38,
    highFreq: 0.42,
    tempo: 118,
    rhythmStrength: 0.65,
    spectralCentroid: 1950,
    spectralFlux: 800,
    harmonicRatio: 0.68,
    weight: 0.95,
  },
  '璀璨': {
    description: '璀璨绚丽',
    energy: 0.7,
    lowFreq: 0.32,
    midFreq: 0.36,
    highFreq: 0.45,
    tempo: 125,
    rhythmStrength: 0.7,
    spectralCentroid: 2100,
    spectralFlux: 920,
    harmonicRatio: 0.65,
    weight: 0.9,
  },
  '绚烂': {
    description: '绚烂多彩',
    energy: 0.68,
    lowFreq: 0.3,
    midFreq: 0.38,
    highFreq: 0.47,
    tempo: 122,
    rhythmStrength: 0.68,
    spectralCentroid: 2050,
    spectralFlux: 880,
    harmonicRatio: 0.67,
    weight: 0.9,
  },
};

/**
 * 情绪识别器（重构版）
 */
export class EmotionRecognizer {
  /**
   * 计算情绪得分
   * 基于音频特征和情绪特征模型的匹配度
   */
  private calculateEmotionScore(
    features: AudioFeatures,
    profile: EmotionFeatureProfile
  ): number {
    let totalScore = 0;
    let weightSum = 0;

    // 1. 能量匹配 (0-1) - 增加容差
    if (profile.energy !== undefined) {
      const energyDiff = Math.abs(features.rmsEnergy - profile.energy);
      const energyScore = Math.max(0, 1 - energyDiff * 1.5); // 容差增加到0.67
      totalScore += energyScore;
      weightSum += 1;
    }

    // 2. 频段匹配 (0-1) - 增加容差
    if (profile.lowFreq !== undefined) {
      const lowFreqDiff = Math.abs(features.lowFrequencyEnergy - profile.lowFreq);
      const lowFreqScore = Math.max(0, 1 - lowFreqDiff * 1.5);
      totalScore += lowFreqScore;
      weightSum += 1;
    }
    if (profile.midFreq !== undefined) {
      const midFreqDiff = Math.abs(features.midFrequencyEnergy - profile.midFreq);
      const midFreqScore = Math.max(0, 1 - midFreqDiff * 1.5);
      totalScore += midFreqScore;
      weightSum += 1;
    }
    if (profile.highFreq !== undefined) {
      const highFreqDiff = Math.abs(features.highFrequencyEnergy - profile.highFreq);
      const highFreqScore = Math.max(0, 1 - highFreqDiff * 1.5);
      totalScore += highFreqScore;
      weightSum += 1;
    }

    // 3. 节奏匹配 (0-1) - 增加容差
    if (profile.tempo !== undefined) {
      const tempoDiff = Math.abs(features.tempo - profile.tempo) / features.tempo;
      const tempoScore = Math.max(0, 1 - tempoDiff * 1.5); // 容差增加到67%
      totalScore += tempoScore;
      weightSum += 1;
    }

    // 4. 节奏强度匹配 (0-1) - 增加容差
    if (profile.rhythmStrength !== undefined) {
      const rhythmDiff = Math.abs(features.rhythmStrength - profile.rhythmStrength);
      const rhythmScore = Math.max(0, 1 - rhythmDiff * 1.5);
      totalScore += rhythmScore;
      weightSum += 1;
    }

    // 5. 频谱质心匹配 (0-1) - 增加容差
    if (profile.spectralCentroid !== undefined) {
      const centroidDiff = Math.abs(features.spectralCentroid - profile.spectralCentroid) / 4000;
      const centroidScore = Math.max(0, 1 - centroidDiff * 1.5);
      totalScore += centroidScore;
      weightSum += 1;
    }

    // 6. 频谱流量匹配 (0-1) - 增加容差
    if (profile.spectralFlux !== undefined) {
      const fluxDiff = Math.abs(features.spectralFlux - profile.spectralFlux) / 2000;
      const fluxScore = Math.max(0, 1 - fluxDiff * 1.5);
      totalScore += fluxScore;
      weightSum += 1;
    }

    // 7. 谐波比匹配 (0-1) - 增加容差
    if (profile.harmonicRatio !== undefined) {
      const harmonicDiff = Math.abs(features.harmonicRatio - profile.harmonicRatio);
      const harmonicScore = Math.max(0, 1 - harmonicDiff * 1.5);
      totalScore += harmonicScore;
      weightSum += 1;
    }

    // 计算平均分
    const avgScore = weightSum > 0 ? totalScore / weightSum : 0;

    // 应用情绪权重系数，并提高整体得分
    const finalScore = avgScore * (profile.weight || 1) * 1.1; // 增加1.1倍放大系数

    return finalScore;
  }

  /**
   * 识别情绪（核心方法）
   */
  recognize(features: AudioFeatures): EmotionRecognitionResult {
    // 1. 计算所有情绪的得分
    const moodScores: Array<{ mood: string; score: number }> = [];

    for (const [mood, profile] of Object.entries(EMOTION_PROFILES)) {
      const score = this.calculateEmotionScore(features, profile);
      if (score > 0.25) { // 降低阈值，允许更多相关情绪被识别
        moodScores.push({ mood, score });
      }
    }

    // 2. 按得分排序
    moodScores.sort((a, b) => b.score - a.score);

    // 3. 选择主情绪和辅助情绪
    const primaryMood = moodScores.length > 0 ? moodScores[0].mood : '未识别';
    // 增加辅助情绪数量，从3个增加到6个，让情绪标签更丰富
    const secondaryMoods = moodScores.slice(1, 7).map(r => r.mood);

    // 4. 计算情绪强度
    const intensity = this.calculateIntensity(features);

    // 5. 识别影视类型
    const filmType = this.identifyFilmType(features);

    // 6. 识别场景
    const scene = this.identifyScene(features);

    // 7. 识别音乐风格
    const style = this.identifyStyle(features);

    // 8. 推荐乐器
    const instruments = this.recommendInstruments(features);

    // 9. 计算置信度
    const confidence = moodScores.length > 0 ? moodScores[0].score : 0;

    return {
      primaryMood,
      secondaryMoods,
      intensity,
      filmType,
      scene,
      style,
      instruments,
      confidence,
    };
  }

  /**
   * 计算情绪强度
   */
  private calculateIntensity(features: AudioFeatures): number {
    const energyIntensity = Math.min(features.rmsEnergy * 2, 1);
    const rhythmIntensity = features.rhythmStrength;
    const fluxIntensity = Math.min(features.spectralFlux / 2000, 1);

    return (energyIntensity * 0.5 + rhythmIntensity * 0.3 + fluxIntensity * 0.2);
  }

  /**
   * 识别影视类型
   */
  private identifyFilmType(features: AudioFeatures): string {
    // 武侠剧：低频+中等节奏+中国风音色
    if (features.lowFrequencyEnergy > 0.35 && features.tempo > 80 && features.tempo < 130 && features.harmonicRatio > 0.5) {
      return '武侠剧（传统武侠）';
    }

    // 黑帮剧：低频+压抑+冷峻
    if (features.lowFrequencyEnergy > 0.4 && features.rmsEnergy < 0.4 && features.spectralFlux > 400) {
      return '黑帮剧（江湖道义）';
    }

    // 都市剧：中频+温暖+中等节奏
    if (features.midFrequencyEnergy > 0.4 && features.harmonicRatio > 0.55 && features.tempo > 80 && features.tempo < 120) {
      return '都市剧（都市情感）';
    }

    // 政治题材：低频+威严+慢节奏
    if (features.lowFrequencyEnergy > 0.45 && features.harmonicRatio > 0.6 && features.tempo < 100) {
      return '政治题材（历史权谋）';
    }

    // 动作片：高能量+快节奏
    if (features.rmsEnergy > 0.5 && features.tempo > 120 && features.rhythmStrength > 0.6) {
      return '动作片（现代动作）';
    }

    // 爱情片：中高频+柔和
    if (features.highFrequencyEnergy > 0.35 && features.rmsEnergy < 0.4 && features.harmonicRatio > 0.6) {
      return '爱情片（都市爱情）';
    }

    // 悬疑片：高频+变化+紧张
    if (features.spectralFlux > 800 && features.highFrequencyEnergy > 0.35 && features.tempo > 100) {
      return '悬疑片（心理悬疑）';
    }

    return '未分类';
  }

  /**
   * 识别场景
   */
  private identifyScene(features: AudioFeatures): string {
    // 武侠：华山对决
    if (features.rmsEnergy > 0.5 && features.tempo > 100 && features.lowFrequencyEnergy > 0.4) {
      return '华山之巅武林大会对决';
    }

    // 武侠：竹林论道
    if (features.rmsEnergy < 0.3 && features.tempo < 90 && features.harmonicRatio > 0.6) {
      return '深山竹林隐士高人论道';
    }

    // 武侠：客栈英雄救美
    if (features.rmsEnergy > 0.3 && features.tempo > 80 && features.midFrequencyEnergy > 0.4) {
      return '江湖客栈英雄救美';
    }

    // 黑帮：赌场火拼
    if (features.rmsEnergy > 0.5 && features.spectralFlux > 1000 && features.tempo > 110) {
      return '地下赌场帮派火拼';
    }

    // 黑帮：卧底接头
    if (features.rmsEnergy < 0.3 && features.tempo < 90 && features.spectralFlux < 500) {
      return '警局卧底传递情报接头';
    }

    // 都市：天台告白
    if (features.midFrequencyEnergy > 0.4 && features.harmonicRatio > 0.6 && features.tempo < 100) {
      return '城市天台情侣告白 / 分手';
    }

    // 都市：职场加班
    if (features.rmsEnergy > 0.25 && features.rmsEnergy < 0.45 && features.tempo > 90 && features.tempo < 120) {
      return '写字楼职场内卷加班';
    }

    // 政治：朝堂议政
    if (features.lowFrequencyEnergy > 0.45 && features.harmonicRatio > 0.65 && features.tempo < 90) {
      return '古代朝堂君臣议政博弈';
    }

    // 政治：外交谈判
    if (features.midFrequencyEnergy > 0.4 && features.spectralFlux < 600 && features.tempo < 100) {
      return '国际外交谈判桌交锋';
    }

    return '未识别场景';
  }

  /**
   * 识别音乐风格
   */
  private identifyStyle(features: AudioFeatures): string {
    if (features.harmonicRatio > 0.7 && features.spectralCentroid < 2000) {
      return '古典';
    }

    if (features.midFrequencyEnergy > 0.4 && features.harmonicRatio > 0.6 && features.tempo < 120) {
      return '流行';
    }

    if (features.highFrequencyEnergy > 0.45 && features.spectralFlux > 800 && features.tempo > 120) {
      return '电子';
    }

    if (features.rmsEnergy > 0.5 && features.spectralFlux > 600 && features.lowFrequencyEnergy > 0.35) {
      return '摇滚';
    }

    if (features.midFrequencyEnergy > 0.35 && features.harmonicRatio > 0.5 && features.spectralCentroid < 1500) {
      return '爵士';
    }

    if (features.harmonicRatio > 0.6 && features.rmsEnergy < 0.35 && features.tempo < 100) {
      return '民谣';
    }

    if (features.rhythmStrength > 0.6 && features.midFrequencyEnergy > 0.35) {
      return '嘻哈';
    }

    return '流行';
  }

  /**
   * 推荐乐器
   */
  private recommendInstruments(features: AudioFeatures): string[] {
    const instruments: string[] = [];

    // 基于频率特征推荐
    if (features.lowFrequencyEnergy > 0.4) {
      instruments.push('钢琴', '大提琴', '贝斯');
    }
    if (features.midFrequencyEnergy > 0.4) {
      instruments.push('吉他', '小提琴', '萨克斯');
    }
    if (features.highFrequencyEnergy > 0.4) {
      instruments.push('长笛', '小号', '人声');
    }

    // 基于节奏推荐
    if (features.rhythmStrength > 0.6) {
      instruments.push('鼓', '贝斯');
    }

    // 去重并限制数量
    return [...new Set(instruments)].slice(0, 5);
  }
}

// 导出单例
export const emotionRecognizer = new EmotionRecognizer();
