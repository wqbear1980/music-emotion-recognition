/**
 * 6类目标场景的核心词汇初始化
 * 用于初始化场景词库，覆盖影视作品常见场景
 */

interface SceneData {
  coreTerms: string[];
  synonyms: Record<string, string[]>;
  filmTypes: string[];
  confidenceThreshold: number;
}

interface TargetScenes {
  courtroom: SceneData;
  interrogation: SceneData;
  classroom: SceneData;
  office: SceneData;
  operatingRoom: SceneData;
  stadium: SceneData;
}

export const TARGET_SCENES: TargetScenes = {
  // 1. 法庭场景
  courtroom: {
    coreTerms: [
      '法槌',
      '庭审',
      '辩护',
      '陪审团',
      '举证'
    ],
    synonyms: {
      '法槌': ['敲击声', '法官锤', '审判锤'],
      '庭审': ['法庭', '审判', '开庭', '法庭审理'],
      '辩护': ['辩词', '辩论', '辩护词', '律师辩护'],
      '陪审团': ['陪审', '陪审员', '陪审席'],
      '举证': ['证据', '展示证据', '提交证据', '呈堂证供']
    },
    filmTypes: ['律政剧', '剧情片', '悬疑片'],
    confidenceThreshold: 0.8
  },

  // 2. 审讯场景
  interrogation: {
    coreTerms: [
      '审讯室',
      '盘问',
      '笔录',
      '嫌疑人',
      '口供'
    ],
    synonyms: {
      '审讯室': ['审讯', '询问室', '审问室', '审讯场景'],
      '盘问': ['审问', '提问', '质问', '审讯'],
      '笔录': ['记录', '讯问记录', '审讯记录', '口供记录'],
      '嫌疑人': ['嫌疑犯', '嫌疑人', '可疑人员', '犯罪分子'],
      '口供': ['供词', '招供', '供述', '认罪']
    },
    filmTypes: ['警匪片', '悬疑片', '推理剧'],
    confidenceThreshold: 0.8
  },

  // 3. 校园教室场景
  classroom: {
    coreTerms: [
      '上课铃',
      '板书',
      '朗读',
      '值日生',
      '下课'
    ],
    synonyms: {
      '上课铃': ['铃声', '上课铃声', '预备铃'],
      '板书': ['黑板', '黑板书写', '老师板书'],
      '朗读': ['朗诵', '念书', '读书声', '学生朗读'],
      '值日生': ['值日', '打扫', '值日同学'],
      '下课': ['放学', '课间', '课间休息']
    },
    filmTypes: ['校园剧', '青春片', '家庭剧'],
    confidenceThreshold: 0.8
  },

  // 4. 办公室场景
  office: {
    coreTerms: [
      '键盘声',
      '电话铃',
      '会议',
      '打印',
      '咖啡杯'
    ],
    synonyms: {
      '键盘声': ['打字声', '键盘敲击', '电脑键盘'],
      '电话铃': ['电话铃声', '手机铃声', '来电'],
      '会议': ['开会', '讨论', '商务会议', '公司会议'],
      '打印': ['打印机', '打印文件', '复印'],
      '咖啡杯': ['咖啡', '茶水', '咖啡时间', '休息时间']
    },
    filmTypes: ['职场剧', '剧情片', '喜剧片'],
    confidenceThreshold: 0.8
  },

  // 5. 医院手术室场景
  operatingRoom: {
    coreTerms: [
      '心电监护',
      '手术刀',
      '麻醉',
      '缝合',
      '手术仪器'
    ],
    synonyms: {
      '心电监护': ['监护仪', '心电仪', '心电图', '生命体征监测'],
      '手术刀': ['手术器械', '手术工具', '医疗器械'],
      '麻醉': ['麻醉剂', '麻醉药', '打麻药', '全身麻醉'],
      '缝合': ['缝针', '伤口缝合', '手术缝合', '缝线'],
      '手术仪器': ['手术室设备', '医疗设备', '手术台', '无影灯']
    },
    filmTypes: ['医疗剧', '家庭剧', '剧情片'],
    confidenceThreshold: 0.8
  },

  // 6. 体育比赛场场景
  stadium: {
    coreTerms: [
      '观众欢呼',
      '裁判哨声',
      '解说',
      '进球',
      '赛场广播'
    ],
    synonyms: {
      '观众欢呼': ['欢呼', '观众掌声', '加油声', '呐喊'],
      '裁判哨声': ['哨声', '裁判哨', '吹哨', '比赛哨声'],
      '解说': ['解说员', '播音', '比赛解说', '体育解说'],
      '进球': ['得分', '射门得分', '投篮得分', '得分'],
      '赛场广播': ['广播', '场馆广播', '比赛广播', '体育场广播']
    },
    filmTypes: ['体育片', '励志片', '剧情片'],
    confidenceThreshold: 0.8
  }
};

/**
 * 获取所有目标场景的核心词汇
 */
export function getAllTargetSceneTerms() {
  const terms: Array<{
    term: string;
    category: string;
    termType: string;
    synonyms: string[];
    filmTypes: string[];
    confidenceThreshold: number;
  }> = [];

  for (const [sceneType, sceneData] of Object.entries(TARGET_SCENES)) {
    sceneData.coreTerms.forEach((term: string) => {
      terms.push({
        term,
        category: 'scenario',
        termType: 'core',
        synonyms: sceneData.synonyms[term] || [],
        filmTypes: sceneData.filmTypes,
        confidenceThreshold: sceneData.confidenceThreshold
      });
    });
  }

  return terms;
}

/**
 * 获取指定场景类型的核心词汇
 */
export function getTargetSceneTerms(sceneType: keyof typeof TARGET_SCENES) {
  const sceneData = TARGET_SCENES[sceneType];
  return sceneData.coreTerms.map(term => ({
    term,
    category: 'scenario',
    termType: 'core',
    synonyms: sceneData.synonyms[term] || [],
    filmTypes: sceneData.filmTypes,
    confidenceThreshold: sceneData.confidenceThreshold
  }));
}

/**
 * 初始化数据库中的目标场景词汇
 */
export async function initializeTargetSceneTerms() {
  const terms = getAllTargetSceneTerms();
  
  // TODO: 在后续API中调用此函数，将词汇插入数据库
  console.log(`准备初始化 ${terms.length} 个目标场景词汇`);
  
  return terms;
}
