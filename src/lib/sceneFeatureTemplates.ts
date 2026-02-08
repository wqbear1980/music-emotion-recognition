/**
 * 二次识别影视场景特征库
 * 包含各类场景的音频特征模板，用于AI深度识别
 */

export interface SceneFeatureTemplate {
  // 场景名称
  sceneName: string;

  // 核心音频特征
  audioFeatures: {
    // 节奏特征
    rhythm: {
      bpm?: number;           // BPM范围（可选）
      pace: 'slow' | 'moderate' | 'fast' | 'variable';  // 节奏快慢
      consistency: 'steady' | 'variable' | 'irregular';  // 节奏一致性
    };

    // 音量特征
    volume: {
      level: 'low' | 'medium' | 'high' | 'dynamic';  // 音量水平
      dynamics: 'static' | 'gentle' | 'dramatic';  // 音量起伏
    };

    // 乐器特征
    instruments: {
      primary: string[];      // 主要乐器
      percussion?: string[];   // 打击乐器
      electronic?: string[];  // 电子元素
    };

    // 人声特征
    vocals?: {
      type?: 'speech' | 'singing' | 'chanting' | 'none';  // 人声类型
      style?: 'calm' | 'tense' | 'excited' | 'solemn' | 'cheering';  // 人声风格
      language?: string;       // 语言（中文、英文等）
    };
  };

  // 情绪特征
  emotionalFeatures: {
    primary: string;          // 主情绪（紧张、舒缓、激昂、肃穆等）
    intensity: 'low' | 'medium' | 'high';  // 情绪强度
    secondary?: string[];     // 次要情绪
  };

  // 关键声音特征（特殊声音提示）
  keySounds: {
    description: string;      // 描述
    examples: string[];       // 示例声音
  };

  // 影视类型
  filmTypes: string[];

  // 匹配阈值（0-100，默认70）
  matchThreshold: number;

  // 同义词/近义词映射（用于语义扩展）
  synonyms?: Record<string, string[]>;  // {特征词: [近义词1, 近义词2]}
}

