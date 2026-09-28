import { ReactNode } from 'react';

interface MetricCardProps {
  id?: string;
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendText?: string;
}

export default function MetricCard({
  id,
  label,
  value,
  unit,
  subtext,
  icon,
  trend,
  trendText,
}: MetricCardProps) {
  return (
    <div
      id={id || `metric-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className="bg-white rounded-xl border border-sky-100/80 p-4 shadow-sm hover:shadow transition-shadow duration-200"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 tracking-wide uppercase">
          {label}
        </span>
        {icon && (
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-slate-500">
            {unit}
          </span>
        )}
      </div>

      {(subtext || trendText) && (
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          {subtext && <span>{subtext}</span>}
          {trendText && (
            <span
              className={`font-medium ${
                trend === 'up'
                  ? 'text-sky-600'
                  : trend === 'down'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {trendText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
