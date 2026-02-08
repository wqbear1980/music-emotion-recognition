'use client';

import { useState, useEffect } from 'react';

interface PendingTerm {
  id: string;
  term: string;
  category: string;
  termType: string;
  synonyms: string[];
  filmTypes: string[];
  expansionSource: string;
  expansionReason: string;
  reviewStatus: string;
  reviewComment: string;
  createdAt: string;
  validationDetails?: {
    namingNormalized?: boolean;
    synonymsChecked?: boolean;
    conflictsResolved?: boolean;
    similarityChecked?: boolean;
    highestSimilarity?: number;
    recommendedAction?: string;
  };
}

interface SceneTermManagementProps {
  onClose?: () => void;
}

/**
 * 场景词库管理界面
 * 功能：
 * 1. 查看待审核的场景词列表
 * 2. 审核通过/拒绝场景词
 * 3. 初始化6类目标场景的核心词汇
 * 4. 查看扩充历史记录
 */
export default function SceneTermManagement({ onClose }: SceneTermManagementProps) {
  const [pendingTerms, setPendingTerms] = useState<PendingTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'scenario' | 'dubbing'>('all');
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // 获取待审核词列表
  const fetchPendingTerms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/term-management/list-pending-terms');
      const data = await response.json();

      if (data.success) {
        setPendingTerms(data.data);
      }
    } catch (error) {
      console.error('获取待审核词列表失败:', error);
      alert('获取待审核词列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 审核操作
  const reviewTerm = async (termId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/term-management/review-term', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termId,
          action,
          reviewComment: action === 'approve' ? '人工审核通过' : '人工审核拒绝'
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message || '审核成功');
        fetchPendingTerms();
      } else {
        alert(data.error || '审核失败');
      }
    } catch (error) {
      console.error('审核失败:', error);
      alert('审核失败');
    }
  };

  // 初始化目标场景词汇
  const initializeTargetScenes = async () => {
    try {
      if (!confirm('确定要初始化6类目标场景的核心词汇吗？\n这将添加30个核心词汇到词库中。')) {
        return;
      }

      const response = await fetch('/api/term-management/auto-expand-scene', {
        method: 'PUT'
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message || '初始化成功');
        fetchPendingTerms();
      } else {
        alert(data.error || '初始化失败');
      }
    } catch (error) {
      console.error('初始化失败:', error);
      alert('初始化失败');
    }
  };

  useEffect(() => {
    fetchPendingTerms();
  }, []);

  // 过滤待审核词列表
  const filteredTerms = pendingTerms.filter(term => {
    const statusMatch = filterStatus === 'all' || term.reviewStatus === filterStatus;
    const categoryMatch = filterCategory === 'all' || term.category === filterCategory;
    return statusMatch && categoryMatch;
  });

  const selectedTerm = selectedTermId ? pendingTerms.find(t => t.id === selectedTermId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-700">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-semibold text-white">场景词库管理</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 操作栏 */}
        <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-4">
            {/* 状态筛选 */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>

            {/* 分类筛选 */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部分类</option>
              <option value="scenario">场景词</option>
              <option value="dubbing">配音建议词</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchPendingTerms}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              刷新列表
            </button>
            <button
              onClick={initializeTargetScenes}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              初始化目标场景
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：词列表 */}
          <div className="w-1/2 overflow-y-auto p-4 border-r border-gray-700">
            {loading ? (
              <div className="text-center py-8 text-gray-400">加载中...</div>
            ) : filteredTerms.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {filterStatus === 'pending' ? '暂无待审核词汇' : '暂无词汇'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTerms.map((term) => (
                  <div
                    key={term.id}
                    onClick={() => {
                      setSelectedTermId(term.id);
                      setShowDetail(true);
                    }}
                    className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                      selectedTermId === term.id
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{term.term}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-300">
                            {term.category === 'scenario' ? '场景词' : '配音建议词'}
                          </span>
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-300">
                            {term.termType === 'core' ? '核心词' : '扩展词'}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            term.reviewStatus === 'pending' ? 'bg-yellow-600/20 text-yellow-300' :
                            term.reviewStatus === 'approved' ? 'bg-green-600/20 text-green-300' :
                            'bg-red-600/20 text-red-300'
                          }`}>
                            {term.reviewStatus === 'pending' ? '待审核' :
                             term.reviewStatus === 'approved' ? '已通过' : '已拒绝'}
                          </span>
                        </div>
                      </div>
                      {term.validationDetails?.highestSimilarity !== undefined && (
                        <div className="text-right">
                          <div className="text-xs text-gray-400">相似度</div>
                          <div className={`text-lg font-semibold ${
                            term.validationDetails.highestSimilarity >= 0.8 ? 'text-red-400' :
                            term.validationDetails.highestSimilarity >= 0.7 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {(term.validationDetails.highestSimilarity * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      来源：{term.expansionSource === 'ai-auto-expand' ? 'AI自动扩充' : '手动添加'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：词详情 */}
          <div className="w-1/2 overflow-y-auto p-4">
            {selectedTerm ? (
              <div className="space-y-4">
                {/* 基本信息 */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-3">{selectedTerm.term}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">分类：</span>
                      <span className="text-white">
                        {selectedTerm.category === 'scenario' ? '场景词' : '配音建议词'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">类型：</span>
                      <span className="text-white">
                        {selectedTerm.termType === 'core' ? '核心词' : '扩展词'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">审核状态：</span>
                      <span className={`${
                        selectedTerm.reviewStatus === 'pending' ? 'text-yellow-300' :
                        selectedTerm.reviewStatus === 'approved' ? 'text-green-300' :
                        'text-red-300'
                      }`}>
                        {selectedTerm.reviewStatus === 'pending' ? '待审核' :
                         selectedTerm.reviewStatus === 'approved' ? '已通过' : '已拒绝'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">来源：</span>
                      <span className="text-white">
                        {selectedTerm.expansionSource === 'ai-auto-expand' ? 'AI自动扩充' :
                         selectedTerm.expansionSource === 'ai-recommend' ? 'AI推荐' : '手动添加'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 近义词 */}
                {selectedTerm.synonyms && selectedTerm.synonyms.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-md font-semibold text-white mb-2">近义词</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTerm.synonyms.map((synonym, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full"
                        >
                          {synonym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 适配类型 */}
                {selectedTerm.filmTypes && selectedTerm.filmTypes.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-md font-semibold text-white mb-2">适配影视类型</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTerm.filmTypes.map((type, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-purple-600/20 text-purple-300 rounded-full"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 扩充理由 */}
                {selectedTerm.expansionReason && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-md font-semibold text-white mb-2">扩充理由</h4>
                    <p className="text-sm text-gray-300">{selectedTerm.expansionReason}</p>
                  </div>
                )}

                {/* 审核意见 */}
                {selectedTerm.reviewComment && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-md font-semibold text-white mb-2">审核意见</h4>
                    <p className="text-sm text-gray-300">{selectedTerm.reviewComment}</p>
                  </div>
                )}

                {/* 校验详情 */}
                {selectedTerm.validationDetails && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-md font-semibold text-white mb-2">校验详情</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">命名标准化：</span>
                        <span className={selectedTerm.validationDetails.namingNormalized ? 'text-green-300' : 'text-red-300'}>
                          {selectedTerm.validationDetails.namingNormalized ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">近义词检查：</span>
                        <span className={selectedTerm.validationDetails.synonymsChecked ? 'text-green-300' : 'text-red-300'}>
                          {selectedTerm.validationDetails.synonymsChecked ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">冲突解决：</span>
                        <span className={selectedTerm.validationDetails.conflictsResolved ? 'text-green-300' : 'text-red-300'}>
                          {selectedTerm.validationDetails.conflictsResolved ? '✓' : '✗'}
                        </span>
                      </div>
                      {selectedTerm.validationDetails.similarityChecked && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">相似度检查：</span>
                          <span className="text-green-300">✓</span>
                        </div>
                      )}
                      {selectedTerm.validationDetails.highestSimilarity !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">最高相似度：</span>
                          <span className={`${
                            selectedTerm.validationDetails.highestSimilarity >= 0.8 ? 'text-red-400' :
                            selectedTerm.validationDetails.highestSimilarity >= 0.7 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {(selectedTerm.validationDetails.highestSimilarity * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {selectedTerm.validationDetails.recommendedAction && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">推荐操作：</span>
                          <span className={`${
                            selectedTerm.validationDetails.recommendedAction === 'reject' ? 'text-red-400' :
                            selectedTerm.validationDetails.recommendedAction === 'review' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {selectedTerm.validationDetails.recommendedAction === 'reject' ? '拒绝' :
                             selectedTerm.validationDetails.recommendedAction === 'review' ? '需审核' : '接受'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-3">
                  {selectedTerm.reviewStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => reviewTerm(selectedTerm.id, 'approve')}
                        className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold"
                      >
                        ✓ 审核通过
                      </button>
                      <button
                        onClick={() => reviewTerm(selectedTerm.id, 'reject')}
                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
                      >
                        ✗ 拒绝
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                请从左侧选择一个词汇查看详情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
