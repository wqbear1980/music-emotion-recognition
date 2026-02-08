#!/bin/bash

# Ollama 本地模型检查脚本
# 用于检查 Ollama 服务和模型是否可用

echo "========================================="
echo "🔍 Ollama 本地模型检查工具"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅${NC} $1 已安装"
        return 0
    else
        echo -e "${RED}❌${NC} $1 未安装"
        return 1
    fi
}

check_service() {
    if curl -s http://localhost:11434/api/tags &> /dev/null; then
        echo -e "${GREEN}✅${NC} Ollama 服务正在运行"
        return 0
    else
        echo -e "${RED}❌${NC} Ollama 服务未运行"
        return 1
    fi
}

# 1. 检查 Ollama 是否安装
echo "📦 检查 Ollama 安装..."
if check_command "ollama"; then
    OLLAMA_VERSION=$(ollama --version)
    echo "   版本: $OLLAMA_VERSION"
else
    echo ""
    echo -e "${YELLOW}💡 安装 Ollama:${NC}"
    echo "   curl -fsSL https://ollama.com/install.sh | sh"
    echo ""
    exit 1
fi

echo ""

# 2. 检查 Ollama 服务是否运行
echo "🚀 检查 Ollama 服务状态..."
if check_service; then
    echo ""
else
    echo ""
    echo -e "${YELLOW}💡 启动 Ollama 服务:${NC}"
    echo "   OLLAMA_HOST=0.0.0.0:11434 ollama serve"
    echo ""
    exit 1
fi

# 3. 获取本机 IP 地址
echo "🌐 获取本机 IP 地址..."
echo ""
case "$(uname -s)" in
    Linux*)
        IP_ADDRESS=$(hostname -I | awk '{print $1}')
        ;;
    Darwin*)
        IP_ADDRESS=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
        ;;
    MINGW*|CYGWIN*|MSYS*)
        IP_ADDRESS=$(ipconfig | grep "IPv4" | awk '{print $NF}' | head -1)
        ;;
    *)
        IP_ADDRESS="未知系统"
        ;;
esac
echo -e "   本机 IP: ${GREEN}${IP_ADDRESS}${NC}"
echo "   Ollama 地址: ${GREEN}http://${IP_ADDRESS}:11434${NC}"
echo "   本地测试地址: ${GREEN}http://localhost:11434${NC}"
echo ""

# 4. 检查已安装的模型
echo "📚 检查已安装的模型..."
echo ""
MODELS=$(ollama list)
if [ -z "$MODELS" ]; then
    echo -e "${RED}❌ 没有找到已安装的模型${NC}"
    echo ""
    echo -e "${YELLOW}💡 推荐安装的模型:${NC}"
    echo "   # 平衡版本（推荐）"
    echo "   ollama pull deepseek-r1:32b"
    echo ""
    echo "   # 轻量级版本"
    echo "   ollama pull deepseek-r1:8b"
    echo ""
    exit 1
else
    echo "$MODELS"
    MODEL_COUNT=$(echo "$MODELS" | grep -v "^NAME" | wc -l | tr -d ' ')
    echo ""
    echo -e "   共安装 ${GREEN}${MODEL_COUNT}${NC} 个模型"
fi

echo ""

# 5. 测试模型推理（如果安装了推荐模型）
echo "🧠 测试模型推理能力..."
echo ""

# 优先测试 DeepSeek 模型
TEST_MODEL=""
if ollama list | grep -q "deepseek-r1:32b"; then
    TEST_MODEL="deepseek-r1:32b"
elif ollama list | grep -q "deepseek-r1:8b"; then
    TEST_MODEL="deepseek-r1:8b"
elif ollama list | grep -q "deepseek"; then
    TEST_MODEL=$(ollama list | grep "deepseek" | head -1 | awk '{print $1}')
else
    # 测试第一个可用的模型
    FIRST_MODEL=$(ollama list | grep -v "^NAME" | head -1 | awk '{print $1}')
    if [ -n "$FIRST_MODEL" ]; then
        TEST_MODEL="$FIRST_MODEL"
    fi
fi

if [ -n "$TEST_MODEL" ]; then
    echo "   测试模型: ${GREEN}${TEST_MODEL}${NC}"
    echo "   测试问题: 你好，请用一句话介绍一下你自己"
    echo ""
    echo -e "   ${YELLOW}推理结果:${NC}"
    ollama run "$TEST_MODEL" "你好，请用一句话介绍一下你自己" 2>&1 | head -5
    echo ""
    echo -e "   ${GREEN}✅${NC} 模型推理测试成功"
else
    echo -e "${YELLOW}⚠️${NC} 跳过推理测试（没有找到可测试的模型）"
fi

echo ""

# 6. 检查 GPU 加速（如果有）
echo "⚡ 检查 GPU 加速..."
echo ""
if command -v nvidia-smi &> /dev/null; then
    echo -e "${GREEN}✅${NC} 检测到 NVIDIA GPU"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits | while read line; do
        echo "   GPU: $line"
    done
    echo ""
    echo -e "${YELLOW}💡 启用 GPU 加速:${NC}"
    echo "   CUDA_VISIBLE_DEVICES=0 ollama serve"
elif command -v rocm-smi &> /dev/null; then
    echo -e "${GREEN}✅${NC} 检测到 AMD GPU"
    rocm-smi 2>&1 | head -5
else
    echo -e "${YELLOW}⚠️${NC} 未检测到 GPU，将使用 CPU 运行（速度较慢）"
fi

echo ""

# 7. 检查端口占用
echo "🔌 检查端口占用..."
echo ""
if lsof -i :11434 &> /dev/null; then
    echo -e "${GREEN}✅${NC} 端口 11434 已被占用（Ollama 正在运行）"
    lsof -i :11434 | tail -1
else
    echo -e "${RED}❌${NC} 端口 11434 未被占用"
fi

echo ""

# 8. 检查外部访问
echo "🌐 检查外部访问配置..."
echo ""
if curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo -e "${GREEN}✅${NC} 本地访问正常"
fi

if [ -n "$IP_ADDRESS" ] && [ "$IP_ADDRESS" != "未知系统" ]; then
    if curl -s "http://${IP_ADDRESS}:11434/api/tags" &> /dev/null; then
        echo -e "${GREEN}✅${NC} 外部访问正常（http://${IP_ADDRESS}:11434）"
    else
        echo -e "${YELLOW}⚠️${NC} 外部访问可能受限"
        echo ""
        echo -e "${YELLOW}💡 启用外部访问:${NC}"
        echo "   OLLAMA_HOST=0.0.0.0:11434 ollama serve"
    fi
fi

echo ""
echo "========================================="
echo "✨ 检查完成"
echo "========================================="
echo ""
echo -e "${GREEN}📝 在网页中配置 Ollama 连接:${NC}"
echo "   1. 打开「🤖 LLM 配置」面板"
echo "   2. LLM模式: 选择「本地（Local）」"
echo "   3. 服务类型: 选择「Ollama」"
echo "   4. 基础URL: http://${IP_ADDRESS}:11434"
echo "   5. 点击「检查连接」"
echo "   6. 选择模型: $([ -n "$TEST_MODEL" ] && echo "$TEST_MODEL" || echo "从下拉列表选择")"
echo "   7. 点击「应用配置」"
echo ""
