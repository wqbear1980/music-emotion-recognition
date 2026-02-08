/**
 * 多段落音乐分析工具
 * 用于处理复杂音乐（管弦乐、原声大碟）的分析
 */

export interface AudioFeatures {
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
}

export interface SegmentMood {
  primary: string;
  secondary: string[];
  intensity: number; // 1-7
}

export interface SegmentFeatures {
  bpm: number;
  dynamics: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
  instrumentation: string[];
  energy: number;
  complexity: number;
}

export interface SegmentAnalysis {
  segment: 'intro' | 'development' | 'climax' | 'outro';
  timeRange: { start: number; end: number }; // 百分比 0-100
  mood: SegmentMood;
  features: SegmentFeatures;
}

export interface EmotionalTransition {
  from: string;
  to: string;
  position: number; // 百分比 0-100
  smoothness: 'smooth' | 'abrupt' | 'gradual';
}

export interface EmotionalTrajectory {
  primary: string; // 主导情绪
  trajectory: {
    phase: 'intro' | 'development' | 'climax' | 'outro';
    emotion: string;
    intensity: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  transitions: EmotionalTransition[];
}

export interface MultiSegmentAnalysisResult {
  segments: SegmentAnalysis[];
  emotionalTrajectory: EmotionalTrajectory;
  dominantEmotion: string;
  orchestration: {
    primary: string[];
    secondary: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  };
  dynamicRange: {
    min: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
    max: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
    range: 'small' | 'medium' | 'large';
  };
}

/**
 * 根据音频特征判断是否为复杂音乐
 */
export function isComplexMusic(features: AudioFeatures): boolean {
  const { energy, texture, dynamics, rhythm } = features;

  // 能量范围大
  const hasLargeDynamicRange = dynamics.range > 30;

  // 配器层次多
  const hasRichTexture = texture.density > 6 || texture.layering > 6;

  // 节奏复杂
  const hasComplexRhythm = rhythm.complexity > 6;

  // 高频活跃（可能为管弦乐）
  const hasHighFrequencyActivity = features.frequencyProfile.high > 6;

  return hasLargeDynamicRange || hasRichTexture || hasComplexRhythm || hasHighFrequencyActivity;
}

/**
 * 自动划分音乐段落（基于音频特征）
 */
export function detectSegments(features: AudioFeatures): SegmentAnalysis[] {
  const segments: SegmentAnalysis[] = [];
  const duration = features.duration;

  // 基于动态范围判断是否有明显的高潮
  const hasClimax = features.dynamics.range > 40;

  if (hasClimax) {
    // 有高潮的四段式结构
    segments.push({
      segment: 'intro',
      timeRange: { start: 0, end: 15 },
      mood: { primary: '', secondary: [], intensity: 0 },
      features: {
        bpm: features.bpm * 0.9,
        dynamics: getDynamicLevel(features.dynamics.average - features.dynamics.range * 0.3),
        instrumentation: [],
        energy: features.energy * 0.6,
        complexity: features.rhythm.complexity * 0.7,
      },
    });

    segments.push({
      segment: 'development',
      timeRange: { start: 15, end: 50 },
      mood: { primary: '', secondary: [], intensity: 0 },
      features: {
        bpm: features.bpm,
        dynamics: getDynamicLevel(features.dynamics.average),
        instrumentation: [],
        energy: features.energy * 0.8,
        complexity: features.rhythm.complexity,
      },
    });

    segments.push({
      segment: 'climax',
      timeRange: { start: 50, end: 85 },
      mood: { primary: '', secondary: [], intensity: 0 },
      features: {
        bpm: features.bpm * 1.1,
        dynamics: getDynamicLevel(features.dynamics.average + features.dynamics.range * 0.3),
        instrumentation: [],
        energy: features.energy,
        complexity: features.rhythm.complexity * 1.2,
      },
    });

    segments.push({
      segment: 'outro',
      timeRange: { start: 85, end: 100 },
      mood: { primary: '', secondary: [], intensity: 0 },
      features: {
        bpm: features.bpm * 0.8,
        dynamics: getDynamicLevel(features.dynamics.average - features.dynamics.range * 0.2),
        instrumentation: [],
        energy: features.energy * 0.5,
        complexity: features.rhythm.complexity * 0.6,
      },
    });
  } else {
    // 无高潮的两段式结构
    segments.push({
      segment: 'intro',
      timeRange: { start: 0, end: 40 },
      mood: { primary: '', secondary: [], intensity: 0 },
      features: {
        bpm: features.bpm * 0.95,
        dynamics: getDynamicLevel(features.dynamics.average),
        instrumentation: [],
        energy: features.energy * 0.8,
        complexity: features.rhythm.complexity,
      },
    });

    segments.push({
      segment: 'development',
      timeRange: { start: 40, end: 100 },
      mood: { primary: '', secondary: [], intensity: 0 },
      features: {
        bpm: features.bpm,
        dynamics: getDynamicLevel(features.dynamics.average),
        instrumentation: [],
        energy: features.energy,
        complexity: features.rhythm.complexity,
      },
    });
  }

  return segments;
}

/**
 * 将分贝值转换为动态等级
 */
function getDynamicLevel(db: number): 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' {
  if (db < 50) return 'pp';
  if (db < 65) return 'p';
  if (db < 75) return 'mp';
  if (db < 85) return 'mf';
  if (db < 95) return 'f';
  return 'ff';
}

