/**
 * 学习引导系统
 * 提供新手教程、上下文帮助、术语解释等功能
 */

/**
 * 新手教程步骤
 */
export interface TutorialStep {
  target: string; // 目标元素的选择器
  action: string; // 要执行的动作
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  tips?: string[];
  warnings?: string[];
}

/**
 * 新手教程
 */
export interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  skipable: boolean;
  onComplete?: () => void;
}

/**
 * 术语帮助卡片
 */
export interface TermHelpCard {
  term: string;
  category: 'mood' | 'style' | 'filmType' | 'scenario' | 'instrument';
  definition: string;
  examples: string[];
  usage: string[];
  relatedTerms: string[];
  tips?: string[];
}

/**
 * 情绪词帮助库
 */
export const MOOD_HELP_CARDS: Record<string, TermHelpCard> = {
  '中性': {
    term: '中性',
    category: 'mood',
    definition: '无明显情绪倾向，情绪强度低，适合作为背景音乐',
    examples: [
      '办公室环境音乐',
      '商场背景音乐',
      '纪录片旁白背景',
      '产品展示背景',
    ],
    usage: [
      '客观叙事场景',
      '说明性镜头',
      '过渡场景',
      '环境氛围',
    ],
    relatedTerms: ['平和', '平静', '舒缓'],
    tips: [
      'BPM通常在60-90之间',
      '动态范围小，无明显强弱对比',
      '节奏一致，规律稳定',
    ],
  },
  '浪漫': {
    term: '浪漫',
    category: 'mood',
    definition: '表达深情、温柔、柔和的情感氛围，常用于爱情场景',
    examples: [
      '情侣约会',
      '初遇心动',
      '浪漫告白',
      '甜蜜回忆',
    ],
    usage: [
      '爱情场景',
      '抒情场景',
      '温馨时刻',
      '人物关系发展',
    ],
    relatedTerms: ['温馨', '甜蜜', '深情', '柔情'],
    tips: [
      '常与"甜蜜"、"青涩"搭配使用',
      '适合慢节奏、旋律优美的音乐',
      '避免在激烈动作场景使用',
    ],
  },
  '欢快': {
    term: '欢快',
    category: 'mood',
    definition: '轻松愉快、充满活力的情绪，让人感到快乐和积极向上',
    examples: [
      '节日庆典',
      '欢庆聚会',
      '成功喜悦',
      '轻松日常',
    ],
    usage: [
      '庆祝场景',
      '快乐日常',
      '轻松氛围',
      '积极时刻',
    ],
    relatedTerms: ['快乐', '愉悦', '兴奋', '喜悦'],
    tips: [
      'BPM通常在100-130之间',
      '节奏明快，旋律活泼',
      '适合表达积极向上的情绪',
    ],
  },
  '悲伤': {
    term: '悲伤',
    category: 'mood',
    definition: '表达悲伤、哀愁、忧郁等负面情绪，常用于情感宣泄场景',
    examples: [
      '离别',
      '失去',
      '回忆悲伤往事',
      '情感低谷',
    ],
    usage: [
      '悲伤场景',
      '情感宣泄',
      '回忆闪回',
      '人物失落',
    ],
    relatedTerms: ['哀愁', '忧郁', '忧伤', '感伤'],
    tips: [
      '常与慢节奏结合使用',
      '旋律低沉，和声复杂',
      '注意控制情绪强度，避免过度悲伤',
    ],
  },
  '紧张': {
    term: '紧张',
    category: 'mood',
    definition: '表达紧张、焦虑、紧迫的情绪，营造紧张氛围',
    examples: [
      '追逐',
      '危机来临',
      '悬疑推理',
      '时间紧迫',
    ],
    usage: [
      '追逐场景',
      '悬疑场景',
      '危机时刻',
      '推理场景',
    ],
    relatedTerms: ['焦虑', '惊险', '紧迫', '不安'],
    tips: [
      'BPM通常较快（120以上）',
      '节奏急促，有强烈的驱动力',
      '常用不协和和声增加紧张感',
    ],
  },
  '激昂': {
    term: '激昂',
    category: 'mood',
    definition: '表达强烈、炽热、充满激情的情绪，常用于高潮和战斗场景',
    examples: [
      '战斗高潮',
      '胜利时刻',
      '激昂演讲',
      '突破极限',
    ],
    usage: [
      '高潮场景',
      '战斗场景',
      '励志时刻',
      '突破场景',
    ],
    relatedTerms: ['激情', '热血', '激烈', '热情'],
    tips: [
      'BPM通常在120-150之间',
      '动态范围大，对比强烈',
      '鼓点密集，充满力量感',
    ],
  },
  '悬疑': {
    term: '悬疑',
    category: 'mood',
    definition: '营造神秘、未知的氛围，引导观众思考和猜测',
    examples: [
      '案件调查',
      '线索发现',
      '真相揭晓前',
      '神秘事件',
    ],
    usage: [
      '悬疑场景',
      '推理场景',
      '谜题解开',
      '神秘时刻',
    ],
    relatedTerms: ['神秘', '诡异', '莫测', '惊悚'],
    tips: [
      '使用不协和和声',
      '节奏不稳定，有停顿和变化',
      '音色可以选择偏暗、偏冷的',
    ],
  },
};

