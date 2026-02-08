# 混合方案架构文档

## 概述

本文档描述了音乐分析系统的混合方案架构，该架构结合了多种分析策略的优势，提供更准确、更全面的音乐分析能力。

## 混合方案总览

### 1. 词库管理混合模式（方案C）

**核心原则**: 真正同义词映射，近义词独立

**实现位置**: `src/lib/standardTerms.ts`

**特点**:
- **近义词独立**: 每个近义词作为独立的标准词，丰富描述能力
  - 例如: "快乐"、"愉悦"、"开心"各自独立，各有细微差别
- **真正同义词映射**: 仅保留意思完全相同的同义词映射
  - 例如: "悲怆" -> "悲壮"（两者表达的核心情感完全相同）
  - 例如: "恢弘" -> "恢弘"（重复映射）

**使用场景**:
- 日常音乐分析：使用独立近义词，丰富描述
- 专业术语统一：使用同义词映射，确保一致性

**示例**:
```typescript
import { STANDARD_TERMS } from './standardTerms';

// 近义词独立
console.log(STANDARD_TERMS.mood.mapping['快乐']);   // '快乐'
console.log(STANDARD_TERMS.mood.mapping['愉悦']);   // '愉悦'
console.log(STANDARD_TERMS.mood.mapping['开心']);   // '开心'

// 真正同义词映射
console.log(STANDARD_TERMS.mood.mapping['悲怆']);   // '悲壮'
```

---

### 2. 情绪识别混合方案（方案C）

**核心策略**: LLM + 规则混合

**实现位置**: `src/lib/hybridEmotionRecognizer.ts`

**架构**:
- **规则引擎**: 快速筛选候选情绪，提供初步判断
  - 基于音频特征的评分算法
  - 支持200+标准情绪词汇
  - 快速响应（< 1秒）
- **LLM引擎**: 精细化识别，考虑上下文
  - 理解情绪细微差别
  - 考虑上下文和情绪组合
  - 处理复杂情绪场景
- **结果融合**: 规则权重 + LLM精细化决策
  - 并行执行（默认）
  - 置信度加权计算
  - 冲突处理策略

**配置参数**:
```typescript
interface HybridEmotionConfig {
  ruleWeight: number;              // 规则引擎权重（默认0.3）
  llmWeight: number;               // LLM引擎权重（默认0.7）
  enableComplexDetection: boolean; // 是否启用复杂音乐检测
  ruleConfidenceThreshold: number; // 规则引擎阈值（默认0.7）
  parallel: boolean;               // 是否并行执行
}
```

**使用示例**:
```typescript
import { recognizeEmotionHybrid } from './hybridEmotionRecognizer';

const emotionResult = await recognizeEmotionHybrid(
  features,
  fileName,
  {
    ruleWeight: 0.3,
    llmWeight: 0.7,
    parallel: true,
  }
);

console.log(emotionResult);
// {
//   primary: "欢快",
//   secondary: ["愉悦", "兴奋"],
//   intensity: 7,
//   dimensions: { happiness: 8, sadness: 1, tension: 3, romance: 2, epic: 4 },
//   confidence: 0.85,
//   method: "hybrid"
// }
```

---

### 3. 复杂音乐多段落分析（方案B）

**核心策略**: 四段式结构分析

**实现位置**: `src/lib/multiSegmentAnalysis.ts`

**架构**:
- **复杂音乐检测**: 基于动态范围、配器层次、节奏复杂度、高频活跃度
- **段落划分**: 前奏、发展、高潮、尾声
- **情绪轨迹**: 生成情绪变化轨迹
- **主导情绪计算**: 多维度加权算法

**使用场景**:
- 管弦乐/原声大碟
- 配器层次丰富的音乐
- 动态范围大的音乐

