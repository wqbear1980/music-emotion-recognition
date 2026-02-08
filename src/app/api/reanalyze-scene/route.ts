import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { sceneFeatureTemplates } from '@/lib/sceneFeatureTemplates';

/**
 * 音频特征接口
 */
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

/**
 * 情绪特征接口
 */
interface EmotionalFeatures {
  primary: string;
  intensity: string;
  secondary: string[];
}

/**
 * 请求接口
 */
interface ReanalysisRequest {
  fileName: string;
  audioFeatures: AudioFeatures;
  emotionalFeatures: EmotionalFeatures;
  filmType?: string; // 可选：影视类型（用于过滤匹配的场景）
  musicAnalysisId?: string; // 可选：关联的音乐分析记录ID
}

/**
 * 匹配结果接口
 */
interface MatchResult {
  sceneName: string;
  matchScore: number;
  matchDetails: {
    rhythmMatch: number;
    volumeMatch: number;
    emotionMatch: number;
    overallMatch: number;
  };
}

/**
 * 二次识别场景API
 * 基于音频特征和情绪特征，与预设场景特征模板进行比对，输出匹配度最高的场景标签
 */
export async function POST(request: NextRequest) {
  try {
    const body: ReanalysisRequest = await request.json();
    const { fileName, audioFeatures, emotionalFeatures, filmType, musicAnalysisId } = body;

    if (!fileName || !audioFeatures || !emotionalFeatures) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数：fileName、audioFeatures、emotionalFeatures',
        },
        { status: 400 }
      );
    }

    console.log(`[二次识别] 开始分析文件"${fileName}"的场景`);

    // 方法1：基于规则的特征模板匹配（快速、准确）
    const ruleBasedMatches = matchByRuleBasedTemplates(audioFeatures, emotionalFeatures, filmType);

    // 方法2：基于LLM的语义分析（补充、扩展）
    const llmMatches = await matchByLLM(audioFeatures, emotionalFeatures, filmType, fileName);

    // 合并匹配结果，综合评分
    const combinedMatches = combineMatchResults(ruleBasedMatches, llmMatches);

    // 排序，获取最佳匹配
    combinedMatches.sort((a, b) => b.matchScore - a.matchScore);
    const bestMatch = combinedMatches[0];

    console.log(`[二次识别] 最佳匹配场景: "${bestMatch?.sceneName}", 匹配分数: ${bestMatch?.matchScore}`);

    // 判断是否成功匹配
    const MATCH_THRESHOLD = 70; // 匹配阈值
    const matched = bestMatch && bestMatch.matchScore >= MATCH_THRESHOLD;

    // 构建响应
    const response = {
      success: true,
      matched,
      bestMatch: matched
        ? {
            sceneName: bestMatch.sceneName,
            matchScore: bestMatch.matchScore,
            confidence: bestMatch.matchScore >= 85 ? 'high' : bestMatch.matchScore >= 75 ? 'medium' : 'low',
            reason: generateMatchReason(bestMatch),
          }
        : null,
      allMatches: combinedMatches.slice(0, 5), // 返回前5个匹配结果
      candidateScenes: extractCandidateScenes(combinedMatches), // 提取候选场景词（用于词库扩充）
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[二次识别] 识别失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '二次识别失败',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

/**
 * 方法1：基于规则的特征模板匹配
 * 将音频特征和情绪特征与预设模板进行比对，计算匹配度
 */
function matchByRuleBasedTemplates(
  audioFeatures: AudioFeatures,
  emotionalFeatures: EmotionalFeatures,
  filmType?: string
): MatchResult[] {
  const matches: MatchResult[] = [];

  // 遍历所有场景模板
  for (const template of sceneFeatureTemplates) {
    // 如果指定了影视类型，只匹配适配的场景
    if (filmType && !template.filmTypes.some(f => f.includes(filmType) || filmType.includes(f))) {
      continue;
    }

    // 计算各项匹配度
    const rhythmMatch = calculateRhythmMatch(audioFeatures, template.audioFeatures.rhythm);
    const volumeMatch = calculateVolumeMatch(audioFeatures, template.audioFeatures.volume);
    const emotionMatch = calculateEmotionMatch(emotionalFeatures, template.emotionalFeatures);

    // 综合匹配度（加权平均）
    const overallMatch = (rhythmMatch * 0.3 + volumeMatch * 0.3 + emotionMatch * 0.4);

    matches.push({
      sceneName: template.sceneName,
      matchScore: Math.round(overallMatch),
      matchDetails: {
        rhythmMatch: Math.round(rhythmMatch),
        volumeMatch: Math.round(volumeMatch),
        emotionMatch: Math.round(emotionMatch),
        overallMatch: Math.round(overallMatch),
      },
    });
  }

  return matches;
}

/**
 * 计算节奏匹配度
 */
function calculateRhythmMatch(audioFeatures: AudioFeatures, templateRhythm: any): number {
  let score = 0;

  // BPM匹配（差异越小，分数越高）
  if (templateRhythm.bpm) {
    const bpmDiff = Math.abs(audioFeatures.bpm - templateRhythm.bpm);
    score += Math.max(0, 100 - bpmDiff * 0.5); // 每差异1BPM，扣0.5分
  }

  // 节奏快慢匹配
  const paceMap: Record<string, number> = {
    slow: 60,
    moderate: 100,
    fast: 130,
    variable: 100, // 可变节奏给中等分数
  };
  const expectedBpm = paceMap[templateRhythm.pace] || 100;
  const paceScore = Math.max(0, 100 - Math.abs(audioFeatures.bpm - expectedBpm) * 0.3);
  score = paceScore; // 节奏快慢是最重要的因素

  return score;
}

/**
 * 计算音量匹配度
 */
function calculateVolumeMatch(audioFeatures: AudioFeatures, templateVolume: any): number {
  // 根据能量值判断音量水平
  const levelMap: Record<string, number[]> = {
    low: [0, 0.4],
    medium: [0.4, 0.7],
    high: [0.7, 1.0],
    dynamic: [0.3, 1.0], // 动态音量范围大
  };

  const [min, max] = levelMap[templateVolume.level] || [0, 1];
  const inRange = audioFeatures.energy >= min && audioFeatures.energy <= max;
  const levelScore = inRange ? 100 : Math.max(0, 100 - Math.min(audioFeatures.energy - max, min - audioFeatures.energy) * 200);

  // 音量动态匹配
  const dynamicsRange = audioFeatures.dynamics.max - audioFeatures.dynamics.average;
  const dynamicScore: Record<string, number> = {
    static: dynamicsRange < 0.2 ? 100 : Math.max(0, 100 - dynamicsRange * 200),
    gentle: dynamicsRange >= 0.2 && dynamicsRange < 0.5 ? 100 : Math.max(0, 100 - Math.abs(dynamicsRange - 0.35) * 200),
    dramatic: dynamicsRange >= 0.5 ? 100 : Math.max(0, 100 - (0.5 - dynamicsRange) * 200),
  };

  const dynamicsScore = dynamicScore[templateVolume.dynamics] || 0;
  return (levelScore + dynamicsScore) / 2;
}

/**
 * 计算情绪匹配度
 */
function calculateEmotionMatch(emotionalFeatures: EmotionalFeatures, templateEmotion: any): number {
  // 主情绪匹配
  const primaryMatch = emotionalFeatures.primary === templateEmotion.primary ? 100 : 0;

  // 次要情绪匹配
  let secondaryScore = 0;
  if (templateEmotion.secondary && emotionalFeatures.secondary.length > 0) {
    const matches = emotionalFeatures.secondary.filter(s => templateEmotion.secondary.includes(s));
    secondaryScore = (matches.length / templateEmotion.secondary.length) * 100;
  }

  // 情绪强度匹配
  const intensityMap: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };
  const intensityMatch = Math.max(0, 100 - Math.abs(intensityMap[emotionalFeatures.intensity] - intensityMap[templateEmotion.intensity]) * 33);

  return (primaryMatch * 0.5 + secondaryScore * 0.3 + intensityMatch * 0.2);
}

