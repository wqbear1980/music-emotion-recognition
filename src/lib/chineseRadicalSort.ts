/**
 * 中文部首排序工具
 * 提供汉字部首识别和排序功能
 */

// 常用汉字部首映射表（简化版，覆盖常用汉字）
const radicalMap: Record<string, string> = {
  // 一画
  '一': '一', '乙': '乙',
  // 二画
  '二': '二', '十': '十', '厂': '厂', '卜': '卜', '又': '又',
  // 三画
  '三': '三', '口': '口', '土': '土', '士': '士', '夕': '夕', '大': '大', '女': '女', '子': '子', '小': '小',
  '尸': '尸', '山': '山', '巛': '巛', '工': '工', '己': '己', '巾': '巾', '干': '干', '幺': '幺', '广': '广', '廴': '廴',
  '弋': '弋', '弓': '弓',
  // 四画
  '心': '心', '戈': '戈', '户': '户', '手': '手', '支': '支', '攴': '攴', '文': '文', '斗': '斗', '方': '方', '无': '无',
  '日': '日', '曰': '曰', '月': '月', '木': '木', '欠': '欠', '止': '止', '歹': '歹', '殳': '殳', '毋': '毋', '比': '比',
  '毛': '毛', '氏': '氏', '气': '气', '水': '水', '火': '火', '爪': '爪', '父': '父', '爻': '爻', '片': '片', '牙': '牙',
  '牛': '牛', '犬': '犬',
  // 五画
  '玉': '玉', '瓜': '瓜', '瓦': '瓦', '甘': '甘', '生': '生', '用': '用', '田': '田', '疋': '疋', '疒': '疒', '癶': '癶',
  '白': '白', '皮': '皮', '皿': '皿', '目': '目', '矛': '矛', '矢': '矢', '石': '石', '示': '示', '禸': '禸', '禾': '禾',
  '穴': '穴', '立': '立',
  // 六画
  '竹': '竹', '米': '米', '糸': '糸', '缶': '缶', '网': '网', '羊': '羊', '羽': '羽', '老': '老', '而': '而', '耳': '耳',
  '聿': '聿', '肉': '肉', '臣': '臣', '自': '自', '至': '至', '臼': '臼', '舌': '舌', '舛': '舛', '舟': '舟', '艮': '艮',
  '色': '色', '艸': '艸', '虍': '虍', '虫': '虫', '血': '血', '行': '行', '衣': '衣', '襾': '襾',
  // 七画
  '见': '见', '角': '角', '言': '言', '谷': '谷', '豆': '豆', '豕': '豕', '豸': '豸', '贝': '贝', '赤': '赤', '走': '走',
  '足': '足', '身': '身', '车': '车', '辛': '辛', '辰': '辰', '辵': '辵', '邑': '邑', '酉': '酉', '釆': '釆', '里': '里',
  // 八画
  '金': '金', '长': '长', '门': '门', '阜': '阜', '隶': '隶', '隹': '隹', '雨': '雨', '青': '青', '非': '非',
  // 九画
  '面': '面', '革': '革', '韦': '韦', '韭': '韭', '音': '音', '页': '页', '风': '风', '飞': '飞', '食': '食', '首': '首',
  '香': '香',
  // 十画
  '马': '马', '骨': '骨', '高': '高', '髟': '髟', '鬯': '鬯', '鬲': '鬲', '鬼': '鬼',
  // 十一画
  '鱼': '鱼', '鸟': '鸟', '卤': '卤', '鹿': '鹿', '麦': '麦', '麻': '麻',
  // 十二画
  '黄': '黄', '黍': '黍', '黑': '黑', '黹': '黹',
  // 十三画
  '黾': '黾', '鼓': '鼓', '鼠': '鼠',
  // 十四画
  '鼻': '鼻', '齐': '齐',
  // 十五画
  '齿': '齿',
  // 十六画
  '龙': '龙', '龟': '龟',
  // 十七画
  '龠': '龠',

  // 常用场景词相关汉字
  '战': '戈', '温': '氵', '追': '辶', '赶': '走', '吵': '口', '打': '扌', '调': '讠', '查': '木', '潜': '氵', '入': '入',
  '飙': '风', '梦': '梦', '跟': '足', '踪': '足', '暗': '日', '杀': '杀', '谈': '讠',
  '独': '犭', '处': '夂', '庆': '广', '告': '告', '别': '口', '祷': '礻', '煎': '灬', '熬': '灬', '绝': '纟',
  '惊': '忄', '嬉': '女', '闹': '门', '感': '心', '重': '里', '折': '扌', '揭': '扌', '露': '雨',
};

/**
 * 判断字符是否为汉字
 */
export function isChineseChar(char: string): boolean {
  return /[\u4e00-\u9fa5]/.test(char);
}

/**
 * 判断字符是否为英文字母
 */
