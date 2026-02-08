'use client';

import { useState } from 'react';

interface CategoryDetailCardProps {
  title: string;
  icon: string;
  color: string;
  data: Array<{ label: string; count: number; details?: Array<{ label: string; count: number }> }>;
  onItemClick?: (label: string) => void;
  onFilterClick?: (label: string) => void;
  maxVisible?: number;
  aggregateThreshold?: number;
  aggregateLabel?: string;
  categoryType?: 'emotion' | 'film' | 'scenario' | 'instrument' | 'style';
}

export default function CategoryDetailCard({
  title,
  icon,
  color,
  data,
  onItemClick,
  onFilterClick,
  maxVisible = 15,
  aggregateThreshold = 3,
  aggregateLabel = '其他',
  categoryType,
}: CategoryDetailCardProps) {
  const [showAll, setShowAll] = useState(false);
  const [showOtherDetails, setShowOtherDetails] = useState(false);

  // 为特定分类创建独立的展开状态
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

  // 切换风格分类的展开状态
  const toggleStyleExpand = (label: string) => {
    setExpandedStyles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };

  // 判断是否为风格分类的特殊标签
  const isSpecialStyleLabel = (label: string): boolean => {
    return categoryType === 'style' && (label === '传统音乐' || label === '场景氛围音乐' || label === '其他' || label.startsWith('其他'));
  };

  // 聚合小分类为"其他"
  const processData = () => {
    // 如果是风格分类或乐器分类，不需要聚合
    // 风格分类：后端已经处理了分类
    // 乐器分类：逐一展示所有乐器，不归并到"其他"
    if (categoryType === 'style' || categoryType === 'instrument') {
      return data as Array<{ label: string; count: number; details?: Array<{ label: string; count: number }> }>;
    }

    const mainCategories = data.filter((item) => item.count >= aggregateThreshold);
    const otherCategories = data.filter((item) => item.count < aggregateThreshold);

    if (otherCategories.length > 0) {
      const otherTotal = otherCategories.reduce((sum, item) => sum + item.count, 0);
      return [
        ...mainCategories,
        {
          label: aggregateLabel, // 不再添加数字后缀
          count: otherTotal,
          details: otherCategories,
        },
      ] as Array<{ label: string; count: number; details?: Array<{ label: string; count: number }> }>;
    }

    return data as Array<{ label: string; count: number; details?: Array<{ label: string; count: number }> }>;
  };

  const processedData = processData();
  const visibleData = showAll
    ? processedData
    : processedData.slice(0, maxVisible);

  const totalCount = data.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(...data.map((item) => item.count));

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-sm text-gray-400 mt-1">
              共 {data.length} 类 · {totalCount} 首
            </p>
          </div>
        </div>
        {processedData.length > maxVisible && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
          >
            {showAll ? '收起' : `展开全部 (${processedData.length})`}
          </button>
        )}
      </div>

      {/* 列表展示 */}
      <div className="space-y-3">
        {visibleData.map((item, index) => {
          const isOther = item.label === aggregateLabel;
          const isSpecialStyle = isSpecialStyleLabel(item.label);
          const isExpanded = isSpecialStyle ? expandedStyles.has(item.label) : showOtherDetails;
          const percentage = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : 0;
          const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

          return (
            <div key={index}>
              <div
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer group"
                onClick={() => {
                  if (onItemClick && !isOther && !isSpecialStyle) {
                    onItemClick(item.label);
                  } else if (isOther || isSpecialStyle) {
                    // 为风格分类的特殊标签使用独立的展开状态
                    if (isSpecialStyle) {
                      toggleStyleExpand(item.label);
                    } else {
                      setShowOtherDetails(!showOtherDetails);
                    }
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-white truncate">
                      {item.label}
                    </span>
                    <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-gray-400">
                      {percentage}%
                    </span>
                  </div>

                  {/* 粉红色占比长条 */}
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: '#ec4899',
                      }}
                    />
                  </div>
                </div>

                <div className="ml-4 flex items-center gap-2">
                  <span className="text-lg font-bold text-white whitespace-nowrap">
                    {item.count}
                  </span>
                  {/* 筛选按钮：所有标签都显示 */}
                  {onFilterClick && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFilterClick(item.label);
                      }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="按此分类筛选"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    </button>
                  )}
                  {/* 展开/收起按钮：只有带details的标签才显示 */}
                  {(isOther || isSpecialStyle) && item.details && item.details.length > 0 && (
                    <button
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="查看详情"
                    >
                      {isExpanded ? (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 展开查看分类中的详细内容 */}
              {(isOther || isSpecialStyle) && isExpanded && item.details && item.details.length > 0 && (
                <div className="ml-8 mt-2 space-y-2">
                  {(item.details as Array<{ label: string; count: number }>).map((detail, idx) => {
                    const detailPercentage = totalCount > 0 ? ((detail.count / totalCount) * 100).toFixed(1) : 0;
                    const detailBarWidth = maxCount > 0 ? (detail.count / maxCount) * 100 : 0;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-gray-300 truncate">{detail.label}</span>
                            <span className="text-xs text-gray-400">{detailPercentage}%</span>
                          </div>
                          {/* 粉红色占比长条 */}
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${detailBarWidth}%`,
                                backgroundColor: '#ec4899',
                              }}
                            />
                          </div>
                        </div>
                        {onFilterClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onFilterClick(detail.label);
                            }}
                            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ml-3"
                            title="按此分类筛选"
                          >
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