**功能函数**:
```typescript
// 检测复杂音乐
isComplexMusic(features): boolean

// 完整的多段落分析
performMultiSegmentAnalysis(features): MultiSegmentAnalysisResult

// 结果示例
{
  segments: [
    { segment: 'intro', timeRange: { start: 0, end: 15 }, mood: {...}, features: {...} },
    { segment: 'development', timeRange: { start: 15, end: 50 }, mood: {...}, features: {...} },
    { segment: 'climax', timeRange: { start: 50, end: 85 }, mood: {...}, features: {...} },
    { segment: 'outro', timeRange: { start: 85, end: 100 }, mood: {...}, features: {...} }
  ],
  emotionalTrajectory: {
    primary: "悲壮",
    trajectory: [...],
    transitions: [...]
  },
  dominantEmotion: "悲壮",
  orchestration: { primary: [...], secondary: [...], complexity: "complex" },
  dynamicRange: { min: "p", max: "ff", range: "large" }
}
```

---

### 4. 音乐出处识别（方案B）

**核心策略**: 元数据优先

**实现位置**: `src/app/api/analyze-music/route.ts`

**三步法**:
1. **专辑元数据提取**（最高优先级）
   - 检查专辑栏（metadata.album）
   - 标准化为标准专辑名称
   - 从标准库获取完整信息
   - 置信度标记为"高"

2. **音频特征验证**
   - 提取音频核心特征
   - 与标准专辑库比对
   - 说明验证结果或差异

3. **补充缺失信息**
   - 补充创作者、发行方、平台
   - 从其他元数据推断
   - 标注补充信息的可靠性

**核心原则**:
- 专辑元数据是出处的最权威来源
- AI分析主要用于验证和补充
- 冲突时仍以专辑信息为准（标注警告）

**置信度分级**:
- 高置信度（90%+）：音频特征与已知作品高度一致
- 中置信度（50-89%）：音频特征与某作品有相似性
- 低置信度（<50%）：无法确定具体出处

---

### 5. 场景识别混合决策（方案C）

**核心策略**: 多维度混合决策

**实现位置**: `src/lib/hybridSceneRecognizer.ts`

**多维度架构**:
- **维度A**: 影视类型+情绪→场景联动映射
  - 快速筛选，基于预定义映射表
  - 权重: 30%
- **维度B**: 音频特征匹配
  - 基于音频特征直接匹配场景
  - 阈值降低至75%
  - 权重: 25%
- **维度C**: 6类目标场景特征匹配
  - 法庭、审讯、教室、办公室、手术室、比赛场
  - 特殊场景优先识别
  - 权重: 25%
- **维度D**: LLM精细化识别
  - 上下文理解
  - 处理复杂场景
  - 权重: 20%

**融合策略**:
```
优先级: 目标场景 > 联动映射 > 音频特征 > LLM
置信度: 多个维度加权计算
冲突处理: 高置信度维度优先
```

**配置参数**:
```typescript
interface HybridSceneConfig {
  linkageWeight: number;       // 联动映射权重（默认0.3）
  audioWeight: number;         // 音频特征权重（默认0.25）
  targetWeight: number;        // 目标场景权重（默认0.25）
  llmWeight: number;           // LLM权重（默认0.2）
  linkageThreshold: number;    // 联动映射阈值（默认0.8）
  audioThreshold: number;      // 音频特征阈值（默认0.75）
  targetThreshold: number;     // 目标场景阈值（默认0.8）
  enableLLM: boolean;          // 是否启用LLM
  enableTargetPriority: boolean; // 是否启用目标场景优先
}
```

**使用示例**:
```typescript
import { recognizeSceneHybrid } from './hybridSceneRecognizer';

const sceneResult = await recognizeSceneHybrid(
  features,
  filmType,
  emotion,
  fileName,
  {
    audioThreshold: 0.75,
    linkageThreshold: 0.8,
    enableLLM: true,
  }
);

console.log(sceneResult);
// {
//   scene: "追逐",
//   confidence: 85,
//   source: "linkage",
//   description: "基于警匪片+紧张情绪的联动映射",
//   reasoning: "影视类型'警匪片'和情绪'紧张'的组合通常对应场景'追逐'"
// }
```