export function isEnglishChar(char: string): boolean {
  return /^[a-zA-Z]$/.test(char);
}

/**
 * 提取字符串的首汉字部首
 * @param str 输入字符串
 * @returns 首部首，如果不是汉字则返回空字符串
 */
export function getFirstRadical(str: string): string {
  if (!str) return '';

  // 查找第一个汉字
  for (const char of str) {
    if (isChineseChar(char)) {
      // 查找部首
      if (radicalMap[char]) {
        return radicalMap[char];
      }
      // 如果字典中没有，尝试推断部首（简化处理）
      // 常见偏旁部首推断
      if (/^氵/.test(char) || char.includes('水')) return '氵';
      if (/^木/.test(char) || char.includes('树')) return '木';
      if (/^口/.test(char) || char.includes('嘴')) return '口';
      if (/^扌/.test(char) || char.includes('手')) return '扌';
      if (/^讠/.test(char) || char.includes('言')) return '讠';
      if (/^辶/.test(char) || char.includes('走')) return '辶';
      if (/^足/.test(char) || char.includes('脚')) return '足';
      if (/^心/.test(char) || char.includes('情')) return '心';
      if (/^火/.test(char) || char.includes('焰')) return '火';
      if (/^土/.test(char) || char.includes('地')) return '土';
      if (/^金/.test(char) || char.includes('铁')) return '金';
      if (/^女/.test(char) || char.includes('娘')) return '女';

      // 默认返回字符本身作为"部首"
      return char;
    }
  }

  return '';
}

/**
 * 提取字符串的英文首字母
 * @param str 输入字符串
 * @returns 英文首字母，如果没有则返回空字符串
 */
export function getFirstEnglishLetter(str: string): string {
  if (!str) return '';

  for (const char of str) {
    if (isEnglishChar(char)) {
      return char.toUpperCase();
    }
  }

  return '';
}

/**
 * 判断字符串主要是中文还是英文
 * @param str 输入字符串
 * @returns 'chinese' | 'english' | 'mixed'
 */
export function detectStringType(str: string): 'chinese' | 'english' | 'mixed' {
  let chineseCount = 0;
  let englishCount = 0;

  for (const char of str) {
    if (isChineseChar(char)) chineseCount++;
    else if (isEnglishChar(char)) englishCount++;
  }

  if (chineseCount === 0 && englishCount === 0) return 'mixed';
  if (chineseCount > englishCount) return 'chinese';
  if (englishCount > chineseCount) return 'english';
  return 'mixed';
}

/**
 * 按部首排序比较函数
 * @param a 标签A
 * @param b 标签B
 * @returns 比较结果
 */
export function compareByRadical(a: string, b: string): number {
  const radicalA = getFirstRadical(a);
  const radicalB = getFirstRadical(b);

  // 如果都有部首，按部首排序
  if (radicalA && radicalB) {
    if (radicalA !== radicalB) {
      return radicalA.localeCompare(radicalB, 'zh');
    }
    // 部首相同，按完整字符串排序
    return a.localeCompare(b, 'zh');
  }

  // 只有A有部首，A在前
  if (radicalA && !radicalB) return -1;

  // 只有B有部首，B在前
  if (!radicalA && radicalB) return 1;

  // 都没有部首，按默认排序
  return a.localeCompare(b, 'zh');
}

/**
 * 按英文首字母排序比较函数
 * @param a 标签A
 * @param b 标签B
 * @returns 比较结果
 */
export function compareByEnglish(a: string, b: string): number {
  const letterA = getFirstEnglishLetter(a);
  const letterB = getFirstEnglishLetter(b);

  // 如果都有英文首字母，按首字母排序
  if (letterA && letterB) {
    if (letterA !== letterB) {
      return letterA.localeCompare(letterB, 'en');
    }
    // 首字母相同，按完整字符串排序
    return a.localeCompare(b, 'en');
  }

  // 只有A有英文首字母，A在前
  if (letterA && !letterB) return -1;

  // 只有B有英文首字母，B在前
  if (!letterA && letterB) return 1;

  // 都没有英文首字母，按默认排序
  return a.localeCompare(b, 'en');
}

/**
 * 按指定方式排序标签数组
 * @param items 标签数组
 * @param sortOrder 排序方式
 * @param labelKey 标签字段名，默认为'label'
 * @returns 排序后的数组
 */
export function sortItems<T extends Record<string, any>>(
  items: T[],
  sortOrder: 'default' | 'english' | 'radical',
  labelKey: string = 'label'
): T[] {
  if (sortOrder === 'default') {
    // 默认按数量降序
    return [...items].sort((a, b) => b.count - a.count);
  }

  const compareFn = sortOrder === 'english' ? compareByEnglish : compareByRadical;

  return [...items].sort((a, b) => {
    const labelA = a[labelKey] || '';
    const labelB = b[labelKey] || '';
    return compareFn(labelA, labelB);
  });
}
