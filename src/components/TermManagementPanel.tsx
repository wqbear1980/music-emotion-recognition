'use client';

import { useState, useEffect } from 'react';

export interface UnrecognizedTerm {
  id: string;
  term: string;
  category: string;
  occurrenceCount: number;
  relatedFilmTypes?: { filmType: string; count: number }[];
  expansionStatus: string;
  createdAt: string;
}

export interface StandardTerm {
  id: string;
  term: string;
  category: string;
  termType: string;
  filmTypes?: string[];
  synonyms?: string[];
  isAutoExpanded: boolean;
  expansionSource?: string;
  expansionReason?: string;
  reviewStatus: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  usageCount: number;
  createdAt: string;
}

export default function TermManagementPanel() {
  // 标签页切换
  const [activeTab, setActiveTab] = useState<'unrecognized' | 'expand' | 'review' | 'library' | 'add-term'>('unrecognized');

  // 未识别内容统计
  const [unrecognizedTerms, setUnrecognizedTerms] = useState<UnrecognizedTerm[]>([]);
  const [eligibleTerms, setEligibleTerms] = useState<UnrecognizedTerm[]>([]);
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [minFrequency, setMinFrequency] = useState(10);

  // 自动扩充
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionResults, setExpansionResults] = useState<any>(null);

  // 待审核词
  const [pendingTerms, setPendingTerms] = useState<StandardTerm[]>([]);
  const [isReviewLoading, setIsReviewLoading] = useState(false);

  // 词库查询
  const [libraryTerms, setLibraryTerms] = useState<StandardTerm[]>([]);
  const [libraryFilter, setLibraryFilter] = useState({
    category: '',
    termType: '',
    reviewStatus: '',
    keyword: '',
  });
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);

  // 手动添加新词
  const [newTerm, setNewTerm] = useState({
    term: '',
    category: 'scenario' as 'scenario' | 'dubbing',
    termType: 'extended' as 'core' | 'extended',
    synonyms: [] as string[],
    filmTypes: [] as string[],
    reason: '',
  });
  const [isAddingTerm, setIsAddingTerm] = useState(false);
  const [synonymInput, setSynonymInput] = useState('');
  const [filmTypeInput, setFilmTypeInput] = useState('');

  // 一键转正功能
  const [showApproveDirectlyDialog, setShowApproveDirectlyDialog] = useState(false);
  const [approvingTerm, setApprovingTerm] = useState<UnrecognizedTerm | null>(null);
  const [isSuggestingTerms, setIsSuggestingTerms] = useState(false);
  const [suggestedTerms, setSuggestedTerms] = useState<any[]>([]);
  const [selectedStandardTerm, setSelectedStandardTerm] = useState('');
  const [isApprovingDirectly, setIsApprovingDirectly] = useState(false);
  const [customStandardTerm, setCustomStandardTerm] = useState('');

  // 加载未识别内容统计
  const loadUnrecognizedStats = async () => {
    setIsStatsLoading(true);
    try {
      const res = await fetch(`/api/term-management/stats-unrecognized?minFrequency=${minFrequency}`);
      const data = await res.json();
      if (data.success && data.data?.eligibleTerms) {
        setUnrecognizedTerms(
          data.data.eligibleTerms.filter(
            (t: UnrecognizedTerm) => t.expansionStatus === 'eligible'
          )
        );
        setEligibleTerms(data.data.eligibleTerms);
      } else {
        setUnrecognizedTerms([]);
        setEligibleTerms([]);
      }
    } catch (error) {
      console.error('加载未识别内容统计失败:', error);
      setUnrecognizedTerms([]);
      setEligibleTerms([]);
    } finally {
      setIsStatsLoading(false);
    }
  };

  // 触发自动扩充
  const handleAutoExpand = async () => {
    if (selectedTermIds.length === 0) {
      alert('请先选择要扩充的术语');
      return;
    }

    if (!confirm(`确定要自动扩充 ${selectedTermIds.length} 个术语吗？`)) {
      return;
    }

    setIsExpanding(true);
    try {
      const res = await fetch('/api/term-management/auto-expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termIds: selectedTermIds,
          minFrequency,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setExpansionResults(data.data);
        alert(data.message);
        loadUnrecognizedStats();
        loadPendingTerms();
      } else {
        alert(`扩充失败: ${data.error}`);
      }
    } catch (error) {
      console.error('自动扩充失败:', error);
      alert('自动扩充失败');
    } finally {
      setIsExpanding(false);
    }
  };

  // 加载待审核词
  const loadPendingTerms = async () => {
    setIsReviewLoading(true);
    try {
      const res = await fetch('/api/term-management/review?reviewStatus=pending');
      const data = await res.json();
      if (data.success && data.data?.records) {
        setPendingTerms(data.data.records);
      } else {
        setPendingTerms([]);
      }
    } catch (error) {
      console.error('加载待审核词失败:', error);
      setPendingTerms([]);
    } finally {
      setIsReviewLoading(false);
    }
  };

  // 审核操作
  const handleReview = async (termIds: string[], action: 'approve' | 'reject', comment?: string) => {
    try {
      const res = await fetch('/api/term-management/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termIds,
          action,
          reviewer: 'admin',
          comment,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadPendingTerms();
      } else {
        alert(`审核失败: ${data.error}`);
      }
    } catch (error) {
      console.error('审核失败:', error);
      alert('审核失败');
    }
  };

  // 加载词库
  const loadLibrary = async () => {
    setIsLibraryLoading(true);
    try {
      const params = new URLSearchParams();
      if (libraryFilter.category) params.append('category', libraryFilter.category);
      if (libraryFilter.termType) params.append('termType', libraryFilter.termType);
      if (libraryFilter.reviewStatus) params.append('reviewStatus', libraryFilter.reviewStatus);
      if (libraryFilter.keyword) params.append('keyword', libraryFilter.keyword);

      const res = await fetch(`/api/term-management/query?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data?.terms) {
        setLibraryTerms(data.data.terms);
      } else {
        setLibraryTerms([]);
      }
    } catch (error) {
      console.error('加载词库失败:', error);
      setLibraryTerms([]);
    } finally {
      setIsLibraryLoading(false);
    }
  };

  // 初始化
  useEffect(() => {
    if (activeTab === 'unrecognized') {
      loadUnrecognizedStats();
    } else if (activeTab === 'review') {
      loadPendingTerms();
    } else if (activeTab === 'library') {
      loadLibrary();
    }
  }, [activeTab, libraryFilter]);

  // 手动添加新词的辅助函数
  const handleAddSynonym = () => {
    if (synonymInput.trim() && !newTerm.synonyms.includes(synonymInput.trim())) {
      setNewTerm({
        ...newTerm,
        synonyms: [...newTerm.synonyms, synonymInput.trim()]
      });
      setSynonymInput('');
    }
  };

  const handleRemoveSynonym = (index: number) => {
    setNewTerm({
      ...newTerm,
      synonyms: newTerm.synonyms.filter((_, i) => i !== index)
    });
  };

  const handleAddFilmType = () => {
    if (filmTypeInput.trim() && !newTerm.filmTypes.includes(filmTypeInput.trim())) {
      setNewTerm({
        ...newTerm,
        filmTypes: [...newTerm.filmTypes, filmTypeInput.trim()]
      });
      setFilmTypeInput('');
    }
  };

  const handleRemoveFilmType = (index: number) => {
    setNewTerm({
      ...newTerm,
      filmTypes: newTerm.filmTypes.filter((_, i) => i !== index)
    });
  };

  const handleSubmitNewTerm = async () => {
    if (!newTerm.term || !newTerm.reason) {
      alert('请填写标准词名称和添加理由');
      return;
    }

    if (newTerm.synonyms.length === 0) {
      if (!confirm('您没有提供近义词清单，是否继续提交？')) {
        return;
      }
    }

    if (newTerm.filmTypes.length === 0) {
      if (!confirm('您没有指定适配的影视类型，是否继续提交？')) {
        return;
      }
    }

    setIsAddingTerm(true);
    try {
      const response = await fetch('/api/term-management/add-candidate-term', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: newTerm.term,
          category: newTerm.category,
          termType: newTerm.termType,
          synonyms: newTerm.synonyms,
          filmTypes: newTerm.filmTypes,
          reason: newTerm.reason,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('新词已提交审核，审核通过后将加入词库！');
        // 重置表单
        setNewTerm({
          term: '',
          category: 'scenario',
          termType: 'extended',
          synonyms: [],
          filmTypes: [],
          reason: '',
        });
        setSynonymInput('');
        setFilmTypeInput('');
      } else {
        alert(`提交失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('提交新词失败:', error);
      alert('提交失败，请重试');
    } finally {
      setIsAddingTerm(false);
    }
  };

  // 一键转正功能：打开对话框
  const handleOpenApproveDirectlyDialog = (term: UnrecognizedTerm) => {
    setApprovingTerm(term);
    setShowApproveDirectlyDialog(true);
    setSuggestedTerms([]);
    setSelectedStandardTerm('');
    setCustomStandardTerm('');
    // 自动调用AI推荐
    handleSuggestStandardTerms(term);
  };

  // AI推荐候选标准词
  const handleSuggestStandardTerms = async (term: UnrecognizedTerm) => {
    setIsSuggestingTerms(true);
    try {
      const response = await fetch('/api/term-management/suggest-standard-term', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unrecognizedTerm: term.term,
          category: term.category as 'scenario' | 'dubbing',
          filmTypes: term.relatedFilmTypes?.map(f => f.filmType) || [],
          occurrenceCount: term.occurrenceCount,
        }),
      });

      const data = await response.json();
      if (data.success && data.data?.recommendations) {
        setSuggestedTerms(data.data.recommendations);
        // 自动选择置信度最高的候选词
        if (data.data.recommendations.length > 0) {
          setSelectedStandardTerm(data.data.recommendations[0].term);
        }
      } else {
        alert(`推荐失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('推荐标准词失败:', error);
      alert('推荐失败，请重试');
    } finally {
      setIsSuggestingTerms(false);
    }
  };

  // 执行一键转正
  const handleApproveDirectly = async () => {
    if (!approvingTerm || !selectedStandardTerm) {
      alert('请选择标准词');
      return;
    }

    if (!confirm(`确定将"${approvingTerm.term}"转正为标准词"${selectedStandardTerm}"吗？`)) {
      return;
    }

    setIsApprovingDirectly(true);
    try {
      const response = await fetch('/api/term-management/approve-directly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: approvingTerm.term,
          standardTerm: selectedStandardTerm,
          category: approvingTerm.category as 'scenario' | 'dubbing',
          termType: 'extended',
          filmTypes: approvingTerm.relatedFilmTypes?.map(f => f.filmType) || [],
          synonyms: [approvingTerm.term], // 将原词作为近义词
          reason: '用户手动一键转正',
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setShowApproveDirectlyDialog(false);
        // 重新加载列表
        loadUnrecognizedStats();
        // 【词库管理】通知父组件刷新标准词库
        if ((window as any).refreshStandardVocabulary) {
          console.log('[词库管理] 一键转正完成后刷新词库...');
          await (window as any).refreshStandardVocabulary();
        }
      } else {
        alert(`转正失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('一键转正失败:', error);
      alert('转正失败，请重试');
    } finally {
      setIsApprovingDirectly(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 标签页切换 */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 flex-wrap">
        <button
          onClick={() => setActiveTab('unrecognized')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'unrecognized'
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          }`}
        >
          未识别内容统计
        </button>
        <button
          onClick={() => setActiveTab('expand')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'expand'
              ? 'bg-green-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          }`}
        >
          自动扩充
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'review'
              ? 'bg-yellow-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          }`}
        >
          待审核词
          {pendingTerms.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {pendingTerms.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'library'
              ? 'bg-purple-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          }`}
        >
          词库查询
        </button>
        <button
          onClick={() => setActiveTab('add-term')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'add-term'
              ? 'bg-orange-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          }`}
        >
          手动添加新词
        </button>
      </div>

      {/* 未识别内容统计 */}
      {activeTab === 'unrecognized' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">最低出现次数</label>
                <input
                  type="number"
                  value={minFrequency}
                  onChange={(e) => setMinFrequency(parseInt(e.target.value))}
                  className="w-24 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={loadUnrecognizedStats}
                disabled={isStatsLoading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isStatsLoading ? '统计中...' : '开始统计'}
              </button>
            </div>
            <div className="text-sm text-gray-400">
              找到 {eligibleTerms.length} 个符合扩充条件的内容
            </div>
          </div>

          <div className="space-y-2">
            {eligibleTerms.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {isStatsLoading ? '正在统计中...' : '暂无符合扩充条件的内容'}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {eligibleTerms.map((term) => (
                  <div
                    key={term.id}
                    className="flex items-start gap-3 p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTermIds.includes(term.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTermIds([...selectedTermIds, term.id]);
                        } else {
                          setSelectedTermIds(selectedTermIds.filter(id => id !== term.id));
                        }
                      }}
                      className="mt-1 w-4 h-4 rounded border-white/20 bg-white/10"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{term.term}</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300">
                          {term.category === 'dubbing' ? '配音建议' : '场景建议'}
                        </span>
                        <span className="text-sm text-yellow-400">
                          出现 {term.occurrenceCount} 次
                        </span>
                      </div>
                      {term.relatedFilmTypes && term.relatedFilmTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {term.relatedFilmTypes.slice(0, 5).map((item) => (
                            <span
                              key={item.filmType}
                              className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300"
                            >
                              {item.filmType} ({item.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 一键转正按钮 */}
                    <button
                      onClick={() => handleOpenApproveDirectlyDialog(term)}
                      className="px-3 py-1.5 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors border border-purple-500/30 flex items-center gap-1"
                      title="AI推荐标准词并一键转正"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      一键转正
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedTermIds.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <span className="text-green-300">已选择 {selectedTermIds.length} 个术语</span>
              <button
                onClick={handleAutoExpand}
                disabled={isExpanding}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isExpanding ? '扩充中...' : '开始自动扩充'}
              </button>
            </div>
          )}

          {expansionResults && expansionResults.expandedTerms && (
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <h4 className="font-semibold text-blue-300 mb-2">扩充结果</h4>
              <div className="space-y-2">
                {expansionResults.expandedTerms.map((result: any) => (
                  <div key={result.originalTerm} className="text-sm">
                    <span className="text-white">{result.originalTerm}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="text-green-300">{result.standardTerm}</span>
                    <span className="ml-2 text-gray-400">
                      (清洗了 {result.cleanedCount} 条历史数据)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 自动扩充 */}
      {activeTab === 'expand' && (
        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">自动扩充流程</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">1</div>
                <span>统计未识别内容，筛选高频出现的内容（≥{minFrequency}次）</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">2</div>
                <span>校验触发条件（频率门槛、匹配门槛、无冲突门槛）</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">3</div>
                <span>标准化命名（去除冗余后缀）和近义词检查</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">4</div>
                <span>添加到标准词库（扩展词），标记为自动扩充</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">5</div>
                <span>清洗历史数据，将未识别内容替换为标准词</span>
              </div>
            </div>
          </div>

          {eligibleTerms.length > 0 ? (
            <div className="text-center">
              <button
                onClick={() => setActiveTab('unrecognized')}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
              >
                前往未识别内容统计 ({eligibleTerms.length} 个待扩充)
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              暂无可扩充内容，请先进行未识别内容统计
            </div>
          )}
        </div>
      )}

      {/* 待审核词 */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">待审核词 ({pendingTerms.length})</h3>
            <button
              onClick={loadPendingTerms}
              disabled={isReviewLoading}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isReviewLoading ? '刷新中...' : '刷新列表'}
            </button>
          </div>

          <div className="space-y-2">
            {pendingTerms.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {isReviewLoading ? '加载中...' : '暂无待审核词'}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {pendingTerms.map((term) => (
                  <div
                    key={term.id}
                    className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{term.term}</span>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300">
                            {term.category === 'dubbing' ? '配音' : '场景'}
                          </span>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300">
                            {term.termType === 'core' ? '核心词' : '扩展词'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          出现 {term.usageCount} 次
                          {term.isAutoExpanded && (
                            <span className="ml-2 text-blue-400">（自动扩充）</span>
                          )}
                        </div>
                        {term.filmTypes && term.filmTypes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {term.filmTypes.map((filmType) => (
                              <span
                                key={filmType}
                                className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300"
                              >
                                {filmType}
                              </span>
                            ))}
                          </div>
                        )}
                        {term.synonyms && term.synonyms.length > 0 && (
                          <div className="text-sm text-gray-400 mt-2">
                            近义词: {term.synonyms.join(', ')}
                          </div>
                        )}
                        {term.expansionReason && (
                          <div className="text-sm text-gray-400 mt-2">
                            {term.expansionReason}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview([term.id], 'approve', '审核通过')}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReview([term.id], 'reject', '审核拒绝')}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                        >
                          拒绝
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 词库查询 */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">分类</label>
              <select
                value={libraryFilter.category}
                onChange={(e) => setLibraryFilter({ ...libraryFilter, category: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">全部</option>
                <option value="dubbing">配音建议</option>
                <option value="scenario">场景建议</option>
                <option value="emotion">情绪</option>
                <option value="style">风格</option>
                <option value="instruments">乐器</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">词类型</label>
              <select
                value={libraryFilter.termType}
                onChange={(e) => setLibraryFilter({ ...libraryFilter, termType: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">全部</option>
                <option value="core">核心词</option>
                <option value="extended">扩展词</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">审核状态</label>
              <select
                value={libraryFilter.reviewStatus}
                onChange={(e) => setLibraryFilter({ ...libraryFilter, reviewStatus: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">全部</option>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">关键词</label>
              <input
                type="text"
                value={libraryFilter.keyword}
                onChange={(e) => setLibraryFilter({ ...libraryFilter, keyword: e.target.value })}
                placeholder="搜索术语..."
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="text-sm text-gray-400">
            共 {libraryTerms.length} 个标准词
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {libraryTerms.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {isLibraryLoading ? '加载中...' : '暂无数据'}
              </div>
            ) : (
              (libraryTerms || []).map((term) => (
                <div
                  key={term.id}
                  className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{term.term}</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300">
                          {term.category === 'dubbing' ? '配音' : term.category === 'scenario' ? '场景' : term.category}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300">
                          {term.termType === 'core' ? '核心' : '扩展'}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            term.reviewStatus === 'approved'
                              ? 'bg-blue-500/20 text-blue-300'
                              : term.reviewStatus === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {term.reviewStatus === 'approved' ? '已通过' : term.reviewStatus === 'pending' ? '待审核' : '已拒绝'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        使用 {term.usageCount} 次
                        {term.isAutoExpanded && (
                          <span className="ml-2 text-blue-400">（自动扩充）</span>
                        )}
                      </div>
                      {term.filmTypes && term.filmTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {term.filmTypes.map((filmType) => (
                            <span
                              key={filmType}
                              className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300"
                            >
                              {filmType}
                            </span>
                          ))}
                        </div>
                      )}
                      {term.synonyms && term.synonyms.length > 0 && (
                        <div className="text-sm text-gray-400 mt-2">
                          近义词: {term.synonyms.join(', ')}
                        </div>
                      )}
                    </div>
                    {term.reviewedBy && (
                      <div className="text-sm text-gray-400">
                        审核人: {term.reviewedBy}
                        <br />
                        {term.reviewedAt && (
                          <span className="text-xs">
                            {new Date(term.reviewedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 手动添加新词 */}
      {activeTab === 'add-term' && (
        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">手动添加新词</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <p>直接添加新的标准词到词库，需要经过人工审核。</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                  ⚠️ 重要提示
                </span>
                <span>添加新词必须确保：1）不是现有标准词的近义词；2）提供合理的近义词清单；3）明确适配的影视类型</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">标准词名称 *</label>
                <input
                  type="text"
                  value={newTerm.term}
                  onChange={(e) => setNewTerm({ ...newTerm, term: e.target.value })}
                  placeholder="如：设伏陷阱"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">分类 *</label>
                <select
                  value={newTerm.category}
                  onChange={(e) => setNewTerm({ ...newTerm, category: e.target.value as 'scenario' | 'dubbing' })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="scenario">场景词</option>
                  <option value="dubbing">配音建议词</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">词类型 *</label>
              <select
                value={newTerm.termType}
                onChange={(e) => setNewTerm({ ...newTerm, termType: e.target.value as 'core' | 'extended' })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500"
              >
                <option value="core">核心词（高频使用，80%覆盖）</option>
                <option value="extended">扩展词（低频使用，20%覆盖）</option>
              </select>
            </div>

            {/* 近义词 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">近义词清单</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={synonymInput}
                  onChange={(e) => setSynonymInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSynonym()}
                  placeholder="输入近义词后按回车添加"
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleAddSynonym}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  添加
                </button>
              </div>
              {newTerm.synonyms.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newTerm.synonyms.map((synonym, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm flex items-center gap-2"
                    >
                      {synonym}
                      <button
                        onClick={() => handleRemoveSynonym(idx)}
                        className="hover:text-red-300"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 影视类型 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">适配的影视类型</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filmTypeInput}
                  onChange={(e) => setFilmTypeInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddFilmType()}
                  placeholder="输入影视类型后按回车添加"
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleAddFilmType}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  添加
                </button>
              </div>
              {newTerm.filmTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newTerm.filmTypes.map((filmType, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm flex items-center gap-2"
                    >
                      {filmType}
                      <button
                        onClick={() => handleRemoveFilmType(idx)}
                        className="hover:text-red-300"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 添加理由 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">添加理由 *</label>
              <textarea
                value={newTerm.reason}
                onChange={(e) => setNewTerm({ ...newTerm, reason: e.target.value })}
                placeholder="说明为什么需要这个词，以及它的使用场景"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 min-h-[80px]"
                rows={3}
              />
            </div>

            {/* 提交按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleSubmitNewTerm}
                disabled={isAddingTerm || !newTerm.term || !newTerm.reason}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isAddingTerm ? '提交中...' : '提交审核'}
              </button>
              <button
                onClick={() => {
                  setNewTerm({
                    term: '',
                    category: 'scenario',
                    termType: 'extended',
                    synonyms: [],
                    filmTypes: [],
                    reason: '',
                  });
                  setSynonymInput('');
                  setFilmTypeInput('');
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一键转正候选词选择对话框 */}
      {showApproveDirectlyDialog && approvingTerm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">一键转正</h3>
                <button
                  onClick={() => setShowApproveDirectlyDialog(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                为非标准词"<span className="text-yellow-400 font-semibold">{approvingTerm.term}</span>"选择标准词
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* AI推荐候选词 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    AI推荐的标准词
                  </label>
                  <button
                    onClick={() => handleSuggestStandardTerms(approvingTerm)}
                    disabled={isSuggestingTerms}
                    className="px-3 py-1 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
                  >
                    {isSuggestingTerms ? '推荐中...' : '重新推荐'}
                  </button>
                </div>
                {suggestedTerms.length === 0 && !isSuggestingTerms ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    暂无推荐词，请点击"重新推荐"或手动输入
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {suggestedTerms.map((rec, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedStandardTerm(rec.term)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                          selectedStandardTerm === rec.term
                            ? 'bg-purple-500/20 border-purple-500'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-white">{rec.term}</span>
                          <div className="flex items-center gap-2">
                            {rec.isExisting && (
                              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-300 rounded-full">
                                现有标准词
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              置信度: {rec.confidence}%
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">{rec.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 手动输入标准词 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  或手动输入标准词
                </label>
                <input
                  type="text"
                  value={customStandardTerm}
                  onChange={(e) => {
                    setCustomStandardTerm(e.target.value);
                    setSelectedStandardTerm(e.target.value);
                  }}
                  placeholder="输入或选择标准词名称"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* 关联信息 */}
              {approvingTerm.relatedFilmTypes && approvingTerm.relatedFilmTypes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    关联影视类型
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {approvingTerm.relatedFilmTypes.map((item) => (
                      <span
                        key={item.filmType}
                        className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300"
                      >
                        {item.filmType} ({item.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setShowApproveDirectlyDialog(false)}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleApproveDirectly}
                disabled={isApprovingDirectly || !selectedStandardTerm}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isApprovingDirectly ? '转正中...' : '确认转正'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