export const sceneFeatureTemplates: SceneFeatureTemplate[] = [
  {
    sceneName: '法庭场景',
    audioFeatures: {
      rhythm: {
        bpm: 60,
        pace: 'slow',
        consistency: 'steady',
      },
      volume: {
        level: 'low',
        dynamics: 'static',
      },
      instruments: {
        primary: ['钢琴', '弦乐', '管乐'],
        percussion: ['法槌声', '低频鼓点'],
      },
      vocals: {
        type: 'speech',
        style: 'solemn',
        language: '中文',
      },
    },
    emotionalFeatures: {
      primary: '肃穆',
      intensity: 'medium',
      secondary: ['紧张', '严肃'],
    },
    keySounds: {
      description: '低频背景音、法槌敲击声、严肃人声',
      examples: ['法槌敲击声', '低频背景音', '严肃人声', '法庭背景音乐'],
    },
    filmTypes: ['职场剧（医护/警察/律政/美食）', '古装剧'],
    matchThreshold: 70,
    synonyms: {
      '法槌声': ['法槌敲击', '法槌响', '敲击法槌'],
      '肃穆': ['庄重', '严肃', '庄严'],
    },
  },
  {
    sceneName: '审讯场景',
    audioFeatures: {
      rhythm: {
        bpm: 50,
        pace: 'slow',
        consistency: 'steady',
      },
      volume: {
        level: 'low',
        dynamics: 'gentle',
      },
      instruments: {
        primary: ['低音吉他', '贝斯', '合成器'],
        percussion: ['轻微打击'],
      },
      vocals: {
        type: 'speech',
        style: 'tense',
        language: '中文',
      },
    },
    emotionalFeatures: {
      primary: '紧张',
      intensity: 'high',
      secondary: ['压抑', '悬疑'],
    },
    keySounds: {
      description: '低沉对话、环境安静、偶尔纸笔摩擦',
      examples: ['低沉对话', '安静环境', '纸笔摩擦声', '审讯背景音'],
    },
    filmTypes: ['推理剧', '警匪片', '古装剧'],
    matchThreshold: 70,
    synonyms: {
      '紧张': ['压抑', '紧绷', '窒息'],
      '审讯': ['询问', '调查', '盘问'],
    },
  },
  {
    sceneName: '校园教室场景',
    audioFeatures: {
      rhythm: {
        bpm: 80,
        pace: 'moderate',
        consistency: 'variable',
      },
      volume: {
        level: 'medium',
        dynamics: 'gentle',
      },
      instruments: {
        primary: ['吉他', '钢琴', '长笛'],
        percussion: ['上课铃声', '轻快节奏'],
      },
      vocals: {
        type: 'speech',
        style: 'excited',
        language: '中文',
      },
    },
    emotionalFeatures: {
      primary: '欢快',
      intensity: 'medium',
      secondary: ['轻松', '活泼'],
    },
    keySounds: {
      description: '嘈杂人声、上课铃、粉笔书写声',
      examples: ['嘈杂人声', '上课铃声', '粉笔书写声', '教室背景音乐'],
    },
    filmTypes: ['校园剧', '家庭剧', '励志片'],
    matchThreshold: 70,
    synonyms: {
      '欢快': ['轻松', '活泼', '愉悦'],
      '教室': ['课堂', '教室场景', '校园场景'],
    },
  },
  {
    sceneName: '医院手术室场景',
    audioFeatures: {
      rhythm: {
        bpm: 70,
        pace: 'moderate',
        consistency: 'steady',
      },
      volume: {
        level: 'medium',
        dynamics: 'gentle',
      },
      instruments: {
        primary: ['电子合成器', '钢琴'],
        percussion: ['高频蜂鸣', '器械碰撞'],
        electronic: ['电子音效', '监测仪器声'],
      },
      vocals: {
        type: 'speech',
        style: 'calm',
        language: '中文',
      },
    },
    emotionalFeatures: {
      primary: '紧张',
      intensity: 'medium',
      secondary: ['专业', '冷静'],
    },
    keySounds: {
      description: '仪器蜂鸣声、高频器械碰撞声',
      examples: ['仪器蜂鸣声', '高频器械碰撞声', '监护仪声', '手术室背景音'],
    },
    filmTypes: ['职场剧（医护/警察/律政/美食）', '灾难片'],
    matchThreshold: 70,
    synonyms: {
      '手术室': ['手术', '医疗场景', '医院场景'],
      '紧张': ['紧急', '危急', '紧绷'],
    },
  },
  {
    sceneName: '体育比赛场场景',
    audioFeatures: {
      rhythm: {
        bpm: 120,
        pace: 'fast',
        consistency: 'variable',
      },
      volume: {
        level: 'high',
        dynamics: 'dramatic',
      },
      instruments: {
        primary: ['铜管乐器', '军鼓', '电子合成器'],
        percussion: ['哨声', '鼓点'],
        electronic: ['电子音效', '低音'],
      },
      vocals: {
        type: 'speech',
        style: 'excited',
        language: '中文',
      },
    },
    emotionalFeatures: {
      primary: '激昂',
      intensity: 'high',
      secondary: ['振奋', '热情'],
    },
    keySounds: {
      description: '观众欢呼、哨声、解说员激昂语调',
      examples: ['观众欢呼', '哨声', '解说员激昂语调', '比赛背景音乐'],
    },
    filmTypes: ['励志片', '体育电影', '校园剧'],
    matchThreshold: 70,
    synonyms: {
      '激昂': ['振奋', '热情', '热烈'],
      '比赛': ['竞技', '赛事', '运动'],
    },
  },
  {
    sceneName: '追逐场景',
    audioFeatures: {
      rhythm: {
        bpm: 140,
        pace: 'fast',
        consistency: 'variable',
      },
      volume: {
        level: 'high',
        dynamics: 'dramatic',
      },
      instruments: {
        primary: ['电吉他', '贝斯', '合成器'],
        percussion: ['鼓点密集', '打击乐'],
        electronic: ['电子音效', '低音'],
      },
      vocals: {
        type: 'none',
      },
    },
    emotionalFeatures: {
      primary: '紧张',
      intensity: 'high',
      secondary: ['惊险', '激烈'],
    },
    keySounds: {
      description: '快速节奏、强烈低音、音效紧凑',
      examples: ['快速节奏', '强烈低音', '音效紧凑', '追逐背景音乐'],
    },
    filmTypes: ['动作片', '警匪片', '灾难片'],
    matchThreshold: 75,
    synonyms: {
      '追逐': ['追击', '逃跑', '追捕'],
      '紧张': ['惊险', '激烈', '紧急'],
    },
  },
  {
    sceneName: '吵架场景',
    audioFeatures: {
      rhythm: {
        bpm: 100,
        pace: 'moderate',
        consistency: 'variable',
      },
      volume: {
        level: 'high',
        dynamics: 'gentle',
      },
      instruments: {
        primary: ['钢琴', '弦乐'],
      },
      vocals: {
        type: 'speech',
        style: 'tense',
        language: '中文',
      },
    },
    emotionalFeatures: {
      primary: '愤怒',
      intensity: 'high',
      secondary: ['激烈', '紧张'],
    },
    keySounds: {
      description: '激烈对话、情绪起伏、紧张背景音',
      examples: ['激烈对话', '情绪起伏', '紧张背景音', '吵架背景音乐'],
    },
    filmTypes: ['家庭剧', '职场剧', '校园剧', '爱情片'],
    matchThreshold: 75,
    synonyms: {
      '吵架': ['争吵', '争执', '对峙'],
      '愤怒': ['激动', '生气', '不满'],
    },
  },
];

/**
 * 根据场景名称获取特征模板
 */
export function getSceneTemplateByName(sceneName: string): SceneFeatureTemplate | undefined {
  return sceneFeatureTemplates.find(t => t.sceneName === sceneName);
}

/**
 * 获取所有场景名称列表
 */
export function getAllSceneNames(): string[] {
  return sceneFeatureTemplates.map(t => t.sceneName);
}

/**
 * 获取影视类型对应的场景列表
 */
export function getScenesByFilmType(filmType: string): SceneFeatureTemplate[] {
  return sceneFeatureTemplates.filter(t =>
    t.filmTypes.some(f => f.includes(filmType) || filmType.includes(f))
  );
}
