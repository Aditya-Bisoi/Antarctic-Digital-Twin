import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { RadarScope } from './radar/RadarScope';
import { RadarStatusOverlay } from './radar/RadarStatusOverlay';
import { RadarPlaybackBar } from './radar/RadarPlaybackBar';
import { api } from '../../api/client';

import { SCENARIO_LIBRARY } from '../../simulation/ScenarioLibrary';
import {
  calculateStormKinematics,
  DEFAULT_STORM_INITIAL_DISTANCE_KM,
  DEFAULT_STORM_MOTION_SPEED_KMH,
  DEFAULT_BLIZZARD_WIND_KMH,
} from '../../simulation/stormPhysics';

export interface RadarLiveDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  stationId?: string;
  stationName?: string;
  activeScenarioId?: string | null;
  activeSimulationId?: string | number | null;
  activeRadarObservation?: any;
  currentSimulationHour?: number;
  isSimulationRunning?: boolean;
  simulationSpeed?: number;
}

// ─── Demo speed presets ────────────────────────────────────────────────────────
// speedMultiplier determines how many "simulation seconds" elapse per real second.
// Formula: simElapsedHours += (realDeltaMs / 1000) × speedMultiplier / 3600
//
//   60×  → 1 real second = 60 sim seconds   → 180 real seconds (3 min) per full demo
//  180×  → 1 real second = 180 sim seconds  →  60 real seconds (1 min) per full demo
//  360×  → 1 real second = 360 sim seconds  →  30 real seconds        per full demo  ← default
//  720×  → 1 real second = 720 sim seconds  →  15 real seconds        per full demo
const DEMO_SPEED_PRESETS: { label: string; value: number; hint: string }[] = [
  { label: '60×',  value: 60,  hint: '3 min demo' },
  { label: '180×', value: 180, hint: '1 min demo' },
  { label: '360×', value: 360, hint: '30 s demo'  },
  { label: '720×', value: 720, hint: '15 s demo'  },
];
const TOTAL_SIM_HOURS = 3.0;