---

## 统一调用接口

**实现位置**: `src/lib/hybridAnalyzer.ts`

### 快速分析（仅情绪识别）

```typescript
import { quickAnalyze } from './hybridAnalyzer';

const emotionResult = await quickAnalyze(features, fileName);
```

### 完整分析（包含所有维度）

```typescript
import { fullAnalyze } from './hybridAnalyzer';

const fullResult = await fullAnalyze(
  features,
  fileName,
  {
    title: "歌曲标题",
    artist: "艺术家",
    album: "专辑",
  },
  {
    enableMultiSegment: true,
    parallel: true,
  }
);

console.log(fullResult);
// {
//   fileName: "音乐文件.mp3",
//   duration: 180,
//   emotion: {...},
//   scene: {...},
//   multiSegment: {...}, // 如果检测到复杂音乐
//   overallConfidence: 0.82,
//   analysisMethod: {...}
// }
```

---

## 技术优势

### 1. 词库管理混合模式
- ✅ 丰富描述能力（139个独立词汇 vs 原来的67个）
- ✅ 保持术语一致性（真正同义词映射）
- ✅ 灵活适应不同场景

### 2. 情绪识别混合方案
- ✅ 快速响应（规则引擎）
- ✅ 精准识别（LLM引擎）
- ✅ 高准确率（结果融合）

### 3. 复杂音乐多段落分析
- ✅ 自动检测复杂音乐
- ✅ 四段式结构分析
- ✅ 情绪轨迹生成

### 4. 音乐出处识别
- ✅ 权威来源优先（专辑元数据）
- ✅ 音频特征验证
- ✅ 完整信息补充

### 5. 场景识别混合决策
- ✅ 多维度匹配
- ✅ 降低识别阈值（75%）
- ✅ 减少未识别场景

---

## 性能优化

### 1. 并行执行
- 规则引擎和LLM并行调用
- 多个维度同时匹配
- 提高整体响应速度

### 2. 智能缓存
- 词库缓存（数据库查询）
- 音频特征缓存
- LLM响应缓存

### 3. 阈值优化
- 降低识别阈值（75%）
- 增加候选词推荐（65%）
- 提高识别覆盖率

---

## 使用建议

### 1. 简单音乐场景
```typescript
const config = {
  emotion: {
    ruleConfidenceThreshold: 0.7, // 高阈值，规则引擎主导
  },
  scene: {
    enableLLM: false, // 禁用LLM，降低成本
  },
};
```

### 2. 复杂音乐场景
```typescript
const config = {
  emotion: {
    ruleConfidenceThreshold: 0.5, // 低阈值，强制LLM
    enableComplexDetection: true,
  },
  scene: {
    enableLLM: true,
    enableTargetPriority: true,
  },
};
```

### 3. 批量分析场景
```typescript
const config = {
  parallel: true,
  emotion: {
    parallel: true,
  },
  enableMultiSegment: false, // 跳过多段落分析，提高速度
};
```

---

## 文件结构

```
src/lib/
├── hybridAnalyzer.ts           # 混合分析引擎总览
├── hybridEmotionRecognizer.ts  # 情绪识别混合方案
├── hybridSceneRecognizer.ts    # 场景识别混合方案
├── multiSegmentAnalysis.ts     # 复杂音乐多段落分析
├── standardTerms.ts            # 词库管理混合模式
└── __tests__/
    └── hybridAnalyzer.test.ts  # 集成测试

src/app/api/
└── analyze-music/route.ts      # 音乐出处识别（元数据优先）
```

---

## 总结

混合方案架构结合了以下优势：

1. **词库管理**: 真正同义词映射 + 近义词独立
2. **情绪识别**: 规则引擎 + LLM精细化
3. **复杂音乐**: 四段式结构分析
4. **音乐出处**: 元数据优先 + 验证补充
5. **场景识别**: 多维度混合决策

通过统一调用接口，可以灵活配置各种场景的需求，实现高效、准确的音乐分析。