/**
 * 方法2：基于LLM的语义分析
 * 使用AI进行深度语义分析，提取隐含的场景特征
 */
async function matchByLLM(
  audioFeatures: AudioFeatures,
  emotionalFeatures: EmotionalFeatures,
  filmType: string | undefined,
  fileName: string
): Promise<MatchResult[]> {
  try {
    const config = new Config();
    const client = new LLMClient(config);

    // 构建系统提示词
    const systemPrompt = `你是一位专业的音乐场景识别专家，擅长通过音频特征和情绪特征判断音乐适合的影视场景。

【任务】
根据提供的音频特征和情绪特征，分析并判断音乐最匹配的影视场景。

【可用场景列表】
${sceneFeatureTemplates.map(t => `- ${t.sceneName}（影视类型：${t.filmTypes.join('、')}）`).join('\n')}

【分析要点】
1. 节奏特征：根据BPM和节奏一致性判断场景氛围（如快速节奏适合追逐、激烈比赛；慢节奏适合法庭、审讯）
2. 音量特征：根据能量值和动态范围判断场景紧张度（如高能量+大动态适合比赛、追逐；低能量+静态适合审讯、手术室）
3. 情绪特征：根据情绪类型和强度匹配场景情绪（如紧张+高强度适合追逐、审讯；肃穆+中强度适合法庭）
4. 影视类型：根据影视类型过滤不匹配的场景（如校园剧不适合法庭场景）

【输出格式】
请以JSON格式输出分析结果，包含以下字段：
\`\`\`json
{
  "topMatches": [
    {
      "sceneName": "场景名称",
      "matchScore": 匹配分数（0-100的整数）,
      "reason": "匹配理由"
    }
  ],
  "candidateScenes": [
    {
      "sceneName": "候选场景名称",
      "synonyms": ["近义词1", "近义词2"],
      "filmTypes": ["适配影视类型1", "适配影视类型2"],
      "confidence": 置信度（0-100的整数）,
      "reason": "推荐理由"
    }
  ]
}
\`\`\``;

    // 构建用户消息
    const userMessage = `请分析以下音乐的场景：

【音频特征】
- BPM: ${audioFeatures.bpm}
- 能量值: ${audioFeatures.energy}
- 节奏一致性: ${(audioFeatures.rhythm.consistency * 100).toFixed(0)}%
- 节奏复杂度: ${(audioFeatures.rhythm.complexity * 100).toFixed(0)}%
- 音量动态范围: ${(audioFeatures.dynamics.range * 100).toFixed(0)}%
- 音色亮度: ${(audioFeatures.harmonic.brightness * 100).toFixed(0)}%
- 音色温暖度: ${(audioFeatures.harmonic.warmth * 100).toFixed(0)}%

【情绪特征】
- 主情绪: ${emotionalFeatures.primary}
- 情绪强度: ${emotionalFeatures.intensity}
- 次要情绪: ${emotionalFeatures.secondary.join('、')}

${filmType ? `【影视类型】\n${filmType}\n` : ''}

【文件名】
${fileName}

请输出最匹配的3-5个场景，以及1-2个候选新场景（如果标准词库未能覆盖）。`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    // 调用LLM（使用stream方法获取完整响应）
    const llmStream = client.stream(messages, {
      model: 'doubao-seed-1-6-251015',
      temperature: 0.3,
    });

    let llmResponse = '';
    for await (const chunk of llmStream) {
      if (chunk.content) {
        llmResponse += chunk.content.toString();
      }
    }

    console.log('[二次识别] LLM响应:', llmResponse);

    // 解析JSON结果
    const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                     llmResponse.match(/\{[\s\S]*"topMatches"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[1] || jsonMatch[0]);

        // 转换为MatchResult格式
        const matches: MatchResult[] = (result.topMatches || []).map((m: any) => ({
          sceneName: m.sceneName,
          matchScore: m.matchScore,
          matchDetails: {
            rhythmMatch: 0,
            volumeMatch: 0,
            emotionMatch: 0,
            overallMatch: m.matchScore,
          },
        }));

        return matches;
      } catch (parseError) {
        console.error('[二次识别] 解析LLM结果失败:', parseError);
      }
    }

    return [];
  } catch (error) {
    console.error('[二次识别] LLM分析失败:', error);
    return [];
  }
}

