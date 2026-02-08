import { getDb } from 'coze-coding-dev-sdk';
import { FALLBACK_DATA } from '@/lib/db-enhanced';
import { standardTerms } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * 标准词库接口
 */
export interface StandardVocabulary {
  // 情绪词
  emotions: string[];
  // 风格词 - 传统风格
  traditionalStyles: string[];
  // 场景/氛围风格（统一为"场景氛围"）
  atmosphericStyles: string[];
  // 乐器词
  instruments: string[];
  // 影视类型
  filmTypes: string[];
  // 场景词
  scenarios: string[];
}

/**
 * 从数据库获取审核通过的标准词库
 * 仅获取 reviewStatus = 'approved' 的词汇
 * 数据库不可用时使用降级数据
 */
export async function getApprovedStandardTerms(): Promise<StandardVocabulary> {
  try {
    const db = await getDb();

    // 查询所有审核通过的标准词
    const approvedTerms = await db
      .select({
        term: standardTerms.term,
        category: standardTerms.category,
        filmTypes: standardTerms.filmTypes,
      })
      .from(standardTerms)
      .where(eq(standardTerms.reviewStatus, 'approved'));

    // 按分类分组
    const vocabulary: StandardVocabulary = {
      emotions: [],
      traditionalStyles: [],
      atmosphericStyles: [],
      instruments: [],
      filmTypes: [],
      scenarios: [],
    };

    approvedTerms.forEach((item) => {
      const { term, category } = item;

      switch (category) {
        case 'emotion':
          vocabulary.emotions.push(term);
          break;

        case 'style':
          // 根据三分类规则：传统音乐、场景氛围音乐、其他
          // 第一类：传统音乐风格（明确的、固定的音乐风格）
          // 第二类：场景/氛围风格（带场景/氛围描述的风格）
          // 第三类：其他风格
          if (isTraditionalStyle(term)) {
            vocabulary.traditionalStyles.push(term);
          } else if (isAtmosphericStyle(term)) {
            // 场景氛围风格统一归到"场景氛围"
            if (!vocabulary.atmosphericStyles.includes('场景氛围')) {
              vocabulary.atmosphericStyles.push('场景氛围');
            }
          } else {
            // 其他风格也归到场景氛围
            if (!vocabulary.atmosphericStyles.includes('场景氛围')) {
              vocabulary.atmosphericStyles.push('场景氛围');
            }
          }
          break;

        case 'instrument':
          vocabulary.instruments.push(term);
          break;

        case 'film':
          vocabulary.filmTypes.push(term);
          break;

        case 'scenario':
          vocabulary.scenarios.push(term);
          break;

        default:
          console.warn(`未知的词库分类: ${category}`);
          break;
      }
    });

    return vocabulary;
  } catch (error: any) {
    // 数据库连接失败时使用降级数据
    if (
      error.message.includes('DB_CONNECTION_FAILED') ||
      error.message.includes('timeout') ||
      error.message.includes('Compute node') ||
      error.message.includes('connection') ||
      error.message.includes('ECONNREFUSED')
    ) {
      console.error('[标准词库] 数据库连接失败，使用降级数据:', error.message);
      
      // 返回降级数据
      return {
        emotions: FALLBACK_DATA.standardTerms.emotion,
        traditionalStyles: FALLBACK_DATA.standardTerms.style.filter(isTraditionalStyle),
        atmosphericStyles: ['场景氛围'],
        instruments: FALLBACK_DATA.standardTerms.instrument,
        filmTypes: FALLBACK_DATA.standardTerms.film,
        scenarios: FALLBACK_DATA.standardTerms.scenario,
      };
    }

    // 其他错误抛出
    throw error;
  }
}

/**
 * 判断是否为传统风格
 * 第一类：明确的、固定的音乐风格（如古典、爵士、蓝调、流行）
 */
function isTraditionalStyle(term: string): boolean {
  const traditionalKeywords = [
    '古典', '流行', '电子', '摇滚', '爵士',
    '民谣', '嘻哈', 'R&B', '金属', '新世纪',
    '乡村', '雷鬼', '蓝调', '朋克', '放克',
    '灵魂', '迪斯科', '探戈', '华尔兹', '波尔卡'
  ];

  return traditionalKeywords.some(keyword => term.includes(keyword));
}

/**
 * 判断是否为场景/氛围风格
 * 第二类：带场景/氛围描述的风格（如氛围音乐、史诗氛围、电影氛围）
 */
function isAtmosphericStyle(term: string): boolean {
  const atmosphericKeywords = [
    '氛围', '史诗', '电影', '励志', '疗愈', '治愈',
    '冥想', '禅意', '背景', 'BGM', '配乐', '原声', 'OST'
  ];

  return atmosphericKeywords.some(keyword => term.includes(keyword));
}

/**
 * 构建词库Prompt字符串
 * 用于AI分析时将审核通过的词库注入到Prompt中
 */
export async function buildVocabularyPrompt(): Promise<string> {
  const vocabulary = await getApprovedStandardTerms();

  const parts = [
    '【术语标准化 - 强制使用标准词库】',
    '',
    '【重要提示】',
    `- 当前词库包含${vocabulary.scenarios.length}个场景词、${vocabulary.emotions.length}个情绪词、${vocabulary.filmTypes.length}个影视类型词`,
    `- 所有审核通过的新词已实时同步到此词库，请优先使用这些词汇`,
    '',
    '【情绪词】',
    `标准词库：${vocabulary.emotions.join('、')}`,
    '',
    '【风格词】',
    '【传统风格】' + vocabulary.traditionalStyles.join('、'),
    '【场景/氛围风格】场景氛围（包含：氛围音乐、史诗氛围、电影氛围、励志流行、疗愈音乐、冥想音乐、背景音乐等）',
    '',
    '【乐器词】',
    `标准词库：${vocabulary.instruments.join('、')}`,
    '',
    '【影视类型】',
    `标准词库：${vocabulary.filmTypes.join('、')}`,
    '',
    '【场景词】',
    `标准词库（共${vocabulary.scenarios.length}个）：${vocabulary.scenarios.join('、')}`,
    '',
    '【核心原则 - 强制使用词库】',
    '1. **必须使用词库中的词汇**：以上列出的所有词汇（包括刚审核通过的新词）都是标准词，必须优先使用',
    '2. **减少未识别**：如果识别出的场景在词库中有相近的词，必须使用词库中的词，不要返回"未识别"',
    '3. **允许使用非标准词**：只有在词库中确实没有合适词汇时，才使用非标准词，并记录到candidateTerms',
    '4. **提高识别率**：即使无法使用标准词，也要尽力识别场景，不要简单返回"未识别"',
  ];

  return parts.join('\n');
}
