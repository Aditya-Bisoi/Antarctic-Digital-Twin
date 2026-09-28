// ============================================================================
// SimulationPage.tsx — Full Antarctic Digital Twin Simulation Page
// SIH26060 — Complete operational simulation command center
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Play, Pause, RotateCcw, FastForward, Clock,
  Thermometer, Wind, Eye, Gauge, Zap, BatteryCharging, Fuel,
  Users, CloudSnow, Radio, Shield, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Activity, Cpu, TrendingDown, TrendingUp,
  Minus, ArrowRight, Wrench, Package, ShieldAlert, Flame,
  Sun, Power, Ship, Info, FileText, BarChart3, Target, Layers, Sparkles, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../../simulation/useSimulation';
import { StationState, CascadeNode, RiskLevel, SimulationEvent } from '../../simulation/SimulationEngine';
import { ScenarioDefinition } from '../../simulation/ScenarioLibrary';
import { Intervention, InterventionPlan } from '../../simulation/InterventionEngine';
import { FailurePrediction } from '../../simulation/PredictiveEngine';

// ---- Utility ----
const riskColor: Record<RiskLevel, string> = {
  LOW: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  MODERATE: 'text-amber-600 bg-amber-50 border-amber-200',
  HIGH: 'text-orange-600 bg-orange-50 border-orange-200',
  CRITICAL: 'text-rose-600 bg-rose-50 border-rose-200',
};
const riskBg: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500', MODERATE: 'bg-amber-500', HIGH: 'bg-orange-500', CRITICAL: 'bg-rose-500',
};
const severityColor: Record<string, string> = {
  low: 'bg-sky-50 text-sky-700 border-sky-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

function formatHour(h: number): string {
  const days = Math.floor(h / 24);
  const hrs = Math.floor(h % 24);
  const mins = Math.round((h % 1) * 60);
  if (days > 0) return `Day ${days + 1}, ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function MetricBox({ label, value, unit, severity, icon: Icon, small }: {
  label: string; value: string | number; unit?: string;
  severity?: 'good' | 'warning' | 'critical' | 'neutral';
  icon?: React.ElementType; small?: boolean;
}) {
  const sev = severity || 'neutral';
  const border = sev === 'critical' ? 'border-rose-200 bg-rose-50/50' : sev === 'warning' ? 'border-amber-200 bg-amber-50/50' : sev === 'good' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white';
  const valColor = sev === 'critical' ? 'text-rose-700' : sev === 'warning' ? 'text-amber-700' : sev === 'good' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className={`p-3 rounded-xl border ${border} ${small ? 'p-2' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-[11px] text-slate-500 font-medium">{label}</span>
      </div>
      <div className={`${small ? 'text-sm' : 'text-lg'} font-bold ${valColor}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit && <span className="text-xs font-medium text-slate-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

// ---- Section Header ----
function SectionHeader({ title, subtitle, icon: Icon, collapsed, onToggle, badge }: {
  title: string; subtitle?: string; icon: React.ElementType;
  collapsed?: boolean; onToggle?: () => void; badge?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between py-3 px-1 cursor-pointer group">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-left">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {onToggle && (collapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />)}
      </div>
    </button>
  );
}

// ---- Main Component ----
export default function SimulationPage() {
  const navigate = useNavigate();
  const sim = useSimulation('maitri');
  const {
    state, controls, actions, scenarios, interventions, predictions,
    optimizerPlans, comparisonSnapshot, decisionSupport, optimizationHorizon,
    diagnosedProblems, availableResources, feasibleInterventions, candidatePackages,
    aiAutoApplyInfo
  } = sim;

  // Collapsible sections
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    overview: false, scenarios: false, dashboard: false, cascade: false,
    interventions: false, comparison: true, optimizer: false, predictions: true,
    risk: false, timeline: true, report: true,
  });
  const toggle = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  // Scenario custom params
  const [scenarioParams, setScenarioParams] = useState<Record<string, Record<string, number | string>>>({});

  // Broadcast scenario activation status so Header and components show LIVE RADAR DEMO only when active
  useEffect(() => {
    const hasActive = (state.activeScenarios || []).length > 0;
    try {
      sessionStorage.setItem('ant_active_scenarios', JSON.stringify(state.activeScenarios || []));
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('simulation-scenario-status', {
      detail: {
        hasActiveScenario: hasActive,
        activeScenarios: state.activeScenarios,
        stationId: state.stationId || 'maitri',
      }
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('simulation-scenario-status', {
        detail: { hasActiveScenario: false, activeScenarios: [] }
      }));
    };
  }, [state.activeScenarios, state.stationId]);

  const resilColor = state.resilienceScore > 70 ? 'text-emerald-600' : state.resilienceScore > 40 ? 'text-amber-600' : 'text-rose-600';
  const resilBg = state.resilienceScore > 70 ? 'stroke-emerald-500' : state.resilienceScore > 40 ? 'stroke-amber-500' : 'stroke-rose-500';

  // Metric severity helpers
  const tempSev = (t: number) => t < -45 ? 'critical' as const : t < -35 ? 'warning' as const : 'neutral' as const;
  const windSev = (w: number) => w > 100 ? 'critical' as const : w > 60 ? 'warning' as const : 'neutral' as const;
  const battSev = (b: number) => b < 15 ? 'critical' as const : b < 40 ? 'warning' as const : 'good' as const;
  const fuelSev = (d: number) => d < 14 ? 'critical' as const : d < 60 ? 'warning' as const : 'good' as const;

  return (
    <div className="space-y-4 pb-16 max-w-full">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors cursor-pointer mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /><span>Back to Home</span>
          </button>
          <h1 className="text-xl font-bold text-slate-900">Digital Twin Simulation Engine</h1>
          <p className="text-xs text-slate-500">SIH26060 — Operational What-If simulation with cause-effect physics engine</p>
        </div>
        {/* Station Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
            {(['maitri', 'bharati'] as const).map(sid => (
              <button key={sid} type="button" onClick={() => actions.selectStation(sid)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${sim.stationId === sid ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {sid === 'maitri' ? 'Maitri Station' : 'Bharati Station'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TIME CONTROLS BAR */}
      <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <button type="button" onClick={controls.isRunning ? controls.pause : controls.play}
            className="w-9 h-9 rounded-xl bg-sky-600 hover:bg-sky-500 flex items-center justify-center transition-colors cursor-pointer">
            {controls.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button type="button" onClick={controls.reset} className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center cursor-pointer">
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="h-6 w-px bg-slate-700 mx-1" />
          {[0.5, 1, 5, 10, 50].map(s => (
            <button key={s} type="button" onClick={() => controls.setSpeed(s)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${controls.speed === s ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {s}×
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {[1, 6, 24].map(h => (
            <button key={h} type="button" onClick={() => controls.advanceByHours(h)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer">
              +{h}h
            </button>
          ))}
          <div className="h-6 w-px bg-slate-700 mx-1" />
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-sm font-mono font-bold text-sky-300">{formatHour(state.simulationHour)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCollapsed(p => ({ ...p, optimizer: false }));
              document.getElementById('ai-decision-support-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-400/30 cursor-pointer flex items-center gap-1.5 transition-all"
            title="Jump to AI Decision Support & Recommendation Service"
          >
            <Target className="w-3.5 h-3.5 text-sky-400" />
            <span>AI Support ({optimizerPlans.length} Plans)</span>
          </button>
          <div className={`px-3 py-1 rounded-full text-[11px] font-extrabold border ${state.riskLevel === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : state.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' : state.riskLevel === 'MODERATE' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
            {state.riskLevel}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Resilience</span>
            <span className={`text-sm font-bold ${resilColor}`}>{state.resilienceScore}</span>
          </div>
          {state.activeScenarios.length > 0 && (
            <button
              id="btn-sim-radar-live-demo-top"
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-radar-demo', {
                  detail: {
                    scenarioId: state.activeScenarios[0],
                    stationId: state.stationId || 'maitri',
                    currentSimulationHour: state.simulationHour,
                    isSimulationRunning: controls.isRunning,
                    simulationSpeed: controls.speed,
                    activeRadarObservation: sim.radarObservation,
                  }
                }));
              }}

              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono font-bold text-xs tracking-wider uppercase shadow-md shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-200 active:scale-95 cursor-pointer animate-pulse shrink-0"
              title="Launch Live Doppler Radar for Activated Scenario"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>⚡ LIVE RADAR DEMO</span>
            </button>
          )}
        </div>
      </div>

      {/* STATION OVERVIEW */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader title={`${state.stationName} — Overview`} subtitle="Current operational status" icon={Layers} collapsed={collapsed.overview} onToggle={() => toggle('overview')}
          badge={<span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${riskColor[state.riskLevel]}`}>{state.riskLevel} Risk</span>} />
        {!collapsed.overview && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
            <MetricBox label="Temperature" value={state.environment.temperature} unit="°C" icon={Thermometer} severity={tempSev(state.environment.temperature)} />
            <MetricBox label="Wind Speed" value={state.environment.windSpeed} unit="km/h" icon={Wind} severity={windSev(state.environment.windSpeed)} />
            <MetricBox label="Battery" value={state.energy.batteryLevelPercent} unit="%" icon={BatteryCharging} severity={battSev(state.energy.batteryLevelPercent)} />
            <MetricBox label="Fuel Endurance" value={state.logistics.fuelEnduranceDays} unit="days" icon={Fuel} severity={fuelSev(state.logistics.fuelEnduranceDays)} />
            <MetricBox label="Crew" value={state.crew.count} icon={Users} severity={state.crew.safetyRisk === 'LOW' ? 'good' : state.crew.safetyRisk === 'MODERATE' ? 'warning' : 'critical'} />
            <MetricBox label="Power Generation" value={state.energy.totalGenerationKw} unit="kW" icon={Zap} severity={state.energy.powerDeficitKw > 0 ? 'critical' : 'good'} />
            <MetricBox label="Power Consumption" value={state.energy.totalConsumptionKw} unit="kW" icon={Gauge} severity={state.energy.powerDeficitKw > 0 ? 'critical' : 'neutral'} />
            <MetricBox label="Heating Demand" value={state.energy.heatingDemandKw} unit="kW" icon={Flame} severity={state.energy.heatingDemandKw > 80 ? 'warning' : 'neutral'} />
            <MetricBox label="Indoor Temp" value={state.infrastructure.indoorTempAvg} unit="°C" icon={Thermometer} severity={state.infrastructure.indoorTempAvg < 12 ? 'critical' : state.infrastructure.indoorTempAvg < 18 ? 'warning' : 'good'} />
            <MetricBox label="Comm Quality" value={state.communication.quality} unit="%" icon={Radio} severity={state.communication.quality < 30 ? 'critical' : state.communication.quality < 60 ? 'warning' : 'good'} />
          </div>
        )}
      </div>

      {/* RESILIENCE GAUGE + RISK ASSESSMENT (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resilience */}
        <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900">Station Resilience Score</h3>
          </div>
          <div className="flex items-center gap-6">
            {/* SVG Gauge */}
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" className={resilBg} strokeWidth="8"
                  strokeDasharray={`${state.resilienceScore * 2.64} 264`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-extrabold ${resilColor}`}>{state.resilienceScore}</span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {state.resilienceFactors.map(f => (
                <div key={f.name} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 w-28 truncate">{f.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${f.score > 70 ? 'bg-emerald-500' : f.score > 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${f.score}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 w-8 text-right">{Math.round(f.score)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">Risk Assessment</h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${riskColor[state.riskLevel]}`}>{state.riskLevel}</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {state.riskReasons.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600 py-2"><CheckCircle2 className="w-4 h-4" /> No active risk factors. Station operating normally.</div>
            ) : state.riskReasons.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${r.severity === 'critical' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${r.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'}`} />
                <div><strong>{r.factor}:</strong> {r.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SCENARIO LIBRARY */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader title="Scenario Library" subtitle="13 predefined simulation scenarios" icon={Cpu} collapsed={collapsed.scenarios} onToggle={() => toggle('scenarios')}
          badge={state.activeScenarios.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">{state.activeScenarios.length} Active</span>
              <button
                id="btn-scenario-radar-live-demo"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('open-radar-demo', {
                    detail: {
                      scenarioId: state.activeScenarios[0],
                      stationId: state.stationId || 'maitri',
                      currentSimulationHour: state.simulationHour,
                      isSimulationRunning: controls.isRunning,
                      simulationSpeed: controls.speed,
                      activeRadarObservation: sim.radarObservation,
                    }
                  }));

                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono font-bold text-[10px] tracking-wider uppercase shadow-sm shadow-red-500/20 hover:shadow-red-500/30 transition-all cursor-pointer animate-pulse"
                title="Launch Live Doppler Radar for Active Scenario"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                </span>
                <span>⚡ LIVE RADAR DEMO</span>
              </button>
            </div>
          ) : undefined} />
        {!collapsed.scenarios && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
            {scenarios.map(sc => {
              const isActive = state.activeScenarios.includes(sc.id);
              return (
                <div key={sc.id} className={`p-3 rounded-xl border transition-all ${isActive ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/50' : 'border-slate-200 bg-white hover:border-sky-300'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityColor[sc.severity]}`}>{sc.severity.toUpperCase()}</span>
                    <span className="text-[10px] text-slate-400">{sc.category}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">{sc.name}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-2 line-clamp-2">{sc.description}</p>
                  {/* Custom controls */}
                  {sc.customControls && sc.customControls.map(ctrl => (
                    <div key={ctrl.id} className="mb-2">
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">{ctrl.label}</label>
                      {ctrl.type === 'select' && ctrl.options ? (
                        <select className="w-full text-[11px] px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
                          value={scenarioParams[sc.id]?.[ctrl.id] ?? ctrl.defaultValue}
                          onChange={e => {
                            const val = e.target.value;
                            setScenarioParams(p => ({ ...p, [sc.id]: { ...p[sc.id], [ctrl.id]: val } }));
                            actions.updateScenarioParams(sc.id, { [ctrl.id]: val });
                          }}>
                          {ctrl.options.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : ctrl.type === 'slider' ? (
                        <div className="flex items-center gap-2">
                          <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step}
                            value={Number(scenarioParams[sc.id]?.[ctrl.id] ?? ctrl.defaultValue)}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setScenarioParams(p => ({ ...p, [sc.id]: { ...p[sc.id], [ctrl.id]: val } }));
                              actions.updateScenarioParams(sc.id, { [ctrl.id]: val });
                            }}
                            className="flex-1 h-1.5 accent-sky-600 cursor-pointer" />
                          <span className="text-[11px] font-mono text-slate-600 w-16 text-right">
                            {Number(scenarioParams[sc.id]?.[ctrl.id] ?? ctrl.defaultValue).toLocaleString()}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {isActive && (
                    <button
                      id={`btn-card-radar-demo-${sc.id}`}
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-radar-demo', {
                          detail: {
                            scenarioId: sc.id,
                            stationId: state.stationId || 'maitri',
                            currentSimulationHour: state.simulationHour,
                            isSimulationRunning: controls.isRunning,
                            simulationSpeed: controls.speed,
                            activeRadarObservation: sim.radarObservation,
                          }
                        }));

                      }}
                      className="w-full mb-2 py-1.5 px-3 rounded-lg bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono font-bold text-[11px] tracking-wider uppercase shadow-md shadow-red-500/20 hover:shadow-red-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 animate-pulse"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      <span>⚡ LIVE RADAR DEMO</span>
                    </button>
                  )}
                  <button type="button"
                    onClick={() => isActive ? actions.deactivateScenario(sc.id) : actions.activateScenario(sc.id, scenarioParams[sc.id])}
                    className={`w-full py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${isActive ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-sky-600 text-white hover:bg-sky-700'}`}>
                    {isActive ? 'Deactivate' : 'Activate Scenario'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CASCADE CHAIN VISUALIZATION */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader title="Cause-Effect Cascade Chain" subtitle="Real-time propagation of environmental stress through station systems" icon={Activity} collapsed={collapsed.cascade} onToggle={() => toggle('cascade')} />
        {!collapsed.cascade && (
          <div className="flex flex-wrap items-center gap-1 mt-3 overflow-x-auto pb-2">
            {state.cascadeChain.map((node, i) => (
              <div key={node.id} className="flex items-center gap-1 shrink-0">
                <div className={`px-3 py-2 rounded-xl border-2 text-center min-w-[120px] transition-all duration-500 ${
                  node.severity === 'critical' ? 'border-rose-400 bg-rose-50 shadow-md shadow-rose-100' :
                  node.severity === 'warning' ? 'border-amber-400 bg-amber-50 shadow-md shadow-amber-100' :
                  node.isActive ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50'
                }`}>
                  <div className={`text-[11px] font-bold ${
                    node.severity === 'critical' ? 'text-rose-700' :
                    node.severity === 'warning' ? 'text-amber-700' :
                    node.isActive ? 'text-sky-700' : 'text-slate-500'
                  }`}>{node.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{node.detail}</div>
                </div>
                {i < state.cascadeChain.length - 1 && (
                  <ArrowRight className={`w-4 h-4 shrink-0 ${node.isActive ? 'text-amber-500' : 'text-slate-300'}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIVE DASHBOARD */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader title="Live Systems Dashboard" subtitle="Real-time telemetry from all subsystems" icon={BarChart3} collapsed={collapsed.dashboard} onToggle={() => toggle('dashboard')} />
        {!collapsed.dashboard && (
          <div className="space-y-4 mt-3">
            {/* Generators */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Generators</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[...state.energy.generators, state.energy.backupGenerator].map(gen => (
                  <div key={gen.id} className={`p-3 rounded-xl border ${gen.status === 'Failed' ? 'border-rose-300 bg-rose-50' : gen.isOnline ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">{gen.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${gen.status === 'Failed' ? 'bg-rose-100 text-rose-700' : gen.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {gen.status === 'Failed' ? 'FAILED' : gen.isOnline ? 'ONLINE' : 'STANDBY'}
                      </span>
                    </div>
                    {gen.isOnline && (
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <div><span className="text-slate-400">Output:</span> <strong>{gen.currentOutputKw.toFixed(0)} kW</strong></div>
                        <div><span className="text-slate-400">Load:</span> <strong className={gen.loadPercent > 85 ? 'text-rose-600' : gen.loadPercent > 70 ? 'text-amber-600' : ''}>{gen.loadPercent.toFixed(0)}%</strong></div>
                        <div><span className="text-slate-400">Health:</span> <strong>{gen.health.toFixed(0)}%</strong></div>
                        <div><span className="text-slate-400">Fuel:</span> <strong>{gen.fuelRateLph.toFixed(1)} L/h</strong></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Environment + Logistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Environment</h4>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox small label="Visibility" value={state.environment.visibility} unit="km" icon={Eye} severity={state.environment.visibility < 2 ? 'critical' : state.environment.visibility < 10 ? 'warning' : 'neutral'} />
                  <MetricBox small label="Pressure" value={state.environment.airPressure} unit="hPa" icon={Gauge} severity={state.environment.airPressure < 960 ? 'warning' : 'neutral'} />
                  <MetricBox small label="Wind Chill" value={state.environment.windChill} unit="°C" icon={CloudSnow} severity={state.environment.windChill < -50 ? 'critical' : 'neutral'} />
                </div>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Logistics Endurance</h4>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox small label="Food" value={state.logistics.foodEnduranceDays} unit="days" icon={Package} severity={fuelSev(state.logistics.foodEnduranceDays)} />
                  <MetricBox small label="Water" value={state.logistics.waterEnduranceDays} unit="days" icon={Package} severity={state.logistics.waterEnduranceDays < 14 ? 'critical' : state.logistics.waterEnduranceDays < 30 ? 'warning' : 'good'} />
                  <MetricBox small label="Resupply" value={state.logistics.nextResupplyDays} unit="days" icon={Ship} severity={state.logistics.fuelEnduranceDays < state.logistics.nextResupplyDays ? 'critical' : 'neutral'} />
                </div>
              </div>
            </div>
            {/* Indoor Zones */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Indoor Zone Temperatures</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {state.infrastructure.zones.map(zone => (
                  <div key={zone.name} className={`p-2 rounded-lg border ${zone.temperature < 10 ? 'border-rose-200 bg-rose-50' : zone.temperature < 16 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                    <div className="text-[10px] text-slate-500 truncate">{zone.name}</div>
                    <div className={`text-sm font-bold ${zone.temperature < 10 ? 'text-rose-700' : zone.temperature < 16 ? 'text-amber-700' : 'text-slate-900'}`}>{zone.temperature.toFixed(1)}°C</div>
                    <div className="text-[10px] text-slate-400">{zone.isHeatingActive ? `${zone.heatingKw}kW` : 'OFF'} • {zone.category}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DYNAMIC INTERVENTION ENGINE */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader
          title="Dynamic Intervention Engine"
          subtitle="Real-time physical threat diagnosis, constraint evaluation, and candidate response packages"
          icon={Wrench}
          collapsed={collapsed.interventions}
          onToggle={() => toggle('interventions')}
          badge={
            <div className="flex items-center gap-1.5">
              {diagnosedProblems.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                  {diagnosedProblems.length} THREATS DIAGNOSED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                  NOMINAL TELEMETRY
                </span>
              )}
              {state.activeInterventions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                  {state.activeInterventions.length} Active
                </span>
              )}
            </div>
          }
        />
        {!collapsed.interventions && (
          <div className="space-y-4 mt-3">
            {/* Action Bar */}
            <div className="flex gap-2 flex-wrap items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => actions.takeComparisonSnapshot()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                >
                  📸 Snapshot for Comparison
                </button>
                <button
                  type="button"
                  onClick={() => {
                    actions.runOptimizer(optimizationHorizon);
                    setCollapsed(p => ({ ...p, optimizer: false }));
                    document.getElementById('ai-decision-support-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-sky-600 text-white hover:bg-sky-700 cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  🧠 Forward-Simulate & Rank Plans
                </button>
                <button
                  type="button"
                  onClick={() => actions.refreshCandidates()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh Feasibility
                </button>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Authoritative Physics Evaluated: {feasibleInterventions.filter(i => i.is_feasible).length} Feasible / {feasibleInterventions.length} Total
              </div>
            </div>

            {/* AI Auto-Applied Scenario Response Banner */}
            {aiAutoApplyInfo && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-sky-900 via-indigo-900 to-purple-900 text-white border border-sky-500/30 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-400/10 via-transparent to-transparent" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-sky-300" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-sky-200 tracking-wider uppercase">AI Auto-Response Activated</div>
                        <div className="text-[11px] text-sky-300/80">Scenario: {aiAutoApplyInfo.scenarioName}</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                      {aiAutoApplyInfo.interventionCount} INTERVENTIONS AUTO-APPLIED
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-100/90 leading-relaxed mb-2.5">
                    {aiAutoApplyInfo.scenarioTheme}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiAutoApplyInfo.interventionNames.map((name, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-sky-100 border border-white/10">
                        ✓ {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 1. Diagnosed Problems / Threats Banner */}
            {diagnosedProblems.length > 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs border-l-4 border-rose-500">
                <div className="text-[10px] font-bold tracking-wider uppercase text-rose-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    Diagnosed Physical Hazards & Life-Support Threat States ({diagnosedProblems.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Authoritative State Problem Identifier</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {diagnosedProblems.map((prob, pi) => (
                    <div
                      key={pi}
                      className={`p-2.5 rounded-lg border ${
                        prob.severity === 'CRITICAL'
                          ? 'bg-rose-950/40 border-rose-700/60 text-rose-100'
                          : prob.severity === 'WARNING'
                          ? 'bg-amber-950/40 border-amber-700/60 text-amber-100'
                          : 'bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-[11px] text-white flex items-center gap-1">
                          <AlertTriangle className={`w-3 h-3 ${prob.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}`} />
                          {prob.threat_type.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                          prob.severity === 'CRITICAL' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-900'
                        }`}>
                          {prob.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug mb-1.5">{prob.description}</p>
                      {prob.recommended_intervention_categories?.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap text-[9px] text-slate-400">
                          <span>Target categories:</span>
                          {prob.recommended_intervention_categories.map((cat, ci) => (
                            <span key={ci} className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                              {cat.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Station Physical State Nominal:</span> No acute power deficit or thermal threats diagnosed.
                  </div>
                </div>
                <span className="text-[11px] text-emerald-700 font-medium">Interventions available for proactive endurance hardening</span>
              </div>
            )}

            {/* 2. Available Resources Bar */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Generators Online</span>
                <span className="font-bold text-slate-800">
                  {state.energy?.generators?.filter(g => g.isOnline).length ?? 0} / {state.energy?.generators?.length ?? 0} online ({state.energy?.generators?.filter(g => g.isOnline).reduce((acc, g) => acc + (g.currentOutputKw || g.ratedCapacityKw || 0), 0) ?? 0} kW)
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Battery Storage</span>
                <span className={`font-bold ${battSev(state.energy?.batteryLevelPercent ?? 100) === 'critical' ? 'text-rose-600' : 'text-slate-800'}`}>
                  {(state.energy?.batteryLevelPercent ?? 0).toFixed(1)}% ({(((state.energy?.batteryCapacityKwh ?? 500) * (state.energy?.batteryLevelPercent ?? 0)) / 100).toFixed(0)} kWh)
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Fuel Reserves</span>
                <span className={`font-bold ${fuelSev(state.logistics?.fuelEnduranceDays ?? 100) === 'critical' ? 'text-rose-600' : 'text-slate-800'}`}>
                  {(state.logistics?.fuelEnduranceDays ?? 0).toFixed(1)} Days ({(state.logistics?.fuelLevelLiters ?? 0).toFixed(0)} L)
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Maintenance Crew</span>
                <span className="font-bold text-slate-800">
                  {availableResources?.maintenance_crew_available ?? true ? 'Specialists Available' : 'No Crew Available'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Weather EVA Window</span>
                <span className={`font-bold ${windSev(state.environment?.windSpeed ?? 0) === 'critical' ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {(state.environment?.windSpeed ?? 0) > 100 ? 'Blizzard (Outdoor Hazard)' : 'EVA Feasible'}
                </span>
              </div>
            </div>

            {/* 3. Problem-Targeted Candidate Packages */}
            {candidatePackages.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Problem-Targeted Candidate Response Packages (AI-Synthesized Combinations)
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    {candidatePackages.length} Feasible Packages Synthesized
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {candidatePackages.slice(0, 6).map((pkg, pidx) => (
                    <div key={pidx} className="p-3 rounded-xl border border-sky-100 bg-sky-50/40 hover:bg-sky-50/70 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900">
                            {pkg.names?.join(' + ') || pkg.interventions.join(' + ')}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                            Rel: {pkg.relevance_score || 80}
                          </span>
                        </div>
                        {pkg.addressed_threats?.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mb-2">
                            {pkg.addressed_threats.map((t, ti) => (
                              <span key={ti} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Targets {t.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          pkg.interventions.forEach(id => {
                            if (!state.activeInterventions.includes(id)) actions.applyIntervention(id);
                          });
                        }}
                        className="w-full mt-2 py-1.5 rounded-lg text-[11px] font-bold bg-sky-600 text-white hover:bg-sky-700 cursor-pointer shadow-xs transition-colors"
                      >
                        Apply Package ({pkg.interventions.length} Actions)
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Feasible vs Pruned Individual Interventions Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-600" />
                  Operational Interventions Catalog (Physics Prerequisites & Pruning Logic)
                </h4>
                <span className="text-[10px] text-slate-500">
                  Pruned actions dynamically disabled when physical prerequisites fail
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {feasibleInterventions.map(int => {
                  const isActive = state.activeInterventions.includes(int.id);
                  const isFeasible = int.is_feasible;

                  return (
                    <div
                      key={int.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                        isActive
                          ? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-200'
                          : isFeasible
                          ? 'border-slate-200 bg-white hover:border-slate-300'
                          : 'border-slate-200/60 bg-slate-50/80 opacity-75'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">{int.name}</span>
                          {isActive ? (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              ACTIVE
                            </span>
                          ) : isFeasible ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              FEASIBLE
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              PRUNED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{int.description}</p>

                        {/* Reasons Applicable */}
                        {isFeasible && int.reasons_applicable?.length > 0 && (
                          <div className="mb-2 space-y-0.5">
                            {int.reasons_applicable.map((r, ri) => (
                              <div key={ri} className="text-[10px] text-emerald-700 flex items-start gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reasons Pruned */}
                        {!isFeasible && int.reasons_pruned?.length > 0 && (
                          <div className="mb-2 p-1.5 rounded-lg bg-rose-50 border border-rose-100 space-y-0.5">
                            {int.reasons_pruned.map((r, ri) => (
                              <div key={ri} className="text-[10px] text-rose-700 flex items-start gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!isFeasible && !isActive}
                        onClick={() => isActive ? actions.removeIntervention(int.id) : actions.applyIntervention(int.id)}
                        className={`w-full mt-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            : isFeasible
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isActive ? 'Revert / Remove' : isFeasible ? 'Apply Intervention' : 'Pruned by Constraints'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* COMPARISON VIEW */}
      {comparisonSnapshot && (
        <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
          <SectionHeader title="Before / After Comparison" subtitle="Snapshot vs. current state" icon={BarChart3} collapsed={collapsed.comparison} onToggle={() => toggle('comparison')} />
          {!collapsed.comparison && (
            <ComparisonTable before={comparisonSnapshot.state} after={state} />
          )}
        </div>
      )}

      {/* AI DECISION SUPPORT & RECOMMENDATION SERVICE */}
      <div id="ai-decision-support-section" className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader
          title="AI Decision Support & Recommendation Service"
          subtitle="Physics-driven multi-objective optimization with explainable AI reasoning"
          icon={Target}
          collapsed={collapsed.optimizer}
          onToggle={() => toggle('optimizer')}
          badge={
            decisionSupport?.urgency ? (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                decisionSupport.urgency === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                decisionSupport.urgency === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                decisionSupport.urgency === 'ELEVATED' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {decisionSupport.urgency} URGENCY
              </span>
            ) : optimizerPlans.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {optimizerPlans.length} PLANS EVALUATED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                READY
              </span>
            )
          }
        />
        {!collapsed.optimizer && (
            <div className="space-y-4 mt-3">
              {/* Horizon & Situation Control Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-600 font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-600" /> Prediction Horizon:
                  </span>
                  {[6, 12, 24, 48, 72, 168].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => actions.runOptimizer(h)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                        optimizationHorizon === h
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {h === 168 ? '7 Days' : `${h}h`}
                    </button>
                  ))}
                </div>
                {decisionSupport?.traceability ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200">Sim #{decisionSupport.traceability.simulation_id}</span>
                    <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800">Horizon: {decisionSupport.traceability.simulation_horizon}h</span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800">{decisionSupport.traceability.model_version}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200">Sim: Local Physics Engine</span>
                    <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800">Horizon: {optimizationHorizon}h</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Deterministic Offline AI</span>
                  </div>
                )}
              </div>

              {/* AI Situation Summary Callout */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs leading-relaxed border-l-4 border-sky-400">
                <div className="text-[10px] font-bold tracking-wider uppercase text-sky-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" /> Operational Situation Assessment
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Confidence: {decisionSupport?.confidence || 'HIGH (Physics Grounded)'}</span>
                </div>
                <p>
                  {decisionSupport?.situation?.summary || decisionSupport?.situation_summary || (
                    state.riskReasons.length > 0
                      ? `Active hazards identified: ${state.riskReasons.map(r => `${r.factor} (${r.detail})`).join('; ')}. Multi-objective optimizer has evaluated ${optimizerPlans.length} response candidate plans to prevent cascading life-support failures.`
                      : `Station operating under nominal baseline parameters with ${state.activeScenarios.length} active scenario(s). Optimizer evaluated ${optimizerPlans.length} candidate intervention permutations for endurance and reserve stability.`
                  )}
                </p>
              </div>

              {/* Hard Constraints Status Alert */}
              {decisionSupport?.optimizer?.hard_constraints && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  decisionSupport.optimizer.hard_constraints.passed
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {decisionSupport.optimizer.hard_constraints.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">
                      {decisionSupport.optimizer.hard_constraints.passed
                        ? 'Hard Safety Constraints Verified (Safe)'
                        : 'Safety Constraint Violations Detected (Unsafe)'}
                    </div>
                    {decisionSupport.optimizer.hard_constraints.passed ? (
                      <div className="text-[11px] text-emerald-700">
                        Critical indoor temp ≥ 10°C, zero unserved life-support deficit, emergency battery reserve maintained.
                      </div>
                    ) : (
                      <ul className="list-disc pl-4 mt-1 text-[11px] text-rose-700 space-y-0.5">
                        {decisionSupport.optimizer.hard_constraints.violations.map((v: string, vi: number) => (
                          <li key={vi}>{v}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Candidate Plans Pruned / Rejected Alert */}
              {((decisionSupport?.rejectedPlans && decisionSupport.rejectedPlans.length > 0) ||
                (decisionSupport?.optimizer?.rejected_plans && decisionSupport.optimizer.rejected_plans.length > 0)) && (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-xs text-rose-900">
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Physics Safety Pruning: Candidate Plans Failing Hard Operational Constraints
                  </div>
                  <div className="space-y-1.5 mt-1.5">
                    {(decisionSupport?.rejectedPlans || decisionSupport?.optimizer?.rejected_plans || []).slice(0, 4).map((rp: any, rpi: number) => (
                      <div key={rpi} className="p-2 rounded-lg bg-white border border-rose-100 text-[11px]">
                        <div className="font-semibold text-slate-800">
                          Candidate Combination: <span className="text-rose-700">{Array.isArray(rp.interventions) ? rp.interventions.join(' + ') : rp.interventions}</span>
                        </div>
                        {rp.violations && rp.violations.length > 0 && (
                          <div className="text-[10px] text-rose-600 mt-0.5">
                            Violations: {rp.violations.join('; ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forward Simulation Outcome Comparison Table */}
              {decisionSupport?.optimizer?.baseline_outcome && decisionSupport?.optimizer?.predicted_outcome && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <span>Forward Simulation Outcome ({optimizationHorizon}h Prediction Window)</span>
                    <span className="text-[10px] font-normal text-slate-500">Comparing: Without Intervention vs Recommended Plan</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500 font-semibold text-left">
                          <th className="py-1.5 px-2">Metric</th>
                          <th className="py-1.5 px-2">Without Intervention (Baseline)</th>
                          <th className="py-1.5 px-2">With Recommended Plan</th>
                          <th className="py-1.5 px-2 text-right">Delta / Impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="py-1.5 px-2 font-medium">Resilience Score</td>
                          <td className="py-1.5 px-2">{decisionSupport.optimizer.baseline_outcome.resilienceScore ?? decisionSupport.optimizer.baseline_outcome.resilience_score}/100</td>
                          <td className="py-1.5 px-2 font-bold text-emerald-600">{decisionSupport.optimizer.predicted_outcome.resilienceScore ?? decisionSupport.optimizer.predicted_outcome.resilience_score}/100</td>
                          <td className="py-1.5 px-2 text-right font-semibold text-emerald-600">
                            +{((decisionSupport.optimizer.predicted_outcome.resilienceScore ?? decisionSupport.optimizer.predicted_outcome.resilience_score) - (decisionSupport.optimizer.baseline_outcome.resilienceScore ?? decisionSupport.optimizer.baseline_outcome.resilience_score)).toFixed(1)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 font-medium">Power Deficit</td>
                          <td className="py-1.5 px-2 text-rose-600 font-semibold">{decisionSupport.optimizer.baseline_outcome.powerDeficitKw ?? decisionSupport.optimizer.baseline_outcome.power_deficit_kw} kW</td>
                          <td className="py-1.5 px-2 text-emerald-600 font-bold">{decisionSupport.optimizer.predicted_outcome.powerDeficitKw ?? decisionSupport.optimizer.predicted_outcome.power_deficit_kw} kW</td>
                          <td className="py-1.5 px-2 text-right font-semibold text-emerald-600">
                            -{Math.max(0, (decisionSupport.optimizer.baseline_outcome.powerDeficitKw ?? decisionSupport.optimizer.baseline_outcome.power_deficit_kw) - (decisionSupport.optimizer.predicted_outcome.powerDeficitKw ?? decisionSupport.optimizer.predicted_outcome.power_deficit_kw)).toFixed(1)} kW
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 font-medium">Battery Reserve</td>
                          <td className="py-1.5 px-2">{decisionSupport.optimizer.baseline_outcome.batteryLevelPercent ?? decisionSupport.optimizer.baseline_outcome.battery_level_percent}%</td>
                          <td className="py-1.5 px-2 font-bold">{decisionSupport.optimizer.predicted_outcome.batteryLevelPercent ?? decisionSupport.optimizer.predicted_outcome.battery_level_percent}%</td>
                          <td className="py-1.5 px-2 text-right font-semibold text-emerald-600">
                            +{((decisionSupport.optimizer.predicted_outcome.batteryLevelPercent ?? decisionSupport.optimizer.predicted_outcome.battery_level_percent) - (decisionSupport.optimizer.baseline_outcome.batteryLevelPercent ?? decisionSupport.optimizer.baseline_outcome.battery_level_percent)).toFixed(1)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 font-medium">Habitat Indoor Temp</td>
                          <td className="py-1.5 px-2">{decisionSupport.optimizer.baseline_outcome.indoorTempAvg ?? decisionSupport.optimizer.baseline_outcome.indoor_temp_avg}°C</td>
                          <td className="py-1.5 px-2 font-bold">{decisionSupport.optimizer.predicted_outcome.indoorTempAvg ?? decisionSupport.optimizer.predicted_outcome.indoor_temp_avg}°C</td>
                          <td className="py-1.5 px-2 text-right font-semibold text-emerald-600">
                            +{((decisionSupport.optimizer.predicted_outcome.indoorTempAvg ?? decisionSupport.optimizer.predicted_outcome.indoor_temp_avg) - (decisionSupport.optimizer.baseline_outcome.indoorTempAvg ?? decisionSupport.optimizer.baseline_outcome.indoor_temp_avg)).toFixed(1)}°C
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 font-medium">Fuel Endurance</td>
                          <td className="py-1.5 px-2">{decisionSupport.optimizer.baseline_outcome.fuelEnduranceDays ?? decisionSupport.optimizer.baseline_outcome.fuel_endurance_days} days</td>
                          <td className="py-1.5 px-2 font-bold">{decisionSupport.optimizer.predicted_outcome.fuelEnduranceDays ?? decisionSupport.optimizer.predicted_outcome.fuel_endurance_days} days</td>
                          <td className="py-1.5 px-2 text-right text-slate-500">
                            {((decisionSupport.optimizer.predicted_outcome.fuelEnduranceDays ?? decisionSupport.optimizer.predicted_outcome.fuel_endurance_days) - (decisionSupport.optimizer.baseline_outcome.fuelEnduranceDays ?? decisionSupport.optimizer.baseline_outcome.fuel_endurance_days)).toFixed(1)} days
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ranked Candidate Intervention Plans */}
              <div className="space-y-3">
                {optimizerPlans.map((plan: any, idx: number) => {
                  const isRec = idx === 0;
                  const whyNot = plan.whyNotSelected || plan.why_not_selected;
                  const hardPassed = plan.hard_constraints ? plan.hard_constraints.passed : (plan.hardConstraints ? plan.hardConstraints.passed : true);

                  return (
                    <div key={plan.id} className={`p-4 rounded-xl border transition-all ${
                      isRec ? 'border-emerald-300 bg-emerald-50/30 ring-2 ring-emerald-200' : 'border-slate-200 bg-white'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                            isRec ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {plan.rank || idx + 1}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{plan.name}</span>
                          {isRec && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              RECOMMENDED ACTION
                            </span>
                          )}
                          {!hardPassed && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                              SAFETY CONSTRAINT VIOLATED
                            </span>
                          )}
                        </div>
                        <span className={`text-lg font-extrabold ${
                          (plan.scores?.overallScore ?? plan.scores?.overall_score ?? 0) > 70
                            ? 'text-emerald-600'
                            : (plan.scores?.overallScore ?? plan.scores?.overall_score ?? 0) > 50
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}>
                          {Math.round(plan.scores?.overallScore ?? plan.scores?.overall_score ?? 0)}
                        </span>
                      </div>

                      {/* Score Metrics Breakdown */}
                      {plan.scores && (
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                          {[
                            { label: 'Fuel', value: plan.scores.fuelEndurance ?? plan.scores.fuel_endurance ?? 0 },
                            { label: 'Power', value: plan.scores.powerStability ?? plan.scores.power_stability ?? 0 },
                            { label: 'Battery', value: plan.scores.batteryReserve ?? plan.scores.battery_reserve ?? 0 },
                            { label: 'Resources', value: plan.scores.resourceEndurance ?? plan.scores.resource_endurance ?? 0 },
                            { label: 'Risk', value: 100 - (plan.scores.operationalRisk ?? plan.scores.operational_risk ?? 50) },
                            { label: 'Equipment', value: 100 - (plan.scores.equipmentStress ?? plan.scores.equipment_stress ?? 50) },
                            { label: 'Safety', value: plan.scores.crewSafety ?? plan.scores.crew_safety ?? 0 },
                          ].map(s => (
                            <div key={s.label} className="text-center">
                              <div className="text-[9px] text-slate-400 uppercase font-semibold">{s.label}</div>
                              <div className={`text-xs font-bold ${
                                s.value > 70 ? 'text-emerald-600' : s.value > 40 ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {Math.round(s.value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reasoning or Why Not Selected */}
                      <div className="space-y-1 my-2">
                        {isRec && decisionSupport?.why && decisionSupport.why.length > 0 ? (
                          decisionSupport.why.map((r: string, ri: number) => (
                            <div key={ri} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{r}</span>
                            </div>
                          ))
                        ) : (
                          (plan.reasoning || []).map((r: string, ri: number) => (
                            <div key={ri} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{r}</span>
                            </div>
                          ))
                        )}

                        {!isRec && whyNot && (
                          <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 mt-1 flex items-start gap-1.5">
                            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span><strong>Why not recommended:</strong> {whyNot}</span>
                          </div>
                        )}
                      </div>

                      {/* Tradeoffs for Recommended Plan */}
                      {isRec && ((plan.tradeoffs && plan.tradeoffs.length > 0) || (decisionSupport?.tradeoffs && decisionSupport.tradeoffs.length > 0)) && (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 my-2 text-[11px] text-slate-600">
                          <span className="font-bold text-slate-700 block mb-1">Operational Tradeoffs:</span>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {(decisionSupport?.tradeoffs || plan.tradeoffs).map((t: string, ti: number) => (
                              <li key={ti}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {isRec && (
                        <button
                          type="button"
                          onClick={() => {
                            (plan.interventions || []).forEach((id: string) => {
                              if (!state.activeInterventions.includes(id)) actions.applyIntervention(id);
                            });
                          }}
                          className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 cursor-pointer shadow-xs transition-all"
                        >
                          Execute Recommended Response Plan ({plan.interventions.length} Actions)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      {/* PREDICTIVE FAILURE */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader title="Predictive Failure Analysis" subtitle="Equipment health trends and failure probability" icon={TrendingDown}
          collapsed={collapsed.predictions} onToggle={() => toggle('predictions')}
          badge={predictions.filter(p => p.severity === 'high' || p.severity === 'critical').length > 0 ?
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">{predictions.filter(p => p.severity === 'high' || p.severity === 'critical').length} At Risk</span> : undefined} />
        {!collapsed.predictions && (
          <div className="space-y-3 mt-3">
            {predictions.map(pred => (
              <div key={pred.equipmentId} className={`p-3 rounded-xl border ${pred.severity === 'critical' ? 'border-rose-200 bg-rose-50/30' : pred.severity === 'high' ? 'border-orange-200 bg-orange-50/30' : pred.severity === 'medium' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{pred.equipmentName}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${severityColor[pred.severity]}`}>{pred.severity.toUpperCase()}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-800">Health: {pred.currentHealth}%</div>
                    <div className="text-[10px] text-slate-500">Failure: {pred.failureProbability}%</div>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 mb-2 overflow-hidden">
                  <div className={`h-full rounded-full ${pred.currentHealth > 70 ? 'bg-emerald-500' : pred.currentHealth > 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${pred.currentHealth}%`, transition: 'width 0.5s' }} />
                </div>
                {pred.abnormalFactors.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Abnormal Parameters</div>
                    {pred.abnormalFactors.map((f, i) => (
                      <div key={i} className="text-[11px] text-slate-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        {f.parameter}: <strong>{f.currentValue}</strong> (normal: {f.normalRange}) — {f.deviationPercent}% above normal
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Trend: <strong className={pred.trend === 'rapidly_declining' ? 'text-rose-600' : pred.trend === 'declining' ? 'text-amber-600' : 'text-emerald-600'}>{pred.trend.replace('_', ' ')}</strong></span>
                  <span className="text-slate-500">Window: <strong>{pred.estimatedFailureWindow}</strong></span>
                </div>
                {pred.recommendedMaintenance.length > 0 && pred.severity !== 'low' && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Recommended Maintenance</div>
                    {pred.recommendedMaintenance.map((m, i) => (
                      <div key={i} className="text-[11px] text-slate-600 flex items-start gap-1"><Wrench className="w-3 h-3 text-sky-500 shrink-0 mt-0.5" />{m}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {predictions.length === 0 && <div className="text-xs text-slate-500 py-4 text-center">Run the simulation to generate predictive failure analysis.</div>}
          </div>
        )}
      </div>

      {/* EVENT TIMELINE */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader title="Event Timeline" subtitle="Chronological log of all events, alerts, and interventions" icon={Clock}
          collapsed={collapsed.timeline} onToggle={() => toggle('timeline')}
          badge={state.events.length > 0 ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{state.events.length} events</span> : undefined} />
        {!collapsed.timeline && (
          <div className="space-y-1.5 mt-3 max-h-80 overflow-y-auto pr-1">
            {state.events.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No events yet. Activate a scenario and run the simulation.</div>
            ) : [...state.events].reverse().map((ev, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-[11px] ${ev.type === 'critical' ? 'bg-rose-50' : ev.type === 'warning' ? 'bg-amber-50' : ev.type === 'intervention' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${ev.type === 'critical' ? 'bg-rose-500' : ev.type === 'warning' ? 'bg-amber-500' : ev.type === 'intervention' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{formatHour(ev.hour)}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{ev.category}</span>
                  </div>
                  <div className="font-bold text-slate-800">{ev.title}</div>
                  <div className="text-slate-600">{ev.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SIMULATION REPORT */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
        <SectionHeader title="Simulation Report" subtitle="Summary of simulation results" icon={FileText}
          collapsed={collapsed.report} onToggle={() => toggle('report')} />
        {!collapsed.report && <SimulationReportPanel state={state} baseline={sim.history[0]?.state} />}
      </div>
    </div>
  );
}

// ---- Comparison Table Subcomponent ----
function ComparisonTable({ before, after }: { before: StationState; after: StationState }) {
  const rows = [
    { label: 'Temperature', before: `${before.environment.temperature.toFixed(1)}°C`, after: `${after.environment.temperature.toFixed(1)}°C`, delta: after.environment.temperature - before.environment.temperature },
    { label: 'Wind Speed', before: `${before.environment.windSpeed.toFixed(0)} km/h`, after: `${after.environment.windSpeed.toFixed(0)} km/h`, delta: after.environment.windSpeed - before.environment.windSpeed },
    { label: 'Power Generation', before: `${before.energy.totalGenerationKw.toFixed(0)} kW`, after: `${after.energy.totalGenerationKw.toFixed(0)} kW`, delta: after.energy.totalGenerationKw - before.energy.totalGenerationKw },
    { label: 'Power Consumption', before: `${before.energy.totalConsumptionKw.toFixed(0)} kW`, after: `${after.energy.totalConsumptionKw.toFixed(0)} kW`, delta: after.energy.totalConsumptionKw - before.energy.totalConsumptionKw },
    { label: 'Battery Level', before: `${before.energy.batteryLevelPercent.toFixed(1)}%`, after: `${after.energy.batteryLevelPercent.toFixed(1)}%`, delta: after.energy.batteryLevelPercent - before.energy.batteryLevelPercent },
    { label: 'Fuel Endurance', before: `${before.logistics.fuelEnduranceDays.toFixed(1)} days`, after: `${after.logistics.fuelEnduranceDays.toFixed(1)} days`, delta: after.logistics.fuelEnduranceDays - before.logistics.fuelEnduranceDays },
    { label: 'Heating Demand', before: `${before.energy.heatingDemandKw.toFixed(0)} kW`, after: `${after.energy.heatingDemandKw.toFixed(0)} kW`, delta: after.energy.heatingDemandKw - before.energy.heatingDemandKw },
    { label: 'Indoor Temp', before: `${before.infrastructure.indoorTempAvg.toFixed(1)}°C`, after: `${after.infrastructure.indoorTempAvg.toFixed(1)}°C`, delta: after.infrastructure.indoorTempAvg - before.infrastructure.indoorTempAvg },
    { label: 'Resilience Score', before: `${before.resilienceScore}`, after: `${after.resilienceScore}`, delta: after.resilienceScore - before.resilienceScore },
  ];
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead><tr className="border-b border-slate-200">
          <th className="text-left py-2 text-slate-500 font-semibold">Metric</th>
          <th className="text-right py-2 text-slate-500 font-semibold">Before</th>
          <th className="text-right py-2 text-slate-500 font-semibold">After</th>
          <th className="text-right py-2 text-slate-500 font-semibold">Change</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className="border-b border-slate-50">
              <td className="py-2 font-medium text-slate-800">{r.label}</td>
              <td className="py-2 text-right text-slate-600">{r.before}</td>
              <td className="py-2 text-right font-bold text-slate-900">{r.after}</td>
              <td className={`py-2 text-right font-bold ${r.delta > 0 ? 'text-rose-600' : r.delta < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {r.delta > 0 ? '+' : ''}{r.delta.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Simulation Report Subcomponent ----
function SimulationReportPanel({ state, baseline }: { state: StationState; baseline?: StationState }) {
  if (!baseline || state.simulationHour < 0.5) {
    return <div className="text-xs text-slate-500 py-4 text-center mt-3">Run a simulation to generate a report.</div>;
  }
  const impacts: string[] = [];
  if (state.energy.powerDeficitKw > 0) impacts.push(`Power deficit of ${state.energy.powerDeficitKw.toFixed(0)} kW detected`);
  if (state.energy.batteryLevelPercent < baseline.energy.batteryLevelPercent - 10) impacts.push(`Battery dropped from ${baseline.energy.batteryLevelPercent.toFixed(0)}% to ${state.energy.batteryLevelPercent.toFixed(0)}%`);
  if (state.logistics.fuelEnduranceDays < baseline.logistics.fuelEnduranceDays * 0.5) impacts.push(`Fuel endurance decreased from ${baseline.logistics.fuelEnduranceDays.toFixed(0)} to ${state.logistics.fuelEnduranceDays.toFixed(0)} days`);
  if (state.infrastructure.indoorTempAvg < baseline.infrastructure.indoorTempAvg - 3) impacts.push(`Indoor temperature dropped from ${baseline.infrastructure.indoorTempAvg.toFixed(1)}°C to ${state.infrastructure.indoorTempAvg.toFixed(1)}°C`);
  if (state.resilienceScore < baseline.resilienceScore - 15) impacts.push(`Resilience score dropped from ${baseline.resilienceScore} to ${state.resilienceScore}`);
  const failedEquip = state.equipment.filter(e => e.status === 'Failed');
  if (failedEquip.length > 0) impacts.push(`${failedEquip.length} equipment failure(s): ${failedEquip.map(e => e.name).join(', ')}`);

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Scenario</div>
          <div className="text-xs font-bold text-slate-900 mt-1">{state.activeScenarios.length > 0 ? state.activeScenarios.join(' + ') : 'None'}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Duration</div>
          <div className="text-xs font-bold text-slate-900 mt-1">{formatHour(state.simulationHour)}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Initial Risk</div>
          <div className={`text-xs font-bold mt-1 ${riskColor[baseline.riskLevel].split(' ')[0]}`}>{baseline.riskLevel}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Final Risk</div>
          <div className={`text-xs font-bold mt-1 ${riskColor[state.riskLevel].split(' ')[0]}`}>{state.riskLevel}</div>
        </div>
      </div>
      {impacts.length > 0 && (
        <div>
          <h4 className="text-[11px] font-bold text-slate-600 uppercase mb-1.5">Major Impacts</h4>
          {impacts.map((imp, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700 mb-1">
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />{imp}
            </div>
          ))}
        </div>
      )}
      {state.activeInterventions.length > 0 && (
        <div>
          <h4 className="text-[11px] font-bold text-slate-600 uppercase mb-1.5">Applied Interventions</h4>
          {state.activeInterventions.map((id, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-emerald-700 mb-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />{id.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
      )}
      {state.riskReasons.length > 0 && (
        <div>
          <h4 className="text-[11px] font-bold text-slate-600 uppercase mb-1.5">Active Risk Factors</h4>
          {state.riskReasons.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700 mb-1">
              <AlertTriangle className={`w-3 h-3 ${r.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'} shrink-0 mt-0.5`} />{r.factor}: {r.detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