/**
 * 影片类型帮助库
 */
export const FILM_TYPE_HELP_CARDS: Record<string, TermHelpCard> = {
  '校园剧': {
    term: '校园剧',
    category: 'filmType',
    definition: '以校园为背景，讲述学生成长、友情、爱情等故事的剧集',
    examples: [
      '校园初恋',
      '校园友情',
      '学业奋斗',
      '毕业离别',
    ],
    usage: [
      '青春题材',
      '校园场景',
      '学生生活',
      '校园爱情',
    ],
    relatedTerms: ['青春片', '校园青春竞技'],
    tips: [
      '常用情绪词：轻快、浪漫、青涩、甜蜜',
      '辅助情绪词：青春、活力',
      '适合节奏适中、旋律清新的音乐',
    ],
  },
  '恐怖片': {
    term: '恐怖片',
    category: 'filmType',
    definition: '通过视觉和听觉效果制造恐惧、惊悚感的影片类型',
    examples: [
      '恐怖场景',
      '惊吓时刻',
      '悬疑氛围',
      '恐怖高潮',
    ],
    usage: [
      '恐怖场景',
      '惊悚氛围',
      '紧张时刻',
      '恐惧营造',
    ],
    relatedTerms: ['惊悚', '压抑', '阴森'],
    tips: [
      '专用情绪词：惊悚、压抑、阴森',
      '注意节奏的停顿和突起',
      '使用特殊音效增强恐怖感',
    ],
  },
  '古装剧': {
    term: '古装剧',
    category: 'filmType',
    definition: '以古代为背景，讲述古代人物和故事的剧集',
    examples: [
      '宫廷权谋',
      '武侠江湖',
      '古代爱情',
      '历史战役',
    ],
    usage: [
      '古代场景',
      '宫廷权谋',
      '武侠江湖',
      '历史叙事',
    ],
    relatedTerms: ['历史剧', '武侠剧'],
    tips: [
      '常用情绪词：大气、悲壮、浪漫、庄重',
      '可使用民族乐器增强历史感',
      '注意和声的古典韵味',
    ],
  },
  '动作片': {
    term: '动作片',
    category: 'filmType',
    definition: '以动作场景为核心，强调打斗、追逐等视觉冲击的影片类型',
    examples: [
      '打斗',
      '追逐',
      '爆炸',
      '战斗',
    ],
    usage: [
      '动作场景',
      '战斗场景',
      '追逐场景',
      '激烈冲突',
    ],
    relatedTerms: ['战争片', '灾难片'],
    tips: [
      '常用情绪词：激昂、紧张、热血',
      'BPM通常较快（120以上）',
      '节奏强烈，动态范围大',
    ],
  },
};

/**
 * 场景词帮助库
 */
export const SCENE_HELP_CARDS: Record<string, TermHelpCard> = {
  '追逐': {
    term: '追逐',
    category: 'scenario',
    definition: '表现人物之间的追逐、逃跑场景',
    examples: [
      '警匪追逐',
      '间谍逃亡',
      '英雄追击',
      '反派逃跑',
    ],
    usage: [
      '动作片',
      '警匪片',
      '灾难片',
      '战争片',
    ],
    relatedTerms: ['逃亡', '对抗'],
    tips: [
      '只能搭配：动作片、警匪片、灾难片、战争片',
      '绝对不能搭配：爱情片、校园剧',
      '情绪词通常为：紧张、激昂',
    ],
  },
  '回忆闪回': {
    term: '回忆闪回',
    category: 'scenario',
    definition: '表现人物回忆过去的场景，常用于剧情补充',
    examples: [
      '童年回忆',
      '昔日恋人',
      '重要事件',
      '人生转折点',
    ],
    usage: [
      '剧情片',
      '爱情片',
      '悬疑剧',
      '古装剧',
      '家庭剧',
    ],
    relatedTerms: ['回忆', '闪回'],
    tips: [
      '只能搭配：剧情片、爱情片、悬疑剧、古装剧、家庭剧',
      '绝对不能搭配：动作片、灾难片',
      '情绪词通常为：悲伤、浪漫、青涩、甜蜜',
    ],
  },
};