/**
 * 合并匹配结果
 * 综合规则匹配和LLM匹配的结果
 */
function combineMatchResults(ruleBasedMatches: MatchResult[], llmMatches: MatchResult[]): MatchResult[] {
  const combinedMap = new Map<string, MatchResult>();

  // 添加规则匹配结果（权重0.6）
  for (const match of ruleBasedMatches) {
    combinedMap.set(match.sceneName, {
      ...match,
      matchScore: match.matchScore * 0.6,
    });
  }

  // 添加LLM匹配结果（权重0.4）
  for (const match of llmMatches) {
    const existing = combinedMap.get(match.sceneName);
    if (existing) {
      // 如果已存在，合并分数
      existing.matchScore = Math.round(existing.matchScore + match.matchScore * 0.4);
    } else {
      // 如果不存在，直接添加
      combinedMap.set(match.sceneName, {
        ...match,
        matchScore: Math.round(match.matchScore * 0.4),
      });
    }
  }

  // 转换为数组并排序
  return Array.from(combinedMap.values());
}

/**
 * 生成匹配理由
 */
function generateMatchReason(match: MatchResult): string {
  const details = match.matchDetails;

  const rhythmDesc = details.rhythmMatch >= 80
    ? '节奏匹配度高'
    : details.rhythmMatch >= 60
    ? '节奏匹配度中等'
    : '节奏匹配度较低';

  const volumeDesc = details.volumeMatch >= 80
    ? '音量匹配度高'
    : details.volumeMatch >= 60
    ? '音量匹配度中等'
    : '音量匹配度较低';

  const emotionDesc = details.emotionMatch >= 80
    ? '情绪匹配度高'
    : details.emotionMatch >= 60
    ? '情绪匹配度中等'
    : '情绪匹配度较低';

  return `${match.sceneName}匹配综合分数为${match.matchScore}分。${rhythmDesc}（${details.rhythmMatch}分），${volumeDesc}（${details.volumeMatch}分），${emotionDesc}（${details.emotionMatch}分）。`;
}

/**
 * 提取候选场景词
 * 从匹配结果中提取置信度较高的候选新场景，用于词库扩充
 */
function extractCandidateScenes(matches: MatchResult[]): any[] {
  // 提取匹配分数在60-75之间的场景（作为候选新词）
  const candidates = matches
    .filter(m => m.matchScore >= 60 && m.matchScore < 75)
    .slice(0, 3); // 最多返回3个候选

  return candidates.map(m => ({
    sceneName: m.sceneName,
    synonyms: [], // 可以通过LLM进一步提取近义词
    filmTypes: [], // 可以从场景模板中获取
    confidence: m.matchScore,
    reason: `基于音频特征分析，匹配分数为${m.matchScore}分，建议纳入词库审核`,
  }));
}
