/**
 * 同义词/近义词相似度计算工具
 *
 * 使用大语言模型（LLM）计算词汇之间的语义相似度
 * 用于场景词库自动扩充时的新词去重校验
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getLLMProviderConfig } from './llmConfig';

/**
 * 相似度计算结果
 */
export interface SimilarityResult {
  isSynonym: boolean;          // 是否为近义词/同义词
  similarity: number;           // 相似度（0-1）
  reason: string;               // 判断理由
  threshold: number;            // 判定阈值
}

/**
 * 批量相似度计算结果
 */
export interface BatchSimilarityResult {
  term: string;                // 待检测词汇
  existingTerms: Array<{       // 词库中已有词汇及相似度
    term: string;
    similarity: number;
  }>;
  hasConflict: boolean;        // 是否存在冲突（相似度≥阈值）
  highestSimilarity: number;    // 最高相似度
  recommendedAction: 'reject' | 'review' | 'accept'; // 推荐操作
}

/**
 * 计算两个词汇的语义相似度
 *
 * @param term1 词汇1
 * @param term2 词汇2
 * @param threshold 相似度阈值（默认0.8）
 * @returns 相似度计算结果
 */
export async function calculateSimilarity(
  term1: string,
  term2: string,
  threshold: number = 0.8
): Promise<SimilarityResult> {
  try {
    // 使用LLM配置管理模块获取配置
    const llmConfig = getLLMProviderConfig();
    const client = new LLMClient(llmConfig.config);

    console.log('[相似度计算] 使用LLM配置:', {
      type: llmConfig.type,
      provider: llmConfig.provider,
      model: llmConfig.model,
    });

    const prompt = `你是一位语言学专家，擅长判断中文词汇之间的语义关系。

请判断以下两个中文词汇是否为近义词或同义词：

词汇1："${term1}"
词汇2："${term2}"

请从以下维度分析：
1. 语义是否相同或高度相似
2. 使用场景是否重叠
3. 是否可以互换使用

请返回JSON格式的结果，格式如下：
{
  "isSynonym": true/false,  // 是否为近义词/同义词
  "similarity": 0.95,       // 相似度（0-1之间的小数，保留2位小数）
  "reason": "判断理由"      // 简要说明判断依据
}

注意：
- 相似度≥0.8判定为近义词/同义词
- 相似度<0.8判定为不同词汇
- 请准确判断，避免误判`;

    const messages = [{ role: 'user' as const, content: prompt }];

    const response = await client.stream(messages, {
      model: llmConfig.model,
      temperature: llmConfig.defaultTemperature,
      streaming: llmConfig.defaultStreaming,
      caching: llmConfig.defaultCaching,
      thinking: llmConfig.defaultThinking,
    });

    let content = '';
    for await (const chunk of response) {
      content += chunk.content || '';
    }
    
    // 提取JSON结果
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('LLM返回格式错误');
    }

    const result = JSON.parse(jsonMatch[0]);

    // 判断是否超过阈值
    const isOverThreshold = result.similarity >= threshold;

    return {
      isSynonym: isOverThreshold && result.isSynonym,
      similarity: result.similarity,
      reason: result.reason,
      threshold
    };
  } catch (error) {
    console.error('计算相似度失败:', error);
    // 失败时返回低相似度，避免误杀
    return {
      isSynonym: false,
      similarity: 0,
      reason: '计算失败，默认不判定为近义词',
      threshold
    };
  }
}

/**
 * 批量计算新词汇与词库中已有词汇的相似度
 *
 * @param newTerm 待检测的新词汇
 * @param existingTerms 词库中已有的词汇数组
 * @param threshold 相似度阈值（默认0.8）
 * @returns 批量相似度计算结果
 */
export async function batchCalculateSimilarity(
  newTerm: string,
  existingTerms: string[],
  threshold: number = 0.8
): Promise<BatchSimilarityResult> {
  try {
    // 如果词库为空，直接返回可接受
    if (existingTerms.length === 0) {
      return {
        term: newTerm,
        existingTerms: [],
        hasConflict: false,
        highestSimilarity: 0,
        recommendedAction: 'accept'
      };
    }

    // 并行计算相似度（限制并发数为5，避免超时）
    const results: Array<{ term: string; similarity: number }> = [];
    const batchSize = 5;

    for (let i = 0; i < existingTerms.length; i += batchSize) {
      const batch = existingTerms.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (existingTerm) => {
          const result = await calculateSimilarity(newTerm, existingTerm, threshold);
          return {
            term: existingTerm,
            similarity: result.similarity
          };
        })
      );
      results.push(...batchResults);
    }

    // 找出最高相似度
    const highestSimilarity = Math.max(...results.map(r => r.similarity), 0);

    // 判断是否存在冲突
    const hasConflict = highestSimilarity >= threshold;

    // 推荐操作
    let recommendedAction: 'reject' | 'review' | 'accept';
    if (highestSimilarity >= threshold) {
      recommendedAction = 'reject'; // 超过阈值，拒绝
    } else if (highestSimilarity >= threshold - 0.1) {
      recommendedAction = 'review'; // 接近阈值，需要人工审核
    } else {
      recommendedAction = 'accept'; // 远低于阈值，接受
    }

    // 过滤出相似度>0.5的词汇，避免返回太多无意义的结果
    const filteredResults = results.filter(r => r.similarity > 0.5);

    return {
      term: newTerm,
      existingTerms: filteredResults.sort((a, b) => b.similarity - a.similarity),
      hasConflict,
      highestSimilarity,
      recommendedAction
    };
  } catch (error) {
    console.error('批量计算相似度失败:', error);
    // 失败时返回谨慎的结果
    return {
      term: newTerm,
      existingTerms: [],
      hasConflict: false,
      highestSimilarity: 0,
      recommendedAction: 'review' // 需要人工审核
    };
  }
}

/**
 * 从数据库中获取指定分类的标准词
 */
export async function getStandardTermsByCategory(category: string): Promise<string[]> {
  try {
    const { getDb } = await import('coze-coding-dev-sdk');
    const { standardTerms } = await import('@/storage/database/shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const db = await getDb();

    const results = await db
      .select({ term: standardTerms.term })
      .from(standardTerms)
      .where(
        and(
          eq(standardTerms.category, category),
          eq(standardTerms.reviewStatus, 'approved') // 只获取已审核通过的词
        )
      );

    return results.map(r => r.term);
  } catch (error) {
    console.error('获取标准词失败:', error);
    return [];
  }
}

/**
 * 自动校验新词汇是否适合扩充到词库
 *
 * @param newTerm 待检测的新词汇
 * @param category 分类（scenario、dubbing等）
 * @param threshold 相似度阈值（默认0.8）
 * @returns 校验结果
 */
export async function autoValidateTerm(
  newTerm: string,
  category: string,
  threshold: number = 0.8
): Promise<BatchSimilarityResult & { category: string }> {
  try {
    // 1. 从数据库获取该分类的所有标准词
    const existingTerms = await getStandardTermsByCategory(category);

    // 2. 批量计算相似度
    const result = await batchCalculateSimilarity(newTerm, existingTerms, threshold);

    // 3. 添加分类信息
    return {
      ...result,
      category
    };
  } catch (error) {
    console.error('自动校验词汇失败:', error);
    return {
      term: newTerm,
      category,
      existingTerms: [],
      hasConflict: false,
      highestSimilarity: 0,
      recommendedAction: 'review'
    };
  }
}
