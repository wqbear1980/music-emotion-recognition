const { STANDARD_TERMS } = require('/workspace/projects/src/lib/standardTerms.ts');

console.log('情绪标准词汇数量:', STANDARD_TERMS.mood.standardList.length);
console.log('情绪标准词汇:', STANDARD_TERMS.mood.standardList);
console.log('\n情绪映射数量:', Object.keys(STANDARD_TERMS.mood.mapping).length);
