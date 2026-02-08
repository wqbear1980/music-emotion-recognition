'use client';

import React from 'react';
import { getTermHelpCard } from '@/lib/tutorialSystem';

interface TermHelpCardProps {
  term: string;
  category: 'mood' | 'style' | 'filmType' | 'scenario' | 'instrument';
  onClose: () => void;
}

export default function TermHelpCard({ term, category, onClose }: TermHelpCardProps) {
  const card = getTermHelpCard(term, category);

  if (!card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700 max-w-lg">
          <div className="text-center">
            <div className="text-4xl mb-4">❓</div>
            <p className="text-gray-300 mb-4">未找到术语 "{term}" 的帮助信息</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  const categoryLabels = {
    mood: '情绪',
    style: '风格',
    filmType: '影片类型',
    scenario: '场景',
    instrument: '乐器'
  };

  const categoryColors = {
    mood: 'from-pink-500/20 to-purple-500/20 border-pink-500/30',
    style: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    filmType: 'from-green-500/20 to-teal-500/20 border-green-500/30',
    scenario: 'from-orange-500/20 to-yellow-500/20 border-orange-500/30',
    instrument: 'from-red-500/20 to-pink-500/20 border-red-500/30'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
        {/* 标题栏 */}
        <div className={`px-6 py-4 bg-gradient-to-r ${categoryColors[category]} border-b border-gray-700`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 mb-1">
                {categoryLabels[category]}术语
              </div>
              <h2 className="text-2xl font-bold text-white">{card.term}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="关闭"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 定义 */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              定义
            </h3>
            <p className="text-gray-300 leading-relaxed pl-6">{card.definition}</p>
          </div>

          {/* 典型案例 */}
          {card.examples && card.examples.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                典型案例
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {card.examples.map((example, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-300 border border-gray-700"
                  >
                    {example}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 使用场景 */}
          {card.usage && card.usage.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-green-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                使用场景
              </h3>
              <div className="flex flex-wrap gap-2">
                {card.usage.map((usage, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30"
                  >
                    {usage}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 相关术语 */}
          {card.relatedTerms && card.relatedTerms.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                相关术语
              </h3>
              <div className="flex flex-wrap gap-2">
                {card.relatedTerms.map((term, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm border border-yellow-500/30"
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 使用技巧 */}
          {card.tips && card.tips.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                使用技巧
              </h3>
              <div className="space-y-2">
                {card.tips.map((tip, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 px-4 py-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20"
                  >
                    <span className="text-cyan-400 font-bold">{index + 1}.</span>
                    <span className="text-gray-300 text-sm">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-800 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors font-medium"
          >
            了解了
          </button>
        </div>
      </div>
    </div>
  );
}
