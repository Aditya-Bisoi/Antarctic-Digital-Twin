import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Zap,
  CloudSnow,
  Building2,
  Package,
  Calendar,
  Users,
  Gauge,
  Thermometer,
  Wind,
  Droplets,
  Radio,
  Clock,
  BatteryCharging,
  Sun,
  ShieldCheck,
  Fuel,
  Compass,
  Sparkles,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { STATIONS } from '../data/mockData';
import { api, StationDashboardData } from '../api/client';
import StatusBadge from './StatusBadge';
import DigitalTwinView from './DigitalTwinView';

export default function StationDashboard() {
  const { stationId } = useParams<{ stationId: string }>();
  const navigate = useNavigate();

  // Normalize station ID to 'maitri' or 'bharati'
  const currentKey = (stationId?.toLowerCase() === 'bharati' ? 'bharati' : 'maitri') as 'maitri' | 'bharati';
  const [stationData, setStationData] = useState<StationDashboardData>(STATIONS[currentKey]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    api.getStationDashboard(currentKey).then((data) => {
      if (isMounted) {
        setStationData(data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [currentKey]);

  const station = stationData || STATIONS[currentKey];

  return (
    <div className="space-y-8 pb-12">
      {/* AI Predictive Insights Banner */}
      {station.aiInsights && station.aiInsights.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white p-5 rounded-2xl border border-sky-500/30 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Rule-Based AI Predictive Analytics Engine</span>
            </div>
            <span className="text-[11px] bg-sky-500/20 px-2.5 py-0.5 rounded-full text-sky-200 border border-sky-400/30 font-semibold">
              Live Telemetry Audit
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {station.aiInsights.map((insight, idx) => (
              <div
                key={idx}
                className="bg-slate-800/80 backdrop-blur-xs p-3.5 rounded-xl border border-sky-400/15 flex items-start gap-3"
              >
                {insight.severity === 'high' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : insight.severity === 'medium' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold text-sky-100">{insight.title}</div>
                  <div className="text-slate-300 leading-relaxed">{insight.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Station Dashboard Header */}
      <div
        id="station-dashboard-header"
        className="bg-white rounded-2xl border border-sky-100/90 shadow-sm p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="space-y-2">
            {/* Breadcrumb / Back Link */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors group cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Home</span>
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {station.name}
              </h1>
              <StatusBadge status={station.status} />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-sky-600" />
                {station.region} — {station.coordinates}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {station.lastPing}
              </span>
            </div>
          </div>

          {/* Quick Switcher Between Stations & Radar Demo Button */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-station-radar-demo"
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-radar-demo'))}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono font-bold text-xs tracking-wider uppercase shadow-md shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>⚡ LIVE RADAR DEMO</span>
            </button>

            <Link
              to="/stations/maitri"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentKey === 'maitri'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 text-slate-700 hover:bg-sky-100'
              }`}
            >
              Maitri Station
            </Link>
            <Link
              to="/stations/bharati"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentKey === 'bharati'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 text-slate-700 hover:bg-sky-100'
              }`}
            >
              Bharati Station
            </Link>
          </div>
        </div>

        {/* Quick Facts Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 font-medium">Crew Present</span>
              <span className="text-sm font-bold text-slate-800">{station.crewCount} Scientists & Engineers</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 font-medium">Commissioned</span>
              <span className="text-sm font-bold text-slate-800">Year {station.commissionedYear}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 font-medium">Elevation</span>
              <span className="text-sm font-bold text-slate-800">{station.elevation}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 font-medium">Telemetry Uplink</span>
              <span className="text-sm font-bold text-slate-800">{station.infrastructure.satelliteUplinkMbps} Mbps (ISRO)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Four Main Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. ENERGY CARD */}
        <div
          id="station-card-energy"
          className="bg-white rounded-2xl border border-sky-100/90 shadow-sm p-6 hover:shadow transition-shadow"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Energy Systems
                </h3>
                <p className="text-xs text-slate-500">
                  Microgrid generation & thermal recovery
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Grid Stable
            </span>
          </div>

          {/* Primary stats */}
          <div className="grid grid-cols-2 gap-4 my-5">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Power Generation</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">
                  {station.energy.powerGenerationKw}
                </span>
                <span className="text-xs font-semibold text-slate-500">kW</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium block mt-1">
                +{station.energy.solarGenerationKw} kW Solar Array
              </span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Current Consumption</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">
                  {station.energy.powerConsumptionKw}
                </span>
                <span className="text-xs font-semibold text-slate-500">kW</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-1">
                Net surplus: +{station.energy.powerGenerationKw - station.energy.powerConsumptionKw} kW
              </span>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-slate-400" /> Generator Load
                </span>
                <span className="font-bold text-slate-800">{station.energy.generatorLoadPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${station.energy.generatorLoadPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" /> Battery Bank Reserve
                </span>
                <span className="font-bold text-slate-800">{station.energy.batteryLevelPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${station.energy.batteryLevelPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Primary Source: <strong className="text-slate-700">{station.energy.primarySource}</strong></span>
            <span>24h Total: <strong className="text-slate-700">{station.energy.dailyUsageKwh} kWh</strong></span>
          </div>
        </div>

        {/* 2. ENVIRONMENT CARD */}
        <div
          id="station-card-environment"
          className="bg-white rounded-2xl border border-sky-100/90 shadow-sm p-6 hover:shadow transition-shadow"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center">
                <CloudSnow className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Environmental Data
                </h3>
                <p className="text-xs text-slate-500">
                  Meteorological and atmospheric telemetry
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              Clear Polar Skies
            </span>
          </div>

          {/* Primary stats */}
          <div className="grid grid-cols-2 gap-4 my-5">
            <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100">
              <span className="text-xs text-slate-500 block mb-1">Ambient Temperature</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">
                  {station.environment.temperature}°C
                </span>
              </div>
              <span className="text-[11px] text-sky-700 font-medium block mt-1">
                Wind chill feel: {station.environment.windChill}°C
              </span>
            </div>

            <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100">
              <span className="text-xs text-slate-500 block mb-1">Wind Speed</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">
                  {station.environment.windSpeed}
                </span>
                <span className="text-xs font-semibold text-slate-500">km/h</span>
              </div>
              <span className="text-[11px] text-slate-600 font-medium block mt-1">
                Direction: {station.windDirection}
              </span>
            </div>
          </div>

          {/* Additional weather metrics list */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500">Barometric Pressure</span>
              <span className="font-semibold text-slate-800">{station.environment.airPressureHpa} hPa</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500">Relative Humidity</span>
              <span className="font-semibold text-slate-800">{station.environment.humidityPercent}%</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500">Visibility Distance</span>
              <span className="font-semibold text-slate-800">{station.environment.visibilityKm} km</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500">UV Index</span>
              <span className="font-semibold text-slate-800">{station.environment.uvIndex} (Low)</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Snow Accumulation: <strong className="text-slate-700">{station.environment.snowAccumulationCm} cm (24h)</strong></span>
            <span className="text-emerald-600 font-medium">Safe operations</span>
          </div>
        </div>

        {/* 3. INFRASTRUCTURE CARD */}
        <div
          id="station-card-infrastructure"
          className="bg-white rounded-2xl border border-sky-100/90 shadow-sm p-6 hover:shadow transition-shadow"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Infrastructure
                </h3>
                <p className="text-xs text-slate-500">
                  Life support, HVAC & habitat safety
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {station.infrastructure.overallHealthPercent}% Health
            </span>
          </div>

          {/* Habitat condition grid */}
          <div className="grid grid-cols-2 gap-4 my-5">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Habitat Temperature</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">
                  +{station.infrastructure.indoorTemp}°C
                </span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium block mt-1">
                HVAC loop: Nominal
              </span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Water Treatment</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">
                  {station.infrastructure.waterTreatmentCapacityLpd.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">L/day</span>
              </div>
              <span className="text-[11px] text-sky-600 font-medium block mt-1">
                Lake Priyadarshini Feed
              </span>
            </div>
          </div>

          {/* Subsystem status rows */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Life Support & Ventilation
              </span>
              <span className="font-bold text-emerald-700">{station.infrastructure.lifeSupportStatus}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-sky-600" /> Central Thermal Tracing
              </span>
              <span className="font-bold text-emerald-700">{station.infrastructure.heatingSystemStatus}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" /> Active Telemetry Sensors
              </span>
              <span className="font-bold text-slate-800">
                {station.infrastructure.activeSensors} / {station.infrastructure.totalSensors} Online
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Air Filtration: <strong className="text-slate-700">HEPA Dual Stage</strong></span>
            <span className="text-sky-700 font-medium">Zero structural deflection</span>
          </div>
        </div>

        {/* 4. LOGISTICS CARD */}
        <div
          id="station-card-logistics"
          className="bg-white rounded-2xl border border-sky-100/90 shadow-sm p-6 hover:shadow transition-shadow"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Logistics & Supplies
                </h3>
                <p className="text-xs text-slate-500">
                  Fuel reserves, rations & mission inventory
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Fully Stocked
            </span>
          </div>

          {/* Primary stats */}
          <div className="grid grid-cols-2 gap-4 my-5">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Fuel Reserve</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">
                  {station.logistics.fuelReserveDays}
                </span>
                <span className="text-xs font-semibold text-slate-500">Days</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-1">
                {station.logistics.fuelLevelLiters.toLocaleString()} L Aviation Turbine Fuel
              </span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Food Rations</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">
                  {station.logistics.foodRationDays}
                </span>
                <span className="text-xs font-semibold text-slate-500">Days</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium block mt-1">
                Freeze-dried & cold stores nominal
              </span>
            </div>
          </div>

          {/* Additional details list */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500">Potable Water Storage</span>
              <span className="font-semibold text-slate-800">{station.logistics.waterStorageLiters.toLocaleString()} L</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500">Medical Supplies</span>
              <span className="font-semibold text-emerald-600">{station.logistics.medicalSupplyStatus}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between col-span-2">
              <span className="text-slate-500">Next Scheduled Resupply</span>
              <span className="font-semibold text-slate-800">{station.logistics.nextResupplyDate}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="truncate">Expedition: <strong className="text-slate-700">{station.logistics.expeditionTeam}</strong></span>
          </div>
        </div>
      </div>

      {/* Digital Twin 2D Representation Section */}
      <div className="pt-2">
        <DigitalTwinView station={station} />
      </div>
    </div>
  );
}
