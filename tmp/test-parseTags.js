/**
 * 测试 parseTags 函数
 */

function parseTags(input) {
  const trimmedInput = input.trim();
  if (!trimmedInput) return [];

  const unifiedInput = trimmedInput.replace(/,/g, '，');
  const tagList = unifiedInput.split('，').map(tag => tag.trim());
  const validTags = tagList.filter(tag => tag);

  return validTags;
}

console.log('===== parseTags 测试用例 =====\n');

// 测试1：标准场景（中文逗号+顿号）
console.log('测试1：标准场景（中文逗号+顿号）');
console.log('输入："欢快、节奏感强，舒缓、旋律优美"');
const result1 = parseTags("欢快、节奏感强，舒缓、旋律优美");
console.log('输出：', result1);
console.log('预期：["欢快、节奏感强", "舒缓、旋律优美"]');
console.log('通过：', JSON.stringify(result1) === JSON.stringify(["欢快、节奏感强", "舒缓、旋律优美"]));
console.log('');

// 测试2：含首尾空格
console.log('测试2：含首尾空格');
console.log('输入："  欢快、节奏感强， 舒缓、旋律优美  "');
const result2 = parseTags("  欢快、节奏感强， 舒缓、旋律优美  ");
console.log('输出：', result2);
console.log('预期：["欢快、节奏感强", "舒缓、旋律优美"]');
console.log('通过：', JSON.stringify(result2) === JSON.stringify(["欢快、节奏感强", "舒缓、旋律优美"]));
console.log('');

// 测试3：英文逗号
console.log('测试3：英文逗号');
console.log('输入："欢快、节奏感强,舒缓、旋律优美"');
const result3 = parseTags("欢快、节奏感强,舒缓、旋律优美");
console.log('输出：', result3);
console.log('预期：["欢快、节奏感强", "舒缓、旋律优美"]');
console.log('通过：', JSON.stringify(result3) === JSON.stringify(["欢快、节奏感强", "舒缓、旋律优美"]));
console.log('');

// 测试4：空输入/全空格
console.log('测试4：空输入/全空格');
console.log('输入：""');
const result4a = parseTags("");
console.log('输出：', result4a);
console.log('预期：[]');
console.log('通过：', JSON.stringify(result4a) === JSON.stringify([]));
console.log('');
console.log('输入："   "');
const result4b = parseTags("   ");
console.log('输出：', result4b);
console.log('预期：[]');
console.log('通过：', JSON.stringify(result4b) === JSON.stringify([]));
console.log('');

// 测试5：连续逗号
console.log('测试5：连续逗号');
console.log('输入："欢快、节奏感强，，舒缓、旋律优美"');
const result5 = parseTags("欢快、节奏感强，，舒缓、旋律优美");
console.log('输出：', result5);
console.log('预期：["欢快、节奏感强", "舒缓、旋律优美"]');
console.log('通过：', JSON.stringify(result5) === JSON.stringify(["欢快、节奏感强", "舒缓、旋律优美"]));
console.log('');

// 测试6：单个标签（无逗号）
console.log('测试6：单个标签（无逗号）');
console.log('输入："欢快、节奏感强"');
const result6 = parseTags("欢快、节奏感强");
console.log('输出：', result6);
console.log('预期：["欢快、节奏感强"]');
console.log('通过：', JSON.stringify(result6) === JSON.stringify(["欢快、节奏感强"]));
console.log('');

// 测试7：多个标签（多个逗号）
console.log('测试7：多个标签（多个逗号）');
console.log('输入："欢快、节奏感强，舒缓、旋律优美，激昂、气势磅礴"');
const result7 = parseTags("欢快、节奏感强，舒缓、旋律优美，激昂、气势磅礴");
console.log('输出：', result7);
console.log('预期：["欢快、节奏感强", "舒缓、旋律优美", "激昂、气势磅礴"]');
console.log('通过：', JSON.stringify(result7) === JSON.stringify(["欢快、节奏感强", "舒缓、旋律优美", "激昂、气势磅礴"]));
console.log('');

// 测试8：混合中文英文逗号
console.log('测试8：混合中文英文逗号');
console.log('输入："欢快、节奏感强,舒缓、旋律优美，激昂、气势磅礴"');
const result8 = parseTags("欢快、节奏感强,舒缓、旋律优美，激昂、气势磅礴");
console.log('输出：', result8);
console.log('预期：["欢快、节奏感强", "舒缓、旋律优美", "激昂、气势磅礴"]');
console.log('通过：', JSON.stringify(result8) === JSON.stringify(["欢快、节奏感强", "舒缓、旋律优美", "激昂、气势磅礴"]));
console.log('');

console.log('===== 测试完成 =====');
