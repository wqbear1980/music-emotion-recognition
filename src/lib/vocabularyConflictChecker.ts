/**
 * 词汇冲突检测工具
 *
 * 用于检测新词汇是否与现有词库形成近义/同义关系
 * 确保词汇扩充时，不引入语义重复或冲突
 */

import { STANDARD_TERMS } from './standardTerms';

/**
 * 检查词汇是否与标准词库形成近义/同义关系
 *
 * @param category 词汇类别（'mood', 'style', 'instruments', 'standardScenes', 'dubbingSuggestions'）
 * @param newTerm 待检测的新词汇
 * @returns 检测结果
 */
export function checkVocabularyConflict(
  category: 'mood' | 'style' | 'instruments' | 'standardScenes' | 'dubbingSuggestions',
  newTerm: string
): {
  hasConflict: boolean;
  conflictType?: 'exact_match' | 'synonym' | 'near_synonym' | 'partial_match';
  conflictingTerms?: string[];
  suggestion?: string;
  message: string;
} {
  // 标准化新词汇
  const normalizedNewTerm = newTerm.trim().toLowerCase();

  // 根据类别获取标准词库
  let standardTerms: string[];
  let mapping: Record<string, string>;

  switch (category) {
    case 'mood':
      standardTerms = STANDARD_TERMS.mood.standardList;
      mapping = STANDARD_TERMS.mood.mapping as Record<string, string>;
      break;

    case 'style':
      standardTerms = STANDARD_TERMS.style.standardList;
      mapping = STANDARD_TERMS.style.mapping as Record<string, string>;
      break;

    case 'instruments':
      standardTerms = STANDARD_TERMS.instruments.standardList;
      mapping = STANDARD_TERMS.instruments.mapping as Record<string, string>;
      break;

    case 'standardScenes':
      standardTerms = STANDARD_TERMS.standardScenes.allStandardList;
      mapping = STANDARD_TERMS.standardScenes.allMapping as Record<string, string>;
      break;

    case 'dubbingSuggestions':
      standardTerms = STANDARD_TERMS.dubbingSuggestions.allStandardList;
      mapping = STANDARD_TERMS.dubbingSuggestions.allMapping as Record<string, string>;
      break;

    default:
      return {
        hasConflict: false,
        message: '无效的词汇类别',
      };
  }

  // 1. 检查是否与标准词完全匹配
  if (standardTerms.includes(newTerm)) {
    return {
      hasConflict: true,
      conflictType: 'exact_match',
      conflictingTerms: [newTerm],
      message: `该词汇"${newTerm}"已存在于标准词库中，无需重复添加`,
    };
  }

  // 2. 检查是否是现有标准词的近义词（在mapping中）
  const mappedTerm = mapping[newTerm];
  if (mappedTerm && mappedTerm !== newTerm) {
    return {
      hasConflict: true,
      conflictType: 'synonym',
      conflictingTerms: [mappedTerm],
      suggestion: mappedTerm,
      message: `该词汇"${newTerm}"是现有标准词"${mappedTerm}"的近义词，请使用标准词"${mappedTerm}"`,
    };
  }

  // 3. 检查是否与标准词形成部分匹配（包含关系）
  const partialMatches: string[] = [];
  for (const standardTerm of standardTerms) {
    const normalizedStandardTerm = standardTerm.trim().toLowerCase();

    // 检查是否包含
    if (normalizedNewTerm.includes(normalizedStandardTerm) || normalizedStandardTerm.includes(normalizedNewTerm)) {
      partialMatches.push(standardTerm);
    }
  }

  if (partialMatches.length > 0) {
    return {
      hasConflict: true,
      conflictType: 'partial_match',
      conflictingTerms: partialMatches,
      suggestion: partialMatches[0],
      message: `该词汇"${newTerm}"与现有标准词"${partialMatches[0]}"存在包含关系，请确认是否需要新增或使用现有标准词`,
    };
  }

  // 4. 检查是否与标准词的近义词形成部分匹配
  const synonymPartialMatches: string[] = [];
  for (const [synonym, standardTerm] of Object.entries(mapping)) {
    const normalizedSynonym = synonym.trim().toLowerCase();

    // 检查是否包含
    if (normalizedNewTerm.includes(normalizedSynonym) || normalizedSynonym.includes(normalizedNewTerm)) {
      synonymPartialMatches.push(`"${synonym}"（标准词：${standardTerm}）`);
    }
  }

  if (synonymPartialMatches.length > 0) {
    return {
      hasConflict: true,
      conflictType: 'near_synonym',
      conflictingTerms: synonymPartialMatches,
      message: `该词汇"${newTerm}"与现有近义词${synonymPartialMatches[0]}存在语义相似，请确认是否需要新增或使用现有标准词`,
    };
  }

  // 没有冲突
  return {
    hasConflict: false,
    message: `该词汇"${newTerm}"可以安全添加到词库中`,
  };
}

/**
 * 批量检查词汇冲突
 *
 * @param category 词汇类别
 * @param newTerms 待检测的新词汇列表
 * @returns 检测结果数组
 */
