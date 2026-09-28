import { useNavigate } from 'react-router-dom';
import {
  Compass,
  BarChart3,
  Cpu,
  BellRing,
  FileText,
  Settings,
  ArrowLeft,
  Download,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { STATIONS, MOCK_ALERTS } from '../data/mockData';
import StationCard from './StationCard';
import StatusBadge from './StatusBadge';

import AntarcticStationMap from './AntarcticStationMap';

// Stations List View
export function StationsView() {
  const navigate = useNavigate();
  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Indian Antarctic Research Stations & Geospatial Map
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time geospatial tracking, polar stereographic map, and 3D architectural digital twins under NCPOR / Ministry of Earth Sciences.
          </p>
        </div>
      </div>

      {/* Geospatial Antarctic Map */}
      <div>
        <AntarcticStationMap />
      </div>

      {/* Station Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <span>Active Research Outposts</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            2 Operational
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StationCard station={STATIONS.maitri} />
          <StationCard station={STATIONS.bharati} />
        </div>
      </div>
    </div>
  );
}

// Analytics View
export function AnalyticsView() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 pb-12">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Home</span>
      </button>

      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Station Comparative Analytics</h2>
            <p className="text-xs text-slate-500">Historical temperature, power grid stability, and wind patterns</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => alert('Exporting telemetry dataset (CSV/JSON)...')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-50 text-sky-700 font-medium text-xs hover:bg-sky-100 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export Data</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Thermal Gradient Comparison</h3>
            <span className="text-xs text-slate-400">Past 7 Days</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Maitri (Schirmacher Oasis)</span>
                <span className="font-bold text-slate-800">-28°C avg</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: '42%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Bharati (Larsemann Hills)</span>
                <span className="font-bold text-slate-800">-25°C avg</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: '50%' }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
            Higher coastal moisture at Larsemann Hills moderates ambient temperature; Maitri experiences stronger katabatic wind gusts.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Microgrid Power Generation Balance</h3>
            <span className="text-xs text-emerald-600 font-semibold">Nominal</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Maitri Power Reserve</span>
                <span className="font-bold text-slate-800">185 kW Generation / 142 kW Load</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '76%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Bharati Power Reserve</span>
                <span className="font-bold text-slate-800">240 kW Generation / 175 kW Load</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '72%' }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
            Both microgrids maintain &gt;25% operating buffer and combined battery bank capacity exceeding 94%.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { api, SimulationResponse } from '../api/client';
import { StationAlert } from '../types';

// Alerts View
export function AlertsView() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<StationAlert[]>(MOCK_ALERTS);

  useEffect(() => {
    let isMounted = true;
    api.getAlerts().then((data) => {
      if (isMounted && data) {
        setAlerts(data);
      }
    });
    return () => { isMounted = false; };
  }, []);
  return (
    <div className="space-y-6 pb-12">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Home</span>
      </button>

      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <BellRing className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Station Alerts & Advisories</h2>
          <p className="text-xs text-slate-500">Live operational alerts across Maitri & Bharati</p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white p-4 rounded-2xl border border-sky-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">{alert.stationName}</span>
                <span className="text-xs text-slate-400">• {alert.timestamp}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {alert.category}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-800">{alert.title}</h4>
              <p className="text-xs text-slate-500">{alert.message}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/stations/${alert.stationId}`)}
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100"
            >
              View Station
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reports View
export function ReportsView() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 pb-12">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Home</span>
      </button>

      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Scientific Expedition Reports</h2>
          <p className="text-xs text-slate-500">Official mission logs and technical bulletins</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-sky-100 divide-y divide-slate-100 shadow-sm">
        {[
          { title: '45th ISEA Winter Telemetry & Meteorological Bulletin', date: 'September 2026', size: '2.4 MB PDF' },
          { title: 'Bharati Station Aerodynamic & Heat Balance Assessment', date: 'August 2026', size: '4.1 MB PDF' },
          { title: 'Maitri Geomagnetic Observational Quarterly Summary', date: 'July 2026', size: '1.8 MB PDF' },
        ].map((report, idx) => (
          <div key={idx} className="p-4 flex items-center justify-between hover:bg-sky-50/40 transition-colors">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{report.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{report.date} • {report.size}</p>
            </div>
            <button
              type="button"
              onClick={() => alert(`Downloading ${report.title}...`)}
              className="p-2 rounded-xl text-sky-600 hover:bg-sky-100 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Settings View
export function SettingsView() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 pb-12 max-w-2xl">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Home</span>
      </button>

      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Platform Settings</h2>
          <p className="text-xs text-slate-500">Telemetry connection and display preferences</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-sky-100 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-800">Telemetry Polling Interval</div>
            <div className="text-xs text-slate-500">Frequency of satellite sensory packets from Maitri & Bharati</div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700">1000 ms (Live)</span>
        </div>

        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-800">Temperature Units</div>
            <div className="text-xs text-slate-500">Scientific standard unit display</div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700">Celsius (°C)</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-slate-800">Theme Mode</div>
            <div className="text-xs text-slate-500">High-legibility polar daylight mode</div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700">Light Mode (Fixed)</span>
        </div>
      </div>
    </div>
  );
}
