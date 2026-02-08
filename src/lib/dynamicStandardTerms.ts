// 动态词汇标准化工具
// 从数据库加载标准词库，支持新词自动生效

import { STANDARD_TERMS } from './standardTerms';

/**
 * 动态词库缓存接口
 */
interface DynamicVocabulary {
  mapping: Record<string, string>;
  standardList: string[];
  standardize?: (text: string) => string;
}

/**
 * 动态词库总接口
 */
interface DynamicVocabularyData {
  mood?: DynamicVocabulary;
  style?: DynamicVocabulary;
  instruments?: DynamicVocabulary;
  filmGenres?: DynamicVocabulary;
  standardScenes?: DynamicVocabulary;
  dubbingSuggestions?: DynamicVocabulary;
  era?: DynamicVocabulary;
  timestamp?: string;
}

// 缓存动态词库
let dynamicVocabulary: DynamicVocabularyData | null = null;
let vocabularyTimestamp: string | null = null;
const cacheExpireTime = 5 * 60 * 1000; // 5分钟缓存
let lastFetchTime = 0;

/**
 * 从数据库加载动态词库
 */
export async function loadDynamicVocabulary(forceRefresh = false): Promise<DynamicVocabularyData> {
  const now = Date.now();

  // 检查缓存
  if (!forceRefresh && dynamicVocabulary && (now - lastFetchTime) < cacheExpireTime) {
    console.log('[动态词库] 使用缓存词库');
    return dynamicVocabulary;
  }

  try {
    console.log('[动态词库] 从数据库加载词库...');
    const response = await fetch('/api/term-management/get-dynamic-vocabulary');

    if (!response.ok) {
      console.warn(`[动态词库] API返回状态码: ${response.status}，将使用静态词库`);
      return {};
    }

    const result = await response.json();

    if (result.success && result.data) {
      dynamicVocabulary = result.data.vocabulary;
      vocabularyTimestamp = result.data.timestamp;
      lastFetchTime = now;
      console.log(`[动态词库] 加载成功，共${result.data.termCount}个词汇，时间戳：${vocabularyTimestamp}`);
      return dynamicVocabulary || {};
    } else {
      console.warn('[动态词库] 响应格式错误，将使用静态词库');
      return {};
    }
  } catch (error) {
    console.log('[动态词库] 初始化失败（使用静态词库作为后备方案，不影响功能）');
    // 如果加载失败，返回空对象，这样后续会使用静态词库
    return {};
  }
}

/**
 * 获取动态词库（如果未加载则异步加载）
 */
export function getDynamicVocabulary(): DynamicVocabularyData {
  return dynamicVocabulary || {};
}

/**
 * 强制刷新词库（用于词库更新后）
 */
export function refreshDynamicVocabulary(): void {
  console.log('[动态词库] 标记需要刷新');
  dynamicVocabulary = null;
  lastFetchTime = 0;
}

/**
 * 使用动态词库标准化单个词
 */
export async function dynamicStandardizeTerm(
  category: 'mood' | 'style' | 'instruments' | 'filmGenres' | 'era' | 'standardScenes',
  text: string
): Promise<string> {
  // 如果文本为空或 "未识别"，直接返回
  if (!text || text.trim() === '' || text === '未识别') {
    return '未识别';
  }

  // 获取动态词库
  const vocab = await loadDynamicVocabulary();
  const categoryData = vocab[category];

  // 如果没有动态词库数据，使用静态词库
  if (!categoryData || !categoryData.mapping) {
    console.log(`[动态词库] 分类${category}无动态数据，使用静态词库`);
    return standardizeTermStatic(category, text);
  }

  // 场景词使用专用标准化方法（在客户端实现）
  if (category === 'standardScenes' && categoryData) {
    const standardList = categoryData.standardList || [];
    const mapping = categoryData.mapping || {};

    // 直接匹配
    if (mapping[text]) {
      return mapping[text] as string;
    }

    // 模糊匹配
    for (const [key, value] of Object.entries(mapping)) {
      if (text.includes(key) || key.includes(text)) {
        return value as string;
      }
    }

    // 未找到匹配，返回原词
    return text;
  }

  // 使用动态映射表
  const mapping = categoryData.mapping;
  for (const [key, value] of Object.entries(mapping)) {
    if (text.includes(key) || key.includes(text)) {
      return value as string;
    }
  }

  // 如果动态词库中没有匹配，尝试静态词库作为后备
  console.log(`[动态词库] 词"${text}"未在动态词库中找到，尝试静态词库`);
  return standardizeTermStatic(category, text);
}

