'use client';

import { useState, useEffect } from 'react';
import { Settings, RefreshCw, Check, X, ChevronDown, ChevronRight, Zap, Search } from 'lucide-react';
import { LOCAL_LLM_MODELS, filterModelsByService, getRecommendedModels, getModelById, getModelNameForService, LocalLLMModel } from '@/lib/llmModels';

interface LLMConfig {
  current: {
    type: 'cloud' | 'local' | 'auto';
    provider: string;
    model: string;
    defaultTemperature: number;
    defaultStreaming: boolean;
  };
  summary: {
    llmType: string;
    cloudModel: string;
    localModel: string;
    localBaseUrl: string;
    temperature: string;
    streaming: string;
    thinking: string;
    caching: string;
  };
}

interface HealthCheckResult {
  success: boolean;
  healthy: boolean;
  message: string;
  details?: {
    service?: string;
    models?: string[];
    baseUrl?: string;
    response?: string;
    errorBody?: string;
  };
}

type LLMMode = 'cloud' | 'local' | 'auto';
type LocalLLMServiceType = 'ollama' | 'vllm' | 'openai-compatible';

interface LLMConfigPanelProps {
  onClose?: () => void;
}

export default function LLMConfigPanel({ onClose }: LLMConfigPanelProps) {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [selectedMode, setSelectedMode] = useState<LLMMode>('auto');
  const [healthStatus, setHealthStatus] = useState<HealthCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [localServiceType, setLocalServiceType] = useState<LocalLLMServiceType>('openai-compatible');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelSearchKeyword, setModelSearchKeyword] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [filteredModels, setFilteredModels] = useState<LocalLLMModel[]>([]);
  const [isTestingInference, setIsTestingInference] = useState(false);
  const [inferenceResult, setInferenceResult] = useState<string>('');
  const [showInferenceResult, setShowInferenceResult] = useState(false);
  const [isEditingBaseUrl, setIsEditingBaseUrl] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [manualModelList, setManualModelList] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [ngrokUrl, setNgrokUrl] = useState('');
  const [showNgrokSetup, setShowNgrokSetup] = useState(false);

  // 加载配置（优先从localStorage恢复配置）
  const loadConfig = async () => {
    setIsLoading(true);
    try {
      // 1. 首先从localStorage加载所有保存的配置
      const savedBaseUrl = localStorage.getItem('llm_custom_base_url');
      if (savedBaseUrl) {
        setCustomBaseUrl(savedBaseUrl);
      }

      const savedServiceType = localStorage.getItem('llm_service_type');
      if (savedServiceType) {
        setLocalServiceType(savedServiceType as LocalLLMServiceType);
      }

      const savedModel = localStorage.getItem('llm_model');
      if (savedModel) {
        setSelectedModel(savedModel);
      }

      const savedMode = localStorage.getItem('llm_mode');
      if (savedMode && ['cloud', 'local', 'auto'].includes(savedMode)) {
        setSelectedMode(savedMode as LLMMode);
      }

      // 加载 ngrok URL
      const savedNgrokUrl = localStorage.getItem('llm_ngrok_url');
      if (savedNgrokUrl) {
        setNgrokUrl(savedNgrokUrl);
      }

      // 2. 从后端获取配置（仅用于显示摘要和其他非localStorage存储的信息）
      const response = await fetch('/api/llm-config');
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
        // 3. 确保使用localStorage的模式，不被后端配置覆盖
        if (savedMode && ['cloud', 'local', 'auto'].includes(savedMode)) {
          setSelectedMode(savedMode as LLMMode);
        } else if (!selectedMode) {
          // 只有在没有localStorage配置时才使用后端默认值
          setSelectedMode(data.config.current.type);
        }
      }
    } catch (error) {
      console.error('加载LLM配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 检查健康状态
  const checkHealth = async (serviceType?: LocalLLMServiceType) => {
    setIsCheckingHealth(true);
    try {
      // 优先使用ngrok地址，否则使用本地地址
      const baseUrl = ngrokUrl.trim() || 'http://127.0.0.1:11434';
      const queryParams = new URLSearchParams({
        serviceType: 'ollama',
        baseUrl,
      });

      console.log('[健康检查] 使用地址:', baseUrl);

      const response = await fetch(`/api/llm-health?${queryParams}`);
      const data: HealthCheckResult = await response.json();
      setHealthStatus(data);

      // 如果健康检查成功，提取可用的模型列表
      if (data.success && data.healthy && data.details?.models) {
        console.log('[健康检查] 获取到的模型列表:', data.details.models);
        setAvailableModels(data.details.models);
      } else {
        console.log('[健康检查] 未获取到模型列表:', { success: data.success, healthy: data.healthy, details: data.details });
        setAvailableModels([]);
      }
    } catch (error) {
      setHealthStatus({
        success: false,
        healthy: false,
        message: '健康检查失败',
      });
      setAvailableModels([]);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // 切换模式
  const switchMode = async (mode: LLMMode) => {
    try {
      // 先保存到localStorage
      localStorage.setItem('llm_mode', mode);
      setSelectedMode(mode);

      // 通知后端（用于会话级配置）
      const response = await fetch('/api/llm-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: mode }),
      });

      const data = await response.json();
      if (data.success) {
        await loadConfig();
        if (mode === 'local') {
          await checkHealth();
        }
      }
    } catch (error) {
      console.error('切换LLM模式失败:', error);
    }
  };

  // 测试模型推理能力
  const testInference = async () => {
    if (!selectedModel) {
      alert('请先选择模型');
      return;
    }

    // 检查模型大小，给用户提示
    const modelInfo = getModelById(selectedModel);
    const modelSize = modelInfo?.size || '';
    const sizeNum = parseInt(modelSize.replace(/\D/g, '')) || 0;

    if (sizeNum >= 32) {
      const confirmed = confirm(
        `⚠️ 检测到您选择了大模型 (${modelInfo?.name})，推理可能需要较长时间（1-3分钟）。\n\n` +
        `原因：\n` +
        `• 32B以上参数模型推理速度较慢\n` +
        `• 首次使用可能需要加载模型到内存\n\n` +
        `建议：\n` +
        `• 如果只是测试，建议使用7B或14B模型\n` +
        `• 如果继续测试，请耐心等待，不要关闭页面\n\n` +
        `是否继续测试？`
      );

      if (!confirmed) {
        return;
      }
    }

    setIsTestingInference(true);
    setInferenceResult('');
    setShowInferenceResult(false);

    try {
      // 优先使用ngrok地址，否则使用本地地址
      const baseUrl = ngrokUrl.trim() || 'http://127.0.0.1:11434';
      console.log('[测试推理] 使用地址:', baseUrl);

      const response = await fetch('/api/llm-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType: 'ollama',
          baseUrl,
          model: selectedModel,
          prompt: '请用一句话介绍一下你自己。',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInferenceResult(data.details?.response || '测试成功，但没有返回内容');
        setShowInferenceResult(true);
      } else {
        // 检查是否是超时错误
        const isTimeoutError =
          data.error?.includes('aborted') ||
          data.error?.includes('timeout') ||
          data.message?.includes('超时');

        if (isTimeoutError) {
          alert('⏱️ 推理测试超时！\n\n可能的原因：\n• 模型过大，推理速度较慢\n• 首次使用需要加载模型到内存\n• ngrok隧道可能不稳定\n\n解决方案：\n1. 建议使用更小的模型（如7B或14B）\n2. 确保本地机器有足够的内存和GPU\n3. 检查Ollama是否正常运行\n4. 确保ngrok隧道正常工作');
        } else if (data.details?.errorBody) {
          alert('推理测试失败：' + data.message + '\n\n详细信息：\n' + data.details.errorBody.substring(0, 200));
        } else {
          alert('推理测试失败：' + data.message);
        }
      }
    } catch (error) {
      alert('推理测试失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsTestingInference(false);
    }
  };

  // 自动检测最佳提供者
  const autoDetect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/llm-config?action=auto-detect');
      const data = await response.json();
      if (data.success) {
        setSelectedMode(data.provider.type);
        await loadConfig();
        if (data.provider.type === 'local') {
          await checkHealth();
        }
      }
    } catch (error) {
      console.error('自动检测失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时加载配置并检查健康状态
  useEffect(() => {
    loadConfig();
    checkHealth();
  }, []);

  // 根据服务类型过滤模型
  useEffect(() => {
    if (localServiceType) {
      const models = filterModelsByService(localServiceType);
      setFilteredModels(models);

      // 如果当前选中的模型不在过滤后的列表中，重置选择
      const currentModel = getModelById(selectedModel);
      if (!currentModel || !currentModel.requires?.includes(localServiceType)) {
        const recommended = getRecommendedModels().find(m => m.requires?.includes(localServiceType));
        if (recommended) {
          setSelectedModel(recommended.id);
        } else if (models.length > 0) {
          setSelectedModel(models[0].id);
        }
      }
    }
  }, [localServiceType]);

  // 搜索模型
  useEffect(() => {
    const models = filterModelsByService(localServiceType);
    if (modelSearchKeyword.trim()) {
      const keyword = modelSearchKeyword.toLowerCase();
      const searched = models.filter(model =>
        model.name.toLowerCase().includes(keyword) ||
        model.provider.toLowerCase().includes(keyword) ||
        model.id.toLowerCase().includes(keyword) ||
        model.description?.toLowerCase().includes(keyword)
      );
      setFilteredModels(searched);
    } else {
      setFilteredModels(models);
    }
  }, [modelSearchKeyword, localServiceType]);

  // 调试：打印已安装模型和匹配情况
  useEffect(() => {
    if (availableModels.length > 0) {
      console.log('[调试] 已安装的模型列表:', availableModels);
      const recommended = getRecommendedModels();
      recommended.forEach(model => {
        const ollamaModelName = getModelNameForService(model.id, 'ollama');
        const isInstalled = availableModels.some(installedModel =>
          installedModel === ollamaModelName ||
          installedModel.startsWith(ollamaModelName + ':') ||
          installedModel === model.id ||
          installedModel.startsWith(model.id + ':')
        );
        console.log('[调试] 模型匹配:', {
          模型名称: model.name,
          模型ID: model.id,
          Ollama名称: ollamaModelName,
          是否已安装: isInstalled,
          匹配的已安装模型: availableModels.filter(installedModel =>
            installedModel === ollamaModelName ||
            installedModel.startsWith(ollamaModelName + ':') ||
            installedModel === model.id ||
            installedModel.startsWith(model.id + ':')
          )
        });
      });
    }
  }, [availableModels]);

  const getStatusColor = (healthy?: boolean) => {
    if (healthy === undefined) return 'bg-gray-500';
    return healthy ? 'bg-green-500' : 'bg-red-500';
  };

  const getModeDescription = (mode: LLMMode) => {
    switch (mode) {
      case 'cloud':
        return '使用云端豆包大模型，稳定可靠，适合生产环境';
      case 'local':
        return '使用本地部署的LLM，速度快，隐私好，需自行部署';
      case 'auto':
        return '自动检测本地LLM，优先使用本地，失败则切换云端';
      default:
        return '';
    }
  };

  const modeCards = [
    {
      mode: 'cloud' as LLMMode,
      title: '云端模式',
      icon: '☁️',
      description: '使用云端大模型',
      detail: '稳定可靠，无需本地部署'
    },
    {
      mode: 'local' as LLMMode,
      title: '本地模式',
      icon: '🏠',
      description: '使用本地LLM',
      detail: '速度快，隐私好，需自行部署'
    },
    {
      mode: 'auto' as LLMMode,
      title: '自动模式',
      icon: '🤖',
      description: '智能选择',
      detail: '优先本地，降级云端'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <Settings className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">LLM 配置</h2>
              <p className="text-sm text-gray-400">管理大语言模型配置</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* 当前状态 */}
        <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthStatus?.healthy)}`} />
              <div>
                <p className="text-sm font-medium text-white">
                  当前模式：{selectedMode === 'cloud' ? '云端' : selectedMode === 'local' ? '本地' : '自动'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {healthStatus?.healthy ? '服务正常运行' : healthStatus?.message || '检测中...'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => checkHealth(localServiceType)}
                disabled={isCheckingHealth}
                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                {isCheckingHealth ? '检查中' : '检查健康'}
              </button>
              <button
                onClick={autoDetect}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Zap className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? '检测中' : '自动检测'}
              </button>
            </div>
          </div>
        </div>

        {/* 模式选择 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">选择 LLM 模式</h3>
          <div className="grid grid-cols-3 gap-3">
            {modeCards.map((card) => (
              <button
                key={card.mode}
                onClick={() => switchMode(card.mode)}
                disabled={isLoading}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedMode === card.mode
                    ? 'border-purple-500 bg-purple-600/10'
                    : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="text-3xl mb-2">{card.icon}</div>
                <div className="text-sm font-semibold text-white mb-1">{card.title}</div>
                <div className="text-xs text-gray-400">{card.detail}</div>
                {selectedMode === card.mode && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-4 h-4 text-purple-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 text-sm text-gray-400">
            {getModeDescription(selectedMode)}
          </div>
        </div>

        {/* 本地服务配置 */}
        <div className="mb-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              {showDetails ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
              <span className="text-sm font-medium text-white">本地服务配置</span>
            </div>
            <span className="text-xs text-gray-500">展开详情</span>
          </button>

          {showDetails && (
            <div className="mt-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
              <div className="space-y-3">
                {/* 服务类型 - 固定为 Ollama */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">服务类型</label>
                  <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm">
                    Ollama
                  </div>
                  <p className="text-xs text-gray-500 mt-1">已固定为 Ollama 服务</p>
                </div>

                {/* 模型选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">选择模型</label>

                  {/* 模型选择提示 */}
                  <div className="mb-2 p-2 bg-blue-900/20 rounded-lg border border-blue-700/30">
                    <div className="text-xs text-blue-300">
                      <span className="font-medium">💡 推荐配置：</span>
                      <span className="ml-1">快速测试使用7B模型（如 qwen2.5:7b 或 deepseek-r1:7b），生产环境推荐14B及以上</span>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setShowModelSelector(!showModelSelector)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-left flex items-center justify-between"
                    >
                      <span>{getModelById(selectedModel)?.name || '选择模型...'}</span>
                      {showModelSelector ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>

                    {showModelSelector && (
                      <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                        {/* 搜索框 */}
                        <div className="p-3 border-b border-gray-700">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              placeholder="搜索模型名称或提供商..."
                              value={modelSearchKeyword}
                              onChange={(e) => setModelSearchKeyword(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>

                        {/* 推荐模型 */}
                        {!modelSearchKeyword && (
                          <div className="p-3 border-b border-gray-700">
                            <div className="text-xs font-medium text-gray-400 mb-2">
                              推荐模型
                              <span className="text-xs text-gray-500 ml-2">
                                {availableModels.length > 0 && `(${availableModels.length} 个已安装)`}
                              </span>
                            </div>
                            {availableModels.length === 0 && (
                              <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1.5 mb-2">
                                ⚠️ 未检测到已安装模型。请确保：
                                <ul className="mt-1 ml-4 list-disc">
                                  <li>Ollama服务已启动（运行 `ollama serve`）</li>
                                  <li>点击"测试连接"按钮刷新模型列表</li>
                                </ul>
                              </div>
                            )}
                            {getRecommendedModels()
                              .filter(m => !m.requires || m.requires.includes(localServiceType))
                              .map(model => {
                                // 使用 getModelNameForService 获取正确的 Ollama 模型名称进行匹配
                                const ollamaModelName = getModelNameForService(model.id, 'ollama');
                                // 检查是否已安装（支持精确匹配和带标签的模糊匹配）
                                const isInstalled = availableModels.some(installedModel =>
                                  installedModel === ollamaModelName ||
                                  installedModel.startsWith(ollamaModelName + ':') ||
                                  installedModel === model.id ||
                                  installedModel.startsWith(model.id + ':')
                                );
                                return (
                                  <button
                                    key={model.id}
                                    onClick={() => {
                                      setSelectedModel(model.id);
                                      localStorage.setItem('llm_model', model.id);
                                      setShowModelSelector(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left rounded-lg text-sm transition-colors mb-1 ${
                                      selectedModel === model.id
                                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                                        : isInstalled
                                          ? 'bg-green-600/10 text-green-300 border border-green-500/20'
                                          : 'bg-gray-800/50 text-gray-400 border border-gray-700/30'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {isInstalled ? (
                                          <Check className="w-4 h-4 text-green-400" />
                                        ) : (
                                          <X className="w-4 h-4 text-gray-500" />
                                        )}
                                        <span className={isInstalled ? 'text-green-200' : 'text-gray-400'}>
                                          {model.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">{model.size}</span>
                                        {isInstalled && (
                                          <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                            已安装
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 pl-6">{model.description}</div>
                                  </button>
                                );
                              })}
                          </div>
                        )}

                        {/* 所有模型 */}
                        <div className="p-3">
                          {filteredModels.length > 0 ? (
                            filteredModels.map(model => {
                              // 使用 getModelNameForService 获取正确的 Ollama 模型名称进行匹配
                              const ollamaModelName = getModelNameForService(model.id, 'ollama');
                              // 检查是否已安装（支持精确匹配和带标签的模糊匹配）
                              const isInstalled = availableModels.some(installedModel =>
                                installedModel === ollamaModelName ||
                                installedModel.startsWith(ollamaModelName + ':') ||
                                installedModel === model.id ||
                                installedModel.startsWith(model.id + ':')
                              );
                              return (
                                <button
                                  key={model.id}
                                  onClick={() => {
                                    setSelectedModel(model.id);
                                    localStorage.setItem('llm_model', model.id);
                                    setShowModelSelector(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left rounded-lg text-sm transition-colors mb-1 ${
                                    selectedModel === model.id
                                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                                      : isInstalled
                                        ? 'bg-green-600/10 text-green-300 border border-green-500/20'
                                        : 'bg-gray-800/50 text-gray-400 border border-gray-700/30'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isInstalled ? (
                                        <Check className="w-4 h-4 text-green-400" />
                                      ) : (
                                        <X className="w-4 h-4 text-gray-500" />
                                      )}
                                      <span className={isInstalled ? 'text-green-200' : 'text-gray-400'}>
                                        {model.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">{model.size || '-'}</span>
                                      {isInstalled && (
                                        <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                          已安装
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5 pl-6">
                                    {model.provider} • {model.category}
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="text-xs text-gray-500 text-center py-4">
                              未找到匹配的模型
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 当前选择模型的详细信息 */}
                {selectedModel && getModelById(selectedModel) && (
                  <div className="p-3 bg-purple-600/10 rounded-lg border border-purple-500/20">
                    <div className="text-sm font-medium text-purple-300 mb-1">
                      {getModelById(selectedModel)?.name}
                    </div>
                    <div className="text-xs text-gray-400 space-y-0.5">
                      <div>提供商: {getModelById(selectedModel)?.provider}</div>
                      <div>大小: {getModelById(selectedModel)?.size || '未知'}</div>
                      {getModelById(selectedModel)?.description && (
                        <div className="mt-1">{getModelById(selectedModel)?.description}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 基础URL */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">服务地址</label>
                    <button
                      onClick={() => setShowNgrokSetup(!showNgrokSetup)}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      {showNgrokSetup ? '▼ 收起' : '▶ 使用本地Ollama'}
                    </button>
                  </div>

                  {/* 显示当前使用的地址 */}
                  <div className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm">
                    {ngrokUrl.trim() ? (
                      <div className="text-green-400">
                        <span className="text-gray-500">ngrok:</span> {ngrokUrl}
                      </div>
                    ) : (
                      <div className="text-gray-400">
                        <span className="text-gray-500">本地:</span> http://127.0.0.1:11434
                      </div>
                    )}
                  </div>

                  {/* ngrok 设置说明 */}
                  {showNgrokSetup && (
                    <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs space-y-2">
                      <div className="font-medium text-blue-300 mb-2">🌐 使用本地 Ollama（通过 ngrok）</div>

                      <div className="space-y-2">
                        <div className="font-medium text-gray-300">步骤1：安装 ngrok</div>
                        <div className="text-gray-400">
                          访问 <code className="bg-gray-800 px-1 rounded">https://ngrok.com/download</code> 下载并安装
                        </div>

                        <div className="font-medium text-gray-300">步骤2：配置 ngrok（推荐）</div>
                        <div className="text-gray-400">
                          如果遇到403错误，先配置认证token：<br/>
                          <code className="bg-gray-800 px-1 rounded">ngrok config add-authtoken YOUR_TOKEN</code><br/>
                          获取token: 访问 <code className="bg-gray-800 px-1 rounded">https://dashboard.ngrok.com/get-started/your-authtoken</code>
                        </div>

                        <div className="font-medium text-gray-300">步骤3：启动 Ollama</div>
                        <div className="text-gray-400">
                          在你的本地终端运行：<br/>
                          <code className="bg-gray-800 px-1 rounded">ollama serve</code>
                        </div>

                        <div className="font-medium text-gray-300">步骤4：启动 ngrok</div>
                        <div className="text-gray-400">
                          在新终端运行：<br/>
                          <code className="bg-gray-800 px-1 rounded">ngrok http 11434</code>
                        </div>

                        <div className="font-medium text-gray-300">步骤5：复制 ngrok 地址</div>
                        <div className="text-gray-400">
                          ngrok 会显示一个公网地址，例如：<br/>
                          <code className="bg-gray-800 px-1 rounded">https://a1b2-c3d4.ngrok-free.app</code>
                        </div>

                        <div className="font-medium text-gray-300">步骤6：输入 ngrok 地址</div>
                        <div>
                          <input
                            type="text"
                            value={ngrokUrl}
                            onChange={(e) => {
                              setNgrokUrl(e.target.value);
                              localStorage.setItem('llm_ngrok_url', e.target.value);
                            }}
                            placeholder="例如: https://a1b2-c3d4.ngrok-free.app"
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="font-medium text-gray-300">步骤7：测试连接</div>
                        <div className="text-gray-400">
                          点击下方的"测试连接"按钮
                        </div>

                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded">
                          <div className="font-medium text-red-300 mb-1">⚠️ 遇到 403 Forbidden 错误？</div>
                          <div className="text-gray-400 space-y-1">
                            1. 配置 ngrok authtoken（见步骤2）<br/>
                            2. 重启 ngrok：<code className="bg-gray-800 px-1 rounded">ngrok http 11434</code><br/>
                            3. 检查 ngrok 版本：<code className="bg-gray-800 px-1 rounded">ngrok version</code>（建议 v3+）<br/>
                            4. 如果仍然失败，使用"手动添加已安装模型"功能
                          </div>
                        </div>

                        <div className="pt-2 border-t border-blue-500/30 text-yellow-300">
                          💡 提示：ngrok免费版每次重启会生成新地址，需要重新输入
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 测试按钮 */}
                <div className="space-y-2">
                  <button
                    onClick={() => checkHealth(localServiceType)}
                    disabled={isCheckingHealth}
                    className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                    测试连接
                  </button>

                  {/* Ollama 诊断提示 */}
                  {healthStatus && !healthStatus.healthy && (
                    <div className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded p-2">
                      <div className="font-medium mb-1">📋 Ollama 服务状态：</div>
                      <div className="mb-2">
                        <span className="text-red-300">⚠️ 检测失败：</span>{healthStatus.message}
                      </div>

                      {/* 403 错误的特殊处理 */}
                      {healthStatus.message.includes('403') || healthStatus.message.includes('Forbidden') ? (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded mb-2">
                          <div className="font-medium text-red-300 mb-1">🚫 403 Forbidden 错误</div>
                          <div className="text-gray-400 space-y-1">
                            <div>ngrok的安全限制阻止了请求。解决方案：</div>
                            <div className="ml-4">
                              1. 配置ngrok authtoken：<br/>
                              &nbsp;&nbsp;访问 <code className="bg-gray-800 px-1 rounded">https://dashboard.ngrok.com/get-started/your-authtoken</code><br/>
                              &nbsp;&nbsp;运行：<code className="bg-gray-800 px-1 rounded">ngrok config add-authtoken YOUR_TOKEN</code>
                            </div>
                            <div className="ml-4">
                              2. 重启ngrok：<code className="bg-gray-800 px-1 rounded">ngrok http 11434</code>
                            </div>
                            <div className="ml-4">
                              3. 如果仍然失败，使用"手动添加已安装模型"功能
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="font-medium mb-1">💡 其他解决方案：</div>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li><strong>方案1 - 确保Ollama运行：</strong>
                          <div className="ml-4 mt-1 text-gray-300">
                            运行：<code className="bg-gray-800 px-1 rounded">ollama serve</code><br/>
                            查看已安装模型：<code className="bg-gray-800 px-1 rounded">ollama list</code>
                          </div>
                        </li>
                        <li><strong>方案2 - 手动添加模型：</strong>
                          <div className="ml-4 mt-1 text-gray-300">
                            点击下方"手动添加已安装模型"<br/>
                            输入你的模型名称（每行一个）
                          </div>
                        </li>
                        <li><strong>方案3 - 测试连接：</strong>
                          <div className="ml-4 mt-1 text-gray-300">
                            在浏览器开发者工具运行：<br/>
                            <code className="bg-gray-800 px-1 rounded">fetch('{ngrokUrl.trim() || 'http://127.0.0.1:11434'}/api/tags').then(r=&gt;r.json()).then(console.log)</code>
                          </div>
                        </li>
                      </ol>
                      <div className="mt-2 text-yellow-300 border-t border-yellow-500/30 pt-2">
                        📌 提示：Web应用运行在沙箱环境中，需要通过ngrok等工具访问本地服务
                      </div>
                    </div>
                  )}

                  {/* 显示已安装的模型列表 */}
                  {availableModels.length > 0 && (
                    <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded p-2">
                      <div className="font-medium mb-1">✅ 已检测到 {availableModels.length} 个模型：</div>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {availableModels.map((model, idx) => (
                          <div key={idx} className="text-gray-300">• {model}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 手动添加已安装模型 */}
                  <div>
                    <button
                      onClick={() => setShowManualInput(!showManualInput)}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      {showManualInput ? '▼' : '▶'} 手动添加已安装模型（如果自动检测失败）
                    </button>
                    {showManualInput && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={manualModelList}
                          onChange={(e) => setManualModelList(e.target.value)}
                          placeholder="每行输入一个模型名称，例如：&#10;qwen2.5:7b&#10;deepseek-r1:7b&#10;llama3.1:8b"
                          className="w-full h-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => {
                            const models = manualModelList
                              .split('\n')
                              .map(m => m.trim())
                              .filter(m => m.length > 0);
                            if (models.length > 0) {
                              setAvailableModels([...availableModels, ...models]);
                              setManualModelList('');
                              setShowManualInput(false);
                              alert(`已添加 ${models.length} 个模型`);
                            }
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                        >
                          添加模型
                        </button>
                        <button
                          onClick={() => {
                            setManualModelList('');
                            setShowManualInput(false);
                          }}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 保存模型配置按钮 */}
                {selectedModel && (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          // 保存到 localStorage（包括模式）
                          localStorage.setItem('llm_mode', selectedMode);
                          localStorage.setItem('llm_service_type', localServiceType);
                          localStorage.setItem('llm_model', selectedModel);
                          if (customBaseUrl.trim()) {
                            localStorage.setItem('llm_custom_base_url', customBaseUrl.trim());
                          }

                          // 发送到后端（用于会话级配置）
                          const response = await fetch('/api/llm-config', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              type: selectedMode,
                              serviceType: localServiceType,
                              model: selectedModel,
                              baseUrl: customBaseUrl.trim() || undefined,
                            }),
                          });
                          const data = await response.json();
                          if (data.success) {
                            await loadConfig();
                            alert('配置已保存！（模式、服务类型、模型和服务地址）');
                          } else {
                            alert('保存失败：' + data.error);
                          }
                        } catch (error) {
                          alert('保存失败：' + (error instanceof Error ? error.message : '未知错误'));
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      保存配置
                    </button>
                    <button
                      onClick={testInference}
                      disabled={isTestingInference}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-4 h-4 ${isTestingInference ? 'animate-spin' : ''}`} />
                      {isTestingInference ? '测试中...' : '测试推理'}
                    </button>
                  </div>
                )}

                {/* 推理测试结果 */}
                {showInferenceResult && inferenceResult && (
                  <div className="p-3 bg-green-600/10 rounded-lg border border-green-500/20">
                    <div className="text-sm font-medium text-green-300 mb-1">推理测试结果</div>
                    <div className="text-xs text-gray-300 bg-gray-800/50 rounded p-2">
                      {inferenceResult}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 配置摘要 */}
        {config && (
          <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
            <h4 className="text-sm font-medium text-gray-300 mb-3">配置摘要</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500">当前模式：</span>
                <span className="text-gray-300">
                  {selectedMode === 'cloud' ? '云端' : selectedMode === 'local' ? '本地' : '自动'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">服务类型：</span>
                <span className="text-gray-300">Ollama</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">当前选择模型：</span>
                <span className="text-gray-300 font-medium">
                  {selectedModel ? getModelById(selectedModel)?.name || selectedModel : '未选择'}
                </span>
              </div>
              {selectedModel && getModelById(selectedModel) && (
                <>
                  <div>
                    <span className="text-gray-500">提供商：</span>
                    <span className="text-gray-300">{getModelById(selectedModel)?.provider}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">模型大小：</span>
                    <span className="text-gray-300">{getModelById(selectedModel)?.size || '未知'}</span>
                  </div>
                </>
              )}
              <div>
                <span className="text-gray-500">服务地址：</span>
                <span className="text-gray-300">http://127.0.0.1:11434</span>
              </div>
              <div>
                <span className="text-gray-500">温度：</span>
                <span className="text-gray-300">{config.summary.temperature}</span>
              </div>
              <div>
                <span className="text-gray-500">流式输出：</span>
                <span className="text-gray-300">{config.summary.streaming}</span>
              </div>
              <div>
                <span className="text-gray-500">缓存：</span>
                <span className="text-gray-300">{config.summary.caching}</span>
              </div>
            </div>
          </div>
        )}

        {/* 底部按钮 */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
