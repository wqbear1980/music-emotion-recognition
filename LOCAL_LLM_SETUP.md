# 本地大模型连接指南

本系统现已支持连接本地大模型，可以替代云端LLM服务。

## 功能特性

✅ **无缝切换**：支持云端LLM和本地LLM的动态切换
✅ **统一接口**：使用相同的API接口，无需修改业务逻辑
✅ **自动检测**：支持自动检测可用的LLM提供者
✅ **健康检查**：提供本地LLM服务健康检查功能
✅ **灵活配置**：通过环境变量轻松配置

## 快速开始

### 1. 启动本地大模型服务

#### 方案A：使用 vLLM（推荐）

```bash
# 安装 vLLM
pip install vllm

# 启动本地大模型服务
vllm serve Qwen/Qwen2.5-7B-Instruct --port 8000
```

#### 方案B：使用 Ollama

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 下载模型
ollama pull qwen2.5:7b

# 启动服务
ollama serve
```

注意：Ollama默认端口为11434，需要使用OpenAI兼容API转换。

#### 方案C：使用 LocalAI

```bash
# 使用Docker启动
docker run -p 8080:8080 localai/localai

# 或使用Docker Compose
docker-compose up -d
```

### 2. 配置环境变量

编辑 `.env.local` 文件：

```bash
# 本地LLM类型：cloud（云端）| local（本地）| auto（自动检测）
LLM_TYPE=local

# 本地LLM服务地址
LOCAL_LLM_BASE_URL=http://localhost:8000/v1
LOCAL_LLM_API_KEY=dummy

# 本地LLM模型名称
LOCAL_LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
```

### 3. 重启应用

```bash
# 如果服务正在运行，停止后重启
coze dev > /dev/null 2>&1 &
```

## 配置说明

### 环境变量详解

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `LLM_TYPE` | `cloud` | LLM类型：cloud（云端）、local（本地）、auto（自动检测） |
| `LOCAL_LLM_BASE_URL` | `http://localhost:8000/v1` | 本地LLM服务地址（需包含/v1） |
| `LOCAL_LLM_API_KEY` | `dummy` | 本地LLM API密钥（通常为dummy） |
| `LOCAL_LLM_MODEL` | `Qwen/Qwen2.5-7B-Instruct` | 本地LLM模型名称 |
| `COZE_WORKLOAD_IDENTITY_API_KEY` | - | Coze API密钥（云端模式需要） |
| `CLOUD_LLM_MODEL` | `doubao-seed-1-6-251015` | 云端LLM模型名称 |

### LLM类型说明

#### cloud（云端模式）
- 使用 Coze 提供的云端大模型
- 需要配置 `COZE_WORKLOAD_IDENTITY_API_KEY`
- 响应速度快，但可能有API调用限制

#### local（本地模式）
- 使用本地部署的大模型
- 无API调用限制，但需要本地硬件资源
- 响应速度取决于本地硬件性能

#### auto（自动检测）
- 优先检测本地LLM是否可用
- 本地LLM可用时使用本地，否则使用云端
- 自动降级机制

## API 接口

### 获取LLM配置

```bash
GET /api/llm-config
```

响应示例：
```json
{
  "success": true,
  "config": {
    "current": {
      "type": "local",
      "provider": "openai-compatible",
      "model": "Qwen/Qwen2.5-7B-Instruct",
      "defaultTemperature": 0.3,
      "defaultStreaming": true
    },
    "summary": {
      "currentType": "local",
      "cloud": {
        "model": "doubao-seed-1-6-251015",
        "modelBaseUrl": "https://model.coze.com"
      },
      "local": {
        "model": "Qwen/Qwen2.5-7B-Instruct",
        "modelBaseUrl": "http://localhost:8000/v1"
      }
    }
  }
}
```

### 健康检查

```bash
GET /api/llm-config?action=health-check
```

响应示例：
```json
{
  "success": true,
  "healthy": true,
  "message": "本地LLM服务正常"
}
```

### 自动检测最佳提供者

```bash
GET /api/llm-config?action=auto-detect
```

