import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

interface VerifyRequest {
  aiAnalysis: any;
  searchResults?: {
    summary: string;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      site_name: string;
      summary?: string;
    }>;
  };
  fileName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    const { aiAnalysis, searchResults, fileName } = body;

    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config);

    // 构建验证Prompt
    let searchInfo = '';
    if (searchResults && searchResults.results.length > 0) {
      searchInfo = `
【联网搜索结果】
搜索摘要：${searchResults.summary}

相关结果：
${searchResults.results.slice(0, 5).map((item, index) => `
${index + 1}. ${item.title}
   来源：${item.site_name}
   摘要：${item.snippet.substring(0, 200)}
   URL：${item.url}
`).join('\n')}
`;
    } else {
      searchInfo = '【联网搜索结果】无相关结果';
    }

    const verifyPrompt = `你是一位专业的音乐验证专家，需要验证AI分析的音乐出处信息的准确性。

【任务说明】
基于以下AI分析结果和联网搜索结果，判断AI的出处分析是否准确，并给出最终的出处结论。

【AI分析结果】
文件名：${fileName}
置信度：${aiAnalysis.musicOrigin?.confidenceLevel || '未知'}
来源类型：${aiAnalysis.musicOrigin?.sourceType || '未知'}
${aiAnalysis.musicOrigin?.filmOrTV?.name ? `影视名称：${aiAnalysis.musicOrigin.filmOrTV.name}` : ''}
${aiAnalysis.musicOrigin?.filmOrTV?.episode ? `集数：${aiAnalysis.musicOrigin.filmOrTV.episode}` : ''}
${aiAnalysis.musicOrigin?.filmOrTV?.scene ? `场景：${aiAnalysis.musicOrigin.filmOrTV.scene}` : ''}
${aiAnalysis.musicOrigin?.album?.name ? `专辑：${aiAnalysis.musicOrigin.album.name}` : ''}
${aiAnalysis.musicOrigin?.creators?.composer ? `作曲：${aiAnalysis.musicOrigin.creators.composer}` : ''}
${aiAnalysis.musicOrigin?.creators?.singer ? `演唱：${aiAnalysis.musicOrigin.creators.singer}` : ''}
判断依据：${aiAnalysis.musicOrigin?.reasoning || '未提供'}
${aiAnalysis.musicOrigin?.uncertaintyReason ? `不确定原因：${aiAnalysis.musicOrigin.uncertaintyReason}` : ''}

${searchInfo}

【其他分析信息】
主要情绪：${aiAnalysis.mood?.primary || '未知'}
主要风格：${aiAnalysis.style?.primary || '未知'}
主奏乐器：${aiAnalysis.instruments?.primary?.join(', ') || '未知'}

【验证要求】
1. 对比AI分析的出处信息与联网搜索结果
2. 判断AI分析是否准确（完全匹配/部分匹配/不匹配）
3. 如果联网搜索结果与AI分析不一致，以搜索结果为准
4. 如果没有相关搜索结果，维持AI的原始分析
5. 最终结论必须明确标注置信度（高/中/低）

【输出格式】
请以JSON格式返回验证结果：
{
  "verified": true/false,
  "accuracy": "完全匹配/部分匹配/不匹配/无搜索结果验证",
  "finalMusicOrigin": {
    "confidenceLevel": "高/中/低",
    "sourceType": "影视原声/专辑/独立单曲/综艺/游戏配乐/广告/不确定",
    "filmOrTV": {
      "name": "影视/综艺名称",
      "episode": "具体集数或场次",
      "scene": "具体场景描述",
      "platform": "播出平台"
    },
    "album": {
      "name": "专辑名称",
      "releaseYear": "发行年份",
      "label": "唱片公司/发行方"
    },
    "creators": {
      "composer": "作曲者",
      "arranger": "编曲者",
      "singer": "演唱者",
      "lyricist": "作词者"
    },
    "reasoning": "判断依据",
    "uncertaintyReason": "不确定的原因"
  },
  "verificationDetails": {
    "aiAnalysis": "AI原始分析摘要",
    "searchValidation": "搜索结果验证说明",
    "adjustmentReason": "调整原因（如有）"
  }
}

【重要】
- 如果联网搜索结果明确指出出处信息，优先采用搜索结果
- 如果AI分析为高置信度但搜索结果不支持，降低置信度并调整分析
- 如果AI分析和搜索结果都不确定，保持低置信度并标注不确定原因
- 最终的musicOrigin字段必须符合原始JSON格式要求`;

    const messages = [
      { role: 'system' as const, content: verifyPrompt },
      { role: 'user' as const, content: '请验证AI分析的音乐出处信息，并给出最终结论。' },
    ];

    // 调用LLM进行验证（使用stream方式并等待完整结果）
    let fullText = '';
    try {
      const llmStream = client.stream(messages, {
        model: 'doubao-seed-1-6-251015',
        temperature: 0.3, // 降低温度以获得更稳定的验证结果
      });

      for await (const chunk of llmStream) {
        if (chunk.content) {
          fullText += chunk.content.toString();
        }
      }
    } catch (error) {
      console.error('LLM Stream Error:', error);
      throw error;
    }

    // 解析返回的JSON
    let verificationResult;
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        verificationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析验证结果');
      }
    } catch (error) {
      console.error('Parse Error:', error);
      // 如果解析失败，返回原始AI分析
      return NextResponse.json({
        verified: false,
        accuracy: '验证失败',
        finalMusicOrigin: aiAnalysis.musicOrigin || {},
        verificationDetails: {
          aiAnalysis: 'AI分析解析成功',
          searchValidation: '验证过程中出现错误',
          adjustmentReason: '无法解析验证结果，维持AI原始分析'
        }
      });
    }

    return NextResponse.json(verificationResult);
  } catch (error) {
    console.error('Verification Error:', error);
    return NextResponse.json(
      { error: '验证失败，请稍后重试' },
      { status: 500 }
    );
  }
}