/**
 * 根据配器预测情绪倾向
 */
export function inferMoodFromInstrumentation(instruments: string[]): string {
  const orchestrationMoods: Record<string, string[]> = {
    史诗: ['弦乐群', '定音鼓', '铜管', '全乐队'],
    浪漫: ['钢琴', '小提琴', '大提琴', '弦乐'],
    紧张: ['铜管乐', '打击乐', '定音鼓', '低音提琴'],
    空灵: ['长笛', '木管', '竖琴', '合成器'],
    激昂: ['铜管', '打击乐', '定音鼓', '全乐队'],
    忧郁: ['小提琴', '大提琴', '木管', '钢琴'],
    温柔: ['钢琴', '木管', '弦乐', '竖琴'],
    欢快: ['长笛', '木管', '打击乐', '小提琴'],
    恐怖: ['低音提琴', '铜管', '打击乐', '合成器'],
    悬疑: ['低音提琴', '木管', '钢琴', '合成器'],
  };

  const moodScores: Record<string, number> = {};

  instruments.forEach(instrument => {
    Object.entries(orchestrationMoods).forEach(([mood, moodInstruments]) => {
      if (moodInstruments.some(mi => instrument.includes(mi))) {
        moodScores[mood] = (moodScores[mood] || 0) + 1;
      }
    });
  });

  return Object.keys(moodScores).reduce((a, b) =>
    moodScores[a] > moodScores[b] ? a : b
  ) || '';
}

/**
 * 根据动态等级判断情绪强度
 */
export function getIntensityFromDynamics(dynamics: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'): number {
  const intensityMap: Record<string, number> = {
    pp: 2,
    p: 3,
    mp: 4,
    mf: 5,
    f: 6,
    ff: 7,
  };
  return intensityMap[dynamics];
}

/**
 * 计算主导情绪
 */
export function calculateDominantEmotion(segments: SegmentAnalysis[]): string {
  const emotionScores: Record<string, number> = {};

  segments.forEach(segment => {
    // 高潮段权重更高
    const weight = segment.segment === 'climax' ? 1.5 : 1.0;
    const intensity = segment.mood.intensity || 4;

    // 主要情绪
    if (segment.mood.primary) {
      emotionScores[segment.mood.primary] =
        (emotionScores[segment.mood.primary] || 0) + intensity * weight * 2;
    }

    // 次要情绪
    segment.mood.secondary.forEach(emotion => {
      emotionScores[emotion] = (emotionScores[emotion] || 0) + intensity * weight;
    });
  });

  // 返回得分最高的情绪
  const topEmotions = Object.entries(emotionScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([emotion]) => emotion);

  return topEmotions[0] || '';
}

