import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { buildVocabularyPrompt } from '@/lib/getStandardTerms';

interface AudioFeatures {
  bpm: number;
  duration: number;
  frequencyProfile: {
    low: number;
    mid: number;
    high: number;
  };
  energy: number;
  dynamics: {
    average: number;
    max: number;
    range: number;
  };
  rhythm: {
    consistency: number;
    complexity: number;
  };
  harmonic: {
    brightness: number;
    warmth: number;
  };
  texture: {
    density: number;
    layering: number;
  };
}

interface AnalysisRequest {
  features: AudioFeatures;
  fileName: string;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    year?: number;
    track?: number;
    genre?: string;
    duration?: number;
    format?: string;
    bitrate?: number;
    sampleRate?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();

    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config);

    // 从数据库动态获取审核通过的标准词库
    const vocabularyPrompt = await buildVocabularyPrompt();

    // 【性能优化】精简版系统提示词 - 减少冗余，加快处理速度
    // 动态获取审核通过的词库，确保分析时只使用已审核通过的词汇
    const systemPrompt = `你是一位专业的音乐分析师，需要根据音频特征进行快速、准确的音乐分析。

【核心任务】
1. 识别音乐的情绪、风格、乐器、结构
2. 判断适合的影视类型和场景
3. 尝试识别音乐出处（基于元数据和音频特征）

${vocabularyPrompt}

【音乐风格分类规则】
- 传统风格：明确的、固定的音乐风格（如古典、爵士、蓝调、流行），单独作为正式风格
- 场景/氛围风格：带场景/氛围描述的风格（如氛围音乐、史诗氛围、电影氛围），统一归到"场景氛围"

【用词权限 - 强制使用词库】
1. **强制使用词库中的词汇**：以上列出的所有词汇（包括刚审核通过的新词）都是标准词，必须优先使用
2. **减少未识别**：如果识别出的场景在词库中有相近的词，必须使用词库中的词，不要返回"未识别"
3. **允许使用非标准词**：只有在词库中确实没有合适词汇时，才使用非标准词，并记录到candidateTerms
4. **提高识别率**：即使无法使用标准词，也要尽力识别场景，不要简单返回"未识别"

【出处识别规则 - 专辑元数据优先】
1. **专辑元数据优先**：
   - 专辑栏（metadata.album）是出处的最权威来源，优先级最高
   - 如果专辑栏有明确信息，必须将其作为出处的核心依据
   - 置信度自动标记为"高"（因为来源是权威的专辑元数据）
   - 将专辑名称转换为标准库中的标准名称

2. **音频特征验证**：
   - 当专辑元数据存在时，使用音频特征进行验证
   - 如果音频特征与专辑信息高度一致，在reasoning中说明验证通过
   - 如果音频特征与专辑信息存在差异，在reasoning中说明差异并标注警告

3. **补充缺失信息**：
   - 当专辑信息不完整时，尝试从标准专辑库中补充
   - 当专辑不在标准库中时，尝试从艺术家、歌名等信息中推断

4. **无专辑元数据的情况**：
   - 当专辑栏为空时，才基于音频特征和艺术家、歌名等信息进行推测
   - 推测时优先使用标准信息库进行匹配
   - 置信度根据匹配度标记为"高"、"中"或"低"

5. **标准化要求**：
   - 所有专辑名称必须使用标准库中的标准名称，禁止使用别名或变体
   - 所有影视名称、创作者名称、发行方、平台都必须使用标准名称

【性能优化 - 快速识别】
1. 优先使用专辑元数据（最快且最准确）
2. 音频特征仅用于验证和补充
3. 优先使用"影视类型+情绪→场景"联动匹配，减少计算量
4. 避免过度分析，基于特征快速判断

请以JSON格式返回分析结果，格式如下：
{
  "mood": {
    "primary": "主要情绪（从标准词中选择）",
    "intensity": "强度（1-10）",
    "trajectory": "情绪变化轨迹",
    "emotionalDimensions": {
      "happiness": 7,
      "sadness": 2,
      "tension": 6,
      "romance": 3,
      "epic": 5
    }
  },
  "style": {
    "primary": "主要风格（从标准词中选择）",
    "subGenre": "子风格",
    "genreBlending": "风格融合特点",
    "era": "音乐时期（巴洛克、古典主义、浪漫主义、印象派、现代、当代）"
  },
  "musicalStructure": {
    "form": "音乐结构",
    "chorus": "是否有明显的副歌",
    "bridge": "是否有桥段",
    "repeatPatterns": "重复模式"
  },
  "harmony": {
    "tonality": "调性（大调/小调）",
    "key": "可能的调（如：C大调、A小调）",
    "chordProgression": "和弦进行特点",
    "modulation": "是否有转调"
  },
  "rhythm": {
    "timeSignature": "节拍类型（如：4/4拍）",
    "rhythmPattern": "节奏模式",
    "groove": "律动特点"
  },
  "instruments": {
    "primary": ["主奏乐器1", "主奏乐器2"],
    "accompaniment": ["伴奏乐器1", "伴奏乐器2"],
    "percussion": ["打击乐器类型"],
    "electronicElements": "电子元素（如有）",
    "timbre": "音色特点"
  },
  "musicOrigin": {
    "confidenceLevel": "高/中/低",
    "sourceType": "影视原声/专辑/独立单曲/综艺/游戏配乐/广告/不确定",
    "filmOrTV": {
      "name": "影视/综艺名称（高置信度时必填）",
      "episode": "具体集数",
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
    "uncertaintyReason": "不确定的原因（低置信度时必填）"
  },
  "filmMusic": {
    "filmType": "识别出的影片类型（优先使用标准术语，允许使用非标准术语）",
    "suitableGenres": ["适合的影视类型1", "类型2"],
    "scenes": [
      {
        "type": "场景类型（优先使用标准场景词，允许使用非标准词）",
        "description": "具体描述",
        "emotionalImpact": "情感影响",
        "usageTips": "使用建议"
      }
    ],
    "turningPoints": "适合的情节转折点",
    "characterTheme": {
      "suitable": "是否适合作为角色主题曲",
      "characterType": "适合的角色类型",
      "storyArc": "适合的故事弧"
    },
    "atmosphere": "氛围营造能力",
    "emotionalGuidance": "情感引导能力"
  },
  "culturalContext": {
    "origin": "可能的起源地/文化背景",
    "influences": ["影响1", "影响2"],
    "modernInterpretation": "现代诠释"
  },
  "candidateTerms": {
    "scenarios": [
      {
        "term": "候选场景词",
        "synonyms": ["近义词1", "近义词2"],
        "filmTypes": ["适配影视类型1"],
        "confidence": 85,
        "reason": "推荐理由"
      }
    ],
    "dubbing": [
      {
        "term": "候选配音建议词",
        "synonyms": ["近义词1", "近义词2"],
        "filmTypes": ["适配影视类型1"],
        "confidence": 80,
        "reason": "推荐理由"
      }
    ]
  }
}`;

    // 构建用户消息
    console.log('[快速分析] 收到分析请求，文件名:', body.fileName);
    console.log('[快速分析] 音频元数据:', JSON.stringify(body.metadata, null, 2));

    const userMessage = `请分析以下音频特征：

【基本信息】
文件名：${body.fileName}
时长：${body.features.duration.toFixed(2)}秒

【音频元数据】（来自ID3标签，是出处的最权威来源，优先级最高）
${body.metadata ? `歌曲标题：${body.metadata.title || '无'}
艺术家：${body.metadata.artist || '无'}
专辑：${body.metadata.album || '无'}
发行年份：${body.metadata.year || '无'}
流派：${body.metadata.genre || '无'}` : '未提取到元数据'}

【出处识别核心原则】
- 专辑栏元数据（metadata.album）是出处的最权威来源，优先级最高
- 当专辑栏有明确信息时，必须将其作为出处的核心依据
- AI分析主要用于验证专辑信息的准确性，而非从头猜测
- 音频特征仅用于验证和补充，当音频特征与专辑信息冲突时，仍以专辑信息为准（但需标注警告）

【音频特征】
BPM：${body.features.bpm}
频谱（低/中/高）：${body.features.frequencyProfile.low} / ${body.features.frequencyProfile.mid} / ${body.features.frequencyProfile.high}
能量值：${body.features.energy}
动态范围：${body.features.dynamics.range}
节奏一致性：${body.features.rhythm.consistency}
和声亮度：${body.features.harmonic.brightness}

【快速分析要求】
1. 优先使用专辑元数据作为出处的核心依据
2. 音频特征仅用于验证和补充专辑信息
3. 基于元数据和音频特征快速判断
4. 优先使用标准词，允许使用非标准词，记录到candidateTerms
5. 场景判断使用联动匹配（类型+情绪→场景）
6. 有依据就识别，减少"未识别"
7. 置信度≥80%就标注为"高"或"中"`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ];

    // 创建 SSE 流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = client.stream(messages, {
            model: 'doubao-seed-1-6-251015',
            temperature: 0.7,
          });

          for await (const chunk of llmStream) {
            if (chunk.content) {
              const content = chunk.content.toString();
              const data = `data: ${JSON.stringify({ content })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }

          // 发送结束标记
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('LLM Stream Error:', error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Analysis Error:', error);
    return NextResponse.json(
      { error: '分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
