'use client';

import React, { useState, useEffect } from 'react';

interface ErrorAnalysis {
  type: 'network' | 'audio' | 'ai' | 'database' | 'validation' | 'unknown';
  title: string;
  description: string;
  solution: string[];
  prevention: string[];
  relatedErrors: string[];
}

interface ErrorPanelProps {
  error?: Error | string | null;
  context?: {
    fileName?: string;
    operation?: string;
    details?: Record<string, any>;
  };
  onClose?: () => void;
}

export default function ErrorPanel({ error = null, context, onClose }: ErrorPanelProps) {
  const [analysis, setAnalysis] = useState<ErrorAnalysis | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (error) {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const analyzedError = analyzeError(errorMessage, context);
      setAnalysis(analyzedError);
    }
  }, [error, context]);

  // 如果没有错误信息，显示错误处理帮助页面
  if (!error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
          {/* 标题栏 */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚠️</span>
                <div>
                  <h2 className="text-xl font-bold text-white">错误处理系统</h2>
                  <div className="text-xs text-gray-400">智能诊断与解决方案</div>
                </div>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="关闭"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* 系统介绍 */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                关于错误处理系统
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">
                本系统提供智能错误诊断和解决方案，帮助您快速定位问题并找到解决办法。
                系统会自动分析错误类型，提供针对性的解决步骤和预防措施。
              </p>
            </div>

            {/* 错误类型分类 */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-green-300 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                支持的错误类型
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🌐</span>
                    <span className="font-semibold text-red-300">网络错误</span>
                  </div>
                  <p className="text-gray-400 text-xs">连接失败、请求超时、服务器无响应等网络相关问题</p>
                </div>

                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🎵</span>
                    <span className="font-semibold text-yellow-300">音频错误</span>
                  </div>
                  <p className="text-gray-400 text-xs">文件格式不支持、音频解码失败、文件损坏等问题</p>
                </div>

                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🤖</span>
                    <span className="font-semibold text-purple-300">AI错误</span>
                  </div>
                  <p className="text-gray-400 text-xs">模型响应异常、分析失败、结果解析错误等AI相关问题</p>
                </div>

                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">💾</span>
                    <span className="font-semibold text-blue-300">数据库错误</span>
                  </div>
                  <p className="text-gray-400 text-xs">连接失败、查询错误、数据保存失败等数据库操作问题</p>
                </div>

                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">✅</span>
                    <span className="font-semibold text-green-300">验证错误</span>
                  </div>
                  <p className="text-gray-400 text-xs">数据格式错误、参数无效、必填项缺失等验证相关问题</p>
                </div>

                <div className="p-4 bg-gray-500/10 rounded-lg border border-gray-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">❓</span>
                    <span className="font-semibold text-gray-300">未知错误</span>
                  </div>
                  <p className="text-gray-400 text-xs">无法分类的其他类型错误，提供通用解决方案</p>
                </div>
              </div>
            </div>

            {/* 使用说明 */}
            <div>
              <h3 className="text-lg font-semibold text-orange-300 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                如何使用
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">1</span>
                  <div>
                    <p className="text-gray-300 text-sm font-medium">自动触发</p>
                    <p className="text-gray-400 text-xs mt-1">系统在检测到错误时，会自动显示错误处理面板，分析错误类型并提供解决方案。</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">2</span>
                  <div>
                    <p className="text-gray-300 text-sm font-medium">手动查看</p>
                    <p className="text-gray-400 text-xs mt-1">点击页面右上角的"⚠️ 错误处理"按钮，可随时打开此面板查看错误处理帮助。</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">3</span>
                  <div>
                    <p className="text-gray-300 text-sm font-medium">查看详情</p>
                    <p className="text-gray-400 text-xs mt-1">在具体的错误面板中，可以查看详细错误信息、解决方案和预防措施。</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">4</span>
                  <div>
                    <p className="text-gray-300 text-sm font-medium">预防措施</p>
                    <p className="text-gray-400 text-xs mt-1">参考系统提供的预防措施，可以避免类似的错误再次发生。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const errorTypeColors = {
    network: 'from-red-500/20 to-orange-500/20 border-red-500/30 text-red-300',
    audio: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-300',
    ai: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300',
    database: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300',
    validation: 'from-green-500/20 to-teal-500/20 border-green-500/30 text-green-300',
    unknown: 'from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-300'
  };

  const errorTypeIcons = {
    network: '🌐',
    audio: '🎵',
    ai: '🤖',
    database: '💾',
    validation: '✅',
    unknown: '❓'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
        {/* 标题栏 */}
        <div className={`px-6 py-4 bg-gradient-to-r ${errorTypeColors[analysis.type]} border-b border-gray-700`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{errorTypeIcons[analysis.type]}</span>
              <div>
                <div className="text-xs text-gray-400">
                  错误类型: {analysis.type.toUpperCase()}
                </div>
                <h2 className="text-xl font-bold text-white">{analysis.title}</h2>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="关闭"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 错误描述 */}
          <div className="mb-6">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-red-400 flex-shrink-0 text-2xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-300 mb-2">发生了什么问题</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{analysis.description}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 解决方案 */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-green-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              如何解决
            </h3>
            <div className="space-y-2">
              {analysis.solution.map((solution, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 px-4 py-3 bg-green-500/10 rounded-lg border border-green-500/20"
                >
                  <span className="bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-gray-300 text-sm">{solution}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 预防措施 */}
          {analysis.prevention && analysis.prevention.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                如何预防
              </h3>
              <div className="space-y-2">
                {analysis.prevention.map((prevention, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 px-4 py-3 bg-blue-500/10 rounded-lg border border-blue-500/20"
                  >
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300 text-sm">{prevention}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 相关错误 */}
          {analysis.relatedErrors && analysis.relatedErrors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                可能相关的错误
              </h3>
              <div className="space-y-2">
                {analysis.relatedErrors.map((related, index) => (
                  <div
                    key={index}
                    className="px-4 py-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20"
                  >
                    <span className="text-yellow-300 text-sm">{related}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 详细错误信息 */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              查看详细错误信息
            </button>

            {showDetails && (
              <div className="mt-3 p-4 bg-gray-800 rounded-lg border border-gray-700 font-mono text-xs text-gray-400">
                <div className="mb-2">
                  <span className="text-purple-400">错误消息:</span>
                  <div className="mt-1 pl-2">{typeof error === 'string' ? error : error.message}</div>
                </div>
                {context && (
                  <div className="space-y-1 mt-3 pt-3 border-t border-gray-700">
                    {context.fileName && (
                      <div>
                        <span className="text-blue-400">文件:</span> {context.fileName}
                      </div>
                    )}
                    {context.operation && (
                      <div>
                        <span className="text-green-400">操作:</span> {context.operation}
                      </div>
                    )}
                    {context.details && Object.keys(context.details).length > 0 && (
                      <div>
                        <span className="text-yellow-400">详情:</span>
                        <pre className="mt-1 pl-2 overflow-x-auto">
                          {JSON.stringify(context.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            错误ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-colors font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 智能分析错误类型和提供解决方案
 */
function analyzeError(errorMsg: string, context?: any): ErrorAnalysis {
  const errorLower = errorMsg.toLowerCase();

  // 网络错误
  if (
    errorLower.includes('network') ||
    errorLower.includes('fetch') ||
    errorLower.includes('timeout') ||
    errorLower.includes('connection') ||
    errorLower.includes('请求失败')
  ) {
    return {
      type: 'network',
      title: '网络连接错误',
      description: '系统无法连接到服务器或API服务，可能是网络问题或服务器暂时不可用。',
      solution: [
        '检查您的网络连接是否正常',
        '尝试刷新页面重新加载',
        '如果问题持续，可能是服务器繁忙，请稍后再试',
        '确认防火墙或代理设置未阻止请求'
      ],
      prevention: [
        '保持稳定的网络连接',
        '避免在网络不稳定时进行大批量操作',
        '定期检查系统状态'
      ],
      relatedErrors: ['API服务超时', '服务器错误500', 'DNS解析失败']
    };
  }

  // 音频处理错误
  if (
    errorLower.includes('audio') ||
    errorLower.includes('decode') ||
    errorLower.includes('format') ||
    errorLower.includes('音频') ||
    errorLower.includes('解码')
  ) {
    return {
      type: 'audio',
      title: '音频处理错误',
      description: '系统无法正确处理音频文件，可能是格式不支持或文件损坏。',
      solution: [
        '确认上传的是支持的音频格式（MP3, WAV, OGG, FLAC）',
        '检查音频文件是否完整且未损坏',
        '尝试使用其他音频转换工具重新编码',
        '如果是大文件，尝试分段上传'
      ],
      prevention: [
        '使用常见的音频格式（MP3, WAV）',
        '确保音频文件完整无损',
        '避免使用加密或受版权保护的音频文件'
      ],
      relatedErrors: ['格式不支持', '音频解码失败', '文件损坏']
    };
  }

  // AI分析错误
  if (
    errorLower.includes('ai') ||
    errorLower.includes('model') ||
    errorLower.includes('分析') ||
    errorLower.includes('识别') ||
    errorLower.includes('analysis')
  ) {
    return {
      type: 'ai',
      title: 'AI分析错误',
      description: 'AI模型在分析过程中遇到问题，可能是音频特征不明显或模型响应异常。',
      solution: [
        '尝试使用其他更清晰的音频文件',
        '检查音频质量是否足够（建议时长至少5秒）',
        '如果音频包含人声，尝试使用纯音乐版本',
        '等待几分钟后重试，可能是服务繁忙'
      ],
      prevention: [
        '使用清晰、质量较高的音频文件',
        '确保音频时长足够（建议10秒以上）',
        '避免使用混合多种风格的复杂音频'
      ],
      relatedErrors: ['特征提取失败', '模型超时', '识别结果为空']
    };
  }

  // 数据库错误
  if (
    errorLower.includes('database') ||
    errorLower.includes('db') ||
    errorLower.includes('sql') ||
    errorLower.includes('存储') ||
    errorLower.includes('数据库')
  ) {
    return {
      type: 'database',
      title: '数据库错误',
      description: '系统在存储或读取数据时遇到问题，可能是数据库连接或操作异常。',
      solution: [
        '稍后重试，可能是临时连接问题',
        '检查数据库服务是否正常运行',
        '如果问题持续，请联系管理员',
        '尝试清除浏览器缓存后重试'
      ],
      prevention: [
        '定期备份数据',
        '避免在高峰期进行大量数据操作',
        '保持系统更新到最新版本'
      ],
      relatedErrors: ['连接超时', '写入失败', '查询错误']
    };
  }

  // 验证错误
  if (
    errorLower.includes('validation') ||
    errorLower.includes('invalid') ||
    errorLower.includes('required') ||
    errorLower.includes('缺少') ||
    errorLower.includes('验证')
  ) {
    return {
      type: 'validation',
      title: '数据验证错误',
      description: '提交的数据不符合要求，请检查输入内容是否完整和正确。',
      solution: [
        '检查所有必填字段是否已填写',
        '确认输入格式正确（如日期、数字等）',
        '查看具体的错误提示信息',
        '重新填写并提交'
      ],
      prevention: [
        '仔细阅读表单说明',
        '按照示例格式填写数据',
        '提交前检查所有字段'
      ],
      relatedErrors: ['缺少必填字段', '格式不正确', '值超出范围']
    };
  }

  // 未知错误
  return {
    type: 'unknown',
    title: '未知错误',
    description: '系统遇到了一个未预期的错误。我们的技术团队会尽快分析和解决这个问题。',
    solution: [
      '尝试刷新页面',
      '清除浏览器缓存和Cookie',
      '检查是否使用了兼容的浏览器（推荐Chrome或Firefox）',
      '如果问题持续，请联系技术支持并提供错误详情'
    ],
    prevention: [
      '使用推荐的浏览器版本',
      '保持浏览器插件更新',
      '避免同时运行多个相似的任务'
    ],
    relatedErrors: ['系统错误', '内部错误', '异常']
  };
}
