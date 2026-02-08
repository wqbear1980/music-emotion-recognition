/**
 * 本地大模型配置
 *
 * 支持常见的本地大模型，包括 DeepSeek、Qwen、Gemma、GPT 等
 */

export interface LocalLLMModel {
  id: string;           // 模型ID
  name: string;         // 显示名称
  provider: string;     // 提供商
  category: string;     // 类别（开源/闭源）
  size?: string;        // 模型大小
  description?: string; // 描述
  requires?: string[];  // 依赖的服务类型
  examplePrompt?: string; // 示例提示词
  ollamaModel?: string; // Ollama 专用的模型名称（因为Ollama使用不同的命名格式）
}

/**
 * 支持的本地大模型列表
 */
export const LOCAL_LLM_MODELS: LocalLLMModel[] = [
  // DeepSeek 系列
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    category: '开源',
    size: '70B',
    description: 'DeepSeek 推理模型，优化逻辑推理任务',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '分析这段音乐的情绪变化和情感轨迹',
  },
  {
    id: 'deepseek-r1:1.5b',
    name: 'DeepSeek R1 (1.5B)',
    provider: 'DeepSeek',
    category: '开源',
    size: '1.5B',
    description: 'DeepSeek R1 轻量版本，适合低配置环境',
    requires: ['ollama'],
    ollamaModel: 'deepseek-r1:1.5b',
  },
  {
    id: 'deepseek-r1:7b',
    name: 'DeepSeek R1 (7B)',
    provider: 'DeepSeek',
    category: '开源',
    size: '7B',
    description: 'DeepSeek R1 小参数版本，平衡性能与资源',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'deepseek-r1:7b',
  },
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek R1 (8B)',
    provider: 'DeepSeek',
    category: '开源',
    size: '8B',
    description: 'DeepSeek R1 8B 参数版本',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'deepseek-r1:8b',
  },
  {
    id: 'deepseek-r1:14b',
    name: 'DeepSeek R1 (14B)',
    provider: 'DeepSeek',
    category: '开源',
    size: '14B',
    description: 'DeepSeek R1 中等参数版本',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'deepseek-r1:14b',
  },
  {
    id: 'deepseek-r1:32b',
    name: 'DeepSeek R1 (32B)',
    provider: 'DeepSeek',
    category: '开源',
    size: '32B',
    description: 'DeepSeek R1 大参数版本，更强推理能力',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'deepseek-r1:32b',
  },
  {
    id: 'deepseek-r1:70b',
    name: 'DeepSeek R1 (70B)',
    provider: 'DeepSeek',
    category: '开源',
    size: '70B',
    description: 'DeepSeek R1 完整参数版本，最强推理能力',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '分析这段音乐的情绪变化和情感轨迹',
    ollamaModel: 'deepseek-r1:70b',
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    provider: 'DeepSeek',
    category: '开源',
    size: '16B',
    description: '专注于代码生成和理解',
    requires: ['ollama', 'vllm', 'openai-compatible'],
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    category: '开源',
    size: '671B',
    description: 'DeepSeek 最新旗舰模型，强大的推理和代码能力',
    requires: ['vllm', 'openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
  },

  // Qwen (通义千问) 系列
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    category: '开源',
    size: '72B',
    description: '通义千问大模型，强大的中文理解和生成能力',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
    ollamaModel: 'qwen2.5:72b',
  },
  {
    id: 'Qwen/Qwen2.5-7B-Instruct',
    name: 'Qwen 2.5 7B',
    provider: 'Alibaba',
    category: '开源',
    size: '7B',
    description: '轻量级通义千问模型，适合本地部署',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'qwen2.5:7b',
  },
  {
    id: 'Qwen/Qwen2.5-32B-Instruct',
    name: 'Qwen 2.5 32B',
    provider: 'Alibaba',
    category: '开源',
    size: '32B',
    description: '中等规模通义千问模型，性能和资源消耗平衡',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'qwen2.5:32b',
  },
  {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    name: 'Qwen Coder 32B',
    provider: 'Alibaba',
    category: '开源',
    size: '32B',
    description: '专注于代码任务的 Qwen 模型',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'qwen2.5-coder:32b',
  },

  // Gemma (Google) 系列
  {
    id: 'google/gemma-3-27b-it',
    name: 'Gemma 3 27B',
    provider: 'Google',
    category: '开源',
    size: '27B',
    description: 'Google Gemma 3 模型，强大的多语言能力',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
    ollamaModel: 'gemma3:27b',
  },
  {
    id: 'google/gemma-2-27b-it',
    name: 'Gemma 2 27B',
    provider: 'Google',
    category: '开源',
    size: '27B',
    description: 'Google Gemma 2 模型，性能优秀',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'gemma2:27b',
  },
  {
    id: 'google/gemma-2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'Google',
    category: '开源',
    size: '9B',
    description: '轻量级 Gemma 模型，适合资源受限环境',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'gemma2:9b',
  },

  // GPT (OpenAI) - 本地兼容版本
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo (Local)',
    provider: 'OpenAI',
    category: '闭源',
    description: 'GPT-4 Turbo 本地兼容版本（需自行部署）',
    requires: ['openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo (Local)',
    provider: 'OpenAI',
    category: '闭源',
    description: 'GPT-3.5 Turbo 本地兼容版本（需自行部署）',
    requires: ['openai-compatible'],
  },

  // LLaMA 系列
  {
    id: 'meta-llama/Llama-3.1-70B-Instruct',
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    category: '开源',
    size: '70B',
    description: 'Meta Llama 3.1 模型，强大的多语言能力',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
    ollamaModel: 'llama3.1:70b',
  },
  {
    id: 'meta-llama/Llama-3.1-8B-Instruct',
    name: 'Llama 3.1 8B',
    provider: 'Meta',
    category: '开源',
    size: '8B',
    description: '轻量级 Llama 模型，适合本地部署',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'llama3.1:8b',
  },
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    category: '开源',
    size: '70B',
    description: 'Meta Llama 3.3 模型，性能优化版本',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'llama3.3:70b',
  },

  // Mistral 系列
  {
    id: 'mistralai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B',
    provider: 'Mistral AI',
    category: '开源',
    size: '7B',
    description: 'Mistral 7B 模型，性能优秀且资源消耗低',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
    ollamaModel: 'mistral:7b-instruct-v0.3',
  },
  {
    id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    name: 'Mixtral 8x7B',
    provider: 'Mistral AI',
    category: '开源',
    size: '47B',
    description: 'MoE 架构模型，性能强大',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    ollamaModel: 'mixtral:8x7b-instruct-v0.1',
  },
  {
    id: 'mistralai/Mistral-Large-Instruct-2407',
    name: 'Mistral Large',
    provider: 'Mistral AI',
    category: '开源',
    size: '123B',
    description: 'Mistral 大型模型，旗舰级别性能',
    requires: ['vllm', 'openai-compatible'],
  },

  // Yi (零一万物) 系列
  {
    id: '01-ai/Yi-1.5-34B-Chat',
    name: 'Yi 1.5 34B',
    provider: '01.AI',
    category: '开源',
    size: '34B',
    description: '零一万物 Yi 1.5 模型，优秀的中英双语能力',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
  },
  {
    id: '01-ai/Yi-1.5-9B-Chat',
    name: 'Yi 1.5 9B',
    provider: '01.AI',
    category: '开源',
    size: '9B',
    description: '轻量级 Yi 模型，适合本地部署',
    requires: ['ollama', 'vllm', 'openai-compatible'],
  },

  // Baichuan (百川) 系列
  {
    id: 'baichuan-inc/Baichuan2-13B-Chat',
    name: 'Baichuan2 13B',
    provider: 'Baichuan',
    category: '开源',
    size: '13B',
    description: '百川智能模型，优秀的中文理解能力',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
  },
  {
    id: 'baichuan-inc/Baichuan2-7B-Chat',
    name: 'Baichuan2 7B',
    provider: 'Baichuan',
    category: '开源',
    size: '7B',
    description: '轻量级 Baichuan 模型',
    requires: ['ollama', 'vllm', 'openai-compatible'],
  },

  // ChatGLM (智谱) 系列
  {
    id: 'THUDM/chatglm3-6b',
    name: 'ChatGLM3 6B',
    provider: 'Tsinghua Zhipu',
    category: '开源',
    size: '6B',
    description: '清华智谱 ChatGLM3 模型',
    requires: ['ollama', 'vllm', 'openai-compatible'],
    examplePrompt: '请分析这段音乐的情绪和风格特征',
  },
  {
    id: 'THUDM/glm-4-9b-chat',
    name: 'GLM-4 9B',
    provider: 'Tsinghua Zhipu',
    category: '开源',
    size: '9B',
    description: '智谱 GLM-4 模型，性能优秀',
    requires: ['ollama', 'vllm', 'openai-compatible'],
  },
];

