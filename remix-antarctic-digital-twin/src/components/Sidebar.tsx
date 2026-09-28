import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Compass,
  BarChart3,
  Cpu,
  BellRing,
  FileText,
  Settings,
  Thermometer,
  Shield,
  HelpCircle,
  ExternalLink,
  Brain,
} from 'lucide-react';
import { STATIONS } from '../data/mockData';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ isOpen, onCloseMobile }: SidebarProps) {
  const location = useLocation();

  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Stations', path: '/stations', icon: Compass },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Simulations', path: '/simulations', icon: Cpu },
    { label: 'Intelligence', path: '/intelligence', icon: Brain },
    {
      label: 'Alerts',
      path: '/alerts',
      icon: BellRing,
      badge: '2',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    { label: 'Reports', path: '/reports', icon: FileText },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const isCurrentActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-dynamic-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-sky-100/90 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-10 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Top Brand Area */}
          <div className="h-16 px-6 flex items-center gap-3 border-b border-sky-100/90">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-xs">
              <Thermometer className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="block font-bold text-slate-900 text-sm tracking-tight">
                Antarctic Twin
              </span>
              <span className="block text-[10px] text-sky-600 font-semibold tracking-wider uppercase">
                Polar Operations
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="py-4 px-3 space-y-1">
            <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isCurrentActive(item.path);

              return (
                <Link
                  key={item.label}
                  id={`nav-item-${item.label.toLowerCase()}`}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-sky-50 text-sky-700 font-semibold shadow-xs border-r-3 border-sky-600'
                      : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        active ? 'text-sky-600' : 'text-slate-400 group-hover:text-sky-600'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Research Stations Quick Access Sub-Section */}
          <div className="px-3 pt-3 mt-3 border-t border-slate-100">
            <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Stations</span>
              <span className="text-[10px] text-emerald-600 font-semibold">2 Active</span>
            </div>

            <div className="space-y-1">
              <Link
                to="/stations/maitri"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  location.pathname === '/stations/maitri'
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:bg-sky-50/50 hover:text-slate-900'
                }`}
              >
                <span className="truncate">{STATIONS.maitri.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {STATIONS.maitri.temperature}°C
                </span>
              </Link>

              <Link
                to="/stations/bharati"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  location.pathname === '/stations/bharati'
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:bg-sky-50/50 hover:text-slate-900'
                }`}
              >
                <span className="truncate">{STATIONS.bharati.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {STATIONS.bharati.temperature}°C
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Station Status Pill & Info */}
        <div className="p-4 border-t border-sky-100/80 bg-sky-50/30">
          <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Shield className="w-3.5 h-3.5 text-sky-600" />
              <span>ISRO & NCAOR Grid</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Secure polar telemetry linked via GSAT satellite transponders.
            </p>
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-sky-600 font-medium">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-400" /> Documentation
              </span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
