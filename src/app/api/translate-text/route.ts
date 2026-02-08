import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

/**
 * 翻译API接口
 * 支持翻译专辑名称、影视名称等外文文本
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '参数错误：需要提供 texts 数组',
          translations: {},
        },
        { status: 400 }
      );
    }

    // 过滤掉已经是中文或无效的文本
    const textsToTranslate = texts.filter((text) => {
      if (!text || !text.trim()) return false;

      // 过滤掉无效文本
      if (
        text === '未提取到' ||
        text === '未识别' ||
        text === '未分类' ||
        text === 'N/A' ||
        text === 'Unknown'
      )
        return false;

      // 检查是否主要是中文（连续的中文字符占比超过50%）
      const chineseMatches = text.match(/[\u4e00-\u9fa5]+/g) || [];
      const totalChineseChars = chineseMatches.join('').length;
      const totalChars = text.length;
      const chineseRatio = totalChineseChars / totalChars;

      // 如果中文字符占比超过50%，则认为是中文，不需要翻译
      return chineseRatio < 0.5;
    });

    if (textsToTranslate.length === 0) {
      // 没有需要翻译的文本，返回原文本
      const translations: Record<string, string> = {};
      texts.forEach((text) => {
        if (text) {
          translations[text] = text;
        }
      });

      return NextResponse.json({
        success: true,
        message: '没有需要翻译的文本',
        translations,
      });
    }

    console.log(`[翻译] 准备翻译 ${textsToTranslate.length} 个文本`);

    // 初始化 LLM 客户端
    const config = new Config();
    const llmClient = new LLMClient(config);

    // 构建翻译提示词
    const prompt = `你是一个专业的文本翻译专家。请将以下外文文本翻译成中文。

要求：
1. 保持专有名词（如人名、地名、作品名、专辑名、影视名）的准确性
2. 翻译要简洁、专业，符合目标领域的命名习惯
3. 如果文本本身就是中文或不需要翻译，返回原文本
4. 请以JSON格式返回翻译结果，格式为：{"原文": "中文翻译"}

文本列表：
${textsToTranslate.map((text, index) => `${index + 1}. ${text}`).join('\n')}

请直接返回JSON格式的翻译结果，不要包含其他解释：`;

    const messages = [
      {
        role: 'system' as const,
        content:
          '你是一个专业的文本翻译专家，擅长将英文、日文、韩文等外文翻译成中文，特别是在音乐、影视领域。',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    // 调用 LLM API
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-6-251015',
      temperature: 0.3,
    });

    // 解析翻译结果
    let translations: Record<string, string> = {};

    try {
      const content = response.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        translations = JSON.parse(jsonMatch[0]);
      } else {
        translations = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('[翻译] 解析翻译结果失败:', parseError);
      return NextResponse.json(
        {
          success: false,
          message: '解析翻译结果失败',
          translations: {},
        },
        { status: 500 }
      );
    }

    // 对于未在翻译结果中的文本，使用原文本
    texts.forEach((text) => {
      if (text && !translations[text]) {
        translations[text] = text;
      }
    });

    return NextResponse.json({
      success: true,
      message: `成功翻译 ${textsToTranslate.length} 个文本`,
      translations,
    });
  } catch (error) {
    console.error('[翻译] 翻译失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '翻译失败',
        error: error instanceof Error ? error.message : '未知错误',
        translations: {},
      },
      { status: 500 }
    );
  }
}
