import React, { useState, useEffect } from 'react';

import { mapDistanceToRadarRadiusRatio } from '../../../simulation/stormPhysics';

export interface RadarScopeProps {
  stationName?: string;
  hasStorm: boolean;
  stormDistanceKm: number;
  stormSpeedKmh: number;
  direction?: string;
  stormWindSpeed?: number;
  calculatedEta: number;
  maxRangeKm?: number;
  className?: string;
  onRangeChange?: (rangeKm: number) => void;
}

export const RadarScope: React.FC<RadarScopeProps> = ({
  stationName = 'Maitri Station',
  hasStorm,
  stormDistanceKm,
  stormSpeedKmh,
  direction = '135° SE',
  stormWindSpeed = 115,
  calculatedEta,
  maxRangeKm = 200,
  className = '',
}) => {
  // Polar coordinate calculation on 800x800 SVG canvas (cx=400, cy=400, maxR=350)
  const cx = 400;
  const cy = 400;
  const maxR = 350;

  // Bearing from station: 135° SE for Maitri, 065° NE for Bharati
  const bearingDeg = direction?.includes('065') || direction?.includes('NE') ? 65 : 135;
  const stormBearingRad = (bearingDeg * Math.PI) / 180;

  // Explicit range boundary: if storm is beyond maxRangeKm, it is out of range
  const isWithinRadarRange = stormDistanceKm <= (maxRangeKm || 200);

  // Pure physical distance ratio mapped to radar radius
  const distRatio = mapDistanceToRadarRadiusRatio(stormDistanceKm, maxRangeKm || 200);
  const stormR = distRatio * maxR;
  const stormX = cx + stormR * Math.sin(stormBearingRad);
  const stormY = cy - stormR * Math.cos(stormBearingRad);

  // Direction vector angle toward station
  const trajAngle = Math.atan2(cy - stormY, cx - stormX);

  return (

    <div
      className={`relative w-[min(78vh,86vw)] aspect-square max-w-[780px] max-h-[780px] rounded-full flex items-center justify-center bg-[#0a0e16] shadow-[0_0_80px_-15px_rgba(0,240,255,0.22)] border border-[#00f0ff]/30 overflow-hidden select-none ${className}`}
    >
      {/* SCANLINE & CRT PHOSPHOR OVERLAYS */}
      <div className="absolute inset-0 rounded-full pointer-events-none z-30 bg-[radial-gradient(circle_at_center,_transparent_50%,_rgba(6,9,15,0.9)_100%)]" />
      <div className="absolute inset-0 rounded-full pointer-events-none z-30 opacity-15 bg-[repeating-linear-gradient(0deg,#00f0ff,#00f0ff_1px,transparent_1px,transparent_4px)]" />

      {/* SVG LAYER 1: GEOGRAPHIC ANTARCTICA CONTINENTAL OUTLINES */}
      <svg
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
        viewBox="0 0 800 800"
      >
        <g className="opacity-50">
          {/* Continental shelf contours around South Pole / Station center */}
          <path
            d="M 380,120 
               C 460,130 570,210 610,310 
               C 640,365 650,460 600,560 
               C 560,630 490,670 420,695 
               C 350,710 250,680 195,600 
               C 155,530 168,420 210,325 
               C 250,240 310,145 380,120 Z"
            fill="#00f0ff"
            fillOpacity="0.03"
            stroke="#00dbe9"
            strokeDasharray="5 3"
            strokeWidth="1.2"
          />
          {/* Ross Ice Shelf Indentation Contour */}
          <path
            d="M 270,580 C 295,540 325,515 365,530 C 405,545 435,595 450,625"
            fill="none"
            stroke="#34ff8d"
            strokeDasharray="3 3"
            strokeWidth="1.2"
          />
          <text
            x="290"
            y="555"
            fill="#34ff8d"
            fontSize="10"
            fontFamily="monospace"
            letterSpacing="0.1em"
            opacity="0.8"
          >
            ROSS ICE SHELF
          </text>
          {/* Weddell Sea Basin Sector */}
          <path
            d="M 445,175 C 500,205 530,260 490,305"
            fill="none"
            stroke="#849495"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text
            x="475"
            y="215"
            fill="#849495"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.08em"
            opacity="0.7"
          >
            WEDDELL BASIN
          </text>
          {/* Transantarctic Mountains Ridge Line */}
          <line
            x1="380"
            y1="380"
            x2="280"
            y2="600"
            stroke="#dbfcff"
            strokeDasharray="1 5"
            strokeOpacity="0.6"
            strokeWidth="0.75"
          />
          <text
            x="250"
            y="470"
            transform="rotate(-65 250 470)"
            fill="#849495"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.12em"
            opacity="0.7"
          >
            TRANSANTARCTIC MTNS
          </text>
        </g>
      </svg>

      {/* SVG LAYER 2: PPI COMPASS RETICLE & CONCENTRIC RANGE RINGS */}
      <svg
        className="absolute inset-0 w-full h-full z-20 pointer-events-none grid-glow"
        viewBox="0 0 800 800"
      >
        <defs>
          <radialGradient id="stormGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="25%" stopColor="#ff5460" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#ff9900" stopOpacity="0.75" />
            <stop offset="85%" stopColor="#ffd000" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff5460" stopOpacity="0" />
          </radialGradient>
          <filter id="stormGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Azimuth Bearing Rings */}
        <circle cx="400" cy="400" r="375" fill="none" stroke="#1c2633" strokeWidth="2" />
        <circle cx="400" cy="400" r="365" fill="none" stroke="#00f0ff" strokeOpacity="0.35" strokeWidth="1" />

        {/* Concentric Range Rings (50km/100k, 100km/250k, 150km/500k, 200km/750k) */}
        <circle cx="400" cy="400" r="87" fill="none" stroke="#3b494b" strokeDasharray="2 3" strokeWidth="0.8" />
        <circle cx="400" cy="400" r="175" fill="none" stroke="#3b494b" strokeDasharray="3 3" strokeWidth="0.8" />
        <circle cx="400" cy="400" r="262" fill="none" stroke="#3b494b" strokeDasharray="3 3" strokeWidth="0.8" />
        <circle cx="400" cy="400" r="350" fill="none" stroke="#00f0ff" strokeDasharray="4 3" strokeOpacity="0.5" strokeWidth="1.2" />

        {/* Range Labels along North Ray */}
        <text x="408" y="318" fill="#849495" fontSize="10" fontFamily="monospace" opacity="0.85">
          {Math.round(maxRangeKm * 0.25)} KM
        </text>
        <text x="408" y="230" fill="#849495" fontSize="10" fontFamily="monospace" opacity="0.85">
          {Math.round(maxRangeKm * 0.5)} KM
        </text>
        <text x="408" y="142" fill="#849495" fontSize="10" fontFamily="monospace" opacity="0.85">
          {Math.round(maxRangeKm * 0.75)} KM
        </text>
        <text x="408" y="54" fill="#00f0ff" fontSize="10" fontWeight="600" fontFamily="monospace" opacity="0.95">
          {maxRangeKm} KM (MAX RADIAL)
        </text>

        {/* Cardinal Points & Major Bearing Degrees */}
        <text x="390" y="24" fill="#00f0ff" fontSize="13" fontWeight="700" fontFamily="monospace">
          000° [N]
        </text>
        <text x="748" y="405" fill="#00f0ff" fontSize="13" fontWeight="700" fontFamily="monospace">
          090° [E]
        </text>
        <text x="385" y="788" fill="#00f0ff" fontSize="13" fontWeight="700" fontFamily="monospace">
          180° [S]
        </text>
        <text x="14" y="405" fill="#00f0ff" fontSize="13" fontWeight="700" fontFamily="monospace">
          270° [W]
        </text>

        {/* 30-Degree Ticks & Angle Labels */}
        <text x="580" y="90" fill="#849495" fontSize="10" fontFamily="monospace">030°</text>
        <text x="700" y="230" fill="#849495" fontSize="10" fontFamily="monospace">060°</text>
        <text x="700" y="580" fill="#849495" fontSize="10" fontFamily="monospace">120°</text>
        <text x="580" y="720" fill="#849495" fontSize="10" fontFamily="monospace">150°</text>
        <text x="190" y="720" fill="#849495" fontSize="10" fontFamily="monospace">210°</text>
        <text x="70" y="580" fill="#849495" fontSize="10" fontFamily="monospace">240°</text>
        <text x="70" y="230" fill="#849495" fontSize="10" fontFamily="monospace">300°</text>
        <text x="190" y="90" fill="#849495" fontSize="10" fontFamily="monospace">330°</text>

        {/* Cardinal Crosshairs */}
        <line x1="50" y1="400" x2="750" y2="400" stroke="#00f0ff" strokeOpacity="0.3" strokeWidth="0.75" />
        <line x1="400" y1="50" x2="400" y2="750" stroke="#00f0ff" strokeOpacity="0.3" strokeWidth="0.75" />

        {/* Diagonal Reticle Rays */}
        <line x1="152" y1="152" x2="648" y2="648" stroke="#3b494b" strokeDasharray="3 3" strokeOpacity="0.4" strokeWidth="0.6" />
        <line x1="152" y1="648" x2="648" y2="152" stroke="#3b494b" strokeDasharray="3 3" strokeOpacity="0.4" strokeWidth="0.6" />

        {/* CENTRAL STATION MARKER (Fixed at 400, 400) */}
        <circle cx="400" cy="400" r="16" fill="none" stroke="#00f0ff" strokeOpacity="0.4" strokeWidth="1" className="animate-ping" style={{ animationDuration: '3s' }} />
        <circle cx="400" cy="400" r="8" fill="none" stroke="#00f0ff" strokeOpacity="0.6" strokeWidth="1.2" />
        <circle cx="400" cy="400" r="4" fill="#00f0ff" className="phosphor-glow" />
        <circle cx="400" cy="400" r="1.5" fill="#ffffff" />
        <text x="400" y="424" fill="#00dbe9" fontSize="10" fontWeight="700" fontFamily="monospace" textAnchor="middle">
          {stationName.toUpperCase()}
        </text>
        <text x="400" y="437" fill="#849495" fontSize="8" fontFamily="monospace" textAnchor="middle">
          (STATION CENTER • 0 KM)
        </text>

        {/* APPROACHING STORM CELL & TRAJECTORY (Only if storm active) */}
        {hasStorm && !isWithinRadarRange && (
          <g transform={`translate(${cx + 340 * Math.sin(stormBearingRad)}, ${cy - 340 * Math.cos(stormBearingRad)})`}>
            <circle r="6" fill="#ff5460" stroke="#ffffff" strokeWidth="1.5" className="animate-ping" />
            <circle r="4" fill="#ff5460" />
            <rect x="10" y="-10" width="165" height="20" rx="3" fill="#06090f" fillOpacity="0.85" stroke="#ff5460" strokeWidth="0.8" />
            <text x="15" y="4" fill="#ff5460" fontSize="8.5" fontWeight="700" fontFamily="monospace">
              OUT OF RANGE ({Math.round(stormDistanceKm)} KM &gt; {maxRangeKm} KM)
            </text>
          </g>
        )}

        {hasStorm && isWithinRadarRange && (
          <g>
            {/* Trajectory dashed line leading to center station */}
            <line
              x1={stormX}
              y1={stormY}
              x2="400"
              y2="400"
              stroke="#ff5460"
              strokeDasharray="6 4"
              strokeOpacity="0.7"
              strokeWidth="2"
            />

            {/* Directional Chevron along Trajectory */}
            {distRatio > 0.15 && (
              <g transform={`translate(${stormX + (400 - stormX) * 0.45}, ${stormY + (400 - stormY) * 0.45}) rotate(${(trajAngle * 180) / Math.PI})`}>
                <polyline points="-8,-6 0,0 -8,6" fill="none" stroke="#ff5460" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            )}

            {/* Multi-tier Doppler storm cell reflectivity blip */}
            <circle
              cx={stormX}
              cy={stormY}
              r={Math.max(28, 42 - distRatio * 10)}
              fill="url(#stormGradient)"
              filter="url(#stormGlow)"
            />
            {/* Inner dense convective core */}
            <circle
              cx={stormX}
              cy={stormY}
              r="8"
              fill="#ffffff"
              className="animate-pulse"
              style={{ animationDuration: '1.2s' }}
            />

            {/* Target Lock Brackets */}
            <g stroke="#00f0ff" strokeWidth="1.8" fill="none">
              <path d={`M ${stormX - 22},${stormY - 14} L ${stormX - 22},${stormY - 22} L ${stormX - 14},${stormY - 22}`} />
              <path d={`M ${stormX + 14},${stormY - 22} L ${stormX + 22},${stormY - 22} L ${stormX + 22},${stormY - 14}`} />
              <path d={`M ${stormX - 22},${stormY + 14} L ${stormX - 22},${stormY + 22} L ${stormX - 14},${stormY + 22}`} />
              <path d={`M ${stormX + 14},${stormY + 22} L ${stormX + 22},${stormY + 22} L ${stormX + 22},${stormY + 14}`} />
            </g>

            {/* Storm HUD Callout Label */}
            <g transform={`translate(${stormX + (stormX > 600 ? -160 : 28)}, ${stormY - 6})`}>
              <rect x="0" y="-12" width="155" height="28" rx="4" fill="#06090f" fillOpacity="0.85" stroke="#ff5460" strokeOpacity="0.6" strokeWidth="1" />
              <text x="8" y="2" fill="#ff5460" fontSize="9" fontWeight="700" fontFamily="monospace">
                {stormDistanceKm <= 0 ? 'STORM ARRIVED' : 'APPROACHING STORM'}
              </text>
              <text x="8" y="12" fill="#00f0ff" fontSize="8" fontFamily="monospace">
                {stormDistanceKm <= 0
                  ? 'EYEWALL AT STATION • ETA 0.0H'
                  : `${Math.round(stormDistanceKm)} KM • ETA ${calculatedEta.toFixed(1)}H`}
              </text>
            </g>
          </g>
        )}
      </svg>


      {/* ROTATING RADAR SWEEP CONIC GRADIENT & LEADING EDGE BEAM */}
      <div className="absolute inset-0 w-full h-full rounded-full z-20 pointer-events-none sweep-rotate">
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, rgba(0, 240, 255, 0.42) 0deg, rgba(0, 240, 255, 0.16) 24deg, rgba(0, 240, 255, 0.02) 60deg, transparent 60deg)',
          }}
        />
        {/* Ultra-sharp leading sweep edge with bright phosphor trail */}
        <div className="absolute top-0 left-1/2 w-[1.5px] h-1/2 bg-white origin-bottom shadow-[0_0_12px_#00f0ff,0_0_4px_#ffffff]" />
      </div>
    </div>
  );
};
