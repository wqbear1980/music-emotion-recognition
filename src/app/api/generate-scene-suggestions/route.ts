import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

interface GenerateSceneRequest {
  mood: {
    primary: string;
    intensity: number;
  };
  style: {
    primary: string;
  };
  features: {
    bpm: number;
    energy: number;
    frequencyProfile: {
      low: number;
      mid: number;
      high: number;
    };
  };
  fileName: string;
}

/**
 * POST /api/generate-scene-suggestions
 * 生成具体场景建议，替代"未识别场景"
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateSceneRequest = await request.json();

    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config);

    // 构建系统提示词
    const systemPrompt = `你是一位专业的影视配乐顾问和音乐场景分析师。你需要根据音乐的情绪、风格和特征，为音乐生成适合的具体场景建议。

【核心任务】
1. 根据音乐的情绪、风格和音频特征，生成1-3个具体、实用的场景建议
2. 使用自然、合适的中文用词和完整句子，避免生硬词汇
3. 场景建议必须与"音乐场景"强相关，确保有实际参考价值
4. 禁止生成"无场景"、"未识别"等无效内容

【场景类型参考】
- 影视类：如"悬疑片追逐场景"、"爱情片告白场景"、"励志片奋斗场景"
- 生活类：如"咖啡馆背景音"、"运动健身配乐"、"睡前放松音乐"
- 职场/校园类：如"职场汇报背景音"、"校园毕业季配乐"
- 氛围类：如"治愈系氛围音"、"紧张刺激场景配乐"、"温馨家庭场景背景音乐"

【生成规则】
1. 优先生成1个核心场景（与音乐特征最匹配的场景）
2. 可以生成2个备选场景（用逗号分隔）
3. 场景建议要具体、有画面感，如"都市通勤背景音"、"校园青春剧情配乐"等
4. 生成的场景必须与音乐的情绪（如"励志"、"治愈"、"悲伤"等）匹配
5. 避免生成与音乐情绪完全无关的场景

【返回格式】
必须以JSON格式返回，格式如下：
{
  "suggestions": ["场景建议1", "场景建议2", "场景建议3"]
}

注意：
- suggestions字段必须是字符串数组
- 每个场景建议必须是完整、具体的中文句子
- 数组长度为1-3个元素
- 不要添加任何额外的解释或说明文字`;

    // 构建用户消息
    const userMessage = `请为以下音乐生成具体场景建议：

【基本信息】
文件名：${body.fileName}

【音乐情绪】
主要情绪：${body.mood.primary}
情绪强度：${body.mood.intensity}/10

【音乐风格】
主要风格：${body.style.primary}

【音频特征】
BPM：${body.features.bpm}
能量值：${body.features.energy}
频谱分布（低/中/高）：${body.features.frequencyProfile.low} / ${body.features.frequencyProfile.mid} / ${body.features.frequencyProfile.high}

请根据以上信息，生成1-3个具体、实用的场景建议，确保场景与音乐的情绪和风格匹配。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ];

    // 使用非流式调用获取完整响应
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-251015',
      temperature: 0.7,
    });

    console.log('[生成场景建议] AI原始响应:', response.content);

    // 解析AI返回的JSON
    let aiResult;
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找到JSON格式的响应');
      }
    } catch (parseError) {
      console.error('[生成场景建议] JSON解析失败，使用兜底方案:', parseError);
      // 如果解析失败，返回兜底场景
      const fallbackSuggestion = generateFallbackSuggestion(body.mood.primary, body.style.primary);
      return NextResponse.json({
        success: true,
        data: {
          suggestions: [fallbackSuggestion],
        },
      });
    }

    // 验证返回的suggestions数组
    if (!aiResult.suggestions || !Array.isArray(aiResult.suggestions) || aiResult.suggestions.length === 0) {
      console.error('[生成场景建议] suggestions数组无效，使用兜底方案');
      const fallbackSuggestion = generateFallbackSuggestion(body.mood.primary, body.style.primary);
      return NextResponse.json({
        success: true,
        data: {
          suggestions: [fallbackSuggestion],
        },
      });
    }

    // 清理场景建议：移除换行符、制表符、非法JSON字符
    const cleanedSuggestions = aiResult.suggestions.map((suggestion: string) =>
      suggestion
        .replace(/[\n\r\t]/g, '') // 移除换行符、制表符
        .replace(/\s+/g, ' ') // 将多个空格合并为一个
        .trim() // 移除首尾空格
    );

    // 过滤掉无效的空建议
    const validSuggestions = cleanedSuggestions.filter((s: string) => s && s.length > 0);

    // 如果没有有效建议，使用兜底方案
    if (validSuggestions.length === 0) {
      console.error('[生成场景建议] 清理后无有效建议，使用兜底方案');
      const fallbackSuggestion = generateFallbackSuggestion(body.mood.primary, body.style.primary);
      return NextResponse.json({
        success: true,
        data: {
          suggestions: [fallbackSuggestion],
        },
      });
    }

    console.log('[生成场景建议] 最终生成的场景建议:', validSuggestions);

    return NextResponse.json({
      success: true,
      data: {
        suggestions: validSuggestions,
      },
    });
  } catch (error) {
    console.error('[生成场景建议] AI调用失败，使用兜底方案:', error);

    // AI调用失败时，返回兜底场景
    const fallbackSuggestion = generateFallbackSuggestion('通用', '通用');
    return NextResponse.json({
      success: true,
      data: {
        suggestions: [fallbackSuggestion],
      },
    });
  }
}

/**
 * 兜底场景生成函数
 * 根据情绪和风格生成通用但有效的场景建议
 */
function generateFallbackSuggestion(moodParam: string, styleParam: string): string {
  const mood = moodParam || '通用';
  const style = styleParam || '通用';

  // 基于情绪生成兜底场景
  const moodToScene: Record<string, string> = {
    '励志': '职场励志短片背景音乐',
    '治愈': '温馨治愈系氛围音',
    '悲伤': '情感叙事类影视配乐',
    '紧张': '悬疑片紧张刺激场景配乐',
    '欢快': '生活喜剧类背景音',
    '温馨': '家庭温馨场景背景音乐',
    '史诗': '史诗级电影配乐',
    '浪漫': '浪漫爱情片场景配乐',
    '忧郁': '文艺电影忧郁氛围音',
    '轻松': '轻松愉悦的日常场景背景音',
    '神秘': '神秘悬疑类影视配乐',
    '激情': '热血激情主题配乐',
    '平静': '平静冥想背景音',
    '怀旧': '怀旧主题影视配乐',
    '温暖': '温暖治愈类氛围音',
  };

  // 如果能匹配到情绪，使用情绪对应的场景
  if (moodToScene[mood]) {
    return moodToScene[mood];
  }

  // 否则返回通用场景
  return '通用背景配乐';
}