响应示例：
```json
{
  "success": true,
  "provider": {
    "type": "local",
    "provider": "openai-compatible",
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "defaultTemperature": 0.3,
    "defaultStreaming": true,
    "defaultThinking": false,
    "defaultCaching": "disabled"
  }
}
```

## 常见问题

### Q1: 本地LLM连接失败怎么办？

**检查步骤：**
1. 确认本地LLM服务已启动
2. 检查端口是否正确（默认8000）
3. 检查防火墙设置
4. 查看浏览器控制台错误信息

**测试命令：**
```bash
curl http://localhost:8000/v1/models
```

### Q2: 本地LLM响应太慢怎么办？

**优化建议：**
1. 使用更小的模型（如7B或更小）
2. 增加GPU内存或使用量化模型
3. 调整批处理大小
4. 使用流式输出（已默认启用）

### Q3: 如何切换回云端LLM？

修改 `.env.local`：
```bash
LLM_TYPE=cloud
```

重启应用即可。

### Q4: 本地LLM模型推荐

| 模型 | 大小 | 显存需求 | 特点 |
|------|------|----------|------|
| Qwen2.5-7B-Instruct | 7B | 8GB+ | 中文效果好，推荐 |
| Qwen2.5-14B-Instruct | 14B | 16GB+ | 更强能力 |
| Qwen2.5-3B-Instruct | 3B | 4GB+ | 轻量级，适合低端设备 |
| Llama3-8B-Instruct | 8B | 8GB+ | 英文效果好 |
| DeepSeek-Coder-V2 | 16B | 16GB+ | 代码能力强 |

### Q5: 支持哪些本地LLM服务？

✅ vLLM（推荐）
✅ Ollama（需要OpenAI兼容转换）
✅ LocalAI
✅ Text Generation WebUI
✅ 任何兼容OpenAI API的服务

## 性能对比

| 指标 | 云端LLM | 本地LLM |
|------|---------|---------|
| 响应速度 | 快（1-3秒） | 中等（3-10秒） |
| 并发能力 | 高 | 受硬件限制 |
| 成本 | 按调用计费 | 免费 |
| 数据隐私 | 数据上传云端 | 完全本地 |
| 网络依赖 | 需要 | 不需要 |
| API限制 | 有 | 无 |

## 技术细节

### 架构设计

```
应用层
  ├── hybridEmotionRecognizer.ts
  ├── hybridSceneRecognizer.ts
  └── similarityCalculator.ts
        ↓
配置管理层
  └── llmConfig.ts
        ↓
SDK层
  └── coze-coding-dev-sdk
        ↓
LLM服务
  ├── Coze API（云端）
  └── OpenAI Compatible API（本地）
```

### 核心模块

1. **llmConfig.ts** - LLM配置管理
   - 环境变量读取
   - 配置验证
   - 健康检查
   - 自动检测

2. **hybridEmotionRecognizer.ts** - 情绪识别
   - 规则引擎 + LLM混合方案
   - 支持本地/云端LLM

3. **hybridSceneRecognizer.ts** - 场景识别
   - 多维度融合策略
   - 支持本地/云端LLM

4. **similarityCalculator.ts** - 相似度计算
   - 词汇相似度分析
   - 支持本地/云端LLM

## 开发指南

### 添加新的LLM支持

1. 在 `llmConfig.ts` 中添加新的配置函数
2. 实现健康检查逻辑
3. 更新环境变量文档
4. 测试新LLM的兼容性

### 调试模式

```bash
# 启用详细日志
LLM_DEBUG=true

# 查看LLM配置日志
grep "LLM配置" logs/app.log
```

## 更新日志

### v1.0.0 (2026-01-21)
- ✅ 支持本地LLM连接
- ✅ 添加LLM配置管理模块
- ✅ 实现健康检查功能
- ✅ 添加自动检测机制
- ✅ 支持动态切换LLM提供者

## 联系支持

如有问题，请查看：
1. 本文档的"常见问题"部分
2. 应用日志：`/app/work/logs/bypass/app.log`
3. GitHub Issues（如果有）

---

**最后更新：** 2026-01-21
**版本：** v1.0.0
