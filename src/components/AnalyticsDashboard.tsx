'use client';

import React, { useState, useEffect } from 'react';

interface FeedbackStats {
  overall: {
    totalFeedbacks: number;
    correctCount: number;
    incorrectCount: number;
    partialCount: number;
    processedCount: number;
    accuracyRate: string;
    avgQualityScore: string | null;
  };
  accuracyByFilmType: Array<{
    filmType: string;
    accuracyRate: string;
    totalFeedbacks: number;
  }>;
  accuracyByMood: Array<{
    mood: string;
    accuracyRate: string;
    totalFeedbacks: number;
  }>;
  commonErrors: Array<{
    field: string;
    incorrectValue: string;
    correctValue: string;
    frequency: number;
  }>;
  accuracyTrend: Array<{
    date: string;
    count: number;
    correct: number;
    accuracyRate: string;
  }>;
}

interface AnalyticsDashboardProps {
  onClose?: () => void;
}

export default function AnalyticsDashboard({ onClose }: AnalyticsDashboardProps) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user-feedback/stats');
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || '加载统计数据失败');
      }
    } catch (err: any) {
      setError(err.message || '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <div className="bg-gray-900 rounded-2xl p-12 border border-gray-700">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-300">加载统计数据中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <div className="bg-gray-900 rounded-2xl p-8 border border-red-500/30 max-w-lg">
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={loadStats}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="bg-gray-900 rounded-2xl w-[95vw] max-w-7xl max-h-[90vh] overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
        {/* 标题栏 */}
        <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-600 to-pink-600">
          <div>
            <h2 className="text-2xl font-bold text-white">数据分析仪表盘</h2>
            <p className="text-sm text-purple-100">AI识别准确率统计</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 总体统计 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">总体统计</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                label="总反馈数"
                value={stats.overall.totalFeedbacks}
                color="purple"
              />
              <StatCard
                label="识别准确"
                value={stats.overall.correctCount}
                color="green"
              />
              <StatCard
                label="需要修正"
                value={stats.overall.incorrectCount}
                color="red"
              />
              <StatCard
                label="部分正确"
                value={stats.overall.partialCount}
                color="yellow"
              />
              <StatCard
                label="准确率"
                value={`${stats.overall.accuracyRate}%`}
                color="blue"
                highlight
              />
              <StatCard
                label="已处理"
                value={stats.overall.processedCount}
                color="gray"
              />
            </div>
          </div>

          {/* 准确率趋势 */}
          {stats.accuracyTrend.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">
                准确率趋势（最近30天）
                <span className="text-sm font-normal text-gray-400 ml-2">悬停柱状图查看详情</span>
              </h3>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                {/* 图例 */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-xs text-gray-400">≥80% 优秀</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span className="text-xs text-gray-400">≥60% 良好</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span className="text-xs text-gray-400">&lt;60% 待提升</span>
                  </div>
                </div>

                {/* Y轴刻度 */}
                <div className="relative mb-2">
                  <div className="absolute left-0 top-0 transform -translate-y-1/2 -translate-x-1 text-xs text-gray-500">
                    100%
                  </div>
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 text-xs text-gray-500">
                    50%
                  </div>
                  <div className="absolute left-0 bottom-0 transform translate-y-1/2 -translate-x-1 text-xs text-gray-500">
                    0%
                  </div>
                  {/* 参考线 */}
                  <div className="border-t border-dashed border-gray-700 absolute top-0 left-4 right-0"></div>
                  <div className="border-t border-dashed border-gray-700 absolute top-1/2 left-4 right-0"></div>
                  <div className="border-t border-gray-700 absolute bottom-0 left-4 right-0"></div>
                </div>

                {/* 柱状图 */}
                <div className="relative" style={{ height: '160px' }}>
                  <div className="flex items-end gap-0.5 h-full ml-4">
                    {stats.accuracyTrend.map((item, index) => {
                      const accuracyRate = parseFloat(item.accuracyRate);
                      // 计算高度，最大160px对应100%
                      const height = Math.max(4, (accuracyRate / 100) * 160);

                      // 根据准确率选择颜色
                      const bgColor = accuracyRate >= 80
                        ? 'bg-green-500 hover:bg-green-400'
                        : accuracyRate >= 60
                        ? 'bg-yellow-500 hover:bg-yellow-400'
                        : 'bg-red-500 hover:bg-red-400';

                      // 每隔5天显示一次日期标签
                      const showDate = index % 5 === 0 || index === stats.accuracyTrend.length - 1;

                      return (
                        <div
                          key={index}
                          className={`flex-1 rounded-t transition-colors relative group ${bgColor}`}
                          style={{ height: `${height}px`, minWidth: '8px' }}
                        >
                          {/* 悬停提示 */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900/95 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">
                            <div className="font-semibold mb-1">{item.date}</div>
                            <div className="text-green-400">准确率: {item.accuracyRate}%</div>
                            <div className="text-gray-400">反馈数: {item.count}</div>
                            <div className="text-blue-400">正确数: {item.correct}</div>
                            {/* 三角形箭头 */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></div>
                          </div>

                          {/* 日期标签 */}
                          {showDate && (
                            <div
                              className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] text-gray-500 whitespace-nowrap"
                              style={{ display: index % 5 === 0 ? 'block' : 'block' }}
                            >
                              {new Date(item.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 按影片类型统计 */}
          {stats.accuracyByFilmType.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">按影片类型统计</h3>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="space-y-3">
                  {stats.accuracyByFilmType.map((item, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-300">{item.filmType}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm">{item.totalFeedbacks} 次反馈</span>
                          <span className={`font-medium ${
                            parseFloat(item.accuracyRate) >= 80 ? 'text-green-400' :
                            parseFloat(item.accuracyRate) >= 60 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {item.accuracyRate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            parseFloat(item.accuracyRate) >= 80 ? 'bg-green-500' :
                            parseFloat(item.accuracyRate) >= 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${item.accuracyRate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 按情绪统计 */}
          {stats.accuracyByMood.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">按情绪统计（Top 10）</h3>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {stats.accuracyByMood.map((item, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        parseFloat(item.accuracyRate) >= 80
                          ? 'bg-green-500/10 border-green-500/30'
                          : parseFloat(item.accuracyRate) >= 60
                          ? 'bg-yellow-500/10 border-yellow-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      <div className="text-sm text-gray-400 mb-1">{item.mood}</div>
                      <div className="text-lg font-medium text-white">{item.accuracyRate}%</div>
                      <div className="text-xs text-gray-500">{item.totalFeedbacks} 次反馈</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 常见错误 */}
          {stats.commonErrors.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">常见错误</h3>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="space-y-3">
                  {stats.commonErrors.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                            {item.field}
                          </span>
                          <span className="text-red-300 line-through">{item.incorrectValue}</span>
                          <span className="text-green-300">→</span>
                          <span className="text-green-300">{item.correctValue}</span>
                        </div>
                      </div>
                      <div className="text-gray-400 text-sm ml-4">
                        {item.frequency} 次
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            数据实时更新
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({ label, value, color, highlight }: { label: string; value: number | string; color: string; highlight?: boolean }) {
  const getColorClasses = (color: string, highlight: boolean) => {
    const baseClasses = 'rounded-lg p-4 border';
    if (highlight) {
      return `${baseClasses} bg-gradient-to-br from-${color}-500 to-${color}-600 text-white shadow-lg`;
    }
    return `${baseClasses} bg-${color}-500/10 border-${color}-500/30`;
  };

  return (
    <div className={getColorClasses(color, highlight || false)}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-white' : `text-${color}-300`}`}>
        {value}
      </div>
    </div>
  );
}
