# 音乐情绪识别系统 - DMG 构建指南

## 概述

本项目已配置为 Electron 桌面应用，可以打包成 macOS DMG 安装文件。

## 重要说明

⚠️ **由于当前环境是 Linux，无法直接构建 macOS 的 DMG 文件。**

要构建 DMG 文件，需要在 **macOS 系统**上执行构建命令。

## 前置要求

- Node.js 18+
- pnpm 包管理器
- macOS 系统（用于构建 DMG）

## 开发运行

### 方式 1：Next.js 开发模式（推荐用于开发）

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 在浏览器中访问 http://localhost:5000
```

### 方式 2：Electron 开发模式

```bash
# 安装依赖
pnpm install

# 启动 Electron 开发模式（同时启动 Next.js 和 Electron）
pnpm electron:dev

# 这将：
# 1. 启动 Next.js 开发服务器（端口 5000）
# 2. 等待服务器就绪后启动 Electron
# 3. Electron 将从 localhost:5000 加载应用
```

## 构建桌面应用

### 构建流程说明

Electron 应用的构建过程分为两个阶段：

1. **构建 Next.js**：`pnpm build` - 生成优化的生产版本
2. **编译 Electron**：`npx tsc -p electron/tsconfig.json` - 编译 TypeScript 主进程代码
3. **打包 Electron**：`electron-builder` - 将应用打包为平台特定的安装文件

### macOS 构建 DMG（需要在 macOS 上执行）

```bash
# 安装依赖
pnpm install

# 构建 macOS DMG 文件
pnpm electron:build:mac

# 构建产物将位于 dist 目录
```

构建完成后，将在 `dist` 目录下生成以下文件：
- `音乐情绪识别-1.0.0-arm64.dmg` - Apple Silicon (M1/M2/M3) 版本
- `音乐情绪识别-1.0.0-x64.dmg` - Intel 版本
- `音乐情绪识别-1.0.0-arm64-mac.zip` - 压缩版本
- `音乐情绪识别-1.0.0-x64-mac.zip` - 压缩版本

### Windows 构建

```bash
# 构建 Windows 安装程序
pnpm electron:build:win

# 构建产物将位于 dist 目录
```

### Linux 构建

```bash
# 构建 Linux 应用
pnpm electron:build:linux

# 构建产物将位于 dist 目录
```

### 通用构建命令

```bash
# 构建当前平台的应用
pnpm electron:build
```

## 应用架构

### 混合架构说明

本项目采用 **Electron + Next.js 混合架构**：

1. **Electron 主进程**：提供桌面应用窗口和系统集成
2. **Next.js 服务器**：在 Electron 内部运行，提供完整的 Web 功能
3. **通信方式**：Electron 窗口通过 HTTP 访问本地 Next.js 服务器（端口 3111）

### 架构优势

✅ **保留所有功能**：所有 API 路由、数据库操作、云端功能都正常工作  
✅ **开发体验一致**：开发和生产环境的代码完全相同  
✅ **渐进式升级**：可以逐步将功能迁移到 Electron 原生实现

### 架构限制

⚠️ **启动时间较长**：需要启动 Next.js 服务器（约 3 秒）  
⚠️ **内存占用较高**：同时运行 Electron 和 Next.js  
⚠️ **端口占用**：使用固定端口 3111，可能与系统服务冲突

## 重要注意事项

### 1. 数据库依赖

桌面应用仍然需要 PostgreSQL 数据库。数据库连接配置通过环境变量提供：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/music_emotion
```

**建议**：
- 使用本地 PostgreSQL（通过 Homebrew 安装）
- 或使用云 PostgreSQL 服务（如 Supabase、Neon）

### 2. 云端存储