/**
 * 按提供商分组模型
 */
export const GROUP_MODELS_BY_PROVIDER: Record<string, LocalLLMModel[]> = {};

LOCAL_LLM_MODELS.forEach(model => {
  if (!GROUP_MODELS_BY_PROVIDER[model.provider]) {
    GROUP_MODELS_BY_PROVIDER[model.provider] = [];
  }
  GROUP_MODELS_BY_PROVIDER[model.provider].push(model);
});

/**
 * 按服务类型筛选模型
 */
export function filterModelsByService(serviceType: 'ollama' | 'vllm' | 'openai-compatible'): LocalLLMModel[] {
  return LOCAL_LLM_MODELS.filter(model =>
    !model.requires || model.requires.includes(serviceType)
  );
}

/**
 * 根据模型ID获取模型信息
 */
export function getModelById(modelId: string): LocalLLMModel | undefined {
  return LOCAL_LLM_MODELS.find(model => model.id === modelId);
}

/**
 * 获取推荐的模型（按性能和资源消耗平衡）
 */
export function getRecommendedModels(): LocalLLMModel[] {
  // 用户已安装的 Ollama 模型，按推荐程度排序
  return [
    // 推荐使用（小而快）
    getModelById('llama3:latest')!,
    getModelById('llama3.1:latest')!,
    getModelById('deepseek-r1:8b')!,
    getModelById('qwen2.5:7b')!,
    getModelById('mistral:7b')!,
    getModelById('deepseek-r1:7b')!,
    // 大模型（高性能）
    getModelById('deepseek-r1:32b')!,
    getModelById('gemma3:27b')!,
    getModelById('gpt-oss:20b')!,
    // 其他
    getModelById('qwen3-coder:latest')!,
    getModelById('qwen3-vl:30b')!,
    getModelById('gpt-oss:120b')!,
  ].filter(Boolean);
}

