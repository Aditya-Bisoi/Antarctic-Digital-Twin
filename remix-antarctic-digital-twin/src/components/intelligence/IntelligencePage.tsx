// ============================================================================
// IntelligencePage.tsx — Innovation features: Sense → Understand → Predict → Protect
// Antarctic Digital Twin — SIH26060
//
// Three panels:
//  1. Sensor-to-Capability Intelligence — what mission function is at risk & how soon
//  2. Twin-of-Twins Resilience Testing — same scenario run across Maitri & Bharati
//  3. Predictive Incident Memory — real events + simulated failures -> proven responses
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Brain, Radar, GitCompare, History, ShieldCheck,
  AlertTriangle, AlertOctagon, Clock, ChevronDown, ChevronRight,
  Sparkles, Play, Loader2, Trophy, PackageCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../../simulation/useSimulation';
import { generatePredictions } from '../../simulation/PredictiveEngine';
import { assessCapabilities, CapabilityAssessment, CapabilityStatus } from '../../simulation/CapabilityIntelligence';
import { matchIncidentMemory, IncidentMatch, IncidentConfidence } from '../../simulation/IncidentMemory';
import { runTwinOfTwinsTest, TwinComparisonResult } from '../../simulation/TwinOfTwinsEngine';
import { SCENARIO_LIBRARY } from '../../simulation/ScenarioLibrary';

