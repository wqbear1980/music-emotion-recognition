import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

/**
 * 专辑名称翻译API
 * 使用大语言模型将外文专辑名称翻译成中文
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { albumNames } = body;

    if (!albumNames || !Array.isArray(albumNames)) {
      return NextResponse.json(
        {
          success: false,
          message: '参数错误：需要提供 albumNames 数组',
        },
        { status: 400 }
      );
    }

    // 过滤掉空值和中文专辑名称（假设中文专辑不需要翻译）
    const albumsToTranslate = albumNames.filter(
      (album: string) => album && album.trim() && !/[\u4e00-\u9fa5]/.test(album)
    );

    if (albumsToTranslate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要翻译的专辑名称',
        translations: {},
      });
    }

    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config);

    // 构建翻译提示词
    const prompt = `你是一个专业的音乐专辑翻译专家。请将以下专辑名称翻译成中文。

要求：
1. 保持专有名词（如人名、地名、作品名）的准确性
2. 翻译要简洁、专业，符合音乐专辑的命名习惯
3. 如果专辑本身就是中文或不需要翻译，返回原名称
4. 请以JSON格式返回翻译结果，格式为：{"原专辑名": "中文翻译"}

专辑列表：
${albumsToTranslate.map((album, index) => `${index + 1}. ${album}`).join('\n')}

请直接返回JSON格式的翻译结果，不要包含其他解释：`;

    const messages = [
      {
        role: 'system' as const,
        content:
          '你是一个专业的音乐专辑翻译专家，擅长将英文、日文、韩文等外文专辑名称翻译成中文。',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    // 调用 LLM API（使用流式输出，但这里只需要最终结果）
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-251015',
      temperature: 0.3, // 降低温度以获得更准确的翻译
    });

    // 解析翻译结果
    let translations: Record<string, string> = {};

    try {
      // 尝试提取 JSON 部分（可能包含在 markdown 代码块中）
      const content = response.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        translations = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有找到 JSON，尝试直接解析
        translations = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('[专辑翻译] 解析翻译结果失败:', parseError);
      console.error('[专辑翻译] 原始内容:', response.content);

      // 解析失败时，返回空翻译
      return NextResponse.json(
        {
          success: false,
          message: '解析翻译结果失败',
          translations: {},
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `成功翻译 ${Object.keys(translations).length} 个专辑名称`,
      translations,
    });
  } catch (error) {
    console.error('[专辑翻译] 翻译失败:', error);
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
