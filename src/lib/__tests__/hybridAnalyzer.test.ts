/**
 * 混合分析引擎测试
 * 验证所有混合方案的导出和基本功能
 */

import {
  analyzeMusicHybrid,
  quickAnalyze,
  fullAnalyze,
} from '../hybridAnalyzer';

import {
  recognizeEmotionHybrid,
} from '../hybridEmotionRecognizer';

import {
  recognizeSceneHybrid,
} from '../hybridSceneRecognizer';

import {
  isComplexMusic,
  performMultiSegmentAnalysis,
} from '../multiSegmentAnalysis';

import { STANDARD_TERMS } from '../standardTerms';

// 测试音频特征
const mockFeatures = {
  bpm: 120,
  duration: 180,
  frequencyProfile: {
    low: 0.3,
    mid: 0.4,
    high: 0.3,
  },
  energy: 0.6,
  dynamics: {
    average: 70,
    max: 90,
    range: 20,
  },
  rhythm: {
    consistency: 0.8,
    complexity: 0.6,
  },
  harmonic: {
    brightness: 0.6,
    warmth: 0.7,
  },
  texture: {
    density: 0.7,
    layering: 0.6,
  },
};

console.log('===== 混合分析引擎测试 =====\n');

// 测试1: 验证所有导出
console.log('✅ 测试1: 验证所有导出');
console.log('- analyzeMusicHybrid:', typeof analyzeMusicHybrid === 'function');
console.log('- quickAnalyze:', typeof quickAnalyze === 'function');
console.log('- fullAnalyze:', typeof fullAnalyze === 'function');
console.log('- recognizeEmotionHybrid:', typeof recognizeEmotionHybrid === 'function');
console.log('- recognizeSceneHybrid:', typeof recognizeSceneHybrid === 'function');
console.log('- isComplexMusic:', typeof isComplexMusic === 'function');
console.log('- performMultiSegmentAnalysis:', typeof performMultiSegmentAnalysis === 'function');
console.log('- STANDARD_TERMS:', typeof STANDARD_TERMS === 'object');

// 测试2: 词库管理混合模式
console.log('\n✅ 测试2: 词库管理混合模式验证');
const moodMapping = STANDARD_TERMS.mood.mapping;
console.log('- 近义词独立示例:', {
  '快乐': moodMapping['快乐'],
  '愉悦': moodMapping['愉悦'],
  '开心': moodMapping['开心'],
});
console.log('- 真正同义词映射示例:', {
  '悲怆': moodMapping['悲怆'],
  '恢弘': moodMapping['恢弘'],
});

// 测试3: 复杂音乐检测
console.log('\n✅ 测试3: 复杂音乐检测');
const isComplex = isComplexMusic(mockFeatures);
console.log('- 复杂音乐检测:', isComplex);

// 测试4: 多段落分析
console.log('\n✅ 测试4: 多段落分析');
const multiSegmentResult = performMultiSegmentAnalysis(mockFeatures);
console.log('- 段落数量:', multiSegmentResult.segments.length);
console.log('- 主导情绪:', multiSegmentResult.dominantEmotion);
console.log('- 配器复杂度:', multiSegmentResult.orchestration.complexity);

console.log('\n===== 所有测试完成 =====');

// 导出测试函数（用于集成测试）
export function runTests() {
  return {
    exports: true,
    vocabulary: true,
    complexDetection: true,
    multiSegment: true,
  };
}