const statusStyles: Record<CapabilityStatus, { badge: string; bar: string; label: string; icon: React.ElementType }> = {
  secure: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', label: 'Secure', icon: ShieldCheck },
  at_risk: { badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500', label: 'At Risk', icon: AlertTriangle },
  critical: { badge: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-500', label: 'Critical', icon: AlertOctagon },
};

const confidenceStyles: Record<IncidentConfidence, string> = {
  strong: 'bg-rose-50 text-rose-700 border-rose-200',
  likely: 'bg-amber-50 text-amber-700 border-amber-200',
  possible: 'bg-sky-50 text-sky-700 border-sky-200',
};

function SectionHeader({ icon: Icon, eyebrow, title, description }: { icon: React.ElementType; eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <span className="block text-[11px] font-bold text-sky-600 uppercase tracking-wider">{eyebrow}</span>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">{description}</p>
      </div>
    </div>
  );
}

// ---- 1. Sensor-to-Capability Intelligence ----

function CapabilityCard({ cap }: { cap: CapabilityAssessment }) {
  const [expanded, setExpanded] = useState(false);
  const style = statusStyles[cap.status];
  const Icon = style.icon;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-xs overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${cap.status === 'secure' ? 'text-emerald-500' : cap.status === 'at_risk' ? 'text-amber-500' : 'text-rose-500'}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{cap.name}</p>
            <p className="text-xs text-slate-500 truncate">{cap.timeToImpactLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex flex-col items-end w-28">
            <span className="text-xs font-mono text-slate-500">{cap.capabilityScore}/100</span>
            <div className="w-full h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
              <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${cap.capabilityScore}%` }} />
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>{style.label}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">{cap.missionImpact}</p>
          {cap.contributingSensors.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contributing Sensors</p>
              {cap.contributingSensors.map((s) => (
                <div key={s.equipmentId} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-slate-700 font-medium truncate">{s.equipmentName}</span>
                  <span className="text-slate-500 font-mono shrink-0 ml-2">
                    {s.currentHealth}% health · {s.failureProbability}% failure risk · {s.estimatedFailureWindow}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No linked equipment telemetry for this function yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- 2. Twin-of-Twins Resilience Testing ----

function TwinStationColumn({ result, isWinner }: { result: TwinComparisonResult['maitri']; isWinner: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${isWinner ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-800">{result.stationName}</h4>
        {isWinner && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            <Trophy className="w-3 h-3" /> More Resilient
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Resilience Score</p>
          <p className="text-lg font-bold text-slate-800">{result.finalResilienceScore}</p>
          <p className={`text-[11px] font-medium ${result.resilienceDelta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {result.resilienceDelta <= 0 ? '' : '+'}{result.resilienceDelta} vs baseline
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Risk Level</p>
          <p className="text-lg font-bold text-slate-800">{result.finalRiskLevel}</p>
          <p className="text-[11px] text-slate-500">{result.criticalEventCount} critical event(s)</p>
        </div>
      </div>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Weakest Function</p>
      {result.weakestCapability ? (
        <div className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
          <span className="text-slate-700 font-medium truncate">{result.weakestCapability.name}</span>
          <span className={`font-mono shrink-0 ml-2 ${result.weakestCapability.status === 'critical' ? 'text-rose-600' : 'text-amber-600'}`}>
            {result.weakestCapability.capabilityScore}/100
          </span>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No function under strain.</p>
      )}
    </div>
  );
}

function TwinOfTwinsPanel() {
  const [scenarioId, setScenarioId] = useState('antarctic_storm');
  const [horizon, setHorizon] = useState(48);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TwinComparisonResult | null>(null);

  const runnableScenarios = useMemo(() => SCENARIO_LIBRARY.filter((s) => s.id !== 'normal'), []);

  const handleRun = () => {
    setIsRunning(true);
    // Yield to the browser so the button shows its loading state before the
    // (synchronous, CPU-bound) twin simulations run.
    setTimeout(() => {
      const res = runTwinOfTwinsTest(scenarioId, horizon);
      setResult(res);
      setIsRunning(false);
    }, 30);
  };

  return (
    <div>
      <div className="rounded-2xl border border-slate-100 bg-white shadow-xs p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Failure Scenario</label>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            {runnableScenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Horizon (hrs)</label>
          <input
            type="number"
            min={6}
            max={168}
            step={6}
            value={horizon}
            onChange={(e) => setHorizon(Math.min(168, Math.max(6, Number(e.target.value) || 48)))}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 transition-colors"
        >
          {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Running Twin Test…' : 'Run Twin-of-Twins Test'}
        </button>
      </div>

      {result ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
            <p className="text-xs text-sky-800 leading-relaxed">
              <span className="font-semibold">{result.scenarioName}</span> replayed identically across both stations over a {result.horizonHours}-hour horizon.
              Resilience gap: <span className="font-mono font-semibold">{result.resilienceGapPoints} pts</span>.
              {' '}{result.backupPriorityNote}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <TwinStationColumn result={result.maitri} isWinner={result.moreResilientStationId === 'maitri'} />
            <TwinStationColumn result={result.bharati} isWinner={result.moreResilientStationId === 'bharati'} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          Choose a scenario and run the test to compare how Maitri and Bharati weather the same failure.
        </div>
      )}
    </div>
  );
}

// ---- 3. Predictive Incident Memory ----

function IncidentCard({ match }: { match: IncidentMatch }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-xs overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <History className="w-4 h-4 text-sky-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{match.pattern}</p>
            <p className="text-xs text-slate-500">{match.recentOccurrences} matching event(s) in this station's log</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${confidenceStyles[match.confidence]}`}>
            {match.confidence} match
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">{match.description}</p>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Proven Response</p>
            <ul className="space-y-1">
              {match.provenResponse.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-slate-400 italic leading-relaxed">{match.historicalNote}</p>
        </div>
      )}
    </div>
  );
}

// ---- Page ----

export default function IntelligencePage() {
  const navigate = useNavigate();
  const [stationId, setStationId] = useState<'maitri' | 'bharati'>('maitri');
  const sim = useSimulation(stationId);

  const predictions = useMemo(() => generatePredictions(sim.state), [sim.state]);
  const capabilities = useMemo(() => assessCapabilities(sim.state, predictions), [sim.state, predictions]);
  const incidentMatches = useMemo(() => matchIncidentMemory(sim.state, predictions), [sim.state, predictions]);

  const atRiskCount = capabilities.filter((c) => c.status !== 'secure').length;

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate('/simulations')}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-sky-600 hover:border-sky-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500" />
            <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">Core Innovation</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 -mt-0.5">Sense → Understand → Predict → Protect</h1>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-5 max-w-3xl">
        Sensor-to-capability intelligence, twin-of-twins resilience testing, and predictive incident memory —
        turning raw telemetry into mission-impact awareness before failures escalate.
      </p>

      {/* Station selector */}
      <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6">
        {(['maitri', 'bharati'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setStationId(id)}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors capitalize ${
              stationId === id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {id} Station
          </button>
        ))}
      </div>

      {/* 1. Sensor-to-Capability Intelligence */}
      <section className="mb-10">
        <SectionHeader
          icon={Radar}
          eyebrow="Innovation 1 · Sense + Understand"
          title="Sensor-to-Capability Intelligence"
          description="Converts live sensor changes into mission impact — showing not just what is failing, but which critical station function is at risk and how soon."
        />
        <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
          <span className={`font-semibold px-2 py-0.5 rounded-full border ${atRiskCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {atRiskCount} of {capabilities.length} functions need attention
          </span>
        </div>
        <div className="space-y-2.5">
          {capabilities.map((cap) => (
            <CapabilityCard key={cap.id} cap={cap} />
          ))}
        </div>
      </section>

      {/* 2. Twin-of-Twins Resilience Testing */}
      <section className="mb-10">
        <SectionHeader
          icon={GitCompare}
          eyebrow="Innovation 2 · Predict"
          title="Twin-of-Twins Resilience Testing"
          description="Runs the same failure scenario across the Maitri and Bharati digital twins to compare resilience, identify critical weaknesses, and set backup and resource priorities."
        />
        <TwinOfTwinsPanel />
      </section>

      {/* 3. Predictive Incident Memory */}
      <section>
        <SectionHeader
          icon={Brain}
          eyebrow="Innovation 3 · Protect"
          title="Predictive Incident Memory"
          description="Combines real sensor events with simulated-failure signatures to recognize recurring failure patterns and suggest proven responses before the situation escalates."
        />
        {incidentMatches.length > 0 ? (
          <div className="space-y-2.5">
            {incidentMatches.map((m) => (
              <IncidentCard key={m.id} match={m} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
            <Clock className="w-5 h-5" />
            No recognized incident patterns are currently active for {sim.state.stationName}.
          </div>
        )}
      </section>
    </div>
  );
}
