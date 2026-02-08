# 数据库连接降级方案说明

## 问题概述

当前系统遇到数据库连接持续失败的问题，主要表现为：
- **连接超时**：Connection terminated due to connection timeout（20秒超时）
- **计算节点未就绪**：Compute node cp-perky-shade-0708dcde is not ready yet（PostgreSQL XX000 错误）

这些错误导致所有依赖数据库的API接口都无法正常工作。

## 解决方案

### 1. 创建增强的数据库连接层 (`src/lib/db-enhanced.ts`)

**核心功能**：
- 连接重试机制（最多2次，每次超时5秒）
- 健康状态跟踪（记录连续失败次数）
- 自动降级策略（连续失败3次后启用降级模式）
- 超时控制（所有操作都有超时限制）
- 预定义降级数据

**主要导出函数**：
- `getDb()` - 带重试的数据库连接
- `checkDbHealth()` - 快速健康检查
- `safeDbOperation()` - 安全执行数据库操作，自动降级
- `getHealthStatus()` - 获取当前健康状态
- `FALLBACK_DATA` - 预定义的降级数据

### 2. 修改标准词库API (`src/app/api/term-management/get-standard-terms/route.ts`)

**改进内容**：
- 使用增强的数据库连接层
- 数据库连接失败时自动返回降级数据
- 返回降级标识和原因，便于前端识别
- 优化预热缓存逻辑，避免启动失败

**降级数据响应示例**：
```json
{
  "success": true,
  "data": {
    "terms": {
      "emotion": ["开心", "悲伤", "平静", ...],
      "style": ["流行", "古典", "摇滚", ...],
      ...
    },
    "totalCount": 48,
    "countsByCategory": {...}
  },
  "cached": false,
  "fallback": true,
  "fallbackReason": "数据库连接失败",
  "error": "DB_CONNECTION_FAILED"
}
```

### 3. 修改标准词库获取函数 (`src/lib/getStandardTerms.ts`)

**改进内容**：
- 使用增强的数据库连接层
- 数据库不可用时自动使用降级数据
- 保证 `buildVocabularyPrompt()` 函数始终可用
- 确保音乐分析API不受数据库故障影响

### 4. 新增数据库健康检查API (`src/api/health/db/route.ts`)

**功能**：
- 实时监控数据库健康状态
- 返回降级模式状态
- 便于运维和监控

**响应示例**：
```json
{
  "status": "ok",
  "database": {
    "status": "unhealthy",
    "consecutiveFailures": 1,
    "lastCheck": "2026-01-16T08:53:30.097Z",
    "isFallbackMode": false,
    "message": "数据库连接正常",
    "error": "Database operation timeout after 3000ms"
  }
}
```

## 降级策略说明

### 降级触发条件

1. **单次降级**：数据库连接失败时立即使用降级数据
2. **连续降级**：连续失败3次后，自动进入降级模式，后续请求直接返回降级数据（减少重试开销）

### 降级数据内容

```typescript
{
  standardTerms: {
    emotion: ['开心', '悲伤', '平静', '激动', '焦虑', '愤怒', '感动', '忧郁'],
    style: ['流行', '古典', '摇滚', '爵士', '电子', '民谣', '说唱', 'R&B'],
    instrument: ['钢琴', '吉他', '小提琴', '鼓', '贝斯', '萨克斯', '笛子', '二胡'],
    film: ['电影', '电视剧', '纪录片', '动画片', '短视频', '广告', '游戏', 'MV'],
    scenario: ['城市', '自然', '室内', '户外', '运动', '浪漫', '悬疑', '搞笑'],
    dubbing: ['中文', '英文', '日文', '韩文', '法文', '德文', '西班牙文', '意大利文'],
  },
  musicAnalysis: {
    emotions: ['情绪分析暂时不可用'],
    styles: ['风格分析暂时不可用'],
    instruments: ['乐器分析暂时不可用'],
  },
}
```

### 前端适配建议

1. **识别降级数据**：检查响应中的 `fallback: true` 字段
2. **降级数据提示**：向用户显示"数据库连接异常，使用基础词库"
3. **降级原因说明**：显示 `fallbackReason` 字段内容
4. **持续重试**：可以添加"重试"按钮，用户可手动刷新

**示例代码**：
```typescript
const response = await fetch('/api/term-management/get-standard-terms');
const result = await response.json();

if (result.fallback) {
  console.log('使用降级数据，原因：', result.fallbackReason);
  // 显示提示信息
  showNotification('数据库连接异常，使用基础词库');
}

// 使用数据
const terms = result.data.terms;
```

## 测试验证

### 1. 标准词库API测试

```bash
curl http://localhost:5000/api/term-management/get-standard-terms
```

**预期结果**：
- 数据库不可用时返回降级数据
- 响应中包含 `fallback: true`
- 每个分类包含基础词汇（8个）

### 2. 数据库健康检查测试

```bash
curl http://localhost:5000/api/health/db
```

**预期结果**：
- 返回当前数据库状态
- 显示连续失败次数
- 标记是否进入降级模式

### 3. 音乐分析功能测试

即使数据库不可用，音乐分析功能仍能正常工作：
- 使用降级词库
- AI分析继续进行
- 标准化功能受限但不影响核心分析

## 根本问题排查

### 需要运维/数据库管理员配合

1. **检查数据库服务状态**
   ```bash
   # 如果是自建PostgreSQL
   sudo systemctl status postgresql
   
   # 查看数据库日志
   sudo tail -f /var/log/postgresql/postgresql-15-main.log
   ```

2. **检查计算节点状态（云数据库）**
   - 检查控制台中计算节点状态
   - 重启计算节点/数据库实例
   - 检查资源配额（CPU/内存是否耗尽）

3. **网络排查**
   ```bash
   # 测试数据库连接
   psql $DATABASE_URL -c "SELECT 1"
   
   # 测试网络连通性
   nc -zv <db-host> <db-port>
   ```

## 预防措施

1. **添加数据库监控**
   - 使用健康检查接口定期检查数据库状态
   - 设置告警阈值（连续失败次数）

2. **连接池优化**
   - 调整连接池参数，避免连接数耗尽
   - 设置合理的连接超时时间

3. **告警机制**
   - 数据库连接失败时发送告警通知
   - 监控降级模式启用情况

4. **缓存策略**
   - 增加内存缓存时间（当前5分钟）
   - 考虑引入Redis缓存

## 性能影响

### 降级模式下的性能

- **响应时间**：几乎无延迟（不查询数据库）
- **数据质量**：基础词汇库（每类8个），可满足基本需求
- **用户体验**：核心功能可用，功能受限但稳定

### 数据库恢复后

- 自动重试连接
- 健康状态自动恢复
- 下次请求时使用真实数据库数据

## 文件修改清单

1. **新增文件**：
   - `src/lib/db-enhanced.ts` - 增强的数据库连接层
   - `src/app/api/health/db/route.ts` - 数据库健康检查API

2. **修改文件**：
   - `src/app/api/term-management/get-standard-terms/route.ts` - 标准词库API
   - `src/lib/getStandardTerms.ts` - 标准词库获取函数

3. **文档**：
   - `DATABASE-FALLBACK-SOLUTION.md` - 本文档

## 总结

该降级方案确保了系统在数据库不可用时的基本功能可用性：
- ✅ 核心功能不中断
- ✅ 用户体验基本保障
- ✅ 自动降级和恢复
- ✅ 健康状态监控
- ✅ 易于扩展和维护

数据库服务恢复后，系统会自动切换回正常模式，无需手动干预。