/**
 * 使用动态词库标准化多个词
 */
export async function dynamicStandardizeTerms(
  category: 'mood' | 'style' | 'instruments' | 'filmGenres' | 'era' | 'standardScenes',
  texts: string[]
): Promise<string[]> {
  return Promise.all(texts.map(text => dynamicStandardizeTerm(category, text)));
}

/**
 * 使用动态词库标准化完整分析结果
 */
export async function dynamicStandardizeAnalysisResult(
  result: any
): Promise<any> {
  // 保存原始情绪词（用于显示"标准词（原词）"）
  const originalMoodPrimary = result.mood?.primary || '';
  
  // 添加调试日志
  console.log('[标准化] 原始 mood.primary:', originalMoodPrimary);
  console.log('[标准化] 原始 emotionalDimensions:', result.mood?.emotionalDimensions);

  // 处理 culturalContext，如果不存在或 influences 不存在则提供默认值
  const culturalContext = result.culturalContext
    ? {
        ...result.culturalContext,
        influences: result.culturalContext.influences
          ? await Promise.all(
              result.culturalContext.influences.map((influence: string) =>
                dynamicStandardizeTerm('style', influence)
              )
            )
          : [],
      }
    : {
        origin: '未指定',
        influences: [],
        modernInterpretation: '未指定',
      };

  // 标准化后的情绪主标签
  const standardizedMoodPrimary = await dynamicStandardizeTerm('mood', originalMoodPrimary);
  
  console.log('[标准化] 标准化后 mood.primary:', standardizedMoodPrimary);

  return {
    ...result,
    mood: {
      ...result.mood,
      primary: standardizedMoodPrimary,
      originalPrimary: originalMoodPrimary, // 保存原始情绪词
    },
    style: {
      ...result.style,
      primary: await dynamicStandardizeTerm('style', result.style.primary),
      era: await dynamicStandardizeTerm('era', result.style.era),
    },
    instruments: {
      ...result.instruments,
      primary: await dynamicStandardizeTerms('instruments', result.instruments.primary),
      accompaniment: await dynamicStandardizeTerms('instruments', result.instruments.accompaniment),
      percussion: await dynamicStandardizeTerms('instruments', result.instruments.percussion),
    },
    filmMusic: {
      ...result.filmMusic,
      suitableGenres: await dynamicStandardizeTerms('filmGenres', result.filmMusic.suitableGenres),
      scenes: await Promise.all(
        result.filmMusic.scenes.map(async (scene: any) => ({
          ...scene,
          type: await dynamicStandardizeTerm('standardScenes', scene.type),
        }))
      ),
    },
    culturalContext,
  };
}

/**
 * 静态词库标准化（作为后备方案）
 * 从 standardTerms.ts 复制逻辑
 */
function standardizeTermStatic(
  category: 'mood' | 'style' | 'instruments' | 'filmGenres' | 'era' | 'standardScenes',
  text: string
): string {
  const categoryData = STANDARD_TERMS[category as keyof typeof STANDARD_TERMS] as any;

  if (!categoryData) {
    return text;
  }

  // 标准场景词使用专用方法
  if (category === 'standardScenes' && typeof categoryData.standardize === 'function') {
    return categoryData.standardize(text);
  }

  // 首先尝试直接匹配
  const mapping = categoryData.mapping;
  for (const [key, value] of Object.entries(mapping)) {
    if (text.includes(key) || key.includes(text)) {
      return value as string;
    }
  }

  // 如果没有匹配，返回 "未识别"
  return '未识别';
}

/**
 * 动态词库初始化（页面加载时调用）
 */
export async function initDynamicVocabulary(): Promise<void> {
  console.log('[动态词库] 初始化词库...');
  await loadDynamicVocabulary(true); // 强制加载
}
