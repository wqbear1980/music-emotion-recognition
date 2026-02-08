# macOS DMG 构建操作指南

## 前提条件

- ✅ macOS 系统（10.15 或更高版本）
- ✅ 已安装 Node.js 18+
- ✅ 已安装 pnpm：`npm install -g pnpm`
- ✅ 项目源代码（从当前环境导出）

---

## 步骤 1：将项目复制到 macOS 系统

### 方法 A：使用 Git（推荐）

如果你的项目在 Git 仓库中：

```bash
# 在 macOS 上执行
git clone <你的仓库地址> music-emotion-recognition
cd music-emotion-recognition
```

### 方法 B：手动复制文件

1. 在当前环境中创建项目打包文件：
   ```bash
   # 排除不需要的文件
   tar -czf music-emotion-recognition.tar.gz \
     --exclude='node_modules' \
     --exclude='.next' \
     --exclude='dist' \
     --exclude='.git' \
     --exclude='*.log' \
     .
   ```

2. 将 `music-emotion-recognition.tar.gz` 传输到 macOS 系统

3. 在 macOS 上解压：
   ```bash
   tar -xzf music-emotion-recognition.tar.gz
   cd music-emotion-recognition
   ```

### 方法 C：使用 SFTP/SCP

```bash
# 在 macOS 上执行（从 Linux 环境下载）
scp user@linux-server:/path/to/music-emotion-recognition.tar.gz .
tar -xzf music-emotion-recognition.tar.gz
cd music-emotion-recognition
```

---

## 步骤 2：配置环境变量

### 2.1 复制环境变量模板

```bash
cp .env.example .env
```

### 2.2 编辑 .env 文件

```bash
# 使用 nano 编辑器
nano .env

# 或使用 VS Code
code .env

# 或使用其他编辑器
open -e .env
```

### 2.3 配置必需的环境变量

```env
# ==================== 数据库配置（必需）====================
# 选项 A：使用本地 PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/music_emotion

# 选项 B：使用云数据库（如 Supabase）
# DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

# 选项 C：使用 Neon
# DATABASE_URL=postgresql://neondb_owner:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# ==================== 云端存储配置（可选）====================
# 如果不需要云端存储功能，可以留空
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your_bucket_name

# ==================== 本地 LLM 配置（可选）====================
# 如果使用本地 Ollama，需要安装并启动 Ollama 服务
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# ==================== 应用配置（可选）====================
NEXT_PUBLIC_APP_NAME=音乐情绪识别系统
```

### 2.4 数据库准备（如果使用本地 PostgreSQL）

#### 安装 PostgreSQL（macOS）

```bash
# 使用 Homebrew 安装
brew install postgresql@15

# 启动 PostgreSQL 服务
brew services start postgresql@15

# 创建数据库
createdb music_emotion

# 或者进入 PostgreSQL 创建
psql postgres
CREATE DATABASE music_emotion;
\q
```

#### 测试数据库连接

```bash
# 测试连接
psql "postgresql://postgres@localhost:5432/music_emotion"

# 如果成功，会看到 psql 提示符
# 输入 \q 退出
```

---

## 步骤 3：构建 DMG 文件

### 3.1 安装依赖

```bash
# 安装项目依赖
pnpm install

# 可能需要批准构建脚本（根据 pnpm 提示）
pnpm approve-builds electron
```

### 3.2 验证环境

```bash
# 检查 Node.js 版本
node --version  # 应该是 18+

# 检查 pnpm 版本
pnpm --version

# 检查环境变量
cat .env
```

### 3.3 构建 Next.js

```bash
# 构建 Next.js 生产版本
pnpm build

# 这可能需要几分钟时间
# 如果遇到数据库连接错误，检查 .env 配置
```

### 3.4 编译 Electron 主进程

```bash
# 编译 TypeScript
npx tsc -p electron/tsconfig.json

# 验证编译结果
ls -la electron/main.js  # 应该存在
```

### 3.5 构建 macOS DMG

```bash
# 构建 DMG 文件（包含 ARM64 和 x64 两种架构）
pnpm electron:build:mac

# 构建时间：5-15 分钟，取决于你的 Mac 性能
```

### 3.6 查看构建产物

```bash
# 查看 dist 目录
ls -lh dist/

# 应该看到以下文件：
# 音乐情绪识别-1.0.0-arm64.dmg (~200MB)
# 音乐情绪识别-1.0.0-x64.dmg (~200MB)
# 音乐情绪识别-1.0.0-arm64-mac.zip
# 音乐情绪识别-1.0.0-x64-mac.zip
```

---

## 步骤 4：测试 DMG 文件

### 4.1 打开 DMG 文件

```bash
# 在 Finder 中打开
open dist/

# 或直接挂载 DMG
open dist/音乐情绪识别-1.0.0-arm64.dmg
```

### 4.2 安装并运行应用

1. DMG 挂载后，会显示应用图标
2. 将"音乐情绪识别.app"拖拽到"Applications"文件夹
3. 从 Launchpad 或 Applications 文件夹启动应用
4. 首次启动可能需要授权（系统偏好设置 > 安全性与隐私）

