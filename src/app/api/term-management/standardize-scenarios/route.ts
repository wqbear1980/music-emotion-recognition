import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms } from '@/storage/database/shared/schema';
import { eq, and, or } from 'drizzle-orm';
import {
  validateMultiple,
  validateRequired,
  validateType,
  createErrorResponse,
  createSuccessResponse,
  createSimpleErrorResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 标准化场景词API
 * POST /api/term-management/standardize-scenarios
 *
 * 功能：
 * 基于最新的标准词库，对输入的场景词进行标准化处理
 *
 * 请求体：
 * {
 *   scenarios: string[];  // 待标准化的场景词列表
 * }
 *
 * 响应：
 * {
 *   success: true,
 *   data: {
 *     standardizedScenarios: string[],  // 标准化后的场景词列表
 *     mappings: Array<{  // 映射关系（可选）
 *       original: string;
 *       standardized: string;
 *       reason: string;
 *     }>;
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const db = await getDb();
    const body = await request.json();
    const { scenarios } = body;

    // 参数验证
    const validationResult = validateMultiple(
      validateRequired(body, 'scenarios', '场景词列表'),
      validateType(body, 'scenarios', 'array', '场景词列表'),
    );

    if (!validationResult.isValid) {
      return createErrorResponse(validationResult.errors, 400, requestId);
    }

    if (scenarios.length === 0) {
      return createSuccessResponse({
        standardizedScenarios: [],
        mappings: [],
      });
    }

    console.log(`[标准化场景词] 开始标准化 ${scenarios.length} 个场景词`);

    // 获取所有approved状态的标准场景词
    const standardTermsData = await db
      .select()
      .from(standardTerms)
      .where(
        and(
          eq(standardTerms.category, 'scenario'),
          eq(standardTerms.reviewStatus, 'approved')
        )
      );

    // 构建标准词和近义词的映射表
    const termToStandard: Map<string, string> = new Map();
    const synonymToStandard: Map<string, string> = new Map();

    for (const term of standardTermsData) {
      // 标准词映射到自身
      termToStandard.set(term.term, term.term);

      // 近义词映射到标准词
      if (term.synonyms && Array.isArray(term.synonyms)) {
        for (const synonym of term.synonyms) {
          synonymToStandard.set(synonym, term.term);
        }
      }
    }

    // 标准化场景词
    const standardizedScenarios: string[] = [];
    const mappings: Array<{
      original: string;
      standardized: string;
      reason: string;
    }> = [];

    for (const scenario of scenarios) {
      if (!scenario || typeof scenario !== 'string') {
        continue;
      }

      let standardized = scenario;
      let reason = '未标准化';

      // 1. 检查是否是标准词
      if (termToStandard.has(scenario)) {
        standardized = termToStandard.get(scenario)!;
        reason = '已是标准词';
      }
      // 2. 检查是否是近义词
      else if (synonymToStandard.has(scenario)) {
        standardized = synonymToStandard.get(scenario)!;
        reason = `是"${standardized}"的近义词`;
      }
      // 3. 检查是否包含"未识别"
      else if (scenario.includes('未识别') || scenario === '未识别') {
        // 尝试通过模糊匹配找到可能的标准词
        // 这里可以添加更复杂的模糊匹配逻辑
        console.log(`[标准化场景词] 发现未识别场景"${scenario}"，尝试模糊匹配`);
        reason = '无法识别（未识别场景）';
      }

      standardizedScenarios.push(standardized);

      if (scenario !== standardized) {
        mappings.push({
          original: scenario,
          standardized,
          reason,
        });
      }
    }

    console.log(`[标准化场景词] 标准化完成，${mappings.length} 个词被标准化`);

    return createSuccessResponse({
      standardizedScenarios,
      mappings,
    });
  } catch (error: any) {
    console.error(`[标准化场景词失败] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      error.message || '标准化场景词失败',
      500,
      'STANDARDIZE_SCENARIOS_FAILED',
      requestId
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: '请使用POST方法标准化场景词',
  }, { status: 405 });
}