/**
 * 获取用户已安装的 Ollama 模型
 */
export function getInstalledOllamaModels(): LocalLLMModel[] {
  return [
    {
      id: 'llama3:latest',
      name: 'Llama 3',
      provider: 'Meta',
      category: '开源',
      size: '8.0B',
      description: 'Meta Llama 3 8B，通用模型，推荐首选',
      requires: ['ollama'],
      ollamaModel: 'llama3:latest',
    },
    {
      id: 'llama3.1:latest',
      name: 'Llama 3.1',
      provider: 'Meta',
      category: '开源',
      size: '8.0B',
      description: 'Meta Llama 3.1 8B，性能优化版',
      requires: ['ollama'],
      ollamaModel: 'llama3.1:latest',
    },
    {
      id: 'deepseek-r1:8b',
      name: 'DeepSeek R1 (8B)',
      provider: 'DeepSeek',
      category: '开源',
      size: '8.2B',
      description: 'DeepSeek 推理模型，逻辑能力强',
      requires: ['ollama'],
      ollamaModel: 'deepseek-r1:8b',
    },
    {
      id: 'qwen2.5:7b',
      name: 'Qwen 2.5 (7B)',
      provider: 'Alibaba',
      category: '开源',
      size: '7.6B',
      description: '通义千问 2.5，中文支持优秀',
      requires: ['ollama'],
      ollamaModel: 'qwen2.5:7b',
    },
    {
      id: 'mistral:7b',
      name: 'Mistral (7B)',
      provider: 'Mistral AI',
      category: '开源',
      size: '7.2B',
      description: 'Mistral 7B，性能优秀',
      requires: ['ollama'],
      ollamaModel: 'mistral:7b',
    },
    {
      id: 'deepseek-r1:7b',
      name: 'DeepSeek R1 (7B)',
      provider: 'DeepSeek',
      category: '开源',
      size: '7.6B',
      description: 'DeepSeek R1 轻量版',
      requires: ['ollama'],
      ollamaModel: 'deepseek-r1:7b',
    },
    {
      id: 'deepseek-r1:32b',
      name: 'DeepSeek R1 (32B)',
      provider: 'DeepSeek',
      category: '开源',
      size: '32.8B',
      description: 'DeepSeek R1 大参数版，推理能力强',
      requires: ['ollama'],
      ollamaModel: 'deepseek-r1:32b',
    },
    {
      id: 'gemma3:27b',
      name: 'Gemma 3 (27B)',
      provider: 'Google',
      category: '开源',
      size: '27.4B',
      description: 'Google Gemma 3，性能优秀',
      requires: ['ollama'],
      ollamaModel: 'gemma3:27b',
    },
    {
      id: 'gpt-oss:20b',
      name: 'GPT-OSS (20B)',
      provider: 'Open Source',
      category: '开源',
      size: '20.9B',
      description: 'GPT-OSS 20B，通用模型',
      requires: ['ollama'],
      ollamaModel: 'gpt-oss:20b',
    },
    {
      id: 'qwen3-coder:latest',
      name: 'Qwen3 Coder',
      provider: 'Alibaba',
      category: '开源',
      size: '30.5B',
      description: 'Qwen3 Coder，专注代码任务',
      requires: ['ollama'],
      ollamaModel: 'qwen3-coder:latest',
    },
    {
      id: 'qwen3-vl:30b',
      name: 'Qwen3 VL (30B)',
      provider: 'Alibaba',
      category: '开源',
      size: '31.1B',
      description: 'Qwen3 多模态视觉语言模型',
      requires: ['ollama'],
      ollamaModel: 'qwen3-vl:30b',
    },
    {
      id: 'gpt-oss:120b',
      name: 'GPT-OSS (120B)',
      provider: 'Open Source',
      category: '开源',
      size: '116.8B',
      description: 'GPT-OSS 120B，最大参数版本',
      requires: ['ollama'],
      ollamaModel: 'gpt-oss:120b',
    },
  ];
}

