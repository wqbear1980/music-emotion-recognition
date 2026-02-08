'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PieChartCardProps {
  title: string;
  data: Array<{ label: string; value: number; count: number }>;
  colors: string[];
  onItemClick?: (label: string) => void;
  onLegendClick?: (label: string) => void;
  visibleCategories?: Set<string>;
  onToggleCategory?: (label: string) => void;
}

export default function PieChartCard({
  title,
  data,
  colors,
  onItemClick,
  onLegendClick,
  visibleCategories,
  onToggleCategory,
}: PieChartCardProps) {
  // 过滤掉隐藏的分类
  const filteredData = visibleCategories
    ? data.filter(item => visibleCategories.has(item.label))
    : data;

  const totalCount = filteredData.reduce((sum, item) => sum + item.count, 0);

  const chartData = filteredData.map(item => ({
    name: item.label,
    value: item.count,
    percentage: totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : 0,
  }));

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900/95 border border-white/20 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-gray-300 text-sm">数量: {data.value}</p>
          <p className="text-gray-300 text-sm">占比: {data.percentage}%</p>
        </div>
      );
    }
    return null;
  };

  // 自定义 Legend
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {payload.map((entry: any, index: number) => {
          const isHidden = visibleCategories && !visibleCategories.has(entry.value);
          return (
            <button
              key={index}
              onClick={() => {
                if (onToggleCategory) {
                  onToggleCategory(entry.value);
                } else if (onLegendClick) {
                  onLegendClick(entry.value);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                isHidden
                  ? 'bg-gray-500/30 text-gray-400 opacity-50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={isHidden ? '点击显示' : '点击隐藏'}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.value}</span>
              <span className="text-gray-400">({entry.payload.value})</span>
              {isHidden && <span className="text-xs ml-1">👁️</span>}
            </button>
          );
        })}
      </div>
    );
  };

  if (filteredData.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-gray-500 text-sm text-center py-8">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-gray-400">总计 {totalCount} 首</span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              onClick={(data) => {
                if (onItemClick) {
                  onItemClick(data.name);
                }
              }}
              style={{ cursor: onItemClick ? 'pointer' : 'default' }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                  style={{ cursor: onItemClick ? 'pointer' : 'default' }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
