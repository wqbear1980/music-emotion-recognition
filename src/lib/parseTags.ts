/**
 * 解析人工输入的标签（遵循顿号整体、逗号拆分规则）
 * @param input 人工输入的标签文本
 * @returns 解析后的标签数组
 */
export const parseTags = (input: string): string[] => {
  // 1. 空值兜底：去除首尾空格后为空则返回空数组
  const trimmedInput = input.trim();
  if (!trimmedInput) return [];

  // 2. 兼容中文/英文逗号，统一替换为中文逗号后拆分
  const unifiedInput = trimmedInput.replace(/,/g, '，');

  // 3. 按中文逗号拆分 → 每个标签去除首尾空格
  const tagList = unifiedInput.split('，').map(tag => tag.trim());

  // 4. 过滤拆分后的空标签（如连续逗号导致的空值）
  const validTags = tagList.filter(tag => tag);

  return validTags;
};