云端 S3 存储功能需要配置 AWS 凭证：

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
AWS_BUCKET_NAME=your_bucket_name
```

### 3. 本地 LLM 集成

本地 LLM (Ollama) 功能可以正常工作，需要：

- Ollama 服务已安装并运行
- 可以通过 localhost:11434 访问
- 已下载所需模型（如 qwen2.5:7b）

### 4. 文件存储

- 上传的音乐文件默认存储在 `/tmp/music-uploads/` 目录
- 可以通过修改 API 路由更改存储位置
- 建议使用云端存储以便在不同设备间同步

## 自定义配置

### 修改端口

如果需要修改 Next.js 服务器端口，编辑 `electron/main.ts`：

```typescript
const PORT = 3111; // 修改为你想要的端口
```

### 自定义图标

要自定义应用图标：

1. 准备一个 `.icns` 格式的图标文件（macOS）
2. 将图标文件放在 `build/icon.icns`
3. 重新构建应用

### 修改应用名称

编辑 `package.json` 中的以下字段：

```json
{
  "name": "music-emotion-recognition",
  "productName": "音乐情绪识别",
  "build": {
    "appId": "com.musicemotion.recognition"
  }
}
```

## 环境变量

创建 `.env` 文件配置应用环境变量：

```env
# 云端存储配置
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your_bucket_name_here

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/music_emotion

# 本地 LLM 配置
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

## 故障排除

### 构建失败

1. **确保所有依赖已正确安装**
   ```bash
   pnpm install
   ```

2. **检查 TypeScript 编译错误**
   ```bash
   npx tsc --noEmit
   ```

3. **查看构建日志**
   ```bash
   pnpm electron:build 2>&1 | tee build.log
   ```

### Electron 启动失败

1. **确保 Next.js 已构建**
   ```bash
   pnpm build
   ```

2. **检查编译后的文件**
   ```bash
   ls -la electron/main.js
   ```

3. **查看 Electron 开发者工具的控制台错误**
   - 应用启动后按 `Cmd+Option+I`（macOS）或 `Ctrl+Shift+I`（Windows/Linux）打开开发者工具

### 服务器启动失败

如果 Next.js 服务器无法启动，检查：

1. **端口是否被占用**
   ```bash
   # macOS/Linux
   lsof -i :3111

   # Windows
   netstat -ano | findstr :3111
   ```

2. **环境变量是否正确配置**
   ```bash
   cat .env
   ```

3. **数据库连接是否正常**
   ```bash
   pnpm dev  # 在开发模式下测试
   ```

### macOS 权限问题

如果 macOS 提示"无法验证开发者"，需要：

1. 打开"系统偏好设置" > "安全性与隐私"
2. 在"通用"标签页中，点击"仍要打开"
3. 或者右键点击应用，选择"打开"

## 分发指南

### macOS

1. 将 DMG 文件上传到下载服务器
2. 创建签名（推荐）
   ```bash
   codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" 音乐情绪识别.app
   ```
3. 公证（App Store 分发必需）
   ```bash
   xcrun notarytool submit 音乐情绪识别-1.0.0.dmg --apple-id "your@email.com" --password "app-specific-password" --team-id "YOUR_TEAM_ID"
   ```

### Windows

1. 使用代码签名证书签名安装程序
2. 上传到下载服务器
3. 提供安装说明

### Linux

1. 上传 AppImage 和 deb 文件
2. 提供安装说明

## 性能优化建议

1. **减少应用大小**：
   - 使用 `electron-builder` 的 `files` 配置排除不必要的文件
   - 使用压缩工具压缩资源

2. **加快启动速度**：
   - 预构建 Next.js（已完成）
   - 使用 `next start` 而不是 `next dev`（已完成）

3. **降低内存占用**：
   - 在不需要时关闭数据库连接
   - 清理缓存文件

## 技术架构

- **前端框架**: Next.js 16 (App Router) + React 19
- **桌面框架**: Electron 40
- **构建工具**: Electron Builder
- **包管理器**: pnpm
- **TypeScript**: 5.x
- **数据库**: PostgreSQL (通过 Drizzle ORM)
- **LLM**: Ollama (本地) / OpenAI API (可选)

## 未来改进方向

- [ ] 使用 next-standalone 减小应用体积
- [ ] 实现自动更新功能
- [ ] 将部分功能迁移到 Electron 原生实现
- [ ] 添加应用内数据库（SQLite）作为本地备份
- [ ] 优化内存使用和启动速度

## 许可证

MIT
