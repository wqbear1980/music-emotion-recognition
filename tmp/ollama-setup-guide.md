# Ollama 配置指南

## 1. 拉取推荐模型（二选一）

### 选项A：拉取平衡版模型（推荐用于音乐分析）
```bash
ollama pull deepseek-r1:32b
```

### 选项B：拉取轻量级模型（适合低配置设备）
```bash
ollama pull deepseek-r1:8b
```

### 其他可选模型
```bash
ollama pull deepseek-r1:70b      # 完整版，需要更多内存
ollama pull deepseek-r1:14b      # 中等配置
ollama pull deepseek-coder       # 代码专用
```

## 2. 验证模型是否安装成功
```bash
ollama list
```

## 3. 测试模型运行
```bash
ollama run deepseek-r1:32b "你好，请介绍一下你自己"
```

## 4. 在系统中连接

1. 打开网页中的「🤖 LLM 配置」面板
2. 选择LLM模式：本地（Local）
3. 服务类型选择：Ollama
4. 基础URL设置为：`http://localhost:11434`
5. 点击「检查连接」
6. 连接成功后，从模型列表选择 `deepseek-r1:32b`
7. 点击「测试推理」验证功能

## 常见问题

### Ollama服务无法启动
```bash
# 检查端口占用
lsof -i :11434

# 如果端口被占用，先杀死占用进程
kill -9 $(lsof -t -i:11434)

# 重新启动
ollama serve
```

### 模型下载失败
```bash
# 使用镜像源加速
export OLLAMA_HOST=0.0.0.0:11434
ollama pull deepseek-r1:32b
```

### 内存不足
```bash
# 选择更小的模型
ollama pull deepseek-r1:8b
```
