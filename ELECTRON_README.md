# Electron 桌面应用配置完成

## ✅ 配置已完成

音乐情绪识别系统已成功配置为 Electron 桌面应用，可以打包成 macOS DMG、Windows 安装程序和 Linux AppImage。

## 📦 构建方法

### 在 macOS 上构建 DMG

```bash
# 1. 确保在 macOS 系统上
# 2. 克隆或复制项目到 macOS
# 3. 安装依赖
pnpm install

# 4. 构建 DMG 文件
pnpm electron:build:mac

# 构建产物将在 dist 目录下
```

### 在 Windows 上构建

```bash
pnpm electron:build:win
```

### 在 Linux 上构建

```bash
pnpm electron:build:linux
```

## 🚀 开发运行

```bash
# 方式 1：仅 Next.js 开发服务器（浏览器访问）
pnpm dev

# 方式 2：Electron 开发模式（桌面应用）
pnpm electron:dev
```

## 📋 重要说明

### 架构说明

本应用采用 **Electron + Next.js 混合架构**：

- **Electron** 提供桌面应用窗口和系统集成
- **Next.js** 在 Electron 内部运行（端口 3111），提供完整功能
- **所有功能保留**：数据库、API 路由、云端存储、LLM 集成都正常工作

### 依赖要求

1. **数据库**：需要 PostgreSQL 数据库
   - 本地安装（推荐用于桌面应用）
   - 或云数据库（如 Supabase、Neon）

2. **环境变量**：创建 `.env` 文件配置
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/music_emotion
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_REGION=your_region
   AWS_BUCKET_NAME=your_bucket
   ```

3. **LLM（可选）**：本地 LLM 需要 Ollama 服务
   ```env
   OLLAMA_API_URL=http://localhost:11434
   OLLAMA_MODEL=qwen2.5:7b
   ```

## 📚 详细文档

请查看 [BUILD_DMG.md](./BUILD_DMG.md) 获取：
- 详细的构建说明
- 故障排除指南
- 自定义配置方法
- 分发指南
- 性能优化建议

## ⚠️ 当前限制

由于在 Linux 环境中，无法直接构建 macOS DMG 文件。需要在 macOS 系统上执行构建命令。

## 🎯 下一步

1. 在 macOS 系统上克隆/复制项目
2. 配置 `.env` 文件（数据库、AWS S3 等）
3. 运行 `pnpm electron:build:mac` 构建 DMG
4. 将 DMG 文件分发给用户

## 🔧 技术栈

- **前端**：Next.js 16 + React 19 + TypeScript 5
- **桌面框架**：Electron 40
- **构建工具**：Electron Builder
- **包管理器**：pnpm
