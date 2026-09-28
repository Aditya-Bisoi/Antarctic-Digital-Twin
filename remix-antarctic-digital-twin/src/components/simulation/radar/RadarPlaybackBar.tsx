import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';

export interface SpeedPreset {
  label: string;
  value: number;
  hint: string;
}

export interface RadarPlaybackBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  onSeekHour?: (hour: number) => void;
  simHoursElapsed: number;
  totalSimHours?: number;
  // Speed multiplier (sim-seconds per real-second)
  speedMultiplier?: number;
  onSpeedChange?: (speed: number) => void;
  speedPresets?: SpeedPreset[];
  simulationSpeed?: number; // legacy prop, unused
}

export const RadarPlaybackBar: React.FC<RadarPlaybackBarProps> = ({
  isPlaying,
  onTogglePlay,
  onReset,
  onSeekHour,
  simHoursElapsed,
  totalSimHours = 3.0,
  speedMultiplier = 360,
  onSpeedChange,
  speedPresets,
}) => {
  const [utcTime, setUtcTime] = useState('00:00:00 UTC');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${h}:${m}:${s} UTC`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const progressPercent = Math.min(100, Math.max(0, (simHoursElapsed / totalSimHours) * 100));

  return (
    <div className="w-full px-4 py-2.5 border-t border-[#3b494b]/30 backdrop-blur-sm bg-[#06090f]/75 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#849495] font-mono select-none">
      {/* Left: Simulation status & playback buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#60ff99] animate-pulse' : 'bg-[#ff9900]'}`} />
          <span className="text-[#dfe2ee] font-semibold tracking-wider">
            {isPlaying ? 'SIM RUNNING' : 'SIM PAUSED'}
          </span>
        </div>
        <span className="text-[#3b494b]">|</span>

        {/* Play / Pause */}
        <button
          onClick={onTogglePlay}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111722] hover:bg-[#18202d] text-[#00f0ff] border border-[#00f0ff]/30 transition-colors font-semibold active:scale-95 cursor-pointer"
        >
          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          <span>{isPlaying ? 'PAUSE SIM' : 'PLAY SIM'}</span>
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#111722] hover:bg-[#18202d] text-[#849495] hover:text-[#dfe2ee] border border-[#3b494b]/40 transition-colors active:scale-95 cursor-pointer"
          title="Reset Simulation Clock to Hour 0"
        >
          <RotateCcw className="w-3 h-3" />
          <span>RESET (0H)</span>
        </button>

        {/* ── Demo Speed Presets ── */}
        {speedPresets && speedPresets.length > 0 && onSpeedChange && (
          <>
            <span className="text-[#3b494b]">|</span>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#ff9900]" />
              <span className="text-[9px] text-[#849495] uppercase tracking-wider">Speed:</span>
              {speedPresets.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => onSpeedChange(preset.value)}
                  title={preset.hint}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer active:scale-95 ${
                    speedMultiplier === preset.value
                      ? 'bg-[#ff9900]/20 text-[#ff9900] border-[#ff9900]/40'
                      : 'bg-[#111722] text-[#849495] border-[#3b494b]/30 hover:text-[#dfe2ee] hover:border-[#849495]/40'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Center: Simulation Clock Scrubber & Milestones */}
      <div className="flex-1 w-full max-w-md flex items-center gap-2.5 px-2">
        <span className="text-[10px] text-[#849495] shrink-0 font-semibold">
          T+{simHoursElapsed.toFixed(2)}h
        </span>
        <div
          role="slider"
          aria-valuemin={0}
          aria-valuemax={totalSimHours}
          aria-valuenow={simHoursElapsed}
          className="flex-1 h-3 flex items-center cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onSeekHour?.(Number((ratio * totalSimHours).toFixed(2)));
          }}
          title="Click to scrub simulation time"
        >
          <div className="w-full h-1.5 bg-[#111722] border border-[#3b494b]/40 rounded-full overflow-hidden group-hover:h-2 transition-all">
            <div
              className="h-full bg-gradient-to-r from-[#00f0ff] via-[#00dbe9] to-[#34ff8d] transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <span className="text-[10px] font-bold text-[#00f0ff] shrink-0">
          / {totalSimHours.toFixed(1)}h SIM
        </span>

        {/* Milestone Quick Jumps: 0H (180km) → 1H (120km) → 2H (60km) → 3H (ARRIVED) */}
        <div className="hidden sm:flex items-center gap-1 ml-1 text-[9px]">
          <button
            onClick={() => onSeekHour?.(0.0)}
            className={`px-1.5 py-0.5 rounded border transition-colors ${Math.abs(simHoursElapsed - 0) < 0.1 ? 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/40 font-bold' : 'border-[#3b494b]/30 text-[#849495] hover:text-[#dfe2ee]'}`}
            title="Hour 0: Distance 180 km (Initial)"
          >
            0H
          </button>
          <button
            onClick={() => onSeekHour?.(1.0)}
            className={`px-1.5 py-0.5 rounded border transition-colors ${Math.abs(simHoursElapsed - 1) < 0.1 ? 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/40 font-bold' : 'border-[#3b494b]/30 text-[#849495] hover:text-[#dfe2ee]'}`}
            title="Hour 1: Distance 120 km"
          >
            1H
          </button>
          <button
            onClick={() => onSeekHour?.(2.0)}
            className={`px-1.5 py-0.5 rounded border transition-colors ${Math.abs(simHoursElapsed - 2) < 0.1 ? 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/40 font-bold' : 'border-[#3b494b]/30 text-[#849495] hover:text-[#dfe2ee]'}`}
            title="Hour 2: Distance 60 km"
          >
            2H
          </button>
          <button
            onClick={() => onSeekHour?.(3.0)}
            className={`px-1.5 py-0.5 rounded border transition-colors ${Math.abs(simHoursElapsed - 3) < 0.1 ? 'bg-[#ff5460]/20 text-[#ff5460] border-[#ff5460]/40 font-bold' : 'border-[#3b494b]/30 text-[#849495] hover:text-[#dfe2ee]'}`}
            title="Hour 3: Distance 0 km (Arrived)"
          >
            3H
          </button>
        </div>
      </div>

      {/* Right: Station UTC Clock */}
      <div className="flex items-center gap-3">
        <span className="hidden lg:inline text-[10px] text-[#849495]">INTEGRATION: GLACIAL COHERENT</span>
        <span className="hidden lg:inline text-[#3b494b]">|</span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-[#849495]">STATION TIME:</span>
          <span className="text-[#dbfcff] font-semibold">{utcTime}</span>
        </div>
      </div>
    </div>
  );
};