/**
 * 生成情绪轨迹
 */
export function generateEmotionalTrajectory(segments: SegmentAnalysis[]): EmotionalTrajectory {
  const trajectory: EmotionalTrajectory['trajectory'] = [];
  const transitions: EmotionalTransition[] = [];

  segments.forEach((segment, index) => {
    trajectory.push({
      phase: segment.segment,
      emotion: segment.mood.primary,
      intensity: segment.mood.intensity,
      trend: index === 0 ? 'stable' :
             segment.mood.intensity > segments[index - 1].mood.intensity ? 'up' :
             segment.mood.intensity < segments[index - 1].mood.intensity ? 'down' : 'stable',
    });

    // 生成转换信息
    if (index > 0) {
      const prevSegment = segments[index - 1];
      const intensityDiff = Math.abs(segment.mood.intensity - prevSegment.mood.intensity);
      const smoothness: 'smooth' | 'abrupt' | 'gradual' =
        intensityDiff <= 1 ? 'smooth' :
        intensityDiff <= 2 ? 'gradual' : 'abrupt';

      transitions.push({
        from: prevSegment.mood.primary,
        to: segment.mood.primary,
        position: segment.timeRange.start,
        smoothness,
      });
    }
  });

  const dominantEmotion = calculateDominantEmotion(segments);

  return {
    primary: dominantEmotion,
    trajectory,
    transitions,
  };
}

/**
 * 分析配器复杂度
 */
export function analyzeOrchestration(features: AudioFeatures): MultiSegmentAnalysisResult['orchestration'] {
  const complexity: 'simple' | 'moderate' | 'complex' =
    features.texture.layering < 5 ? 'simple' :
    features.texture.layering < 8 ? 'moderate' : 'complex';

  // 根据音色分布推断主要乐器
  const primary: string[] = [];
  const secondary: string[] = [];

  if (features.frequencyProfile.high > 7) {
    primary.push('铜管');
  } else if (features.frequencyProfile.mid > 7) {
    primary.push('弦乐');
  } else if (features.frequencyProfile.low > 7) {
    primary.push('低音提琴');
  }

  if (features.harmonic.warmth > 6) {
    secondary.push('木管');
  }

  if (features.rhythm.complexity > 6) {
    secondary.push('打击乐');
  }

  return {
    primary,
    secondary,
    complexity,
  };
}

/**
 * 分析动态范围
 */
export function analyzeDynamicRange(features: AudioFeatures): MultiSegmentAnalysisResult['dynamicRange'] {
  const min = getDynamicLevel(features.dynamics.average - features.dynamics.range / 2);
  const max = getDynamicLevel(features.dynamics.average + features.dynamics.range / 2);
  const range: 'small' | 'medium' | 'large' =
    features.dynamics.range < 20 ? 'small' :
    features.dynamics.range < 40 ? 'medium' : 'large';

  return { min, max, range };
}

/**
 * 完整的多段落分析
 */
export function performMultiSegmentAnalysis(features: AudioFeatures): MultiSegmentAnalysisResult {
  const segments = detectSegments(features);
  const orchestration = analyzeOrchestration(features);
  const dynamicRange = analyzeDynamicRange(features);

  // 这里应该由AI填充每段的情绪
  // 当前只是初始化空的情绪
  segments.forEach(segment => {
    const intensity = getIntensityFromDynamics(segment.features.dynamics);
    segment.mood = {
      primary: '',
      secondary: [],
      intensity,
    };
  });

  const emotionalTrajectory = generateEmotionalTrajectory(segments);
  const dominantEmotion = emotionalTrajectory.primary;

  return {
    segments,
    emotionalTrajectory,
    dominantEmotion,
    orchestration,
    dynamicRange,
  };
}