### 4.3 验证功能

- ✅ 应用启动正常
- ✅ 界面显示正常
- ✅ 数据库连接正常（检查控制台日志）
- ✅ 音乐上传和分析功能正常

### 4.4 查看应用日志

如果应用运行异常，可以查看日志：

```bash
# 应用日志位置
~/Library/Logs/音乐情绪识别/

# 在应用中打开开发者工具（按 Cmd+Option+I）
# 查看控制台错误
```

---

## 步骤 5：分发 DMG 文件

### 5.1 准备发布文件

```bash
# 创建发布目录
mkdir -p release

# 复制 DMG 文件
cp dist/音乐情绪识别-1.0.0-arm64.dmg release/
cp dist/音乐情绪识别-1.0.0-x64.dmg release/

# 创建校验和文件
cd release
shasum -a 256 音乐情绪识别-1.0.0-arm64.dmg > SHA256SUMS.txt
shasum -a 256 音乐情绪识别-1.0.0-x64.dmg >> SHA256SUMS.txt
```

### 5.2 签名应用（推荐，用于分发）

如果你有 Apple Developer 账号：

```bash
# 登录 Apple Developer 账号
# 获取证书和团队 ID

# 签名应用
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name" \
  音乐情绪识别.app

# 验证签名
codesign -v 音乐情绪识别.app
```

### 5.3 公证应用（App Store 分发必需）

```bash
# 提交公证
xcrun notarytool submit 音乐情绪识别-1.0.0-arm64.dmg \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "YOUR_TEAM_ID" \
  --wait

# 附加公证票据
xcrun stapler staple 音乐情绪识别-1.0.0-arm64.dmg
```

### 5.4 上传分发

#### 方式 A：直接分发（小范围）

- 通过网盘（Google Drive、百度网盘等）分享 DMG 文件
- 通过邮件发送 DMG 文件
- 使用文件传输服务（WeTransfer、Transfer.sh）

#### 方式 B：网站分发

```bash
# 将 DMG 文件上传到你的网站
# 创建下载页面，提供两个版本：
# - Apple Silicon 版本 (M1/M2/M3)
# - Intel 版本
```

#### 方式 C：App Store 分发（需要付费）

- 需要 Apple Developer Program 会员资格（$99/年）
- 使用 Xcode 或 Transporter 上传应用
- 遵循 App Store 审核指南

---

## 常见问题

### Q1: 构建失败 - "Command 'codesign' not found"

**解决方案**：如果没有 Apple Developer 账号，可以跳过签名步骤。修改 `package.json` 中的 electron-builder 配置：

```json
"mac": {
  "gatekeeperAssess": false,
  "hardenedRuntime": false
}
```

### Q2: 数据库连接失败

**解决方案**：
1. 确保 PostgreSQL 服务正在运行：`brew services list`
2. 检查 .env 文件中的 DATABASE_URL 配置
3. 测试数据库连接：`psql $DATABASE_URL`

### Q3: 应用启动后白屏

**解决方案**：
1. 打开开发者工具（Cmd+Option+I）
2. 查看控制台错误
3. 检查 Next.js 服务器是否启动（端口 3111）
4. 查看 ~/Library/Logs/音乐情绪识别/ 日志

### Q4: 构建时间过长

**解决方案**：
- 首次构建较慢（15-30 分钟）
- 后续构建会更快（利用缓存）
- 确保使用高速网络下载依赖

### Q5: DMG 文件太大

**解决方案**：
- 当前版本约 200MB 是正常的（包含 Electron 和 Node.js）
- 可以通过排除不必要的文件减小体积
- 使用 UPX 压缩二进制文件（高级优化）

---

## 性能优化（可选）

### 1. 减小应用体积

编辑 `package.json` 中的 build 配置：

```json
"files": [
  "electron/**/*",
  ".next/**/*",
  "public/**/*",
  "node_modules/next/**/*",
  "node_modules/react/**/*",
  "node_modules/react-dom/**/*",
  "package.json"
]
```

### 2. 加快启动速度

- 在开发阶段测试性能瓶颈
- 优化 Next.js 应用代码
- 减少初始加载的依赖

### 3. 内存优化

- 在应用关闭时清理数据库连接
- 实现缓存清理功能
- 优化大文件处理逻辑

---

## 支持信息

如遇到问题：

1. 查看 `BUILD_DMG.md` 详细文档
2. 检查 Electron 日志：`~/Library/Logs/音乐情绪识别/`
3. 查看 Next.js 日志：应用开发者工具控制台
4. 确保所有依赖已正确安装：`pnpm list`

---

## 下一步

成功构建 DMG 后，你可以：

- ✅ 在自己的 Mac 上测试应用
- ✅ 分发给团队成员测试
- ✅ 上传到网站供用户下载
- ✅ 提交到 App Store（需 Apple Developer 账号）
- ✅ 持续迭代和优化功能

祝你构建成功！🎉
