import React, { useState } from 'react';
import { RadarScope } from './radar/RadarScope';
import { RadarStatusOverlay } from './radar/RadarStatusOverlay';
import {
  calculateStormKinematics,
  DEFAULT_STORM_INITIAL_DISTANCE_KM,
  DEFAULT_STORM_MOTION_SPEED_KMH,
  DEFAULT_BLIZZARD_WIND_KMH,
} from '../../simulation/stormPhysics';

export interface RadarDisplayProps {
  stationName?: string;
  activeScenarioId?: string | null;
  activeScenarioName?: string;
  radarStatus?: string;
  hasStorm?: boolean;
  severity?: string;
  direction?: string;
  temperature?: number;
  commImpact?: string;
  logisticsImpact?: string;
  stormDistanceKm?: number;
  stormSpeedKmh?: number;
  stormWindSpeed?: number;
  etaHours?: number;
  isSimulating?: boolean;
  onRadarTrigger?: () => void;
  className?: string;
}

export const RadarDisplay: React.FC<RadarDisplayProps> = ({
  stationName = 'Maitri Station',
  activeScenarioId,
  activeScenarioName,
  radarStatus,
  hasStorm,
  severity = 'CRITICAL',
  direction = '135° SE',
  stormDistanceKm = DEFAULT_STORM_INITIAL_DISTANCE_KM,
  stormSpeedKmh = DEFAULT_STORM_MOTION_SPEED_KMH,
  stormWindSpeed = DEFAULT_BLIZZARD_WIND_KMH,
  etaHours,
  className = '',
}) => {
  const [maxRangeKm, setMaxRangeKm] = useState(200);

  const isStormActive = hasStorm !== undefined
    ? hasStorm
    : (activeScenarioId === 'antarctic_storm' || activeScenarioId === 'extreme_antarctic_storm');

  const displayScenarioName = activeScenarioName || (
    isStormActive
      ? 'Extreme Antarctic Storm'
      : (activeScenarioId ? activeScenarioId.replace(/_/g, ' ') : 'Normal Operations')
  );

  const effectiveStormSpeed = stormSpeedKmh || DEFAULT_STORM_MOTION_SPEED_KMH;

  const calculatedEta = etaHours !== undefined
    ? etaHours
    : (isStormActive && stormDistanceKm > 0 && effectiveStormSpeed > 0
        ? Number((stormDistanceKm / effectiveStormSpeed).toFixed(1))
        : 0.0);

  const displayRadarStatus = radarStatus || (
    isStormActive
      ? (calculatedEta <= 0 ? 'ARRIVED' : 'APPROACHING')
      : 'NOMINAL'
  );


  return (
    <div
      className={`relative flex flex-col items-center justify-between rounded-3xl bg-[#06090f] border border-[#00f0ff]/30 shadow-[0_0_80px_rgba(0,240,255,0.18)] p-4 sm:p-5 overflow-hidden text-[#dfe2ee] w-full ${className}`}
    >
      {/* Background radial & linear vignettes */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(0,240,255,0.03)_0%,_transparent_75%)]" />

      {/* Top Status & Telemetry HUD */}
      <div className="w-full mb-3 z-10">
        <RadarStatusOverlay
          stationName={stationName}
          activeScenarioName={displayScenarioName}
          radarStatus={displayRadarStatus}
          hasStorm={isStormActive}
          severity={severity}
          distanceKm={stormDistanceKm}
          etaHours={calculatedEta}
          stormSpeedKmh={effectiveStormSpeed}
          stormWindSpeed={stormWindSpeed}
          direction={direction}
          maxRangeKm={maxRangeKm}
          onRangeChange={setMaxRangeKm}
        />
      </div>

      {/* Center Radar Scope */}
      <div className="relative w-full flex items-center justify-center my-auto py-2 z-10">
        <RadarScope
          stationName={stationName}
          hasStorm={isStormActive}
          stormDistanceKm={stormDistanceKm}
          stormSpeedKmh={effectiveStormSpeed}
          direction={direction}
          stormWindSpeed={stormWindSpeed}
          calculatedEta={calculatedEta}
          maxRangeKm={maxRangeKm}
        />
      </div>
    </div>
  );
};
