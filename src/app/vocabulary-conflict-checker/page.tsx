'use client';

import { useState } from 'react';

export default function VocabularyConflictCheckerPage() {
  const [category, setCategory] = useState<'mood' | 'style' | 'instruments' | 'standardScenes' | 'dubbingSuggestions'>('standardScenes');
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkConflict = async () => {
    if (!term.trim()) {
      alert('请输入要检测的词汇');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/check-vocabulary-conflict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'check_single',
          category,
          term: term.trim(),
        }),
      });

      const data = await response.json();
      setResult(data.result);
    } catch (error) {
      console.error('检测失败:', error);
      alert('检测失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const getStats = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/check-vocabulary-conflict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_stats',
        }),
      });

      const data = await response.json();
      setResult({ stats: data.stats });
    } catch (error) {
      console.error('获取统计失败:', error);
      alert('获取统计失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          词汇冲突检测工具
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            单个词汇冲突检测
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                词汇类别
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="mood">情绪词</option>
                <option value="style">音乐风格</option>
                <option value="instruments">乐器</option>
                <option value="standardScenes">标准场景词</option>
                <option value="dubbingSuggestions">配音建议词</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                待检测词汇
              </label>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="例如：追逐、雨夜童年回忆、飙车竞技"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={checkConflict}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? '检测中...' : '检测冲突'}
              </button>
              <button
                onClick={getStats}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? '获取中...' : '获取词库统计'}
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              检测结果
            </h2>

            {result.stats ? (
              <div className="space-y-2">
                <p className="text-gray-600">
                  <strong>情绪词：</strong> {result.stats.mood}
                </p>
                <p className="text-gray-600">
                  <strong>音乐风格：</strong> {result.stats.style}
                </p>
                <p className="text-gray-600">
                  <strong>乐器：</strong> {result.stats.instruments}
                </p>
                <p className="text-gray-600">
                  <strong>标准场景词：</strong> {result.stats.standardScenes}
                </p>
                <p className="text-gray-600">
                  <strong>配音建议词：</strong> {result.stats.dubbingSuggestions}
                </p>
              </div>
            ) : result.hasConflict ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 font-semibold mb-2">
                  ⚠️ 检测到冲突
                </p>
                <p className="text-red-700">
                  <strong>冲突类型：</strong> {result.conflictType}
                </p>
                {result.conflictingTerms && result.conflictingTerms.length > 0 && (
                  <p className="text-red-700">
                    <strong>冲突词汇：</strong> {result.conflictingTerms.join(', ')}
                  </p>
                )}
                <p className="text-red-700 mt-2">{result.message}</p>
                {result.suggestion && (
                  <p className="text-red-700 mt-2">
                    <strong>建议：</strong> 使用标准词 "{result.suggestion}"
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 font-semibold mb-2">
                  ✅ 无冲突
                </p>
                <p className="text-green-700">{result.message}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            使用说明
          </h2>
          <div className="space-y-3 text-gray-600">
            <p>
              <strong>单个词汇冲突检测：</strong>
              输入要检测的词汇，系统会检查该词汇是否与标准词库形成近义/同义关系。
            </p>
            <p>
              <strong>冲突类型：</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                <strong>exact_match：</strong> 完全匹配（词汇已在词库中）
              </li>
              <li>
                <strong>synonym：</strong> 近义词（词汇是现有标准词的近义词）
              </li>
              <li>
                <strong>partial_match：</strong> 包含关系（词汇与标准词存在包含关系）
              </li>
              <li>
                <strong>near_synonym：</strong> 近义相似（词汇与现有近义词语义相似）
              </li>
            </ul>
            <p>
              <strong>词库统计：</strong>
              点击"获取词库统计"按钮，查看当前各类别词汇的数量。
            </p>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            核心规则 - 词汇扩充三大原则
          </h2>
          <div className="space-y-3 text-gray-600">
            <p>
              <strong>1. 场景自主命名</strong>
              <br />
              当遇到未收录的具体场景时，可以自主命名（如"雨夜童年回忆"、"街头飙车竞技"）。
              <br />
              自主命名必须保证场景名称的唯一性，不能与现有标准词形成近义关系。
            </p>
            <p>
              <strong>2. 词汇扩量不重复</strong>
              <br />
              允许新增符合逻辑的全新词汇（场景、音乐风格、情绪、配音建议等）。
              <br />
              但同一语义维度下仅保留1个核心表述。
              <br />
              严格限制近义词、同义词、语言相似的表述。
            </p>
            <p>
              <strong>3. 示例说明</strong>
              <br />
              ✅ 正确：已用"追逐"则不再用"追击""追赶""追跑"；已用"打斗"则不再用"搏斗""厮打"
              <br />
              ❌ 错误：不要推荐"追击"作为候选词（这是"追逐"的近义词）
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
