# 自动加入词库功能说明

## 功能概述

当系统AI识别音乐时，会自动将识别出的情绪、风格、乐器等标签加入到词库中，实现词库的智能扩充。

## 核心特性

### 1. 自动识别并加入
- **情绪标签**：自动将识别出的情绪词（如"开心"、"愉悦"、"兴奋"）加入词库
- **风格标签**：自动将识别出的音乐风格（如"流行"、"电子"、"摇滚"）加入词库
- **乐器标签**：自动将识别出的乐器（如"钢琴"、"吉他"、"鼓"）加入词库
- **影视类型**：自动将识别出的影视类型（如"爱情片"、"恐怖片"）加入词库
- **场景标签**：自动将识别出的场景（如"恋爱"、"约会"、"追逐"）加入词库

### 2. 智能去重
- 自动检查词汇是否已在词库中
- 避免重复添加相同的词汇
- 保留原有的词汇属性（如审核状态、使用次数等）

### 3. 自动审核
- AI识别的词汇自动标记为`approved`（已通过审核）
- 自动填充扩充原因："AI自动识别：从音乐分析结果中自动添加"
- 标记来源为`auto`（自动扩充）

## 实现位置

### API接口
- `POST /api/music-analyses/replace-or-create` - 单条创建/替换时自动加入词库
- `POST /api/music-analyses` - 批量创建时自动加入词库

### 核心文件
- `src/lib/autoAddToVocabulary.ts` - 自动加入词库的核心逻辑
- `src/app/api/auto-add-to-vocabulary/route.ts` - 独立的API接口（供手动调用）

## 数据库结构

### standard_terms表
新增/更新字段：
- `is_auto_expanded` - 是否自动扩充（true/false）
- `expansion_source` - 扩充来源（auto/manual）
- `expansion_reason` - 扩充原因说明
- `review_status` - 审核状态（pending/approved/rejected）
- `reviewed_by` - 审核人（system表示系统自动审核）
- `reviewed_at` - 审核时间
- `review_comment` - 审核意见

## 使用示例

### 自动触发（推荐）
当音乐分析完成并保存到数据库时，自动触发词库更新：

```typescript
// 保存音乐分析结果（自动加入词库）
POST /api/music-analyses/replace-or-create
{
  "fileName": "music.mp3",
  "emotionTags": ["开心", "愉悦"],
  "styles": ["流行", "电子"],
  "instruments": ["钢琴", "吉他"],
  "filmType": "爱情片",
  "scenarios": ["恋爱", "约会"]
}
```

### 手动触发（可选）
如果需要单独调用词库更新功能：

```typescript
// 手动调用自动加入词库
POST /api/auto-add-to-vocabulary
{
  "emotionTags": ["开心", "愉悦"],
  "styles": ["流行", "电子"],
  "instruments": ["钢琴", "吉他"],
  "filmType": "爱情片",
  "scenarios": ["恋爱", "约会"]
}
```

## 统计数据

查询自动扩充的词汇统计：

```sql
SELECT 
  category,
  COUNT(*) as total_count,
  SUM(CASE WHEN is_auto_expanded = true THEN 1 ELSE 0 END) as auto_expanded_count,
  SUM(CASE WHEN is_auto_expanded = false THEN 1 ELSE 0 END) as manual_count
FROM standard_terms
GROUP BY category
ORDER BY category;
```

## 注意事项

1. **性能优化**：词库更新失败不会影响音乐分析的主流程
2. **错误处理**：词库更新失败会在控制台记录日志，但不中断主流程
3. **批量处理**：批量创建时，所有词库更新操作异步并行执行
4. **去重机制**：已存在的词汇会被跳过，不会重复添加

## 测试结果

测试场景1：新词自动添加
- 输入：情绪词["开心"、"愉悦"、"兴奋"]、风格词["流行"、"电子"]、乐器词["钢琴"、"吉他"、"鼓"]
- 结果：成功添加所有新词到词库，标记为自动扩充

测试场景2：重复添加
- 输入：已存在的词汇
- 结果：正确跳过已存在的词汇，不重复添加

测试场景3：混合场景
- 输入：部分新词、部分已存在的词
- 结果：新词添加成功，已存在的词正确跳过

## 查看自动扩充的词汇

```sql
SELECT term, category, is_auto_expanded, review_status, created_at 
FROM standard_terms 
WHERE is_auto_expanded = true 
ORDER BY created_at DESC;
```
