// ============================================================================
// useSimulation.ts — React hook wrapping the simulation engine
// Antarctic Digital Twin — SIH26060
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { SimulationEngine, StationState, StateSnapshot } from './SimulationEngine';
import { ScenarioDefinition, SCENARIO_LIBRARY, applyScenarioEvents, applyCustomScenarioParams } from './ScenarioLibrary';
import { INTERVENTIONS, Intervention, InterventionPlan, optimizeDecisions, optimizeForScenario, getInterventionById } from './InterventionEngine';
import { FailurePrediction, generatePredictions } from './PredictiveEngine';
import { calculateStormKinematics } from './stormPhysics';
import { api } from '../api/client';


export interface SimulationControls {
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  advanceByHours: (hours: number) => void;
  isRunning: boolean;
  speed: number;
}

export interface DiagnosedProblem {
  threat_type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  metrics: Record<string, any>;
  recommended_intervention_categories: string[];
}

export interface FeasibleIntervention {
  id: string;
  name: string;
  description: string;
  category: string;
  is_feasible: boolean;
  reasons_applicable: string[];
  reasons_pruned: string[];
  relevance_score: number;
  resource_cost?: Record<string, any>;
  prerequisites?: Record<string, any>;
  constraints?: Record<string, any>;
  expected_effects?: Record<string, any>;
}

export interface CandidatePackage {
  interventions: string[];
  names: string[];
  addressed_threats: string[];
  estimated_cost: number;
  relevance_score: number;
}

export interface SimulationActions {
  selectStation: (stationId: 'maitri' | 'bharati') => void;
  activateScenario: (scenarioId: string, params?: Record<string, number | string>) => void;
  deactivateScenario: (scenarioId: string) => void;
  updateScenarioParams: (scenarioId: string, params: Record<string, number | string>) => void;
  applyIntervention: (interventionId: string) => void;
  removeIntervention: (interventionId: string) => void;
  runOptimizer: (horizonHours?: number, weights?: any) => void;
  setHorizon: (hours: number) => void;
  takeComparisonSnapshot: () => void;
  refreshCandidates: () => Promise<void>;
}

export interface AIAutoApplyInfo {
  planName: string;
  scenarioName: string;
  scenarioTheme: string;
  interventionCount: number;
  interventionNames: string[];
  timestamp: number;
}

export interface UseSimulationReturn {
  state: StationState;
  controls: SimulationControls;
  actions: SimulationActions;
  history: StateSnapshot[];
  scenarios: ScenarioDefinition[];
  interventions: Intervention[];
  predictions: FailurePrediction[];
  optimizerPlans: InterventionPlan[];
  decisionSupport: any;
  optimizationHorizon: number;
  comparisonSnapshot: StateSnapshot | null;
  stationId: 'maitri' | 'bharati';
  activeRunId: number | string | null;
  diagnosedProblems: DiagnosedProblem[];
  availableResources: Record<string, any> | null;
  feasibleInterventions: FeasibleIntervention[];
  candidatePackages: CandidatePackage[];
  aiAutoApplyInfo: AIAutoApplyInfo | null;
  activeScenarioId: string | null;
  activeSimulationId: number | string | null;
  radarObservation: any;
  radarStatus: 'IDLE' | 'APPROACHING' | 'IMPACT';
}

function getDefaultFeasibleInterventions(engineState: StationState): FeasibleIntervention[] {
  return INTERVENTIONS.map(int => {
    const isAvail = int.isAvailable(engineState);
    return {
      id: int.id,
      name: int.name,
      description: int.description,
      category: int.category,
      is_feasible: isAvail,
      reasons_applicable: isAvail ? ['Operational prerequisite met under nominal station baseline.'] : [],
      reasons_pruned: !isAvail ? ['Operational conditions or dependencies not satisfied.'] : [],
      relevance_score: 50,
    };
  });
}