/**
 * 新手教程定义
 */
export const BEGINNER_TUTORIAL: Tutorial = {
  id: 'beginner',
  name: '新手入门教程',
  description: '快速了解如何使用音乐情绪识别系统',
  skipable: true,
  steps: [
    {
      target: '[data-tutorial="upload-area"]',
      action: 'click',
      title: '上传音乐文件',
      content: '点击这里或拖拽音频文件到这个区域，支持 MP3、WAV、OGG、FLAC 等格式。您可以一次性选择多个文件。',
      position: 'bottom',
      tips: [
        '确保音频文件完整且未损坏',
        '文件名可以包含歌曲信息，有助于AI识别',
      ],
    },
    {
      target: '[data-tutorial="analyze-button"]',
      action: 'click',
      title: '开始分析',
      content: '上传完成后，点击这个按钮开始AI分析。系统会自动提取音频特征并识别情绪、风格等信息。',
      position: 'bottom',
      warnings: [
        '首次分析可能需要较长时间，请耐心等待',
        '不要在分析过程中关闭页面',
      ],
    },
    {
      target: '[data-tutorial="result-area"]',
      action: 'view',
      title: '查看分析结果',
      content: '分析完成后，您可以在这里查看详细的识别结果，包括情绪、风格、乐器、影片类型、场景建议等。',
      position: 'top',
      tips: [
        '点击各个模块可以查看详细信息',
        'AI识别结果仅供参考，您可以手动修正',
      ],
    },
    {
      target: '[data-tutorial="feedback-buttons"]',
      action: 'click',
      title: '反馈识别结果',
      content: '如果AI识别准确，点击✅按钮；如果需要修正，点击❌按钮。您的反馈将帮助AI学习，提高识别准确率。',
      position: 'top',
      tips: [
        '准确的反馈能让系统学习您的偏好',
        '可以详细说明修正的原因',
      ],
    },
    {
      target: '[data-tutorial="database-button"]',
      action: 'click',
      title: '数据库管理',
      content: '点击这里可以访问数据库管理功能，查看、搜索、导出历史分析结果。',
      position: 'left',
    },
  ],
};

/**
 * 获取术语帮助卡片
 */
export function getTermHelpCard(term: string, category?: string): TermHelpCard | null {
  // 根据类别查找
  if (category === 'mood') {
    return MOOD_HELP_CARDS[term] || null;
  } else if (category === 'filmType') {
    return FILM_TYPE_HELP_CARDS[term] || null;
  } else if (category === 'scenario') {
    return SCENE_HELP_CARDS[term] || null;
  }

  // 未指定类别，遍历所有类别
  return (
    MOOD_HELP_CARDS[term] ||
    FILM_TYPE_HELP_CARDS[term] ||
    SCENE_HELP_CARDS[term] ||
    null
  );
}

/**
 * 搜索相关术语
 */
export function searchRelatedTerms(term: string): string[] {
  const related = new Set<string>();

  // 搜索情绪词
  Object.entries(MOOD_HELP_CARDS).forEach(([key, card]) => {
    if (card.term === term || card.relatedTerms.includes(term)) {
      card.relatedTerms.forEach(t => related.add(t));
    }
  });

  // 搜索影片类型
  Object.entries(FILM_TYPE_HELP_CARDS).forEach(([key, card]) => {
    if (card.term === term || card.relatedTerms.includes(term)) {
      card.relatedTerms.forEach(t => related.add(t));
    }
  });

  // 搜索场景词
  Object.entries(SCENE_HELP_CARDS).forEach(([key, card]) => {
    if (card.term === term || card.relatedTerms.includes(term)) {
      card.relatedTerms.forEach(t => related.add(t));
    }
  });

  return Array.from(related);
}
