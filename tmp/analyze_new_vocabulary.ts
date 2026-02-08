import { STANDARD_TERMS } from '../src/lib/standardTerms';

// 新词汇数据（从文档中提取）
const newVocabulary = {
  // 新增影视类型
  filmTypes: [
    {
      type: '主旋律题材',
      subGenres: ['红色革命', '家国情怀', '时代楷模', '脱贫攻坚', '科技强国'],
      description: '中式核心风格，参考美式主旋律个人英雄、俄式主旋律战争史诗'
    },
    {
      type: '红色题材',
      subGenres: ['革命战争', '先烈事迹', '红色传承', '地下谍战'],
      description: '中式红色核心风格，聚焦党史军史、英雄叙事'
    },
    {
      type: '偶像剧',
      subGenres: ['都市甜宠', '青春校园', '职场偶像', '奇幻偶像'],
      description: '参考韩式浪漫偶像剧、日式纯爱偶像剧、台式青春偶像剧'
    },
    {
      type: '体育题材',
      subGenres: ['职业体育竞技', '奥运备战', '草根体育逆袭', '校园体育社团'],
      description: '参考美式职业体育、日式运动热血、韩式体育励志'
    }
  ],

  // 新增核心情绪词
  coreEmotions: ['庄重', '热血', '坚定', '自豪', '肃穆', '悲壮', '浪漫', '甜蜜', '温馨', '激昂', '紧张', '荣耀'],

  // 新增辅助情绪词
  auxiliaryEmotions: ['凝重', '感动', '赤诚', '振奋', '崇敬', '羞涩', '心动', '眷恋', '焦灼', '欣慰'],

  // 新增场景词
  scenes: [
    // 主旋律题材场景
    '国庆阅兵/升旗仪式',
    '革命先烈浴血奋战',
    '脱贫攻坚一线帮扶',
    '科研人员攻克技术难关',
    '时代楷模事迹宣讲',

    // 红色题材场景
    '革命根据地战略会议',
    '战场冲锋浴血奋战',
    '地下党秘密接头/传递情报',
    '先烈就义慷慨陈词',
    '后辈瞻仰红色纪念馆传承',

    // 偶像剧场景
    '校园/职场初遇心动',
    '浪漫告白/求婚',
    '偶像舞台表演/粉丝应援',
    '误会解开深情相拥',
    '共同成长携手追梦',

    // 体育题材场景
    '职业联赛关键场次对决',
    '赛前伤病困扰/康复训练',
    '团队战术磨合/矛盾和解',
    '草根选手逆袭赛场',
    '夺冠升国旗/领奖台',

    // 通用场景
    '烈士纪念日公祭',
    '国家荣誉表彰',
    '偶像粉丝见面会',
    '体育赛事颁奖仪式'
  ]
};

// 现有情绪词列表
const existingEmotions = new Set([
  ...Object.keys(STANDARD_TERMS.mood.mapping),
  ...STANDARD_TERMS.mood.standardList,
  ...Object.keys(STANDARD_TERMS.moodExtended.mapping),
  ...STANDARD_TERMS.moodExtended.standardList
]);

// 现有影视类型列表
const existingFilmTypes = new Set(STANDARD_TERMS.filmTypes.getAllStandardTypes());

// 现有场景词列表
const existingScenes = new Set([
  ...Object.keys(STANDARD_TERMS.sceneTypes.mapping),
  ...STANDARD_TERMS.sceneTypes.standardList,
  ...Object.keys(STANDARD_TERMS.standardScenes.core.mapping),
  ...STANDARD_TERMS.standardScenes.core.standardList,
  ...Object.keys(STANDARD_TERMS.standardScenes.extended.mapping),
  ...STANDARD_TERMS.standardScenes.extended.standardList
]);

console.log('=== 词库冲突检测报告 ===\n');

// 检测影视类型冲突
console.log('【影视类型检测】');
console.log(`现有影视类型数: ${existingFilmTypes.size}`);
console.log(`新增影视类型数: ${newVocabulary.filmTypes.length}`);