function getDefaultDiagnosedProblems(state: StationState): DiagnosedProblem[] {
  const problems: DiagnosedProblem[] = [];
  const powerDeficit = state.energy?.powerDeficitKw ?? 0;
  if (powerDeficit > 0) {
    problems.push({
      threat_type: 'POWER_DEFICIT',
      severity: powerDeficit > 30 ? 'CRITICAL' : 'WARNING',
      description: `Active power deficit of ${powerDeficit.toFixed(1)} kW. Generation insufficient for current load.`,
      metrics: { power_deficit_kw: powerDeficit },
      recommended_intervention_categories: ['power_generation', 'load_management'],
    });
  }
  const batteryPct = state.energy?.batteryLevelPercent ?? 100;
  if (batteryPct < 20) {
    problems.push({
      threat_type: 'BATTERY_DEPLETION',
      severity: batteryPct < 15 ? 'CRITICAL' : 'WARNING',
      description: `Battery state of charge at ${batteryPct.toFixed(1)}%, below safe buffer.`,
      metrics: { battery_level_percent: batteryPct },
      recommended_intervention_categories: ['load_management', 'power_generation'],
    });
  }
  const wind = state.environment?.windSpeed ?? 0;
  if (wind > 80) {
    problems.push({
      threat_type: 'WEATHER_HAZARD',
      severity: wind > 100 ? 'CRITICAL' : 'WARNING',
      description: `Severe blizzard winds (${wind.toFixed(0)} km/h). Outdoor operations hazardous.`,
      metrics: { wind_speed_kmh: wind },
      recommended_intervention_categories: ['structural_safety', 'load_management'],
    });
  }
  const indoorTemp = state.infrastructure?.indoorTempAvg ?? 18;
  if (indoorTemp < 12) {
    problems.push({
      threat_type: 'EXTREME_THERMAL_LOSS',
      severity: indoorTemp < 10 ? 'CRITICAL' : 'WARNING',
      description: `Average habitat temperature dropped to ${indoorTemp.toFixed(1)}°C. Hypothermia risk.`,
      metrics: { indoor_temp_c: indoorTemp },
      recommended_intervention_categories: ['life_support', 'power_generation'],
    });
  }
  const fuelDays = state.logistics?.fuelEnduranceDays ?? 90;
  if (fuelDays < 15) {
    problems.push({
      threat_type: 'FUEL_CRITICAL',
      severity: fuelDays < 7 ? 'CRITICAL' : 'WARNING',
      description: `Fuel reserve autonomy at ${fuelDays.toFixed(1)} days. Resupply cutoff imminent.`,
      metrics: { fuel_days: fuelDays },
      recommended_intervention_categories: ['power_generation', 'load_management'],
    });
  }
  return problems;
}

