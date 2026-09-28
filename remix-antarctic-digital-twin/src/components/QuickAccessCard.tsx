import { Key } from 'react';
import { Zap, CloudSnow, Package, Bell, ArrowRight } from 'lucide-react';
import { QuickAccessItem } from '../types';

interface QuickAccessCardProps {
  key?: Key;
  item: QuickAccessItem;
  onClick?: (item: QuickAccessItem) => void;
}

export default function QuickAccessCard({ item, onClick }: QuickAccessCardProps) {
  const getIcon = (name: QuickAccessItem['iconName']) => {
    switch (name) {
      case 'Zap':
        return <Zap className="w-5 h-5 text-amber-600" />;
      case 'CloudSnow':
        return <CloudSnow className="w-5 h-5 text-sky-600" />;
      case 'Package':
        return <Package className="w-5 h-5 text-indigo-600" />;
      case 'Bell':
        return <Bell className="w-5 h-5 text-rose-500" />;
      default:
        return <Zap className="w-5 h-5 text-sky-600" />;
    }
  };

  const getIconBg = (name: QuickAccessItem['iconName']) => {
    switch (name) {
      case 'Zap':
        return 'bg-amber-50 border-amber-100';
      case 'CloudSnow':
        return 'bg-sky-50 border-sky-100';
      case 'Package':
        return 'bg-indigo-50 border-indigo-100';
      case 'Bell':
        return 'bg-rose-50 border-rose-100';
      default:
        return 'bg-sky-50 border-sky-100';
    }
  };

  return (
    <div
      id={`quick-access-${item.id}`}
      onClick={() => onClick?.(item)}
      className="group relative bg-white rounded-2xl border border-sky-100/90 p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(item);
        }
      }}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center border ${getIconBg(
              item.iconName
            )}`}
          >
            {getIcon(item.iconName)}
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-sky-600 group-hover:text-white transition-colors">
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <h3 className="text-base font-semibold text-slate-800 tracking-tight mb-1 group-hover:text-sky-700 transition-colors">
          {item.title}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          {item.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-sky-600">
        <span className="font-medium">Open telemetry view</span>
        <span>→</span>
      </div>
    </div>
  );
}
