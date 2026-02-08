# 复杂音乐（管弦乐/原声）分析改进方案

## 问题分析

### 当前系统的问题
1. **单点分析局限**：将整个音乐作为整体分析，无法捕捉情绪变化
2. **管弦乐复杂性**：
   - 多乐器交织，音色丰富
   - 多主题交替发展
   - 情绪层次复杂（层次感强）
   - 动态范围大（强弱对比明显）
3. **原声大碟特殊性**：
   - 往往是电影配乐，需要结合剧情场景
   - 可能有多个主题反复出现
   - 情绪随剧情发展而变化

## 改进方案

### 1. 多段落分析（Multi-Segment Analysis）

#### 方案概述
将音乐按照时间轴分段，每段独立分析情绪，最后综合得出整体判断。

#### 实现策略
```
1. 时间分段（根据音频特征自动划分）：
   - 前奏（0-15%）：氛围营造
   - 发展段（15-50%）：主题展开
   - 高潮段（50-85%）：情绪爆发
   - 尾声段（85-100%）：收束平复

2. 每段独立分析：
   - BPM变化
   - 动态范围（强弱）
   - 配器变化
   - 旋律起伏
   - 和声进行

3. 段落情绪识别：
   - 每段提取主要情绪词
   - 计算情绪强度（1-7）
   - 标注情绪变化趋势（上升/下降/波动）

4. 综合判断：
   - 统计各段情绪出现频率
   - 识别主导情绪（出现最多或强度最高的情绪）
   - 生成情绪轨迹（情绪变化曲线）
```

#### 数据结构
```typescript
interface SegmentAnalysis {
  segment: 'intro' | 'development' | 'climax' | 'outro';
  timeRange: { start: number; end: number }; // 百分比
  mood: {
    primary: string;          // 主要情绪
    secondary: string[];      // 次要情绪
    intensity: number;        // 强度 1-7
  };
  features: {
    bpm: number;
    dynamics: string;         // "弱" | "中弱" | "中" | "中强" | "强"
    instrumentation: string[]; // 主要乐器
  };
}
```

### 2. 主导情绪识别（Dominant Emotion Detection）

#### 策略
1. **频率加权**：出现次数最多的情绪
2. **强度加权**：强度最高的情绪
3. **持续时间加权**：持续时间最长的情绪
4. **高潮段权重**：高潮段的情绪权重更高（x1.5）

#### 算法示例
```javascript
function calculateDominantEmotion(segments: SegmentAnalysis[]): string {
  const emotionScores = {};

  segments.forEach(segment => {
    const weight = segment.segment === 'climax' ? 1.5 : 1.0;
    const score = segment.mood.intensity * weight;

    // 主要情绪
    emotionScores[segment.mood.primary] =
      (emotionScores[segment.mood.primary] || 0) + score * 2;

    // 次要情绪
    segment.mood.secondary.forEach(emotion => {
      emotionScores[emotion] = (emotionScores[emotion] || 0) + score;
    });
  });

  // 返回得分最高的情绪
  return Object.keys(emotionScores).reduce((a, b) =>
    emotionScores[a] > emotionScores[b] ? a : b
  );
}
```

### 3. 情绪轨迹标注（Emotional Trajectory）

#### 数据结构
```typescript
interface EmotionalTrajectory {
  primary: string;           // 主导情绪
  trajectory: {
    phase: 'intro' | 'development' | 'climax' | 'outro';
    emotion: string;
    intensity: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  transitions: {
    from: string;
    to: string;
    position: number; // 百分比
    smoothness: 'smooth' | 'abrupt' | 'gradual';
  }[];
}
```

#### 示例
```json
{
  "primary": "激昂",
  "trajectory": [
    { "phase": "intro", "emotion": "宁静", "intensity": 3, "trend": "up" },
    { "phase": "development", "emotion": "紧张", "intensity": 5, "trend": "up" },
    { "phase": "climax", "emotion": "激昂", "intensity": 7, "trend": "stable" },
    { "phase": "outro", "emotion": "舒缓", "intensity": 4, "trend": "down" }
  ],
  "transitions": [
    { "from": "宁静", "to": "紧张", "position": 15, "smoothness": "gradual" },
    { "from": "紧张", "to": "激昂", "position": 50, "smoothness": "abrupt" },
    { "from": "激昂", "to": "舒缓", "position": 85, "smoothness": "smooth" }
  ]
}
```

### 4. 配器情绪分析（Orchestration-based Emotion Analysis）

#### 乐器组合与情绪映射
| 乐器组合 | 情绪倾向 | 典型场景 |
|---------|---------|---------|
| 弦乐群 + 定音鼓 | 史诗、激昂、庄重 | 战争、史诗、高潮 |
| 钢琴独奏 + 弦乐 | 浪漫、温柔、怀念 | 爱情、回忆 |
| 铜管乐 + 打击乐 | 紧张、恐惧、压迫 | 动作、悬疑、恐怖 |
| 木管乐 + 竖琴 | 空灵、梦幻、神秘 | 奇幻、神话 |
| 全乐队齐奏 | 震撼、宏大、壮观 | 史诗、灾难、高潮 |
| 小提琴独奏 | 忧郁、哀婉、凄美 | 悲伤、离别 |
| 长笛 + 木管 | 活泼、灵动、轻快 | 欢快、日常 |
| 低音提琴 + 大提琴 | 压抑、沉重、阴暗 | 恐怖、悬疑、压抑 |