export function checkVocabularyConflicts(
  category: 'mood' | 'style' | 'instruments' | 'standardScenes' | 'dubbingSuggestions',
  newTerms: string[]
): Array<{
  term: string;
  result: ReturnType<typeof checkVocabularyConflict>;
}> {
  return newTerms.map(term => ({
    term,
    result: checkVocabularyConflict(category, term),
  }));
}

/**
 * 检查候选词是否符合新增规则
 *
 * @param category 词汇类别
 * @param candidateTerm 候选词对象
 * @returns 检测结果
 */
export function checkCandidateTermRules(
  category: 'standardScenes' | 'dubbingSuggestions',
  candidateTerm: {
    term: string;
    synonyms: string[];
    filmTypes: string[];
    confidence: number;
    reason: string;
  }
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 检查候选词本身是否有冲突
  const conflictResult = checkVocabularyConflict(category, candidateTerm.term);
  if (conflictResult.hasConflict) {
    errors.push(conflictResult.message);
  }

  // 2. 检查近义词是否有冲突
  for (const synonym of candidateTerm.synonyms) {
    const synonymConflict = checkVocabularyConflict(category, synonym);
    if (!synonymConflict.hasConflict) {
      warnings.push(`近义词"${synonym}"未在标准词库中，可能需要补充映射`);
    }
  }

  // 3. 检查置信度是否≥65%
  if (candidateTerm.confidence < 65) {
    errors.push(`置信度${candidateTerm.confidence}%低于最低要求65%，不建议添加`);
  }

  // 4. 检查是否提供近义词
  if (candidateTerm.synonyms.length === 0) {
    warnings.push('未提供近义词，建议提供3-5个近义词以便后续标准化');
  }

  // 5. 检查是否提供推荐理由
  if (!candidateTerm.reason || candidateTerm.reason.trim().length === 0) {
    errors.push('未提供推荐理由');
  }

  // 6. 检查是否提供适配的影视类型
  if (!candidateTerm.filmTypes || candidateTerm.filmTypes.length === 0) {
    warnings.push('未提供适配的影视类型，建议补充');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 自动检测词库中的潜在冲突
 *
 * @param category 词汇类别
 * @returns 潜在冲突列表
 */
export function detectPotentialConflicts(
  category: 'mood' | 'style' | 'instruments' | 'standardScenes' | 'dubbingSuggestions'
): Array<{
  term1: string;
  term2: string;
  similarity: number;
  reason: string;
}> {
  const conflicts: Array<{
    term1: string;
    term2: string;
    similarity: number;
    reason: string;
  }> = [];

  let standardTerms: string[];

  switch (category) {
    case 'mood':
      standardTerms = STANDARD_TERMS.mood.standardList;
      break;
    case 'style':
      standardTerms = STANDARD_TERMS.style.standardList;
      break;
    case 'instruments':
      standardTerms = STANDARD_TERMS.instruments.standardList;
      break;
    case 'standardScenes':
      standardTerms = STANDARD_TERMS.standardScenes.allStandardList;
      break;
    case 'dubbingSuggestions':
      standardTerms = STANDARD_TERMS.dubbingSuggestions.allStandardList;
      break;
  }

  // 两两比较，检测相似度过高的词汇
  for (let i = 0; i < standardTerms.length; i++) {
    for (let j = i + 1; j < standardTerms.length; j++) {
      const term1 = standardTerms[i];
      const term2 = standardTerms[j];
      const similarity = calculateSimilarity(term1, term2);

      // 相似度>0.7的词汇可能存在近义关系
      if (similarity > 0.7 && similarity < 1) {
        conflicts.push({
          term1,
          term2,
          similarity,
          reason: `相似度${(similarity * 100).toFixed(1)}%，可能存在近义关系`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * 计算两个字符串的相似度（简单的编辑距离算法）
 *
 * @param str1 字符串1
 * @param str2 字符串2
 * @returns 相似度（0-1）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();

  if (s1 === s2) {
    return 1;
  }

  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) {
    return 1;
  }

  // 简单的编辑距离算法
  const dp: number[][] = Array(s1.length + 1)
    .fill(null)
    .map(() => Array(s2.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= s2.length; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // 删除
          dp[i][j - 1] + 1, // 插入
          dp[i - 1][j - 1] + 1 // 替换
        );
      }
    }
  }

  const editDistance = dp[s1.length][s2.length];
  return 1 - editDistance / maxLength;
}

/**
 * 导出词库统计信息
 *
 * @returns 词库统计
 */
export function getVocabularyStats(): {
  mood: number;
  style: number;
  instruments: number;
  standardScenes: number;
  dubbingSuggestions: number;
} {
  return {
    mood: STANDARD_TERMS.mood.standardList.length,
    style: STANDARD_TERMS.style.standardList.length,
    instruments: STANDARD_TERMS.instruments.standardList.length,
    standardScenes: STANDARD_TERMS.standardScenes.allStandardList.length,
    dubbingSuggestions: STANDARD_TERMS.dubbingSuggestions.allStandardList.length,
  };
}
