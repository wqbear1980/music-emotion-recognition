# 音乐情绪识别系统

## 项目简介

本系统是一个基于 Web Audio API 和大语言模型的音乐情绪识别系统，支持**本地音乐文件导入分析**，无需上传至扣子云端。

### 核心特点

- 🎵 **纯本地分析**：音乐文件只在用户设备端（浏览器）中处理，不上传到任何云端存储
- 🔒 **隐私保护**：不保存音乐源文件，分析完成后立即释放音频数据
- ⚡ **快速识别**：利用 Web Audio API 提取音频特征，分析速度快
- 🤖 **AI 驱动**：使用大语言模型分析音频特征，提供情绪标签、风格建议、场景推荐
- 📊 **详细报告**：支持导出 Excel 和 CSV 格式的分析报告

---

## 功能说明

### 📥 导入
用户选择本地 MP3/WAV/OGG/FLAC 等格式音乐文件

### 🔍 分析
在**用户设备端**完成音频特征提取与情绪识别

### 📤 输出
仅返回情绪标签、节奏强度等分析结果，**不存储、不上传任何音乐源文件**

---

## 数据安全承诺

### ✅ 不上传
- 音乐文件**从未离开您的设备**
- 不上传到扣子的文件盒子、知识库、工作流临时存储
- 不上传到任何云端存储服务

### ✅ 不保存
- 分析完成后，浏览器内存中的音频数据被自动释放
- 不保存音乐源文件
- 仅保存分析结果（情绪标签、风格建议等文本信息）

### ✅ 完全本地处理
- 所有音频处理都在您的浏览器中完成
- 后端只接收音频特征数据（JSON），不接收音频文件

---

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
coze dev
```

服务将运行在 `http://localhost:5000`

### 构建生产版本

```bash
coze build
```

### 启动生产环境

```bash
coze start
```

---

## 技术架构

### 前端技术栈
- **Next.js 16** - React 框架
- **React 19** - UI 库
- **TypeScript** - 类型安全
- **Tailwind CSS 4** - 样式框架
- **shadcn/ui** - UI 组件库

### 后端技术栈
- **Next.js API Routes** - 后端 API
- **Drizzle ORM** - 数据库 ORM
- **PostgreSQL** - 数据库

### 核心技术
- **Web Audio API** - 浏览器原生音频处理
- **LLM（大语言模型）** - 音频特征分析
- **FileReader API** - 本地文件读取

### 数据流

```
本地文件 → 浏览器内存 → Web Audio API 提取特征 → 发送特征到后端 → LLM 分析 → 返回结果
```

---

## 项目结构

```
.
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   │   ├── analyze-music-fast/    # 音乐分析 API
│   │   │   ├── music-analyses/        # 音乐分析数据库 API
│   │   │   └── term-management/       # 词库管理 API
│   │   ├── page.tsx           # 主页面
│   │   └── layout.tsx         # 布局
│   ├── components/             # React 组件
│   │   ├── ui/               # UI 组件（shadcn/ui）
│   │   └── TermManagementPanel.tsx    # 词库管理面板
│   └── lib/                  # 工具库
│       ├── getStandardTerms.ts       # 标准词库获取
│       └── standardTerms.ts           # 标准词库定义
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 核心功能

### 1. 音频特征提取（本地）
使用 Web Audio API 在浏览器本地提取以下特征：
- BPM（节拍）
- 频谱分析（低频/中频/高频）
- 能量强度
- 动态范围
- 节奏特征
- 和声特征
- 音色纹理

### 2. AI 情绪识别（云端）
基于音频特征，AI 模型识别：
- **情绪标签**：热血、温馨、紧张、悲伤、浪漫、史诗等
- **音乐风格**：古典、爵士、流行、电子、摇滚等
- **影视类型**：动作片、爱情片、恐怖片、悬疑片等
- **场景建议**：追逐、打架、浪漫、回忆、悬疑等
- **乐器分析**：主奏乐器、伴奏乐器、打击乐器等
- **音乐结构**：主歌、副歌、桥段等

### 3. 词库管理
- 标准词库管理（情绪、影视类型、场景、乐器、风格）
- 自动扩充词库
- 人工审核机制
- 同义词管理

### 4. 数据库管理
- 音乐分析结果存储
- 统计分析（类型分布、情绪分布等）
- 高级检索（按情绪、类型、场景等筛选）
- 数据导出（Excel、CSV）

---

## 使用场景

### 适合
- 🎵 个人音乐爱好者分析自己的音乐收藏
- 🎬 影视创作者为作品寻找合适的配乐
- 🎮 游戏开发者为游戏场景选择背景音乐
- 📺 视频制作者为视频添加情绪匹配的背景音乐

### 使用流程
1. 点击"上传音乐文件"区域
2. 选择本地音频文件（支持多选）
3. 系统自动提取音频特征并分析
4. 查看分析结果（情绪标签、风格、场景建议等）
5. 导出分析报告（可选）

---

## 常见问题

### Q: 我上传的音乐会被保存到扣子吗？
**A:** 不会。您的音乐文件只在浏览器内存中临时处理，分析完成后立即释放，从未上传到任何云端存储。

### Q: 我的音乐会离开我的设备吗？
**A:** 不会。所有音频处理都在您的浏览器中完成，只有音频特征数据（如 BPM、能量值等数字）会发送到后端进行分析。

### Q: 后端能看到我的音乐文件吗？
**A:** 看不到。后端只接收音频特征数据（JSON 格式），不接收音频文件本身。

### Q: 支持哪些音频格式？
**A:** 支持 MP3、WAV、OGG、FLAC、M4A 等常见音频格式。

### Q: 分析速度快吗？
**A:** 很快。音频特征提取在本地完成，通常几秒钟就能完成一首歌的分析。

---

## 文档

- **详细功能说明**：参见 [README_USAGE.md](./README_USAGE.md)
- **智能体描述**：参见 [AGENT_DESCRIPTION.md](./AGENT_DESCRIPTION.md)
- **隐私政策**：参见 [PRIVACY.md](./PRIVACY.md)

---

## 开发指南

### 代码规范
- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 代码规范
- 使用 Prettier 格式化代码

### 提交规范
遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：
- `feat:` 新功能
- `fix:` 修复 bug
- `refactor:` 重构代码
- `docs:` 文档更新
- `chore:` 构建/工具链更新

### 分支策略
- `main` - 主分支（生产环境）
- `develop` - 开发分支
- `feature/*` - 功能分支
- `bugfix/*` - 修复分支

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 许可证

MIT License

---

## 联系方式

**开发者**：通用网页搭建专家

**技术支持**：通过 GitHub Issues 提交问题和建议

---

## 版本信息

- **当前版本**：v1.0
- **最后更新**：2025年
- **技术栈**：Next.js 16 + Web Audio API + LLM

---

## 致谢

感谢以下开源项目和工具：
- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [TypeScript](https://www.typescriptlang.org/)
