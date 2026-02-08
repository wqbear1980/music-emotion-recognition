/**
 * 词库分析工具
 * 用于音乐分析时调用词库，识别和标准化词汇
 */

import { STANDARD_TERMS } from './standardTerms';

/**
 * 词库分析结果接口
 */
export interface VocabularyAnalysisResult {
  // 原始词汇
  originalTerm: string;
  // 标准化后的词汇
  standardizedTerm: string;
  // 分类
  category: 'emotion' | 'style' | 'instrument' | 'scenario';
  // 是否为中性音乐相关词汇
  isNeutral: boolean;
  // 匹配度（0-1）
  confidence: number;
}

/**
 * 中性音乐词汇集合
 */
const NEUTRAL_MUSIC_TERMS = {
  // 情绪词
  emotions: [
    '中性', '平和', '平静', '平淡', '平衡', '客观', '自然',
    '宁静', '安详', '稳定', '舒缓', '安逸', '沉稳', '平稳',
    '清淡', '恬静', '柔和', '冷静', '淡然', '放松', '温和',
    '舒适', '安宁', '静谧', '平和安详', '平静安详',
    // 温暖类
    '温暖', '亲切', '慈爱', '关怀', '温柔体贴', '温馨', '暖意',
    // 宁静类
    '安详', '安宁', '平静', '平和', '安然', '安定',
    '宁静', '静谧', '幽静', '恬静', '寂静', '安静',
    // 悠闲类
    '悠闲', '闲适', '自在', '悠然', '轻松自在',
    // 愉悦类
    '愉悦', '舒畅', '欢欣', '怡然', '怡然自得',
  ],
  // 风格词
  styles: [
    '环境音乐', '氛围音乐', 'Ambient', '轻古典', '轻音乐', '轻柔音乐',
    '后摇', '电子氛围', '氛围电子', '缓拍', '慢节奏', '慢拍',
    '钢琴独奏', '钢琴曲', '弦乐', '弦乐合奏', '自然采样',
    '环境音', '自然音效', '白噪音', '粉红噪音', '轻柔打击乐',
    '轻快节奏', '极简主义', '极简风格', '简约音乐', '疗愈音乐',
    '治愈音乐', '放松音乐', '冥想音乐', '冥想曲', '禅意音乐',
  ],
  // 场景词
  scenarios: [
    '背景音乐', 'BGM', '学习', '工作', '冥想', '助眠', '专注',
    '放松', '阅读', '休息', '疗愈', '瑜伽', '咖啡厅', '商场',
  ],
  // 特征词
  characteristics: [
    '节奏缓慢', '旋律简单', '和谐温和', '音量适中', '无明显高潮',
    '循环性强', '渐进变化', '声音纯净', '空间感', '流动性',
  ],
  // 乐器词
  instruments: [
    '钢琴', '弦乐', '合成器', '长笛', '吉他', '自然采样',
  ],
};

/**
 * 判断词汇是否为中性音乐相关
 */
export function isNeutralMusicTerm(term: string): boolean {
  const normalizedTerm = term.toLowerCase().trim();

  // 检查情绪词
  if (NEUTRAL_MUSIC_TERMS.emotions.some(t => t.includes(normalizedTerm) || normalizedTerm.includes(t))) {
    return true;
  }

  // 检查风格词
  if (NEUTRAL_MUSIC_TERMS.styles.some(t => t.includes(normalizedTerm) || normalizedTerm.includes(t))) {
    return true;
  }

  // 检查场景词
  if (NEUTRAL_MUSIC_TERMS.scenarios.some(t => t.includes(normalizedTerm) || normalizedTerm.includes(t))) {
    return true;
  }

  // 检查特征词
  if (NEUTRAL_MUSIC_TERMS.characteristics.some(t => t.includes(normalizedTerm) || normalizedTerm.includes(t))) {
    return true;
  }

  // 检查乐器词
  if (NEUTRAL_MUSIC_TERMS.instruments.some(t => t.includes(normalizedTerm) || normalizedTerm.includes(t))) {
    return true;
  }

  return false;
}

/**
 * 标准化词汇
 */
export function standardizeTerm(term: string): string {
  // 尝试从情绪词标准化
  if (term in STANDARD_TERMS.mood.mapping) {
    return STANDARD_TERMS.mood.mapping[term as keyof typeof STANDARD_TERMS.mood.mapping];
  }

  // 尝试从风格词标准化
  const standardizedStyle = STANDARD_TERMS.style.standardize(term);
  if (standardizedStyle !== term) {
    return standardizedStyle;
  }

  // 尝试从乐器词标准化
  if (term in STANDARD_TERMS.instruments.mapping) {
    return STANDARD_TERMS.instruments.mapping[term as keyof typeof STANDARD_TERMS.instruments.mapping];
  }

  // 无法标准化，返回原词
  return term;
}

