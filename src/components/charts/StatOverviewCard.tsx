'use client';

interface StatOverviewCardProps {
  icon: string;
  title: string;
  count: number;
  categoryCount: number;
  color: string;
  onClick: () => void;
  isExpanded: boolean;
}

export default function StatOverviewCard({
  icon,
  title,
  count,
  categoryCount,
  color,
  onClick,
  isExpanded,
}: StatOverviewCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02] group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{icon}</span>
          <div className="text-left">
            <h3 className="text-xl font-bold text-white group-hover:text-gray-200 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              共 {categoryCount} 类 · {count} 首
            </p>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
          {isExpanded ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      {/* 简化的进度条展示 */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, (count / 10) * 100)}%`,
            backgroundColor: color.replace('bg-', '').replace('/20', '').replace('/30', ''),
          }}
        />
      </div>
    </button>
  );
}