export const RadarLiveDemoModal: React.FC<RadarLiveDemoModalProps> = ({
  isOpen,
  onClose,
  stationId = 'maitri',
  stationName = 'Maitri Station',
  activeScenarioId,
  activeSimulationId,
  activeRadarObservation,
  currentSimulationHour = 0,
  isSimulationRunning = false,
  simulationSpeed,
}) => {
  // ── Authoritative simulation clock ─────────────────────────────────────────
  const [simHour, setSimHour] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(360);
  const [maxRangeKm, setMaxRangeKm] = useState(200);

  // RAF refs — avoids stale-closure issues in animation loop
  const animFrameRef      = useRef<number>(0);
  const lastFrameTimeRef  = useRef<number>(0);
  const isPlayingRef      = useRef<boolean>(false);
  const speedMultRef      = useRef<number>(360);
  const simHourRef        = useRef<number>(0);

  // Keep refs in sync with state (no stale closures in RAF)
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedMultRef.current = speedMultiplier; }, [speedMultiplier]);
  useEffect(() => { simHourRef.current = simHour; }, [simHour]);

  // Backend state (preserved — backend integration unchanged)
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);
  const [radarResponse, setRadarResponse] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Scenario resolution ────────────────────────────────────────────────────
  const resolvedScenarioId = activeScenarioId || (() => {
    try {
      const raw = sessionStorage.getItem('ant_active_scenarios');
      const parsed = raw ? JSON.parse(raw) : [];
      return parsed[0] || null;
    } catch {
      return null;
    }
  })();

  // Only show storm for storm scenarios
  const isStormScenario =
    resolvedScenarioId === 'antarctic_storm' ||
    resolvedScenarioId === 'extreme_antarctic_storm';

  const scenarioDef = SCENARIO_LIBRARY.find(s => s.id === 'antarctic_storm');

  const displayScenarioName = (() => {
    if (isStormScenario) return scenarioDef?.name || 'Extreme Antarctic Storm';
    if (!resolvedScenarioId || resolvedScenarioId === 'normal') return 'Normal Operations';
    return resolvedScenarioId.replace(/_/g, ' ');
  })();

  // ── Canonical physical constants (from Scenario Library — single source of truth) ──
  const isBharati          = stationId.toLowerCase() === 'bharati';
  const initialDistance    = scenarioDef?.initialDistanceKm    ?? DEFAULT_STORM_INITIAL_DISTANCE_KM; // 180 km
  const stormMotionSpeed   = scenarioDef?.stormMotionSpeedKmh  ?? DEFAULT_STORM_MOTION_SPEED_KMH;    // 60 km/h
  const stormDirection     = isBharati ? '065° NE' : (scenarioDef?.stormBearingLabel ?? '135° SE');
  const blizzardWindSpeed  = DEFAULT_BLIZZARD_WIND_KMH;                                               // 115 km/h

  // ── Pure kinematic calculation (deterministic, no randomness) ─────────────
  //   distance_travelled = storm_motion_speed × elapsed_sim_hours
  //   remaining_distance = max(0, initial_distance − distance_travelled)
  //   ETA                = remaining_distance / storm_motion_speed
  const kinematics = calculateStormKinematics({
    initialDistanceKm:      initialDistance,
    stormMotionSpeedKmh:    stormMotionSpeed,
    elapsedSimulationHours: isStormScenario ? simHour : 0,
    windSpeedKmh:           blizzardWindSpeed,
  });

  const dynamicDistanceKm = isStormScenario ? kinematics.remainingDistanceKm : 0;
  const dynamicEtaHours   = isStormScenario ? kinematics.etaHours : 0.0;
  const stormStatus       = kinematics.status; // 'APPROACHING' | 'ARRIVED'

  // ── Self-contained RAF simulation clock ───────────────────────────────────
  // Advances simHour using wall-clock time ONLY — no setInterval, no
  // dependency on SimulationPage being mounted.
  //
  // Physical formula:
  //   simElapsedHours += (realDeltaMs / 1000) × speedMultiplier / 3600
  //
  // This is equivalent to:
  //   simElapsedSeconds = realElapsedSeconds × speedMultiplier
  //   simElapsedHours   = simElapsedSeconds / 3600
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animFrameRef.current);
      lastFrameTimeRef.current = 0;
      return;
    }

    const loop = (ts: number) => {
      if (!isPlayingRef.current) return;

      // First frame — just record timestamp and schedule next
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = ts;
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const deltaMs      = ts - lastFrameTimeRef.current;
      lastFrameTimeRef.current = ts;

      // Convert real wall-clock delta to simulation hours
      const deltaSimHours = (deltaMs / 1000) * speedMultRef.current / 3600;

      const nextHour = Math.min(TOTAL_SIM_HOURS, simHourRef.current + deltaSimHours);
      simHourRef.current = nextHour;
      setSimHour(nextHour);

      // Auto-stop when storm arrives
      if (nextHour >= TOTAL_SIM_HOURS) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]); // Restart only when play/pause toggles

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(animFrameRef.current), []);

  // ── Backend radar event (preserved — existing API contract unchanged) ──────
  const fetchRadarEvent = useCallback(async () => {
    if (!isStormScenario) {
      setRadarResponse(null);
      setIsLoadingBackend(false);
      return;
    }
    try {
      setIsLoadingBackend(true);
      setErrorMessage(null);
      const targetSimId = activeSimulationId || sessionStorage.getItem(`ant_sim_${stationId.toLowerCase()}`);
      const res = await api.sendRadarStormEvent({
        stationId:    stationId.toLowerCase() === 'bharati' ? 'bharati' : 'maitri',
        simulationId: targetSimId ? String(targetSimId) : undefined,
        scenarioId:   'antarctic_storm',
        hazardType:   'antarctic_storm',
        distanceKm:   initialDistance,
        windSpeedKmh: blizzardWindSpeed,
        etaHours:     Number((initialDistance / stormMotionSpeed).toFixed(1)),
        severity:     'CRITICAL',
        confidence:   0.96,
        source:       'Polar Doppler Radar MK-IV',
        isSimulated:  true,
        eventId:      `radar-storm-${Date.now()}`,
        forceFresh:   true,
      });
      setRadarResponse(res);
    } catch (err: any) {
      console.error('Error connecting to radar backend:', err);
      setErrorMessage(err?.message || 'Failed to connect to simulation backend');
    } finally {
      setIsLoadingBackend(false);
    }
  }, [isStormScenario, stationId, activeSimulationId, initialDistance, blizzardWindSpeed, stormMotionSpeed]);

  // Reset clock to 0 whenever modal opens (clean-slate demo each time)
  useEffect(() => {
    if (isOpen) {
      setSimHour(0);
      simHourRef.current = 0;
      setIsPlaying(false);
      isPlayingRef.current = false;
      lastFrameTimeRef.current = 0;
      cancelAnimationFrame(animFrameRef.current);
      fetchRadarEvent();
    } else {
      cancelAnimationFrame(animFrameRef.current);
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  }, [isOpen, resolvedScenarioId, stationId]);

  // ── Playback controls ──────────────────────────────────────────────────────
  const handleTogglePlay = () => {
    // If storm already arrived, auto-reset before playing again
    if (simHour >= TOTAL_SIM_HOURS && !isPlaying) {
      simHourRef.current = 0;
      setSimHour(0);
    }
    lastFrameTimeRef.current = 0; // Reset frame reference to avoid time-jump on resume
    setIsPlaying(prev => !prev);
  };

  const handleReset = () => {
    cancelAnimationFrame(animFrameRef.current);
    setIsPlaying(false);
    isPlayingRef.current = false;
    lastFrameTimeRef.current = 0;
    simHourRef.current = 0;
    setSimHour(0);
    fetchRadarEvent();
  };

  const handleSeekHour = (hour: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_SIM_HOURS, hour));
    simHourRef.current = clamped;
    setSimHour(clamped);
    lastFrameTimeRef.current = 0; // Prevent time-jump after seek
  };

  if (!isOpen) return null;

  const displaySeverity = isStormScenario
    ? (stormStatus === 'ARRIVED' ? 'ARRIVED' : 'CRITICAL')
    : 'NOMINAL';

  const radarStatusText = isStormScenario
    ? (stormStatus === 'ARRIVED'
        ? 'ARRIVED'
        : (dynamicDistanceKm < 50 ? 'IMMINENT IMPACT' : 'APPROACHING'))
    : 'STANDBY: NOMINAL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#06090f]/95 backdrop-blur-md overflow-hidden select-none">
      {/* Background radial & linear vignettes */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(0,240,255,0.03)_0%,_transparent_75%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(6,9,15,0.85)_0%,transparent_15%,transparent_85%,rgba(6,9,15,0.95)_100%)]" />

      <div className="relative w-full max-w-6xl bg-[#06090f] border border-[#00f0ff]/30 rounded-3xl shadow-[0_0_100px_rgba(0,240,255,0.18)] flex flex-col h-[96vh] max-h-[960px] overflow-hidden text-[#dfe2ee]">

        {/* Top Header Row with Close button */}
        <div className="relative z-30 shrink-0 px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between">
          <div className="flex-1">
            <RadarStatusOverlay
              stationName={stationName}
              activeScenarioName={displayScenarioName}
              radarStatus={radarStatusText}
              hasStorm={isStormScenario}
              severity={displaySeverity}
              distanceKm={dynamicDistanceKm}
              etaHours={dynamicEtaHours}
              stormSpeedKmh={stormMotionSpeed}
              stormWindSpeed={blizzardWindSpeed}
              direction={stormDirection}
              maxRangeKm={maxRangeKm}
              onRangeChange={setMaxRangeKm}
            />
          </div>

          <button
            onClick={onClose}
            aria-label="Close radar console"
            className="self-start ml-3 p-1.5 rounded-xl text-[#849495] hover:text-[#dbfcff] hover:bg-[#111722] border border-[#3b494b]/40 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Display: Full Immersive Circular PPI Radar */}
        <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center p-2 overflow-hidden my-auto">
          <RadarScope
            stationName={stationName}
            hasStorm={isStormScenario}
            stormDistanceKm={dynamicDistanceKm}
            stormSpeedKmh={stormMotionSpeed}
            direction={stormDirection}
            stormWindSpeed={blizzardWindSpeed}
            calculatedEta={dynamicEtaHours}
            maxRangeKm={maxRangeKm}
          />
        </div>

        {/* Minimal Bottom HUD Footer */}
        <div className="relative z-30 shrink-0 px-4 sm:px-6 pb-3 pt-1">
          <RadarPlaybackBar
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onReset={handleReset}
            onSeekHour={handleSeekHour}
            simHoursElapsed={simHour}
            totalSimHours={TOTAL_SIM_HOURS}
            speedMultiplier={speedMultiplier}
            onSpeedChange={setSpeedMultiplier}
            speedPresets={DEMO_SPEED_PRESETS}
          />
        </div>
      </div>
    </div>
  );
};


