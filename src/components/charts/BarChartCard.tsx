'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface BarChartCardProps {
  title: string;
  data: Array<{ label: string; value: number; count: number }>;
  color: string;
  onItemClick?: (label: string) => void;
  maxVisible?: number;
}

export default function BarChartCard({
  title,
  data,
  color,
  onItemClick,
  maxVisible = 10,
}: BarChartCardProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState(false);

  // 排序数据
  const sortedData = [...data].sort((a, b) =>
    sortOrder === 'desc' ? b.count - a.count : a.count - b.count
  );

  // 分页显示
  const visibleData = showAll
    ? sortedData
    : sortedData.slice(0, maxVisible);

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900/95 border border-white/20 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium">{label}</p>
          <p className="text-gray-300 text-sm">数量: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  // 转换数据格式
  const chartData = visibleData.map((item, index) => ({
    name: item.label,
    count: item.count,
    value: item.value,
  }));

  if (data.length === 0) {
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
            title={sortOrder === 'desc' ? '按数量降序' : '按数量升序'}
          >
            {sortOrder === 'desc' ? '⬇️' : '⬆️'}
          </button>
          {data.length > maxVisible && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
            >
              {showAll ? `收起` : `展开全部 (${data.length})`}
            </button>
          )}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              stroke="rgba(255,255,255,0.5)"
              fontSize={12}
              interval={0}
            />
            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="count"
              fill={color}
              radius={[4, 4, 0, 0]}
              onClick={(data: any) => {
                if (onItemClick && data.name) {
                  onItemClick(data.name);
                }
              }}
              style={{ cursor: onItemClick ? 'pointer' : 'default' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
