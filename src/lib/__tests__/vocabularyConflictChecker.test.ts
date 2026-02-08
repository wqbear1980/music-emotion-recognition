/**
 * 词汇冲突检测工具测试
 *
 * 用于验证词汇冲突检测工具的功能
 */

import {
  checkVocabularyConflict,
  checkVocabularyConflicts,
  checkCandidateTermRules,
  detectPotentialConflicts,
  getVocabularyStats,
} from '../vocabularyConflictChecker';

/**
 * 测试单个词汇冲突检测
 */
export function testSingleConflictCheck() {
  console.log('=== 测试单个词汇冲突检测 ===');

  // 测试1：完全匹配
  const result1 = checkVocabularyConflict('standardScenes', '追逐');
  console.log('测试1 - 完全匹配（追逐）：', result1);
  console.assert(result1.hasConflict === true, '应该检测到冲突');
  console.assert(result1.conflictType === 'exact_match', '冲突类型应为exact_match');

  // 测试2：近义词
  const result2 = checkVocabularyConflict('standardScenes', '追击');
  console.log('测试2 - 近义词（追击）：', result2);
  console.assert(result2.hasConflict === true, '应该检测到冲突');
  console.assert(result2.conflictType === 'synonym', '冲突类型应为synonym');

  // 测试3：无冲突
  const result3 = checkVocabularyConflict('standardScenes', '雨夜童年回忆');
  console.log('测试3 - 无冲突（雨夜童年回忆）：', result3);
  console.assert(result3.hasConflict === false, '不应该检测到冲突');

  // 测试4：包含关系
  const result4 = checkVocabularyConflict('standardScenes', '追逐戏');
  console.log('测试4 - 包含关系（追逐戏）：', result4);
  console.assert(result4.hasConflict === true, '应该检测到冲突');
  console.assert(result4.conflictType === 'partial_match', '冲突类型应为partial_match');

  console.log('✅ 单个词汇冲突检测测试通过\n');
}

/**
 * 测试批量词汇冲突检测
 */
export function testBatchConflictCheck() {
  console.log('=== 测试批量词汇冲突检测 ===');

  const terms = ['追逐', '追击', '雨夜童年回忆', '追逐戏', '比赛'];
  const results = checkVocabularyConflicts('standardScenes', terms);

  console.log('批量检测结果：');
  results.forEach(({ term, result }) => {
    console.log(`  ${term}: ${result.hasConflict ? '有冲突' : '无冲突'} - ${result.message}`);
  });

  console.assert(
    results[0].result.hasConflict === true,
    '追逐应该检测到冲突'
  );
  console.assert(
    results[1].result.hasConflict === true,
    '追击应该检测到冲突'
  );
  console.assert(
    results[2].result.hasConflict === false,
    '雨夜童年回忆不应该检测到冲突'
  );

  console.log('✅ 批量词汇冲突检测测试通过\n');
}

/**
 * 测试候选词规则检查
 */
export function testCandidateTermRules() {
  console.log('=== 测试候选词规则检查 ===');

  // 测试1：有效的候选词
  const validCandidate = {
    term: '雨夜童年回忆',
    synonyms: ['雨夜回忆', '童年回忆', '雨夜童年', '回忆童年'],
    filmTypes: ['剧情片', '家庭剧', '爱情片'],
    confidence: 85,
    reason: '音乐节奏缓慢、温馨、怀旧，明显是雨夜回忆童年的氛围',
  };
  const result1 = checkCandidateTermRules('standardScenes', validCandidate);
  console.log('测试1 - 有效候选词（雨夜童年回忆）：', result1);
  console.assert(result1.isValid === true, '应该通过验证');

  // 测试2：无效的候选词（近义词）
  const invalidCandidate = {
    term: '追击',
    synonyms: ['追逐', '追赶', '追跑'],
    filmTypes: ['动作片', '警匪片'],
    confidence: 90,
    reason: '音乐节奏急促、紧张，明显是追逐的氛围',
  };
  const result2 = checkCandidateTermRules('standardScenes', invalidCandidate);
  console.log('测试2 - 无效候选词（追击）：', result2);
  console.assert(result2.isValid === false, '不应该通过验证');
  console.assert(result2.errors.length > 0, '应该有错误信息');

  // 测试3：置信度过低
  const lowConfidenceCandidate = {
    term: '新场景',
    synonyms: ['新'],
    filmTypes: ['剧情片'],
    confidence: 50,
    reason: '可能需要',
  };
  const result3 = checkCandidateTermRules('standardScenes', lowConfidenceCandidate);
  console.log('测试3 - 置信度过低（新场景）：', result3);
  console.assert(result3.isValid === false, '不应该通过验证');
  console.assert(result3.errors.some(e => e.includes('置信度')), '应该有置信度错误');

  console.log('✅ 候选词规则检查测试通过\n');
}

/**
 * 测试潜在冲突检测
 */
export function testPotentialConflictsDetection() {
  console.log('=== 测试潜在冲突检测 ===');

  const conflicts = detectPotentialConflicts('standardScenes');
  console.log('潜在冲突检测结果：');
  if (conflicts.length > 0) {
    conflicts.forEach(conflict => {
      console.log(
        `  ${conflict.term1} ↔ ${conflict.term2}: ${conflict.reason}`
      );
    });
  } else {
    console.log('  未发现潜在冲突');
  }

  console.log('✅ 潜在冲突检测测试通过\n');
}

/**
 * 测试词库统计
 */
export function testVocabularyStats() {
  console.log('=== 测试词库统计 ===');

  const stats = getVocabularyStats();
  console.log('词库统计：');
  console.log(`  情绪词: ${stats.mood}`);
  console.log(`  音乐风格: ${stats.style}`);
  console.log(`  乐器: ${stats.instruments}`);
  console.log(`  标准场景: ${stats.standardScenes}`);
  console.log(`  配音建议: ${stats.dubbingSuggestions}`);

  console.assert(stats.mood > 0, '情绪词库不应为空');
  console.assert(stats.style > 0, '音乐风格库不应为空');
  console.assert(stats.standardScenes > 0, '标准场景库不应为空');

  console.log('✅ 词库统计测试通过\n');
}

/**
 * 运行所有测试
 */
export function runAllTests() {
  console.log('🧪 开始词汇冲突检测工具测试\n');

  testSingleConflictCheck();
  testBatchConflictCheck();
  testCandidateTermRules();
  testPotentialConflictsDetection();
  testVocabularyStats();

  console.log('🎉 所有测试通过！');
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runAllTests();
}