### 5. 动态范围分析（Dynamic Range Analysis）

#### 强弱等级与情绪
| 动态等级 | 分贝范围 | 情绪强度 | 典型情绪 |
|---------|---------|---------|---------|
| pp (很弱) | <50dB | 1-2 | 宁静、安详、空灵 |
| p (弱) | 50-65dB | 2-3 | 温柔、舒缓、忧郁 |
| mp (中弱) | 65-75dB | 3-4 | 平和、怀旧、温暖 |
| mf (中) | 75-85dB | 4-5 | 稳定、期待、悬疑 |
| f (强) | 85-95dB | 5-6 | 激昂、紧张、勇敢 |
| ff (很强) | 95-105dB | 6-7 | 震撼、史诗、爆发 |

### 6. 综合判断流程

```
输入：音频特征 + 元数据

↓

1. 自动分段（基于BPM、动态变化、配器变化）
   ↓
   前奏 | 发展 | 高潮 | 尾声

↓

2. 每段独立分析
   - 配器分析 → 情绪倾向
   - 动态分析 → 强度判断
   - 旋律分析 → 情绪识别
   ↓
   4个情绪标签 + 4个强度值

↓

3. 计算主导情绪
   - 频率加权（30%）
   - 强度加权（30%）
   - 持续时间加权（20%）
   - 高潮段权重（20%）
   ↓
   最终主导情绪

↓

4. 生成情绪轨迹
   - 绘制情绪变化曲线
   - 标注情绪转换点
   - 评估转换平滑度
   ↓
   情绪轨迹数据

↓

5. 综合输出
   - 主导情绪
   - 情绪轨迹
   - 配器特征
   - 动态范围
   - 适用场景
   ↓
   最终分析结果
```

## 实施建议

### 第一阶段：API 增强
1. 修改 `analyze-music` API，增加多段落分析模式
2. 返回字段增加：
   - `segments`: 分段分析结果
   - `emotionalTrajectory`: 情绪轨迹
   - `dominantEmotion`: 主导情绪

### 第二阶段：Prompt 优化
1. 增加多段落分析的提示词
2. 增加配器分析指引
3. 增加动态范围分析指引
4. 增加情绪轨迹生成指引

### 第三阶段：质量验证
1. 用经典电影原声测试（如《星球大战》、《指环王》）
2. 用古典交响乐测试（如贝多芬、莫扎特）
3. 评估分析准确性

## 预期效果

### 改进前
- 整体分析，只能给出一个情绪标签
- 无法捕捉情绪变化
- 对复杂音乐分析准确率低（约60%）

### 改进后
- 多段分析，给出完整的情绪轨迹
- 能捕捉情绪变化和转换点
- 对复杂音乐分析准确率提升（预计85%+）

## 示例对比

### 改进前
```json
{
  "mood": {
    "primary": "激昂",
    "secondary": ["紧张", "史诗"]
  }
}
```

### 改进后
```json
{
  "mood": {
    "primary": "激昂",
    "secondary": ["紧张", "史诗", "庄严"]
  },
  "segments": [
    {
      "segment": "intro",
      "mood": { "primary": "宁静", "intensity": 3 },
      "features": { "bpm": 60, "dynamics": "中弱", "instrumentation": ["钢琴", "弦乐"] }
    },
    {
      "segment": "development",
      "mood": { "primary": "紧张", "intensity": 5 },
      "features": { "bpm": 90, "dynamics": "中", "instrumentation": ["铜管", "定音鼓"] }
    },
    {
      "segment": "climax",
      "mood": { "primary": "激昂", "intensity": 7 },
      "features": { "bpm": 120, "dynamics": "很强", "instrumentation": ["全乐队"] }
    },
    {
      "segment": "outro",
      "mood": { "primary": "舒缓", "intensity": 4 },
      "features": { "bpm": 70, "dynamics": "中弱", "instrumentation": ["弦乐"] }
    }
  ],
  "emotionalTrajectory": {
    "primary": "激昂",
    "trajectory": [
      { "phase": "intro", "emotion": "宁静", "intensity": 3 },
      { "phase": "development", "emotion": "紧张", "intensity": 5 },
      { "phase": "climax", "emotion": "激昂", "intensity": 7 },
      { "phase": "outro", "emotion": "舒缓", "intensity": 4 }
    ],
    "transitions": [
      { "from": "宁静", "to": "紧张", "smoothness": "gradual" },
      { "from": "紧张", "to": "激昂", "smoothness": "abrupt" },
      { "from": "激昂", "to": "舒缓", "smoothness": "smooth" }
    ]
  }
}
```

## 技术实现要点

1. **音频分段**：
   - 基于BPM变化点
   - 基于动态范围变化点
   - 基于配器变化点（音色分析）

2. **情绪识别增强**：
   - 结合配器特征
   - 结合动态范围
   - 结合旋律轮廓

3. **轨迹生成**：
   - 统计各段情绪
   - 计算转换点
   - 评估平滑度

4. **主导情绪算法**：
   - 多维度加权
   - 高潮段优先
   - 强度优先

## 总结

通过多段落分析、主导情绪识别、情绪轨迹标注等手段，可以显著提升对复杂音乐（管弦乐、原声大碟）的分析准确性。关键在于：
1. 不要把复杂音乐当作整体分析
2. 充分利用配器、动态、旋律等多维度信息
3. 给出完整的情绪变化轨迹，而不仅仅是单一情绪标签
