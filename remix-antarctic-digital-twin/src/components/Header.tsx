import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Radio, Menu, X, CheckCircle2 } from 'lucide-react';
import { MOCK_ALERTS } from '../data/mockData';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  isMobileSidebarOpen: boolean;
  onOpenRadarDemo?: () => void;
}

export default function Header({
  onToggleMobileSidebar,
  isMobileSidebarOpen,
  onOpenRadarDemo,
}: HeaderProps) {
  const location = useLocation();
  const isSimulationsPage = location.pathname.startsWith('/simulations');
  const [hasActiveSimScenario, setHasActiveSimScenario] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(MOCK_ALERTS.length);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Listen for scenario activation on the simulations page
  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e?.detail && typeof e.detail.hasActiveScenario === 'boolean') {
        setHasActiveSimScenario(e.detail.hasActiveScenario);
      }
    };
    window.addEventListener('simulation-scenario-status', handleStatus);
    return () => window.removeEventListener('simulation-scenario-status', handleStatus);
  }, []);

  // Close notifications on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      id="main-app-header"
      className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-sky-100/90 h-16 px-4 sm:px-6 flex items-center justify-between transition-colors"
    >
      {/* Left side: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          id="btn-sidebar-mobile-toggle"
          type="button"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation menu"
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-sky-50 transition-colors"
        >
          {isMobileSidebarOpen ? (
            <X className="w-5 h-5 text-slate-700" />
          ) : (
            <Menu className="w-5 h-5 text-slate-700" />
          )}
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-xs">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
              Antarctic Digital Twin
            </h1>
            <span className="hidden sm:inline-block text-[11px] text-slate-500 font-medium mt-0.5">
              National Centre for Polar and Ocean Research (NCPOR)
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Radar Demo Trigger, Notification, User Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Radar Live Demo Trigger Button — Shows on simulations page ONLY when a scenario is active */}
        {(!isSimulationsPage || hasActiveSimScenario) && onOpenRadarDemo && (
          <button
            id="btn-radar-live-demo"
            type="button"
            onClick={onOpenRadarDemo}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono font-bold text-xs tracking-wider uppercase shadow-md shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-200 active:scale-95 cursor-pointer animate-pulse"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>⚡ LIVE RADAR DEMO</span>
          </button>
        )}

        {/* Notification Icon & Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="btn-notifications"
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) {
                setUnreadCount(0);
              }
            }}
            aria-label="Notifications"
            className="relative p-2 rounded-xl text-slate-600 hover:text-sky-700 hover:bg-sky-50 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-sky-100 shadow-xl p-4 z-50 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-semibold text-slate-900">
                    Station Telemetry Alerts
                  </span>
                </div>
                <span className="text-xs text-slate-500">Live feed</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto mt-2">
                {MOCK_ALERTS.map((alert) => (
                  <div key={alert.id} className="py-2.5 px-1 hover:bg-sky-50/50 rounded-lg transition-colors">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-800">
                        {alert.stationName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {alert.timestamp}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-700">
                      {alert.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-sky-600">
                <span className="flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All systems monitored
                </span>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
