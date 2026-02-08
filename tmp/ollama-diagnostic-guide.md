# 本地模型检查完整指南

## 🎯 检查目标

检查 Ollama 本地模型是否可以正常使用，包括：
- ✅ Ollama 是否已安装
- ✅ Ollama 服务是否运行
- ✅ 是否有可用的模型
- ✅ 模型是否能正常推理
- ✅ 网络连接是否正常
- ✅ 外部访问是否可用

---

## 🚀 方法1：使用自动检查脚本（推荐）

### 在你的本地电脑上运行：

```bash
# 下载并运行检查脚本
bash -c "$(curl -fsSL https://raw.githubusercontent.com/ollama/ollama/main/scripts/check.sh)"

# 或者手动运行我提供的脚本
bash /tmp/ollama-check.sh
```

脚本会自动检查：
- ✅ Ollama 安装状态
- ✅ Ollama 服务运行状态
- ✅ 本机 IP 地址
- ✅ 已安装的模型列表
- ✅ 模型推理能力测试
- ✅ GPU 加速状态
- ✅ 端口占用情况
- ✅ 外部访问配置

---

## 🔍 方法2：手动检查（逐步检查）

### 步骤1：检查 Ollama 是否安装

```bash
ollama --version
```

**预期输出**：`ollama version is x.x.x`

**如果失败**：
```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh
```

---

### 步骤2：检查 Ollama 服务是否运行

```bash
# 测试本地连接
curl http://localhost:11434/api/tags
```

**预期输出**：JSON 格式的模型列表

**如果失败**，启动服务：
```bash
# macOS/Linux
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# Windows PowerShell
$env:OLLAMA_HOST="0.0.0.0:11434"; ollama serve
```

---

### 步骤3：检查已安装的模型

```bash
ollama list
```

**预期输出**：
```
NAME                    ID              SIZE    MODIFIED
deepseek-r1:32b         abc123...       20GB    5 minutes ago
```

**如果没有模型**，安装推荐模型：
```bash
# 推荐：32B 版本
ollama pull deepseek-r1:32b

# 或者：轻量级 8B 版本
ollama pull deepseek-r1:8b
```

---

### 步骤4：测试模型推理

```bash
ollama run deepseek-r1:32b "你好，请用一句话介绍一下你自己"
```

**预期输出**：模型会回复一段话

**如果失败**：
- 检查模型是否下载完成
- 检查内存是否足够
- 重新拉取模型

---

### 步骤5：获取本机 IP 地址

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

**记下你的 IP**，例如：`192.168.1.100`

---

### 步骤6：测试外部访问

```bash
# 使用本机 IP 测试
curl http://192.168.1.100:11434/api/tags
```

**预期输出**：与步骤2相同的JSON输出

**如果失败**：
```bash
# 确保使用正确的启动命令
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# 检查防火墙设置
```

---

### 步骤7：在网页中配置连接

1. 打开「🤖 LLM 配置」面板
2. **LLM模式**：选择「本地（Local）」
3. **服务类型**：选择「Ollama」
4. **基础URL**：输入 `http://[你的IP]:11434`
5. **点击「检查连接」**
6. **选择模型**：从下拉列表选择 `deepseek-r1:32b`
7. **点击「测试推理」**
8. **点击「应用配置」**

---

## 🌐 方法3：通过网页应用检查

### 使用「🤖 LLM 配置」面板

1. **打开配置面板**
   - 点击顶部工具栏的「🤖 LLM 配置」按钮

2. **配置连接参数**
   - LLM模式：选择「本地（Local）」
   - 服务类型：选择「Ollama」
   - 基础URL：输入 `http://[你的IP]:11434`

3. **运行健康检查**
   - 点击「检查连接」按钮
   - 系统会自动检查：
     - ✅ Ollama 服务是否运行
     - ✅ 网络连接是否正常
     - ✅ 可用的模型列表

4. **测试推理能力**
   - 从模型列表选择一个模型
   - 点击「测试推理」按钮
   - 系统会发送测试请求，验证模型是否正常工作

---

## 📊 检查结果解读

### ✅ 所有检查通过

恭喜！你的本地模型可以正常使用了。

**下一步**：
- 上传音乐文件进行测试
- 享受无限制的本地分析

### ⚠️ 部分检查失败

#### 情况1：Ollama 服务未运行
```bash
# 启动服务
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

#### 情况2：没有可用模型
```bash
# 安装模型
ollama pull deepseek-r1:32b
```

#### 情况3：外部访问失败
```bash
# 确保使用 0.0.0.0 监听
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# 检查防火墙
```

#### 情况4：连接超时
- 检查网络连接
- 确认 IP 地址正确
- 检查防火墙设置

---

## 🔧 常见问题解决

### 问题1：命令未找到
```bash
# 检查 PATH
echo $PATH

# 添加到 PATH
export PATH=$PATH:/usr/local/bin
```

### 问题2：端口被占用
```bash
# 查看占用进程
lsof -i :11434

# 杀死进程
kill -9 $(lsof -t -i:11434)

# 重新启动
ollama serve
```

### 问题3：模型下载失败
```bash
# 重新拉取
ollama pull deepseek-r1:32b

# 使用国内镜像（如果有）
# 设置环境变量
export OLLAMA_HOST=0.0.0.0:11434
```

### 问题4：推理速度慢
```bash
# 检查是否有 GPU
nvidia-smi

# 启用 GPU 加速
CUDA_VISIBLE_DEVICES=0 ollama serve

# 或者使用更小的模型
ollama pull deepseek-r1:8b
```

---

## 📝 检查清单

完成以下检查项，确保本地模型可以正常使用：

- [ ] Ollama 已安装（`ollama --version` 成功）
- [ ] Ollama 服务正在运行（`curl http://localhost:11434/api/tags` 成功）
- [ ] 已安装至少一个模型（`ollama list` 有输出）
- [ ] 模型可以正常推理（`ollama run deepseek-r1:32b "你好"` 成功）
- [ ] 获取到本机 IP 地址
- [ ] 外部访问正常（`curl http://[IP]:11434/api/tags` 成功）
- [ ] 网页中配置成功（「检查连接」通过）
- [ ] 推理测试成功（「测试推理」通过）

---

## 🎉 检查完成

如果所有检查项都通过，恭喜你的本地模型已经可以正常使用了！

现在你可以：
1. 上传音乐文件进行本地分析
2. 享受无限制的免费推理
3. 保护数据隐私
4. 不受任何限流影响

---

需要帮助？告诉我你在哪一步遇到了问题！
