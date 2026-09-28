import { useState } from 'react';
import {
  Boxes,
  Globe,
  Eye,
  ShieldCheck,
  Thermometer,
  Zap,
  Cpu,
} from 'lucide-react';
import { StationData, TwinModule } from '../types';
import StatusBadge from './StatusBadge';
import ThreeDDigitalTwin from './ThreeDDigitalTwin';
import AntarcticStationMap from './AntarcticStationMap';

interface DigitalTwinViewProps {
  station: StationData;
}

export default function DigitalTwinView({ station }: DigitalTwinViewProps) {
  const [activeModuleId, setActiveModuleId] = useState<string>(
    station.digitalTwinModules[0]?.id || ''
  );
  const [viewMode, setViewMode] = useState<'schematic' | 'map' | 'satellite'>('schematic');

  const selectedModule =
    station.digitalTwinModules.find((m) => m.id === activeModuleId) ||
    station.digitalTwinModules[0];

  return (
    <div
      id="digital-twin-view-container"
      className="bg-white rounded-2xl border border-sky-100/90 shadow-sm p-6 overflow-hidden space-y-6"
    >
      {/* Top Header of Digital Twin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Boxes className="w-5 h-5 text-sky-600" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              3D Digital Twin & Geospatial Intelligence — {station.name}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Interactive WebGL 3D architectural CAD twin, Antarctic polar map & modular component health telemetry
          </p>
        </div>

        {/* View Mode Toggles & Structural Integrity Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('schematic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'schematic'
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>3D CAD Schematic</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Antarctic Map</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('satellite')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'satellite'
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Exterior Visual</span>
            </button>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-100 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>Structural Integrity: {station.infrastructure.overallHealthPercent}%</span>
          </span>
        </div>
      </div>

      {/* Main Content Area based on ViewMode */}
      {viewMode === 'schematic' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 3D WebGL Canvas */}
          <div className="lg:col-span-8 min-h-[500px]">
            <ThreeDDigitalTwin
              station={station}
              activeModuleId={activeModuleId}
              onSelectModule={(id) => setActiveModuleId(id)}
            />
          </div>

          {/* Module Telemetry Detail Panel */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-4 bg-sky-50/50 rounded-xl p-5 border border-sky-100 shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  3D COMPONENT INSPECTOR
                </span>
                <StatusBadge status={selectedModule?.status || 'Optimal'} size="sm" />
              </div>

              <h3 className="text-base font-bold text-slate-900 mb-1">
                {selectedModule?.name}
              </h3>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                {selectedModule?.description}
              </p>

              {/* Subsystem Component Buttons */}
              <div className="mb-4">
                <span className="text-[11px] font-semibold text-slate-500 block mb-2">
                  Select Subsystem Component:
                </span>
                <div className="flex flex-col gap-1.5">
                  {station.digitalTwinModules.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveModuleId(m.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                        m.id === selectedModule?.id
                          ? 'bg-sky-600 text-white shadow-xs font-semibold'
                          : 'bg-white text-slate-700 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-parameters */}
              <div className="space-y-2.5">
                <div className="bg-white p-3 rounded-xl border border-sky-100 flex items-center justify-between shadow-2xs">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-sky-600" /> Internal Climate
                  </span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {selectedModule?.temp}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-sky-100 flex items-center justify-between shadow-2xs">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" /> Current Power Draw
                  </span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {selectedModule?.power}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-sky-100 flex items-center justify-between shadow-2xs">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-indigo-500" /> Automated Telemetry
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">
                    Connected & Nominal
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-sky-100 flex items-center justify-between shadow-2xs">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-sky-500" /> Fire & Atmosphere Guard
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    Dual Redundant (0 ppm CO)
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-sky-100/70 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Category: <strong className="capitalize text-slate-700">{selectedModule?.type}</strong></span>
              <span className="text-sky-700 font-medium">Synced with NCPOR Goa</span>
            </div>
          </div>
        </div>
      ) : viewMode === 'map' ? (
        <div className="space-y-4">
          <AntarcticStationMap
            selectedStationId={station.id.toLowerCase() === 'maitri' ? 'maitri' : 'bharati'}
          />
        </div>
      ) : (
        <div className="relative w-full aspect-16/9 max-h-[560px] rounded-2xl overflow-hidden border border-sky-900/30 shadow-md">
          <img
            src={station.image}
            alt={station.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent flex items-end p-6">
            <div className="text-white space-y-1">
              <span className="text-base font-bold block">{station.name} Polar Facility</span>
              <p className="text-xs text-slate-300 max-w-xl">
                Exterior aerodynamic envelope, thermal barrier glazing, and structural pile foundation.
                Location: {station.region} ({station.coordinates}).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