const filmTypeConflicts: string[] = [];
const filmTypeNew: string[] = [];

newVocabulary.filmTypes.forEach(ft => {
  const allTypes = [ft.type, ...ft.subGenres.map(s => `${ft.type}（${s}）`)];
  allTypes.forEach(t => {
    if (existingFilmTypes.has(t)) {
      filmTypeConflicts.push(t);
    } else {
      filmTypeNew.push(t);
    }
  });
});

if (filmTypeConflicts.length > 0) {
  console.log(`❌ 发现 ${filmTypeConflicts.length} 个冲突影视类型:`, filmTypeConflicts);
} else {
  console.log('✅ 无影视类型冲突');
}
console.log(`✅ 可新增 ${filmTypeNew.length} 个影视类型:`, filmTypeNew.slice(0, 5), '...');
console.log();

// 检测情绪词冲突
console.log('【情绪词检测】');
console.log(`现有情绪词数: ${existingEmotions.size}`);
const allNewEmotions = [...new Set([...newVocabulary.coreEmotions, ...newVocabulary.auxiliaryEmotions])];
console.log(`新增情绪词数: ${allNewEmotions.length}`);

const emotionConflicts: string[] = [];
const emotionNew: string[] = [];

allNewEmotions.forEach(emotion => {
  if (existingEmotions.has(emotion)) {
    emotionConflicts.push(emotion);
  } else {
    emotionNew.push(emotion);
  }
});

if (emotionConflicts.length > 0) {
  console.log(`❌ 发现 ${emotionConflicts.length} 个冲突情绪词:`, emotionConflicts);
} else {
  console.log('✅ 无情绪词冲突');
}
console.log(`✅ 可新增 ${emotionNew.length} 个情绪词:`, emotionNew);
console.log();

// 检测场景词冲突
console.log('【场景词检测】');
console.log(`现有场景词数: ${existingScenes.size}`);
console.log(`新增场景词数: ${newVocabulary.scenes.length}`);

const sceneConflicts: string[] = [];
const sceneNew: string[] = [];

newVocabulary.scenes.forEach(scene => {
  const normalized = scene.replace(/[\/\(\)\s]+/g, '').toLowerCase();
  let isConflict = false;

  // 精确匹配
  if (existingScenes.has(scene)) {
    sceneConflicts.push(scene);
    isConflict = true;
  }

  // 模糊匹配
  for (const existingScene of existingScenes) {
    if (!isConflict && existingScene.includes(scene.split('/')[0]) || scene.includes(existingScene.split(' ')[0])) {
      // 可能是相似场景，标注为潜在冲突
      console.log(`⚠️ 潜在相似场景: "${scene}" vs "${existingScene}"`);
    }
  }

  if (!isConflict) {
    sceneNew.push(scene);
  }
});

if (sceneConflicts.length > 0) {
  console.log(`❌ 发现 ${sceneConflicts.length} 个冲突场景词:`, sceneConflicts);
} else {
  console.log('✅ 无场景词冲突');
}
console.log(`✅ 可新增 ${sceneNew.length} 个场景词`);
console.log();

// 总结
console.log('=== 冲突检测总结 ===');
console.log(`✅ 新增影视类型: ${filmTypeNew.length} 个`);
console.log(`✅ 新增情绪词: ${emotionNew.length} 个`);
console.log(`✅ 新增场景词: ${sceneNew.length} 个`);
console.log(`❌ 冲突影视类型: ${filmTypeConflicts.length} 个`);
console.log(`❌ 冲突情绪词: ${emotionConflicts.length} 个`);
console.log(`❌ 冲突场景词: ${sceneConflicts.length} 个`);

if (filmTypeConflicts.length === 0 && emotionConflicts.length === 0 && sceneConflicts.length === 0) {
  console.log('\n🎉 检测通过！所有新词汇均可安全添加到词库。');
} else {
  console.log('\n⚠️ 发现冲突，需要人工确认处理方案。');
}