/**
 * 分析词汇并返回详细信息
 */
export function analyzeVocabulary(term: string): VocabularyAnalysisResult {
  const originalTerm = term.trim();
  const standardizedTerm = standardizeTerm(originalTerm);
  const isNeutral = isNeutralMusicTerm(originalTerm) || isNeutralMusicTerm(standardizedTerm);

  // 判断分类
  let category: 'emotion' | 'style' | 'instrument' | 'scenario';

  if (originalTerm in (STANDARD_TERMS.mood.mapping as Record<string, string>) || NEUTRAL_MUSIC_TERMS.emotions.includes(standardizedTerm)) {
    category = 'emotion';
  } else if (STANDARD_TERMS.style.traditionalList.includes(standardizedTerm) || STANDARD_TERMS.style.atmosphericList.includes(standardizedTerm)) {
    category = 'style';
  } else if (STANDARD_TERMS.instruments.standardList.includes(standardizedTerm)) {
    category = 'instrument';
  } else {
    category = 'scenario';
  }

  // 计算匹配度（简单实现）
  let confidence = 0.5;
  if (originalTerm in (STANDARD_TERMS.mood.mapping as Record<string, string>)) confidence = 1.0;
  else if (originalTerm in (STANDARD_TERMS.style.mapping as Record<string, string>)) confidence = 1.0;
  else if (originalTerm in (STANDARD_TERMS.instruments.mapping as Record<string, string>)) confidence = 1.0;
  else if (isNeutral) confidence = 0.8;

  return {
    originalTerm,
    standardizedTerm,
    category,
    isNeutral,
    confidence,
  };
}

/**
 * 从文本中提取中性音乐相关词汇
 */
export function extractNeutralMusicTerms(text: string): VocabularyAnalysisResult[] {
  const results: VocabularyAnalysisResult[] = [];

  // 获取所有已知词汇（包括同义词）
  const allKnownTerms = new Set<string>();

  // 添加情绪词映射中的所有词汇
  Object.keys(STANDARD_TERMS.mood.mapping as Record<string, string>).forEach(term => allKnownTerms.add(term));

  // 添加风格词
  Object.keys(STANDARD_TERMS.style.mapping as Record<string, string>).forEach(term => allKnownTerms.add(term));

  // 添加乐器词
  Object.keys(STANDARD_TERMS.instruments.mapping as Record<string, string>).forEach(term => allKnownTerms.add(term));

  // 按长度排序，优先匹配长词汇
  const sortedTerms = Array.from(allKnownTerms).sort((a, b) => b.length - a.length);

  // 使用最长匹配算法提取词汇
  let remainingText = text;
  const matchedPositions: { start: number; end: number; term: string }[] = [];

  while (remainingText.length > 0) {
    let matched = false;

    for (const term of sortedTerms) {
      if (remainingText.startsWith(term)) {
        const start = text.length - remainingText.length;
        matchedPositions.push({
          start,
          end: start + term.length,
          term,
        });
        remainingText = remainingText.slice(term.length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      remainingText = remainingText.slice(1);
    }
  }

  // 去除重叠的匹配
  const uniqueMatches = matchedPositions.filter((match, index, self) => {
    return !self.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      return (match.start >= other.start && match.start < other.end) ||
             (other.start >= match.start && other.start < match.end);
    });
  });

  // 按位置排序并分析
  uniqueMatches
    .sort((a, b) => a.start - b.start)
    .forEach(({ term }) => {
      const analysis = analyzeVocabulary(term);
      if (analysis.isNeutral || analysis.confidence > 0.5) {
        results.push(analysis);
      }
    });

  return results;
}

/**
 * 判断音乐是否为中性音乐
 * 基于多个词汇综合判断
 */
export function isNeutralMusic(terms: string[]): boolean {
  let neutralCount = 0;
  const totalTerms = terms.length;

  for (const term of terms) {
    if (isNeutralMusicTerm(term)) {
      neutralCount++;
    }
  }

  // 如果超过 50% 的词汇与中性音乐相关，则判定为中性音乐
  return totalTerms > 0 && (neutralCount / totalTerms) > 0.5;
}

/**
 * 获取中性音乐相关词库
 */
export function getNeutralMusicVocabulary() {
  return {
    emotions: NEUTRAL_MUSIC_TERMS.emotions,
    styles: NEUTRAL_MUSIC_TERMS.styles,
    scenarios: NEUTRAL_MUSIC_TERMS.scenarios,
    characteristics: NEUTRAL_MUSIC_TERMS.characteristics,
    instruments: NEUTRAL_MUSIC_TERMS.instruments,
  };
}