/**
 * 获取轻量级模型（适合资源受限环境）
 */
export function getLightweightModels(): LocalLLMModel[] {
  return LOCAL_LLM_MODELS.filter(model => {
    const size = model.size || '';
    const sizeNum = parseInt(size.replace(/\D/g, '')) || 0;
    return sizeNum <= 10;
  });
}

/**
 * 获取高性能模型（适合复杂任务）
 */
export function getHighPerformanceModels(): LocalLLMModel[] {
  return LOCAL_LLM_MODELS.filter(model => {
    const size = model.size || '';
    const sizeNum = parseInt(size.replace(/\D/g, '')) || 0;
    return sizeNum >= 32;
  });
}

/**
 * 搜索模型
 */
export function searchModels(keyword: string): LocalLLMModel[] {
  const lowerKeyword = keyword.toLowerCase();
  return LOCAL_LLM_MODELS.filter(model =>
    model.name.toLowerCase().includes(lowerKeyword) ||
    model.provider.toLowerCase().includes(lowerKeyword) ||
    model.id.toLowerCase().includes(lowerKeyword) ||
    model.description?.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * 根据服务类型获取正确的模型名称
 * Ollama使用特定的命名格式（如 qwen2.5:7b），而其他服务使用HuggingFace格式（如 Qwen/Qwen2.5-7B-Instruct）
 */
export function getModelNameForService(modelId: string, serviceType: 'ollama' | 'vllm' | 'openai-compatible' | 'auto'): string {
  const model = getModelById(modelId);

  if (!model) {
    return modelId;
  }

  // 如果是Ollama且模型有ollamaModel字段，使用Ollama专用名称
  if (serviceType === 'ollama' && model.ollamaModel) {
    return model.ollamaModel;
  }

  // 否则使用标准ID
  return model.id;
}
