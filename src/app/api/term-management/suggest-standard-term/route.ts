import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import {
  validateMultiple,
  validateRequired,
  validateType,
  validateCategory,
  createErrorResponse,
  createSuccessResponse,
  createSimpleErrorResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 获取AI推荐的标准词候选列表
 *
 * 功能：基于非标准词和上下文信息，调用LLM推荐合适的标准词
 *
 * 请求体：
 * {
 *   unrecognizedTerm: string,  // 非标准词
 *   category: 'scenario' | 'dubbing',  // 分类
 *   filmTypes?: string[],     // 关联的影视类型
 *   occurrenceCount?: number  // 出现次数
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const body = await request.json();
    const {
      unrecognizedTerm,
      category,
      filmTypes = [],
      occurrenceCount = 0
    } = body;

    // 参数校验
    const validationResult = validateMultiple(
      validateRequired(body, 'unrecognizedTerm', '非标准词'),
      validateType(body, 'unrecognizedTerm', 'string', '非标准词'),
      validateRequired(body, 'category', '分类'),
      validateType(body, 'category', 'string', '分类'),
      validateCategory(body),
      filmTypes !== undefined ? validateType(body, 'filmTypes', 'array', '关联影视类型') : undefined,
      occurrenceCount !== undefined ? validateType(body, 'occurrenceCount', 'number', '出现次数') : undefined,
    );

    if (!validationResult.isValid) {
      return createErrorResponse(validationResult.errors, 400, requestId);
    }

    console.log(`[推荐标准词] 非标准词: ${unrecognizedTerm}, 分类: ${category}, 出现次数: ${occurrenceCount}`);

    // 构建Prompt
    const categoryText = category === 'scenario' ? '场景建议' : '配音建议';
    const filmTypesText = filmTypes.length > 0
      ? `关联影视类型: ${filmTypes.join(', ')}`
      : '关联影视类型: 无';

    const systemPrompt = `你是一个专业的音乐配乐术语专家。你的任务是根据非标准术语，推荐最合适的标准术语。

**任务：**
1. 理解非标准术语的含义和使用场景
2. 推荐一个或多个标准术语，要求：
   - 术语简洁明确，符合音乐配乐专业规范
   - 能准确描述音乐的使用场景或氛围
   - 优先使用现有的标准术语（如：追逐、吵架、调查、潜入、逃亡、对峙、回忆闪回、埋伏、祭天仪式等场景词）
   - 如果无法匹配现有标准词，可以推荐新的术语，但必须符合术语命名规范
3. 每个推荐术语需要说明理由
4. 给出置信度评分（0-100）

**输出格式（严格JSON）：**
{
  "recommendations": [
    {
      "term": "推荐的标准术语",
      "reason": "推荐理由（简要说明为什么这个术语合适）",
      "confidence": 置信度数值(0-100),
      "isExisting": true/false  // 是否为现有标准词
    }
  ]
}`;

    const userPrompt = `请为以下非标准术语推荐标准术语：

- 非标准术语：${unrecognizedTerm}
- 术语分类：${categoryText}
- ${filmTypesText}
- 出现次数：${occurrenceCount}次

请提供3-5个推荐术语，按置信度从高到低排序。`;

    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config);

    // 调用LLM（使用stream方法获取完整响应）
    const llmStream = client.stream(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        model: 'doubao-seed-1-6-251015',
        temperature: 0.3,
      }
    );

    let llmResponse = '';
    for await (const chunk of llmStream) {
      if (chunk.content) {
        llmResponse += chunk.content.toString();
      }
    }

    console.log('[推荐标准词] LLM响应:', llmResponse);

    // 解析JSON结果
    const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                     llmResponse.match(/\{[\s\S]*"recommendations"[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('LLM返回数据格式错误');
    }

    const llmOutput = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    console.log(`[推荐标准词] AI返回结果:`, llmOutput);

    return createSuccessResponse(
      {
        unrecognizedTerm,
        category,
        recommendations: llmOutput.recommendations || []
      }
    );

  } catch (error) {
    console.error(`[推荐标准词] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      500,
      'SUGGEST_STANDARD_TERM_FAILED',
      requestId
    );
  }
}
