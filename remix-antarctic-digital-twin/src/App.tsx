import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HomePage from './components/HomePage';
import StationDashboard from './components/StationDashboard';
import {
  StationsView,
  AnalyticsView,
  AlertsView,
  ReportsView,
  SettingsView,
} from './components/OtherViews';
import SimulationPage from './components/simulation/SimulationPage';
import IntelligencePage from './components/intelligence/IntelligencePage';
import { RadarLiveDemoModal } from './components/simulation/RadarLiveDemoModal';

export default function App() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isRadarDemoOpen, setIsRadarDemoOpen] = useState(false);
  const [radarDemoParams, setRadarDemoParams] = useState<{
    scenarioId?: string;
    stationId?: string;
    currentSimulationHour?: number;
    isSimulationRunning?: boolean;
    simulationSpeed?: number;
    activeRadarObservation?: any;
  }>({});


  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e?.detail) {
        const scenarios = e.detail.activeScenarios || [];
        setRadarDemoParams(prev => ({
          ...prev,
          scenarioId: scenarios[0] || (e.detail.hasActiveScenario ? prev.scenarioId : undefined),
          stationId: e.detail.stationId || prev.stationId,
        }));
      }
    };
    window.addEventListener('simulation-scenario-status', handleStatus);
    return () => window.removeEventListener('simulation-scenario-status', handleStatus);
  }, []);

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e?.detail && e.detail.scenarioId !== undefined) {
        setRadarDemoParams(e.detail);
      } else {
        try {
          const raw = sessionStorage.getItem('ant_active_scenarios');
          const parsed = raw ? JSON.parse(raw) : [];
          setRadarDemoParams(prev => ({
            ...prev,
            scenarioId: parsed[0] || undefined,
            ...(e?.detail || {}),
          }));
        } catch {
          // ignore
        }
      }
      setIsRadarDemoOpen(true);
    };
    window.addEventListener('open-radar-demo', handleOpen);
    return () => window.removeEventListener('open-radar-demo', handleOpen);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans selection:bg-sky-200 selection:text-sky-900">
        <div className="flex flex-1 relative">
          {/* Dynamic Left Sidebar */}
          <Sidebar
            isOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          {/* Main App Container */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Header */}
            <Header
              onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              isMobileSidebarOpen={isMobileSidebarOpen}
              onOpenRadarDemo={() => setIsRadarDemoOpen(true)}
            />

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/stations" element={<StationsView />} />
                <Route path="/stations/:stationId" element={<StationDashboard />} />
                <Route path="/analytics" element={<AnalyticsView />} />
                <Route path="/simulations" element={<SimulationPage />} />
                <Route path="/intelligence" element={<IntelligencePage />} />
                <Route path="/alerts" element={<AlertsView />} />
                <Route path="/reports" element={<ReportsView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>

        {/* Global Live Doppler Radar Modal — Authoritative Digital Twin Synchronization */}
        <RadarLiveDemoModal
          isOpen={isRadarDemoOpen}
          onClose={() => setIsRadarDemoOpen(false)}
          activeScenarioId={radarDemoParams.scenarioId}
          stationId={radarDemoParams.stationId || 'maitri'}
          stationName={radarDemoParams.stationId?.toLowerCase() === 'bharati' ? 'Bharati Station' : 'Maitri Station'}
          currentSimulationHour={radarDemoParams.currentSimulationHour}
          isSimulationRunning={radarDemoParams.isSimulationRunning}
          simulationSpeed={radarDemoParams.simulationSpeed}
          activeRadarObservation={radarDemoParams.activeRadarObservation}
        />

      </div>
    </BrowserRouter>
  );
}