export function useSimulation(initialStationId: 'maitri' | 'bharati' = 'maitri'): UseSimulationReturn {
  const engineRef = useRef<SimulationEngine>(new SimulationEngine(initialStationId));
  const [state, setState] = useState<StationState>(engineRef.current.getState());
  const [stationId, setStationId] = useState<'maitri' | 'bharati'>(initialStationId);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [predictions, setPredictions] = useState<FailurePrediction[]>([]);
  const [optimizerPlans, setOptimizerPlans] = useState<InterventionPlan[]>(() => {
    try {
      return optimizeDecisions(engineRef.current, undefined);
    } catch {
      return [];
    }
  });
  const [aiAutoApplyInfo, setAiAutoApplyInfo] = useState<AIAutoApplyInfo | null>(null);
  const [decisionSupport, setDecisionSupport] = useState<any>(null);
  const [diagnosedProblems, setDiagnosedProblems] = useState<DiagnosedProblem[]>(() =>
    getDefaultDiagnosedProblems(engineRef.current.getState())
  );
  const [availableResources, setAvailableResources] = useState<Record<string, any> | null>(null);
  const [feasibleInterventions, setFeasibleInterventions] = useState<FeasibleIntervention[]>(() =>
    getDefaultFeasibleInterventions(engineRef.current.getState())
  );
  const [candidatePackages, setCandidatePackages] = useState<CandidatePackage[]>([]);
  const [optimizationHorizon, setOptimizationHorizon] = useState<number>(24);
  const [comparisonSnapshot, setComparisonSnapshot] = useState<StateSnapshot | null>(null);
  const [activeScenarioIds, setActiveScenarioIds] = useState<Set<string>>(new Set());
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [radarStatus, setRadarStatus] = useState<'IDLE' | 'APPROACHING' | 'IMPACT'>('IDLE');
  const [radarObservation, setRadarObservation] = useState<any>(null);
  const [scenarioParams, setScenarioParams] = useState<Record<string, Record<string, number | string>>>({});
  const activeRunId = useRef<number | string | null>(null);
  const activeScenarioIdRef = useRef<string | null>(null);
  const lastFrameRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const lastPredictionHour = useRef<number>(-1);

  useEffect(() => {
    activeScenarioIdRef.current = activeScenarioId;
  }, [activeScenarioId]);

  const updateRadarFromState = useCallback((
    currentScenarioId: string | null,
    currentState: StationState,
    backendRadarData?: any
  ) => {
    const isStormScenario = currentScenarioId === 'antarctic_storm' ||
      currentScenarioId === 'extreme_antarctic_storm' ||
      currentScenarioId === 'combined_emergency' ||
      currentScenarioId === 'full_cascade' ||
      currentState.activeScenarios.includes('antarctic_storm') ||
      currentState.activeScenarios.includes('extreme_antarctic_storm');

    if (!isStormScenario) {
      setRadarStatus('IDLE');
      setRadarObservation({
        has_storm: false,
        status: 'IDLE',
        scenario_id: currentScenarioId || 'normal',
        scenario_name: SCENARIO_LIBRARY.find(s => s.id === currentScenarioId)?.name || 'Normal Operations',
        severity: 'LOW',
        distance_km: 0,
        wind_speed_kmh: Math.round(currentState.environment?.windSpeed || 35),
        estimated_arrival_hours: 0,
        direction: 'N/A',
        temperature_c: Math.round(currentState.environment?.temperature || -28),
        communication_impact: currentState.communication?.status || 'Nominal',
        logistics_impact: 'Nominal',
      });
      return;
    }

    const isBharati = currentState.stationId === 'bharati';
    const scenarioDef = SCENARIO_LIBRARY.find(s => s.id === 'antarctic_storm');
    const initialDistance = scenarioDef?.initialDistanceKm ?? (isBharati ? 200 : 180);
    const approachSpeed = scenarioDef?.stormMotionSpeedKmh ?? (isBharati ? 50 : 60);
    const direction = isBharati ? '065° NE' : (scenarioDef?.stormBearingLabel ?? '135° SE');
    const blizzardWindSpeed = 115;

    const simHour = currentState.simulationHour || 0;
    const kinematics = calculateStormKinematics({
      initialDistanceKm: initialDistance,
      stormMotionSpeedKmh: approachSpeed,
      elapsedSimulationHours: simHour,
      windSpeedKmh: blizzardWindSpeed,
    });

    const status: 'IDLE' | 'APPROACHING' | 'IMPACT' = kinematics.hasArrived ? 'IMPACT' : 'APPROACHING';

    setRadarStatus(status);
    const radarObs = {
      ...(backendRadarData || {}),
      has_storm: true,
      status: kinematics.status,
      scenario_id: 'antarctic_storm',
      scenario_name: 'Extreme Antarctic Storm',
      severity: kinematics.hasArrived ? 'ARRIVED' : 'CRITICAL',
      distance_km: kinematics.remainingDistanceKm,
      storm_speed_kmh: kinematics.stormMotionSpeedKmh,
      wind_speed_kmh: blizzardWindSpeed,
      estimated_arrival_hours: kinematics.etaHours,
      direction: direction,
      temperature_c: Math.round(currentState.environment?.temperature || -40),
      communication_impact: currentState.communication?.status || 'Degraded',
      logistics_impact: kinematics.remainingDistanceKm < 120 ? 'Resupply Suspended' : 'Nominal',
      simulation_hour: simHour,
    };
    setRadarObservation(radarObs);

    // Broadcast live engine state to window so any active radar modal or views update in lockstep with the simulation engine
    window.dispatchEvent(new CustomEvent('simulation-engine-tick', {
      detail: {
        simulationHour: simHour,
        isRunning: engineRef.current ? engineRef.current.isRunning() : false,
        speed: engineRef.current ? engineRef.current.getSpeed() : 1,
        radarObservation: radarObs,
        stationId: currentState.stationId,
      }
    }));
  }, []);


  // Animation loop
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (lastFrameRef.current === 0) lastFrameRef.current = timestamp;
      const deltaMs = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;

      const engine = engineRef.current;

      if (engine.isRunning()) {
        // Apply scenario events at the right time
        const currentHour = engine.getState().simulationHour;
        activeScenarioIds.forEach(scenarioId => {
          const scenario = SCENARIO_LIBRARY.find(s => s.id === scenarioId);
          if (scenario) {
            applyScenarioEvents(engine, scenario, currentHour, scenarioParams[scenarioId]);
          }
        });

        // Tick the engine
        engine.tick(deltaMs / 1000);

        // Update radar observation synchronized with simulation clock
        updateRadarFromState(activeScenarioIdRef.current, engine.getState());

        // Update predictions every simulated hour
        if (Math.floor(currentHour) > lastPredictionHour.current) {
          lastPredictionHour.current = Math.floor(currentHour);
          setPredictions(generatePredictions(engine.getState()));
        }

        // Update React state (throttled to ~20fps for performance)
        setState({ ...engine.getState() });
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [activeScenarioIds, scenarioParams, updateRadarFromState]);

  // Synchronize external simulation control events (e.g. from Live Radar Console)
  useEffect(() => {
    const handleControl = (e: any) => {
      const { action, hour, speed: newSpeed } = e.detail || {};
      const eng = engineRef.current;
      if (!eng) return;

      if (action === 'play') {
        eng.play();
        setIsRunning(true);
        lastFrameRef.current = 0;
      } else if (action === 'pause') {
        eng.pause();
        setIsRunning(false);
      } else if (action === 'reset') {
        eng.reset();
        setIsRunning(false);
        updateRadarFromState(activeScenarioIdRef.current, eng.getState());
        setState({ ...eng.getState() });
      } else if (action === 'seek-hour' && typeof hour === 'number') {
        eng.state.simulationHour = Math.max(0, hour);
        eng.recalculatePhysics(true);
        updateRadarFromState(activeScenarioIdRef.current, eng.getState());
        setState({ ...eng.getState() });
      } else if (action === 'advance-hours' && typeof hour === 'number') {
        eng.advanceByHours(hour);
        updateRadarFromState(activeScenarioIdRef.current, eng.getState());
        setState({ ...eng.getState() });
      } else if (action === 'set-speed' && typeof newSpeed === 'number') {
        eng.setSpeed(newSpeed);
      }
    };
    window.addEventListener('simulation-engine-control', handleControl);
    return () => window.removeEventListener('simulation-engine-control', handleControl);
  }, [updateRadarFromState]);

  // Controls
  const controls: SimulationControls = {

    play: useCallback(() => {
      engineRef.current.play();
      setIsRunning(true);
      lastFrameRef.current = 0;
    }, []),
    pause: useCallback(() => {
      engineRef.current.pause();
      setIsRunning(false);
    }, []),
    reset: useCallback(() => {
      if (activeRunId.current) {
        fetch(`/api/simulations/${activeRunId.current}/reset/`, { method: 'POST' }).catch(() => {});
        activeRunId.current = null;
      }
      try {
        sessionStorage.removeItem(`ant_sim_${stationId}`);
      } catch (e) {}

      engineRef.current.reset();
      setIsRunning(false);
      setActiveScenarioIds(new Set());
      setActiveScenarioId(null);
      setRadarStatus('IDLE');
      setRadarObservation({
        has_storm: false,
        status: 'IDLE',
        scenario_id: 'normal',
        scenario_name: 'Normal Operations',
        severity: 'LOW',
        distance_km: 0,
        wind_speed_kmh: Math.round(engineRef.current.getState().environment?.windSpeed || 35),
        estimated_arrival_hours: 0,
        direction: 'N/A',
        temperature_c: Math.round(engineRef.current.getState().environment?.temperature || -28),
        communication_impact: 'Nominal',
        logistics_impact: 'Nominal',
      });
      setScenarioParams({});
      setComparisonSnapshot(null);
      setDiagnosedProblems(getDefaultDiagnosedProblems(engineRef.current.getState()));
      setFeasibleInterventions(getDefaultFeasibleInterventions(engineRef.current.getState()));
      setCandidatePackages([]);
      setAvailableResources(null);
      setAiAutoApplyInfo(null);
      try {
        setOptimizerPlans(optimizeDecisions(engineRef.current, undefined));
      } catch {
        setOptimizerPlans([]);
      }
      setDecisionSupport(null);
      setPredictions([]);
      lastPredictionHour.current = -1;
      setState({ ...engineRef.current.getState() });
    }, [stationId]),
    setSpeed: useCallback((s: number) => {
      engineRef.current.setSpeed(s);
      setSpeedState(s);
    }, []),
    advanceByHours: useCallback((hours: number) => {
      const engine = engineRef.current;
      const currentHour = engine.getState().simulationHour;

      // Apply any pending scenario events during the advance
      activeScenarioIds.forEach(scenarioId => {
        const scenario = SCENARIO_LIBRARY.find(s => s.id === scenarioId);
        if (scenario) {
          for (const event of scenario.events) {
            if (event.atHour > currentHour && event.atHour <= currentHour + hours) {
              const hoursToEvent = event.atHour - engine.getState().simulationHour;
              if (hoursToEvent > 0) {
                engine.advanceByHours(hoursToEvent);
              }
              applyScenarioEvents(engine, scenario, event.atHour, scenarioParams[scenarioId]);
            }
          }
        }
      });

      // Advance remaining time
      const remaining = (currentHour + hours) - engine.getState().simulationHour;
      if (remaining > 0) {
        engine.advanceByHours(remaining);
      }

      setPredictions(generatePredictions(engine.getState()));
      setState({ ...engine.getState() });
      updateRadarFromState(activeScenarioIdRef.current, engine.getState());

      // Sync with authoritative backend if a run is active
      if (activeRunId.current) {
        api.advanceSimulation(activeRunId.current, hours)
          .then(async () => {
            if (activeRunId.current) {
              try {
                const [cand, ds, radarData] = await Promise.all([
                  api.getCandidateInterventions(activeRunId.current),
                  api.getDecisionSupport(activeRunId.current, optimizationHorizon),
                  api.getSimulationRadar(activeRunId.current),
                ]);
                if (radarData) {
                  updateRadarFromState(activeScenarioIdRef.current, engine.getState(), radarData);
                }
                if (cand) {
                  if (cand.diagnosed_problems) setDiagnosedProblems(cand.diagnosed_problems);
                  if (cand.available_resources) setAvailableResources(cand.available_resources);
                  if (cand.feasible_interventions) setFeasibleInterventions(cand.feasible_interventions);
                  if (cand.candidate_packages) setCandidatePackages(cand.candidate_packages);
                }
                if (ds) {
                  setDecisionSupport(ds);
                  const plans = ds.optimizer?.rankedPlans || (Array.isArray(ds.optimizer) ? ds.optimizer : ds.optimizer?.alternatives);
                  if (plans && plans.length > 0) setOptimizerPlans(plans);
                }
              } catch (e) {}
            }
          })
          .catch(err => {
            console.warn('Backend advance error:', err);
          });
      }
    }, [activeScenarioIds, scenarioParams, optimizationHorizon, updateRadarFromState]),
    isRunning,
    speed,
  };

  const refreshCandidates = useCallback(async () => {
    const runId = activeRunId.current;
    if (!runId) return;
    try {
      const [cand, ds] = await Promise.all([
        api.getCandidateInterventions(runId),
        api.getDecisionSupport(runId, optimizationHorizon),
      ]);
      if (cand) {
        if (cand.diagnosed_problems) setDiagnosedProblems(cand.diagnosed_problems);
        if (cand.available_resources) setAvailableResources(cand.available_resources);
        if (cand.feasible_interventions) setFeasibleInterventions(cand.feasible_interventions);
        if (cand.candidate_packages) setCandidatePackages(cand.candidate_packages);
      }
      if (ds) {
        setDecisionSupport(ds);
        const plans = ds.optimizer?.rankedPlans || (Array.isArray(ds.optimizer) ? ds.optimizer : ds.optimizer?.alternatives);
        if (plans && plans.length > 0) setOptimizerPlans(plans);
      }
    } catch (err) {
      console.warn('Error refreshing candidate interventions:', err);
    }
  }, [optimizationHorizon]);

  // Actions
  const actions: SimulationActions = {
    selectStation: useCallback((newStationId: 'maitri' | 'bharati') => {
      activeRunId.current = null;
      engineRef.current = new SimulationEngine(newStationId);
      setStationId(newStationId);
      setIsRunning(false);
      setActiveScenarioIds(new Set());
      setScenarioParams({});
      setComparisonSnapshot(null);
      setDiagnosedProblems(getDefaultDiagnosedProblems(engineRef.current.getState()));
      setFeasibleInterventions(getDefaultFeasibleInterventions(engineRef.current.getState()));
      setCandidatePackages([]);
      setAvailableResources(null);
      setAiAutoApplyInfo(null);
      try {
        setOptimizerPlans(optimizeDecisions(engineRef.current, undefined));
      } catch {
        setOptimizerPlans([]);
      }
      setDecisionSupport(null);
      setPredictions([]);
      lastPredictionHour.current = -1;
      setState({ ...engineRef.current.getState() });
    }, []),

    activateScenario: useCallback((scenarioId: string, params?: Record<string, number | string>) => {
      const canonicalId = scenarioId === 'extreme_antarctic_storm' ? 'antarctic_storm' : scenarioId;
      const scenario = SCENARIO_LIBRARY.find(s => s.id === canonicalId || s.id === scenarioId);
      if (!scenario) return;

      setActiveScenarioId(canonicalId);
      updateRadarFromState(canonicalId, engineRef.current.getState());

      if (canonicalId === 'normal') {
        // Reset everything
        if (activeRunId.current) {
          fetch(`/api/simulations/${activeRunId.current}/reset/`, { method: 'POST' }).catch(() => {});
          activeRunId.current = null;
        }
        engineRef.current.reset();
        setActiveScenarioIds(new Set());
        setActiveScenarioId(null);
        setRadarStatus('IDLE');
        setRadarObservation(null);
        setScenarioParams({});
        setComparisonSnapshot(null);
        setDiagnosedProblems(getDefaultDiagnosedProblems(engineRef.current.getState()));
        setFeasibleInterventions(getDefaultFeasibleInterventions(engineRef.current.getState()));
        setCandidatePackages([]);
        setAvailableResources(null);
        setAiAutoApplyInfo(null);
        try {
          setOptimizerPlans(optimizeDecisions(engineRef.current, undefined));
        } catch {
          setOptimizerPlans([]);
        }
        setDecisionSupport(null);
        setPredictions([]);
        lastPredictionHour.current = -1;
        setState({ ...engineRef.current.getState() });
        return;
      }

      // Authoritative backend simulation run creation
      api.createSimulationRun(stationId, canonicalId, `${scenario.name} Run`, params)
        .then(async run => {
          if (run && run.id) {
            activeRunId.current = run.id;
            try {
              sessionStorage.setItem(`ant_sim_${stationId}`, String(run.id));
            } catch (e) {}

            // Immediately query radar and candidate interventions from authoritative backend
            try {
              const [radarData, cand, ds] = await Promise.all([
                api.getSimulationRadar(run.id),
                api.getCandidateInterventions(run.id),
                api.getDecisionSupport(run.id, 24),
              ]);
              if (radarData) {
                updateRadarFromState(canonicalId, engineRef.current.getState(), radarData);
              }
              if (cand) {
                if (cand.diagnosed_problems) setDiagnosedProblems(cand.diagnosed_problems);
                if (cand.available_resources) setAvailableResources(cand.available_resources);
                if (cand.feasible_interventions) setFeasibleInterventions(cand.feasible_interventions);
                if (cand.candidate_packages) setCandidatePackages(cand.candidate_packages);
              }
              if (ds) {
                setDecisionSupport(ds);
                const plans = ds.optimizer?.rankedPlans || (Array.isArray(ds.optimizer) ? ds.optimizer : ds.optimizer?.alternatives);
                if (plans && plans.length > 0) {
                  setOptimizerPlans(plans);
                }
              }
            } catch (fetchErr) {
              console.warn('Failed to query backend candidates:', fetchErr);
            }
          }
        })
        .catch(err => {
          console.warn('Backend run creation failed:', err);
        });

      setActiveScenarioIds(prev => new Set(prev).add(canonicalId));
      if (params) {
        setScenarioParams(prev => ({ ...prev, [canonicalId]: params }));
      }

      // Apply immediate events (atHour: 0)
      const engine = engineRef.current;
      engine.modifyState((s) => {
        if (!s.activeScenarios.includes(scenarioId)) {
          s.activeScenarios.push(scenarioId);
        }
      });

      // Apply hour-0 events and custom feature parameters immediately
      const effectiveParams = params || scenarioParams[scenarioId];
      applyScenarioEvents(engine, scenario, 0, effectiveParams);
      if (effectiveParams) {
        applyCustomScenarioParams(engine, scenarioId, effectiveParams);
      }
      engine.recalculatePhysics(true);
      setState({ ...engine.getState() });
      setPredictions(generatePredictions(engine.getState()));

      try {
        const allActiveIds: string[] = [scenarioId];
        activeScenarioIds.forEach(id => {
          if (!allActiveIds.includes(id)) allActiveIds.push(id);
        });
        const { plans, autoApplyPlan, scenarioTheme } = optimizeForScenario(engine, allActiveIds);
        setOptimizerPlans(plans);

        // Auto-apply the AI's top-ranked plan
        if (autoApplyPlan && scenarioId !== 'normal') {
          const appliedNames: string[] = [];
          for (const intId of autoApplyPlan.interventions) {
            const intervention = getInterventionById(intId);
            if (intervention && intervention.isAvailable(engine.getState()) && !engine.getState().activeInterventions.includes(intId)) {
              intervention.apply(engine);
              appliedNames.push(intervention.name);
            }
          }
          if (appliedNames.length > 0) {
            setState({ ...engine.getState() });
            setAiAutoApplyInfo({
              planName: autoApplyPlan.name,
              scenarioName: scenario.name,
              scenarioTheme,
              interventionCount: appliedNames.length,
              interventionNames: appliedNames,
              timestamp: Date.now(),
            });
            engine.addEvent({
              type: 'info',
              category: 'AI',
              title: 'AI Auto-Response Activated',
              description: `AI analyzed "${scenario.name}" scenario and automatically applied ${appliedNames.length} intervention(s): ${appliedNames.join(', ')}. Reasoning: ${scenarioTheme}`,
            });
            // Recompute plans after auto-apply
            setOptimizerPlans(optimizeDecisions(engine, allActiveIds));
          }
        }
      } catch (e) {
        console.warn('Post-scenario optimization error:', e);
      }
    }, [stationId, activeScenarioIds]),

    deactivateScenario: useCallback((scenarioId: string) => {
      const canonicalId = scenarioId === 'extreme_antarctic_storm' ? 'antarctic_storm' : scenarioId;
      setActiveScenarioIds(prev => {
        const next = new Set(prev);
        next.delete(scenarioId);
        next.delete(canonicalId);
        const remaining = Array.from(next);
        const activeSc = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        setActiveScenarioId(activeSc);
        updateRadarFromState(activeSc, engineRef.current.getState());
        return next;
      });
      engineRef.current.modifyState((s) => {
        s.activeScenarios = s.activeScenarios.filter(id => id !== scenarioId && id !== canonicalId);
        if (s.activeScenarios.length === 0) {
          s.environment.temperature = -28;
          s.environment.windSpeed = 42;
          s.environment.airPressure = 986;
          s.environment.visibility = 35;
          s.crew.shelterInPlace = false;
          s.crew.outdoorOpsAllowed = true;
          for (const g of s.energy.generators) {
            g.isOnline = true;
            g.status = 'Nominal';
            g.failedAtHour = null;
          }
          s.infrastructure.heatingSystemStatus = 'Nominal';
          for (const z of s.infrastructure.zones) z.isHeatingActive = true;
        }
      });
      engineRef.current.recalculatePhysics(true);
      setState({ ...engineRef.current.getState() });
      setPredictions(generatePredictions(engineRef.current.getState()));
    }, []),

    updateScenarioParams: useCallback((scenarioId: string, params: Record<string, number | string>) => {
      setScenarioParams(prev => ({
        ...prev,
        [scenarioId]: { ...(prev[scenarioId] || {}), ...params },
      }));

      const engine = engineRef.current;
      if (engine.getState().activeScenarios.includes(scenarioId)) {
        applyCustomScenarioParams(engine, scenarioId, params);
        engine.recalculatePhysics(true);
        setState({ ...engine.getState() });
        setPredictions(generatePredictions(engine.getState()));

        try {
          const allActiveIds: string[] = [scenarioId];
          activeScenarioIds.forEach(id => {
            if (!allActiveIds.includes(id)) allActiveIds.push(id);
          });
          setOptimizerPlans(optimizeDecisions(engine, allActiveIds));
        } catch {}
      }
    }, [activeScenarioIds]),

    applyIntervention: useCallback((interventionId: string) => {
      const intervention = getInterventionById(interventionId);
      if (!intervention) return;
      const engine = engineRef.current;
      if (!intervention.isAvailable(engine.getState())) return;
      if (engine.getState().activeInterventions.includes(interventionId)) return;

      // Sync with backend session
      if (activeRunId.current) {
        api.applySimulationIntervention(activeRunId.current, interventionId)
          .then(async () => {
            if (activeRunId.current) {
              try {
                const [cand, ds] = await Promise.all([
                  api.getCandidateInterventions(activeRunId.current),
                  api.getDecisionSupport(activeRunId.current, optimizationHorizon),
                ]);
                if (cand) {
                  if (cand.diagnosed_problems) setDiagnosedProblems(cand.diagnosed_problems);
                  if (cand.available_resources) setAvailableResources(cand.available_resources);
                  if (cand.feasible_interventions) setFeasibleInterventions(cand.feasible_interventions);
                  if (cand.candidate_packages) setCandidatePackages(cand.candidate_packages);
                }
                if (ds) {
                  setDecisionSupport(ds);
                  const plans = ds.optimizer?.rankedPlans || (Array.isArray(ds.optimizer) ? ds.optimizer : ds.optimizer?.alternatives);
                  if (plans && plans.length > 0) setOptimizerPlans(plans);
                }
              } catch (e) {}
            }
          })
          .catch(err => {
            console.warn('Backend intervention apply failed:', err);
          });
      }

      intervention.apply(engine);
      setState({ ...engine.getState() });
      try {
        setOptimizerPlans(optimizeDecisions(engine, [...activeScenarioIds]));
      } catch (e) {}
    }, [optimizationHorizon]),

    removeIntervention: useCallback((interventionId: string) => {
      const intervention = getInterventionById(interventionId);
      if (!intervention) return;

      // Sync with backend session
      if (activeRunId.current) {
        api.revertSimulationIntervention(activeRunId.current, interventionId)
          .then(async () => {
            if (activeRunId.current) {
              try {
                const [cand, ds] = await Promise.all([
                  api.getCandidateInterventions(activeRunId.current),
                  api.getDecisionSupport(activeRunId.current, optimizationHorizon),
                ]);
                if (cand) {
                  if (cand.diagnosed_problems) setDiagnosedProblems(cand.diagnosed_problems);
                  if (cand.available_resources) setAvailableResources(cand.available_resources);
                  if (cand.feasible_interventions) setFeasibleInterventions(cand.feasible_interventions);
                  if (cand.candidate_packages) setCandidatePackages(cand.candidate_packages);
                }
                if (ds) {
                  setDecisionSupport(ds);
                  const plans = ds.optimizer?.rankedPlans || (Array.isArray(ds.optimizer) ? ds.optimizer : ds.optimizer?.alternatives);
                  if (plans && plans.length > 0) setOptimizerPlans(plans);
                }
              } catch (e) {}
            }
          })
          .catch(err => {
            console.warn('Backend intervention revert failed:', err);
          });
      }

      intervention.revert(engineRef.current);
      setState({ ...engineRef.current.getState() });
      try {
        setOptimizerPlans(optimizeDecisions(engineRef.current, [...activeScenarioIds]));
      } catch (e) {}
    }, [optimizationHorizon]),

    runOptimizer: useCallback((horizonHours: number = 24, weights?: any) => {
      setOptimizationHorizon(horizonHours);
      if (activeRunId.current) {
        Promise.all([
          api.getCandidateInterventions(activeRunId.current),
          api.getDecisionSupport(activeRunId.current, horizonHours, weights),
        ])
          .then(([cand, res]) => {
            if (cand) {
              if (cand.diagnosed_problems) setDiagnosedProblems(cand.diagnosed_problems);
              if (cand.available_resources) setAvailableResources(cand.available_resources);
              if (cand.feasible_interventions) setFeasibleInterventions(cand.feasible_interventions);
              if (cand.candidate_packages) setCandidatePackages(cand.candidate_packages);
            }
            if (res) {
              setDecisionSupport(res);
              const plans = res.optimizer?.rankedPlans || (Array.isArray(res.optimizer) ? res.optimizer : res.optimizer?.alternatives);
              if (plans && plans.length > 0) {
                setOptimizerPlans(plans);
                return;
              }
            }
            const fallbackPlans = optimizeDecisions(engineRef.current, [...activeScenarioIds]);
            setOptimizerPlans(fallbackPlans);
          })
          .catch(() => {
            const fallbackPlans = optimizeDecisions(engineRef.current, [...activeScenarioIds]);
            setOptimizerPlans(fallbackPlans);
          });
      } else {
        const plans = optimizeDecisions(engineRef.current, [...activeScenarioIds]);
        setOptimizerPlans(plans);
      }
    }, []),

    setHorizon: useCallback((hours: number) => {
      setOptimizationHorizon(hours);
    }, []),

    takeComparisonSnapshot: useCallback(() => {
      setComparisonSnapshot(engineRef.current.createSnapshot());
    }, []),

    refreshCandidates,
  };

  return {
    state,
    controls,
    actions,
    history: engineRef.current.getHistory(),
    scenarios: SCENARIO_LIBRARY,
    interventions: INTERVENTIONS,
    predictions,
    optimizerPlans,
    decisionSupport,
    optimizationHorizon,
    comparisonSnapshot,
    stationId,
    activeRunId: activeRunId.current,
    diagnosedProblems,
    availableResources,
    feasibleInterventions,
    candidatePackages,
    aiAutoApplyInfo,
    activeScenarioId,
    activeSimulationId: activeRunId.current,
    radarObservation,
    radarStatus,
  };
}
