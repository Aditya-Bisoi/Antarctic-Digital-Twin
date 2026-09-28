import { X, Zap, CloudSnow, Package, Bell, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QuickAccessItem } from '../types';
import { STATIONS, MOCK_ALERTS } from '../data/mockData';

interface QuickAccessModalProps {
  item: QuickAccessItem | null;
  onClose: () => void;
}

export default function QuickAccessModal({ item, onClose }: QuickAccessModalProps) {
  const navigate = useNavigate();

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="quick-access-modal"
        className="bg-white rounded-2xl border border-sky-100 shadow-2xl max-w-xl w-full p-6 overflow-hidden relative"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              {item.iconName === 'Zap' && <Zap className="w-5 h-5 text-amber-500" />}
              {item.iconName === 'CloudSnow' && <CloudSnow className="w-5 h-5 text-sky-600" />}
              {item.iconName === 'Package' && <Package className="w-5 h-5 text-indigo-600" />}
              {item.iconName === 'Bell' && <Bell className="w-5 h-5 text-rose-500" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{item.title} Overview</h3>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Comparison between Maitri and Bharati */}
        <div className="py-5 space-y-4">
          {item.category === 'alerts' ? (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Active Station Advisories
              </span>
              {MOCK_ALERTS.map((alert) => (
                <div key={alert.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800">{alert.stationName}</span>
                    <span className="text-slate-400">{alert.timestamp}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-800">{alert.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{alert.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Maitri Snapshot */}
              <div className="bg-sky-50/50 rounded-xl p-4 border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-sm">{STATIONS.maitri.name}</h4>
                  <span className="text-[11px] text-emerald-600 font-semibold">Online</span>
                </div>
                {item.category === 'energy' && (
                  <div className="text-xs space-y-1.5 text-slate-600">
                    <div>Generation: <strong className="text-slate-900">{STATIONS.maitri.energy.powerGenerationKw} kW</strong></div>
                    <div>Consumption: <strong className="text-slate-900">{STATIONS.maitri.energy.powerConsumptionKw} kW</strong></div>
                    <div>Battery Bank: <strong className="text-slate-900">{STATIONS.maitri.energy.batteryLevelPercent}%</strong></div>
                  </div>
                )}
                {item.category === 'environment' && (
                  <div className="text-xs space-y-1.5 text-slate-600">
                    <div>Temperature: <strong className="text-slate-900">{STATIONS.maitri.environment.temperature}°C</strong></div>
                    <div>Wind Speed: <strong className="text-slate-900">{STATIONS.maitri.environment.windSpeed} km/h</strong></div>
                    <div>Air Pressure: <strong className="text-slate-900">{STATIONS.maitri.environment.airPressureHpa} hPa</strong></div>
                  </div>
                )}
                {item.category === 'logistics' && (
                  <div className="text-xs space-y-1.5 text-slate-600">
                    <div>Fuel Remaining: <strong className="text-slate-900">{STATIONS.maitri.logistics.fuelReserveDays} days</strong></div>
                    <div>Food Stores: <strong className="text-slate-900">{STATIONS.maitri.logistics.foodRationDays} days</strong></div>
                    <div>Resupply: <strong className="text-slate-900">{STATIONS.maitri.logistics.nextResupplyDate}</strong></div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/stations/maitri');
                  }}
                  className="mt-3 w-full py-1.5 px-3 rounded-lg bg-white border border-sky-200 text-sky-700 font-medium text-xs hover:bg-sky-50 flex items-center justify-center gap-1"
                >
                  <span>Open Maitri Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Bharati Snapshot */}
              <div className="bg-sky-50/50 rounded-xl p-4 border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-sm">{STATIONS.bharati.name}</h4>
                  <span className="text-[11px] text-emerald-600 font-semibold">Online</span>
                </div>
                {item.category === 'energy' && (
                  <div className="text-xs space-y-1.5 text-slate-600">
                    <div>Generation: <strong className="text-slate-900">{STATIONS.bharati.energy.powerGenerationKw} kW</strong></div>
                    <div>Consumption: <strong className="text-slate-900">{STATIONS.bharati.energy.powerConsumptionKw} kW</strong></div>
                    <div>Battery Bank: <strong className="text-slate-900">{STATIONS.bharati.energy.batteryLevelPercent}%</strong></div>
                  </div>
                )}
                {item.category === 'environment' && (
                  <div className="text-xs space-y-1.5 text-slate-600">
                    <div>Temperature: <strong className="text-slate-900">{STATIONS.bharati.environment.temperature}°C</strong></div>
                    <div>Wind Speed: <strong className="text-slate-900">{STATIONS.bharati.environment.windSpeed} km/h</strong></div>
                    <div>Air Pressure: <strong className="text-slate-900">{STATIONS.bharati.environment.airPressureHpa} hPa</strong></div>
                  </div>
                )}
                {item.category === 'logistics' && (
                  <div className="text-xs space-y-1.5 text-slate-600">
                    <div>Fuel Remaining: <strong className="text-slate-900">{STATIONS.bharati.logistics.fuelReserveDays} days</strong></div>
                    <div>Food Stores: <strong className="text-slate-900">{STATIONS.bharati.logistics.foodRationDays} days</strong></div>
                    <div>Resupply: <strong className="text-slate-900">{STATIONS.bharati.logistics.nextResupplyDate}</strong></div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/stations/bharati');
                  }}
                  className="mt-3 w-full py-1.5 px-3 rounded-lg bg-white border border-sky-200 text-sky-700 font-medium text-xs hover:bg-sky-50 flex items-center justify-center gap-1"
                >
                  <span>Open Bharati Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
