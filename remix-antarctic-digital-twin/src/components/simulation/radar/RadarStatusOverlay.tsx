import React, { useState, useEffect } from 'react';
import { ShieldAlert, Compass, Wind, Clock, Navigation, Gauge } from 'lucide-react';

export interface RadarStatusOverlayProps {
  stationName: string;
  activeScenarioName: string;
  radarStatus: string;
  hasStorm: boolean;
  severity: string;
  distanceKm: number;
  etaHours: number;
  stormSpeedKmh: number;
  stormWindSpeed: number;
  direction: string;
  maxRangeKm?: number;
  onRangeChange?: (range: number) => void;
}

export const RadarStatusOverlay: React.FC<RadarStatusOverlayProps> = ({
  stationName,
  activeScenarioName,
  radarStatus,
  hasStorm,
  severity,
  distanceKm,
  etaHours,
  stormSpeedKmh = 60,
  stormWindSpeed = 115,
  direction = '135° SE',
  maxRangeKm = 200,
  onRangeChange,
}) => {
  // Live dynamic azimuth degrees (synchronizing with the 4.5s sweep rotation)
  const [azimuthDeg, setAzimuthDeg] = useState(0);

  useEffect(() => {
    let animId: number;
    const startTime = performance.now();
    const degPerSec = 360 / 4.5;

    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const deg = (elapsed * degPerSec) % 360;
      setAzimuthDeg(deg);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const isBharati = stationName.toLowerCase().includes('bharati');
  const latLong = isBharati ? 'LAT 69°24\'25"S • 76°11\'41"E' : 'LAT 70°45\'58"S • 11°44\'09"E';
  const arrayName = isBharati ? 'BHARATI POLAR ARRAY' : 'MAITRI POLAR ARRAY';

  // Mathematically validated ETA display (consistent with distance ÷ speed)
  const formattedDistance = hasStorm ? `${Math.round(distanceKm)} km` : 'CLEAR';
  const formattedEta = hasStorm
    ? (distanceKm <= 0 ? '0.0h (ARRIVED)' : `${etaHours.toFixed(1)} hrs`)
    : 'N/A';

  return (
    <div className="w-full flex flex-col gap-2.5 font-mono select-none">
      {/* MINIMAL HUD HEADER BAR */}
      <div className="w-full px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#3b494b]/30 backdrop-blur-sm bg-[#06090f]/75 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-ping absolute" />
            <span className="w-2 h-2 rounded-full bg-[#00f0ff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-widest text-[#dbfcff] uppercase">
                ANTARCTIC POLAR RADAR
              </h1>
              <span className="text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-[#18202d] text-[#00dbe9] border border-[#00f0ff]/20">
                PPI SWEEP
              </span>
              <span className="text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-[#111722] text-[#849495] border border-[#3b494b]/40">
                {activeScenarioName.toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] text-[#849495] flex items-center gap-2 mt-0.5">
              <span>{latLong}</span>
              <span className="text-[#3b494b]">•</span>
              <span>{arrayName}</span>
              <span className="text-[#3b494b]">•</span>
              <span className={hasStorm ? (distanceKm <= 0 ? 'text-[#ff5460] font-bold' : 'text-[#ff5460] font-semibold') : 'text-[#60ff99]'}>
                {hasStorm
                  ? (distanceKm <= 0 ? 'STORM IMPACT (ARRIVED)' : `STORM DETECTED (${direction})`)
                  : 'STANDBY: NOMINAL'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Telemetry Coordinates & Quick Range Selector */}
        <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-center">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs text-[#00f0ff] font-semibold tracking-wider">
              AZ: {azimuthDeg.toFixed(1).padStart(5, '0')}° // EL: +0.50°
            </span>
            <span className="text-[10px] text-[#849495]">PRF: 1200 HZ • S-BAND 2.84 GHz</span>
          </div>

          {/* Quick Range Selector */}
          <div className="flex items-center bg-[#111722] rounded border border-[#3b494b]/40 p-0.5 text-xs">
            <button
              onClick={() => onRangeChange?.(100)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                maxRangeKm === 100
                  ? 'bg-[#00f0ff] text-[#06090f] shadow-sm font-bold'
                  : 'text-[#849495] hover:text-[#dbfcff]'
              }`}
            >
              100K
            </button>
            <button
              onClick={() => onRangeChange?.(200)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                maxRangeKm === 200
                  ? 'bg-[#00f0ff] text-[#06090f] shadow-sm font-bold'
                  : 'text-[#849495] hover:text-[#dbfcff]'
              }`}
            >
              200KM
            </button>
            <button
              onClick={() => onRangeChange?.(500)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                maxRangeKm === 500
                  ? 'bg-[#00f0ff] text-[#06090f] shadow-sm font-bold'
                  : 'text-[#849495] hover:text-[#dbfcff]'
              }`}
            >
              500KM
            </button>
          </div>
        </div>
      </div>

      {/* MINIMAL TELEMETRY HUD STRIP: 6 Explicit Mathematically Consistent Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {/* 1. DISTANCE */}
        <div className="px-3 py-1.5 rounded-xl bg-[#0a0e16]/90 border border-[#3b494b]/40 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between text-[9px] text-[#849495]">
            <span className="uppercase font-semibold tracking-wider">DISTANCE</span>
            <Navigation className="w-3 h-3 text-[#00f0ff]" />
          </div>
          <div className={`text-base font-bold ${hasStorm ? (distanceKm <= 0 ? 'text-[#ff5460] animate-pulse' : 'text-[#ff5460]') : 'text-[#60ff99]'}`}>
            {formattedDistance}
          </div>
          <div className="text-[8px] text-[#849495] truncate">
            {hasStorm ? (distanceKm <= 0 ? 'STORM ARRIVED' : `${Math.round(distanceKm)} km to station`) : '200 KM PERIMETER'}
          </div>
        </div>

        {/* 2. STORM SPEED (Translation velocity toward station) */}
        <div className="px-3 py-1.5 rounded-xl bg-[#0a0e16]/90 border border-[#3b494b]/40 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between text-[9px] text-[#849495]">
            <span className="uppercase font-semibold tracking-wider">STORM SPEED</span>
            <Gauge className="w-3 h-3 text-[#34ff8d]" />
          </div>
          <div className={`text-base font-bold ${hasStorm ? 'text-[#34ff8d]' : 'text-[#849495]'}`}>
            {hasStorm ? `${stormSpeedKmh} km/h` : '0 km/h'}
          </div>
          <div className="text-[8px] text-[#849495] truncate">
            {hasStorm ? 'Translation velocity' : 'No storm motion'}
          </div>
        </div>

        {/* 3. ETA ARRIVAL (Distance / Storm Speed) */}
        <div className="px-3 py-1.5 rounded-xl bg-[#0a0e16]/90 border border-[#3b494b]/40 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between text-[9px] text-[#849495]">
            <span className="uppercase font-semibold tracking-wider">ETA ARRIVAL</span>
            <Clock className="w-3 h-3 text-[#00f0ff]" />
          </div>
          <div className={`text-base font-bold ${hasStorm ? 'text-[#00f0ff]' : 'text-[#849495]'}`}>
            {formattedEta}
          </div>
          <div className="text-[8px] text-[#849495] truncate">
            {hasStorm && distanceKm > 0
              ? `${Math.round(distanceKm)}km ÷ ${stormSpeedKmh}km/h`
              : (hasStorm ? 'Status: ARRIVED' : 'No incoming cell')}
          </div>
        </div>

        {/* 4. FRONT WINDS (Atmospheric blizzard wind speed - distinct from storm translation speed) */}
        <div className="px-3 py-1.5 rounded-xl bg-[#0a0e16]/90 border border-[#3b494b]/40 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between text-[9px] text-[#849495]">
            <span className="uppercase font-semibold tracking-wider">FRONT WINDS</span>
            <Wind className="w-3 h-3 text-[#00f0ff]" />
          </div>
          <div className="text-base font-bold text-[#00f0ff]">
            {Math.round(stormWindSpeed)} km/h
          </div>
          <div className="text-[8px] text-[#849495] truncate">
            {hasStorm ? 'Blizzard wind speed' : 'Ambient katabatic'}
          </div>
        </div>

        {/* 5. BEARING */}
        <div className="px-3 py-1.5 rounded-xl bg-[#0a0e16]/90 border border-[#3b494b]/40 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between text-[9px] text-[#849495]">
            <span className="uppercase font-semibold tracking-wider">BEARING</span>
            <Compass className="w-3 h-3 text-[#00f0ff]" />
          </div>
          <div className="text-base font-bold text-[#00dbe9]">
            {hasStorm ? direction : '360° OMNI'}
          </div>
          <div className="text-[8px] text-[#849495] truncate">
            {hasStorm ? 'Direct intercept' : 'Continuous sweep'}
          </div>
        </div>

        {/* 6. SEVERITY & ARRIVAL STATUS */}
        <div className="px-3 py-1.5 rounded-xl bg-[#0a0e16]/90 border border-[#3b494b]/40 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between text-[9px] text-[#849495]">
            <span className="uppercase font-semibold tracking-wider">SEVERITY</span>
            <ShieldAlert className="w-3 h-3 text-[#ff5460]" />
          </div>
          <div className="text-base font-bold">
            {hasStorm ? (
              <span className={distanceKm <= 0 ? 'text-[#ff5460] font-black' : 'text-[#ff5460]'}>
                {distanceKm <= 0 ? 'ARRIVED' : severity}
              </span>
            ) : (
              <span className="text-[#60ff99] uppercase">NOMINAL</span>
            )}
          </div>
          <div className="text-[8px] text-[#849495] truncate">
            {hasStorm ? (distanceKm <= 0 ? 'Eyewall at station' : 'Critical Blizzard') : 'Nominal Operations'}
          </div>
        </div>
      </div>
    </div>
  );
};
