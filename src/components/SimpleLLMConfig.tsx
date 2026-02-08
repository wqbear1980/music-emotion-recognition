'use client';

import { useState } from 'react';
import { RefreshCw, Check, X, Loader2 } from 'lucide-react';

interface SimpleLLMConfigProps {
  onClose?: () => void;
}

export default function SimpleLLMConfig({ onClose }: SimpleLLMConfigProps) {
  const [ollamaUrl, setOllamaUrl] = useState('http://127.0.0.1:11434');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedModels, setConnectedModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [error, setError] = useState('');

  // 连接Ollama并获取模型列表
  const connectOllama = async () => {
    setIsConnecting(true);
    setError('');

    try {
      console.log('[前端] 正在连接Ollama:', ollamaUrl);

      // 如果是演示模式（使用特殊地址）
      if (ollamaUrl === 'demo') {
        // 模拟延迟
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 返回模拟数据
        const mockModels = ['qwen2.5:7b', 'deepseek-r1:7b', 'llama3.1:8b'];
        setConnectedModels(mockModels);
        setSelectedModel(mockModels[0]);
        localStorage.setItem('ollama_url', ollamaUrl);
        localStorage.setItem('ollama_models', JSON.stringify(mockModels));
        localStorage.setItem('ollama_selected_model', mockModels[0]);
        setError('');
        setIsConnecting(false);
        return;
      }

      const response = await fetch(`/api/ollama/connect?url=${encodeURIComponent(ollamaUrl)}`);
      const data = await response.json();

      console.log('[前端] 连接结果:', data);

      if (data.success && data.models) {
        setConnectedModels(data.models);
        localStorage.setItem('ollama_url', ollamaUrl);
        localStorage.setItem('ollama_models', JSON.stringify(data.models));

        if (data.models.length === 0) {
          setError('✅ 已连接到Ollama，但没有找到任何模型。\n\n请先安装模型，例如：\nollama pull qwen2.5:7b\nollama pull deepseek-r1:7b');
        } else {
          // 自动选择第一个模型
          setSelectedModel(data.models[0]);
          localStorage.setItem('ollama_selected_model', data.models[0]);
          setError('');
        }
      } else {
        setError(`❌ 连接失败：\n${data.error}`);
        setConnectedModels([]);
      }
    } catch (err) {
      console.error('[前端] 连接错误:', err);
      setError(`❌ 连接失败：${err instanceof Error ? err.message : '未知错误'}`);
      setConnectedModels([]);
    } finally {
      setIsConnecting(false);
    }
  };

  // 选择模型
  const selectModel = (modelName: string) => {
    setSelectedModel(modelName);
    localStorage.setItem('ollama_selected_model', modelName);
  };

  // 组件加载时恢复配置
  useState(() => {
    const savedUrl = localStorage.getItem('ollama_url');
    const savedModels = localStorage.getItem('ollama_models');
    const savedSelectedModel = localStorage.getItem('ollama_selected_model');

    if (savedUrl) setOllamaUrl(savedUrl);
    if (savedModels) setConnectedModels(JSON.parse(savedModels));
    if (savedSelectedModel) setSelectedModel(savedSelectedModel);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md max-h-[80vh] overflow-y-auto">
        {/* 标题 */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">🤖 本地Ollama配置</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 配置区域 */}
        <div className="p-4 space-y-4">
          {/* Ollama地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ollama服务地址
            </label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              本地Ollama默认地址是 http://127.0.0.1:11434
              <span className="text-blue-400 ml-2">💡 输入 "demo" 可测试界面功能</span>
            </p>
          </div>

          {/* 连接按钮 */}
          <button
            onClick={connectOllama}
            disabled={isConnecting}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                连接中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                连接Ollama
              </>
            )}
          </button>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 whitespace-pre-line">
              {error}
            </div>
          )}

          {/* 模型列表 */}
          {connectedModels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                已找到 {connectedModels.length} 个模型
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {connectedModels.map((modelName) => (
                  <button
                    key={modelName}
                    onClick={() => selectModel(modelName)}
                    className={`w-full px-3 py-2 text-left rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      selectedModel === modelName
                        ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    {selectedModel === modelName && <Check className="w-4 h-4 text-green-400" />}
                    {modelName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 提示信息 */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
            <div className="font-medium mb-1">💡 使用说明：</div>
            <ol className="list-decimal ml-4 space-y-1">
              <li>在本地终端运行：<code className="bg-gray-800 px-1 rounded">ollama serve</code></li>
              <li>如果使用ngrok，输入ngrok地址（如 https://xxx.ngrok-free.app）</li>
              <li>点击"连接Ollama"获取模型列表</li>
              <li>选择要使用的模型</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
