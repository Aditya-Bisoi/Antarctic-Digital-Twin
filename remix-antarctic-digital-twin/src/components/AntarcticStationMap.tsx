import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Navigation,
  Wind,
  Thermometer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Radio,
  Layers,
  MapPin,
  ExternalLink,
  Info,
  Activity,
  Users,
  Shield,
  Clock,
  Waves,
  Anchor,
} from 'lucide-react';

interface AntarcticStationMapProps {
  selectedStationId?: 'maitri' | 'bharati';
  onSelectStation?: (stationId: 'maitri' | 'bharati') => void;
  compact?: boolean;
}

// Polar Stereographic Projection Formula (matching IBCSO Version 1 / 2, Standard Parallel 71°S)
// Center at SVG (500, 500), outer 60°S circle radius = 480px.
function geoToSvg(lat: number, lon: number): { x: number; y: number } {
  const cx = 500;
  const cy = 500;
  const r60 = 480;
  const colat = 90 - lat; // degrees from South Pole
  // Standard stereographic radial distance from South Pole
  const r = r60 * (Math.tan((colat * Math.PI) / 360) / Math.tan((15 * Math.PI) / 180));
  const angleRad = (lon * Math.PI) / 180;
  const x = cx + r * Math.sin(angleRad);
  const y = cy - r * Math.cos(angleRad);
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

interface StationMetadata {
  id: string;
  name: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  coords: string;
  region: string;
  elevation: string;
  temp: string;
  wind: string;
  status: 'Operational' | 'Historical' | 'Active';
  type: string;
  commissioned: string;
  crew: number;
  isIndian: boolean;
  color: string;
  description: string;
}

const STATIONS: Record<string, StationMetadata> = {
  bharati: {
    id: 'bharati',
    name: 'Bharati Station',
    country: 'India (NCPOR)',
    flag: '🇮🇳',
    lat: 69.408,
    lon: 76.187,
    coords: "69°24'28\"S, 76°11'14\"E",
    region: 'Larsemann Hills, Prydz Bay',
    elevation: '35 m',
    temp: '-25°C',
    wind: '36 km/h NE',
    status: 'Operational',
    type: 'State-of-the-Art Research Facility',
    commissioned: '2012 (33rd ISEA)',
    crew: 47,
    isIndian: true,
    color: '#06b6d4', // Cyan
    description:
      'India’s cutting-edge polar station constructed with 134 modular ISO containers on stilts, providing complete thermal efficiency, greywater recycling, and combined heat & power microgrid.',
  },
  maitri: {
    id: 'maitri',
    name: 'Maitri Station',
    country: 'India (NCPOR)',
    flag: '🇮🇳',
    lat: 70.766,
    lon: 11.736,
    coords: "70°45'57\"S, 11°44'09\"E",
    region: 'Schirmacher Oasis, Queen Maud Land',
    elevation: '117 m',
    temp: '-28°C',
    wind: '42 km/h ESE',
    status: 'Operational',
    type: 'Permanent Inland Oasis Base',
    commissioned: '1989 (8th ISEA)',
    crew: 25,
    isIndian: true,
    color: '#38bdf8', // Sky Blue
    description:
      'Inland research outpost situated near Lake Priyadarshini in the ice-free rocky Schirmacher Oasis, conducting atmospheric physics, geomagnetism, and glaciological monitoring.',
  },
  dakshin_gangotri: {
    id: 'dakshin_gangotri',
    name: 'Dakshin Gangotri',
    country: 'India (Historical)',
    flag: '🇮🇳',
    lat: 70.083,
    lon: 12.0,
    coords: "70°05'S, 12°00'E",
    region: 'Dakshin Gangotri Ice Shelf',
    elevation: 'Sea level (Submerged)',
    temp: '-31°C',
    wind: '48 km/h S',
    status: 'Historical',
    type: 'First Indian Antarctic Base',
    commissioned: '1983 (Decommissioned 1990)',
    crew: 0,
    isIndian: true,
    color: '#f59e0b', // Amber
    description:
      'India’s historic first permanent base erected during the 3rd Indian Expedition. Submerged under accumulating snow in 1990; currently preserved as a designated historic heritage site.',
  },
  south_pole: {
    id: 'south_pole',
    name: 'Amundsen-Scott South Pole Station',
    country: 'United States (NSF)',
    flag: '🇺🇸',
    lat: 90.0,
    lon: 0.0,
    coords: "90°00'00\"S, 0°00'00\"E",
    region: 'Geographic South Pole (Polar Plateau)',
    elevation: '2,835 m',
    temp: '-58°C',
    wind: '18 km/h Grid N',
    status: 'Active',
    type: 'Geographic Pole Observatory',
    commissioned: '1956',
    crew: 50,
    isIndian: false,
    color: '#a855f7',
    description:
      'Atmospheric baseline observatory and astrophysics laboratory situated at the exact Geographic South Pole atop nearly 3 km of polar ice sheet.',
  },
  mcmurdo: {
    id: 'mcmurdo',
    name: 'McMurdo Station',
    country: 'United States (NSF)',
    flag: '🇺🇸',
    lat: 77.85,
    lon: 166.67,
    coords: "77°51'S, 166°40'E",
    region: 'Ross Island, Ross Sea',
    elevation: '24 m',
    temp: '-22°C',
    wind: '28 km/h S',
    status: 'Active',
    type: 'Major Logistics Hub',
    commissioned: '1955',
    crew: 250,
    isIndian: false,
    color: '#94a3b8',
    description: 'Largest community in Antarctica, serving as the primary logistics gateway to the interior and South Pole.',
  },
  vostok: {
    id: 'vostok',
    name: 'Vostok Station',
    country: 'Russia (AARI)',
    flag: '🇷🇺',
    lat: 78.46,
    lon: 106.8,
    coords: "78°28'S, 106°48'E",
    region: 'Inland Ice Plateau (Pole of Cold)',
    elevation: '3,488 m',
    temp: '-68°C',
    wind: '14 km/h W',
    status: 'Active',
    type: 'Deep Ice Core Drilling & Geomagnetic Base',
    commissioned: '1957',
    crew: 30,
    isIndian: false,
    color: '#94a3b8',
    description: 'Site of the lowest recorded natural surface temperature on Earth (-89.2°C) and deep subglacial Lake Vostok drilling.',
  },
  concordia: {
    id: 'concordia',
    name: 'Concordia Station',
    country: 'France / Italy (IPEV / PNRA)',
    flag: '🇫🇷🇮🇹',
    lat: 75.1,
    lon: 123.3,
    coords: "75°06'S, 123°20'E",
    region: 'Dome C, East Antarctic Plateau',
    elevation: '3,233 m',
    temp: '-64°C',
    wind: '12 km/h S',
    status: 'Active',
    type: 'High-Altitude Astrophysical Observatory',
    commissioned: '2005',
    crew: 16,
    isIndian: false,
    color: '#94a3b8',
    description: 'Joint European polar observatory on Dome C, conducting exoplanet observation, atmospheric astronomy, and human spaceflight analog research.',
  },
  halley: {
    id: 'halley',
    name: 'Halley VI Research Station',
    country: 'United Kingdom (BAS)',
    flag: '🇬🇧',
    lat: 75.58,
    lon: -26.66,
    coords: "75°35'S, 26°40'W",
    region: 'Brunt Ice Shelf, Weddell Sea',
    elevation: '30 m',
    temp: '-32°C',
    wind: '38 km/h E',
    status: 'Active',
    type: 'Movable Ski-Mounted Ice Shelf Station',
    commissioned: '2013',
    crew: 20,
    isIndian: false,
    color: '#94a3b8',
    description: 'World-famous relocatable modular research facility situated on the Brunt Ice Shelf, where the Antarctic ozone hole was first discovered.',
  },
  rothera: {
    id: 'rothera',
    name: 'Rothera Research Station',
    country: 'United Kingdom (BAS)',
    flag: '🇬🇧',
    lat: 67.57,
    lon: -68.13,
    coords: "67°34'S, 68°08'W",
    region: 'Adelaide Island, Antarctic Peninsula',
    elevation: '16 m',
    temp: '-14°C',
    wind: '30 km/h NW',
    status: 'Active',
    type: 'Peninsula Logistics Hub & Airfield',
    commissioned: '1975',
    crew: 100,
    isIndian: false,
    color: '#94a3b8',
    description: 'Main British Antarctic Survey hub with a 900m gravel runway supporting Dash-7 air operations across the Antarctic Peninsula.',
  },
};

export default function AntarcticStationMap({
  selectedStationId,
  onSelectStation,
  compact = false,
}: AntarcticStationMapProps) {
  const navigate = useNavigate();

  // Zoom and Pan States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanRef = useRef({ x: 0, y: 0 });

  // Layer Toggles
  const [showRoutes, setShowRoutes] = useState(true);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showInternational, setShowInternational] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  // Active Selected Station
  const [activeStationId, setActiveStationId] = useState<string>(
    selectedStationId || 'bharati'
  );

  const activeStation = STATIONS[activeStationId] || STATIONS.bharati;

  // Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setIsPanning(true);
    startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y,
    });
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const focusStation = (stId: 'bharati' | 'maitri' | 'all') => {
    if (stId === 'all') {
      resetView();
      return;
    }
    const st = STATIONS[stId];
    if (!st) return;
    const pos = geoToSvg(st.lat, st.lon);
    setActiveStationId(stId);
    if (onSelectStation) {
      onSelectStation(stId as 'maitri' | 'bharati');
    }
    // Pan to position with smooth zoom
    setZoom(1.8);
    // Center at position (500 - pos.x * zoom, 500 - pos.y * zoom)
    setPan({
      x: (500 - pos.x) * 1.5,
      y: (500 - pos.y) * 1.5,
    });
  };

  const handleStationClick = (id: string) => {
    setActiveStationId(id);
    if ((id === 'maitri' || id === 'bharati') && onSelectStation) {
      onSelectStation(id as 'maitri' | 'bharati');
    }
  };

  // Pre-calculated station SVG coordinates
  const maitriPos = geoToSvg(STATIONS.maitri.lat, STATIONS.maitri.lon);
  const bharatiPos = geoToSvg(STATIONS.bharati.lat, STATIONS.bharati.lon);
  const dakshinPos = geoToSvg(STATIONS.dakshin_gangotri.lat, STATIONS.dakshin_gangotri.lon);
  const southPolePos = geoToSvg(STATIONS.south_pole.lat, STATIONS.south_pole.lon);

  return (
    <div className="relative w-full rounded-2xl bg-slate-950 border border-sky-900/40 shadow-2xl overflow-hidden flex flex-col font-sans">
      {/* Top Map HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/90 border-b border-sky-900/40 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
            <Compass className="w-5 h-5 animate-[spin_16s_linear_infinite]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>Antarctic Geospatial Bathymetric Chart</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-semibold">
                IBCSO POLAR STEREOGRAPHIC (71°S)
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              National Centre for Polar and Ocean Research (NCPOR) • High-Resolution Bathymetry & Ice Sheet
            </p>
          </div>
        </div>

        {/* Quick Station Focus Presets & Layer Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Focus Buttons */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => focusStation('bharati')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeStationId === 'bharati'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Bharati
            </button>
            <button
              type="button"
              onClick={() => focusStation('maitri')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeStationId === 'maitri'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Maitri
            </button>
            <button
              type="button"
              onClick={() => focusStation('all')}
              className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 cursor-pointer"
            >
              Full Chart
            </button>
          </div>

          {/* Layer Toggles */}
          <div className="hidden md:flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setShowRoutes(!showRoutes)}
              className={`px-2 py-1 rounded-lg transition-colors cursor-pointer text-[11px] font-medium ${
                showRoutes ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Logistics Routes
            </button>
            <button
              type="button"
              onClick={() => setShowWeatherOverlay(!showWeatherOverlay)}
              className={`px-2 py-1 rounded-lg transition-colors cursor-pointer text-[11px] font-medium ${
                showWeatherOverlay ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Katabatic Winds
            </button>
            <button
              type="button"
              onClick={() => setShowInternational(!showInternational)}
              className={`px-2 py-1 rounded-lg transition-colors cursor-pointer text-[11px] font-medium ${
                showInternational ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              International Bases
            </button>
            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className={`px-2 py-1 rounded-lg transition-colors cursor-pointer text-[11px] font-medium ${
                showGrid ? 'bg-slate-700 text-slate-200' : 'text-slate-400 hover:text-white'
              }`}
            >
              Graticule
            </button>
          </div>

          {/* Zoom & Reset Controls */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, z + 0.3))}
              title="Zoom in"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.3))}
              title="Zoom out"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Reset View"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Container */}
      <div
        className={`relative w-full ${
          compact ? 'h-[440px]' : 'h-[580px] lg:h-[680px]'
        } bg-[#030917] select-none overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* SVG Interactive Canvas */}
        <svg
          viewBox="0 0 1000 1000"
          className="w-full h-full pointer-events-auto"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '500px 500px',
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            {/* Circular Map Clip Path - Outer 60°S neatline at r=480px */}
            <clipPath id="antarcticCircleClip">
              <circle cx="500" cy="500" r="480" />
            </clipPath>

            {/* Glowing neon filter for station pins and logistics corridors */}
            <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="amberGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Pulsing radar gradient */}
            <radialGradient id="radarPulseGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(6, 182, 212, 0.4)" />
              <stop offset="60%" stopColor="rgba(6, 182, 212, 0.15)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
            </radialGradient>
          </defs>

          {/* Deep Space Background for Canvas */}
          <rect x="0" y="0" width="1000" height="1000" fill="#020617" />

          {/* Base Outer Circular Shadow */}
          <circle cx="500" cy="500" r="482" fill="#030c1d" stroke="#0e2a4a" strokeWidth="2" />

          {/* 1. AUTHENTIC IBCSO BATHYMETRIC CHART BASEMAP IMAGE */}
          <g clipPath="url(#antarcticCircleClip)">
            <image
              href="/images/antarctic-bathymetric-chart.png"
              x="3.5"
              y="2.0"
              width="990"
              height="1002"
              preserveAspectRatio="none"
            />
            {/* Subtle blue depth vignette overlay */}
            <circle
              cx="500"
              cy="500"
              r="480"
              fill="none"
              stroke="rgba(2, 132, 199, 0.25)"
              strokeWidth="10"
            />
          </g>

          {/* 2. POLAR GRATICULE (LATITUDE / LONGITUDE RAYS & PARALLELS) */}
          {showGrid && (
            <g opacity="0.45" stroke="#7dd3fc" strokeWidth="0.8" strokeDasharray="3 4">
              {/* Concentric Parallels: 80°S, 70°S */}
              {/* 80°S Parallel (r ≈ 156.7 px) */}
              <circle cx="500" cy="500" r="156.7" fill="none" />
              <text x="504" y="347" fill="#7dd3fc" fontSize="9" fontFamily="monospace" opacity="0.9">
                80°S
              </text>

              {/* 70°S Parallel (r ≈ 315.9 px) */}
              <circle cx="500" cy="500" r="315.9" fill="none" />
              <text x="504" y="188" fill="#7dd3fc" fontSize="9" fontFamily="monospace" opacity="0.9">
                70°S
              </text>

              {/* Radial Longitude Rays from South Pole to 60°S neatline */}
              {/* 0° (Greenwich) and 180° (Dateline) */}
              <line x1="500" y1="20" x2="500" y2="980" />
              {/* 90°E and 90°W */}
              <line x1="20" y1="500" x2="980" y2="500" />
              {/* 30° and 150° */}
              <line
                x1={500 + 480 * Math.sin(Math.PI / 6)}
                y1={500 - 480 * Math.cos(Math.PI / 6)}
                x2={500 - 480 * Math.sin(Math.PI / 6)}
                y2={500 + 480 * Math.cos(Math.PI / 6)}
              />
              {/* 60° and 120° */}
              <line
                x1={500 + 480 * Math.sin(Math.PI / 3)}
                y1={500 - 480 * Math.cos(Math.PI / 3)}
                x2={500 - 480 * Math.sin(Math.PI / 3)}
                y2={500 + 480 * Math.cos(Math.PI / 3)}
              />
              {/* -30° and -150° */}
              <line
                x1={500 + 480 * Math.sin(-Math.PI / 6)}
                y1={500 - 480 * Math.cos(-Math.PI / 6)}
                x2={500 - 480 * Math.sin(-Math.PI / 6)}
                y2={500 + 480 * Math.cos(-Math.PI / 6)}
              />
              {/* -60° and -120° */}
              <line
                x1={500 + 480 * Math.sin(-Math.PI / 3)}
                y1={500 - 480 * Math.cos(-Math.PI / 3)}
                x2={500 - 480 * Math.sin(-Math.PI / 3)}
                y2={500 + 480 * Math.cos(-Math.PI / 3)}
              />
            </g>
          )}

          {/* 3. ATMOSPHERIC & KATABATIC WIND OVERLAY */}
          {showWeatherOverlay && (
            <g opacity="0.75" pointerEvents="none">
              {/* Katabatic wind drainage flow vectors from East Antarctic Ice Sheet toward coasts */}
              <path
                d="M 520,440 Q 640,360 800,410"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="8 6"
                className="animate-[dash_15s_linear_infinite]"
              />
              <path
                d="M 480,420 Q 520,280 560,210"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="8 6"
              />
              <path
                d="M 460,540 Q 380,620 400,690"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeDasharray="6 6"
              />
              <path
                d="M 440,460 Q 320,420 230,370"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeDasharray="6 6"
              />

              {/* Polar Jet Circumpolar Stream */}
              <circle
                cx="500"
                cy="500"
                r="450"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="1.2"
                strokeDasharray="12 8"
                opacity="0.35"
              />
              <text x="500" y="58" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle" opacity="0.85">
                Circumpolar Polar Jet ~ 42 km/h ESE
              </text>
            </g>
          )}

          {/* 4. LOGISTICS SUPPLY LINES & INTER-STATION BASELINES */}
          {showRoutes && (
            <g>
              {/* Maitri ↔ Bharati Direct Inter-Station Baseline (~3,000 km Geodesic) */}
              <path
                d={`M ${maitriPos.x},${maitriPos.y} Q 670,260 ${bharatiPos.x},${bharatiPos.y}`}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.8"
                strokeDasharray="8 5"
                filter="url(#amberGlow)"
              />
              {/* Route distance label */}
              <g transform="translate(680, 275)">
                <rect x="-80" y="-12" width="160" height="24" rx="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.2" opacity="0.95" />
                <text x="0" y="4" fill="#fef08a" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  Airlift Baseline: ~3,000 km
                </text>
              </g>

              {/* NCAOR Cape Town Supply Line to Maitri */}
              <path
                d={`M 540,25 Q 550,110 ${maitriPos.x},${maitriPos.y}`}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.8"
              />
              <text x="520" y="40" fill="#38bdf8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                NCAOR Cape Town Supply Corridor ➔
              </text>

              {/* NCPOR Goa Logistics Line to Bharati (Prydz Bay) */}
              <path
                d={`M 880,50 Q 860,220 ${bharatiPos.x},${bharatiPos.y}`}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.8"
              />
              <text x="830" y="70" fill="#06b6d4" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                NCPOR Goa Logistics ➔
              </text>
            </g>
          )}

          {/* 5. INTERNATIONAL STATIONS (WHEN TOGGLED) */}
          {showInternational && (
            <g>
              {Object.values(STATIONS)
                .filter((st) => !st.isIndian && st.id !== 'south_pole')
                .map((st) => {
                  const pos = geoToSvg(st.lat, st.lon);
                  const isSelected = activeStationId === st.id;
                  return (
                    <g
                      key={st.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className="cursor-pointer transition-transform hover:scale-125"
                      onClick={() => handleStationClick(st.id)}
                    >
                      <circle r={isSelected ? 6 : 4} fill="#64748b" stroke="#cbd5e1" strokeWidth="1.5" />
                      <circle r="10" fill="none" stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
                      {showLabels && (
                        <text
                          x="9"
                          y="3"
                          fill="#cbd5e1"
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                          filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))"
                        >
                          {st.name.replace(' Station', '')}
                        </text>
                      )}
                    </g>
                  );
                })}
            </g>
          )}

          {/* 6. GEOGRAPHIC SOUTH POLE CENTRAL RETICLE */}
          <g
            transform={`translate(${southPolePos.x}, ${southPolePos.y})`}
            className="cursor-pointer"
            onClick={() => handleStationClick('south_pole')}
          >
            <circle r="22" fill="url(#radarPulseGrad)" />
            <circle r="8" fill="#1e1b4b" stroke="#a855f7" strokeWidth="2" />
            <circle r="2" fill="#ffffff" />
            {/* Crosshairs */}
            <line x1="-16" y1="0" x2="16" y2="0" stroke="#a855f7" strokeWidth="1.2" opacity="0.8" />
            <line x1="0" y1="-16" x2="0" y2="16" stroke="#a855f7" strokeWidth="1.2" opacity="0.8" />
            <text
              x="14"
              y="18"
              fill="#e9d5ff"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
              filter="drop-shadow(0 1px 3px rgba(0,0,0,0.9))"
            >
              SOUTH POLE (90°S)
            </text>
          </g>

          {/* 7. DAKSHIN GANGOTRI (HISTORICAL INDIAN BASE 1983) */}
          <g
            transform={`translate(${dakshinPos.x}, ${dakshinPos.y})`}
            className="cursor-pointer transition-transform hover:scale-110"
            onClick={() => handleStationClick('dakshin_gangotri')}
          >
            <circle r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
            <circle r="11" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
            <rect x="12" y="-9" width="138" height="18" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.9" />
            <text x="16" y="4" fill="#fbbf24" fontSize="9" fontWeight="bold" fontFamily="monospace">
              Dakshin Gangotri (1983)
            </text>
          </g>

          {/* 8. MAITRI STATION (ACTIVE INDIAN OUTPOST) */}
          <g
            transform={`translate(${maitriPos.x}, ${maitriPos.y})`}
            className="cursor-pointer transition-transform hover:scale-110"
            onClick={() => handleStationClick('maitri')}
          >
            {/* Outer radar ping */}
            <circle r="26" fill="url(#radarPulseGrad)" className="animate-ping" style={{ animationDuration: '3s' }} />
            <circle r="14" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />
            {/* Core Pin */}
            <circle r="7" fill="#0284c7" stroke="#ffffff" strokeWidth="2" filter="url(#cyanGlow)" />
            <circle r="2.5" fill="#ffffff" />
            {/* Label Card */}
            <g transform="translate(14, -14)">
              <rect
                x="0"
                y="0"
                width="145"
                height="32"
                rx="6"
                fill="#0b1329"
                stroke={activeStationId === 'maitri' ? '#38bdf8' : '#1e3a8a'}
                strokeWidth={activeStationId === 'maitri' ? '1.8' : '1'}
                opacity="0.95"
              />
              <text x="8" y="14" fill="#38bdf8" fontSize="10.5" fontWeight="bold" fontFamily="sans-serif">
                🇮🇳 MAITRI STATION
              </text>
              <text x="8" y="26" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                70°45'S • -28°C • 42 km/h
              </text>
            </g>
          </g>

          {/* 9. BHARATI STATION (PRIMARY STATE-OF-THE-ART FACILITY) */}
          <g
            transform={`translate(${bharatiPos.x}, ${bharatiPos.y})`}
            className="cursor-pointer transition-transform hover:scale-110"
            onClick={() => handleStationClick('bharati')}
          >
            {/* Outer radar ping */}
            <circle r="30" fill="url(#radarPulseGrad)" className="animate-ping" style={{ animationDuration: '2.5s' }} />
            <circle r="16" fill="none" stroke="#06b6d4" strokeWidth="1.8" opacity="0.9" />
            {/* Core Pin */}
            <circle r="8" fill="#0891b2" stroke="#ffffff" strokeWidth="2.2" filter="url(#cyanGlow)" />
            <circle r="3" fill="#ffffff" />
            {/* Label Card */}
            <g transform="translate(-165, -16)">
              <rect
                x="0"
                y="0"
                width="155"
                height="32"
                rx="6"
                fill="#081528"
                stroke={activeStationId === 'bharati' ? '#06b6d4' : '#0e7490'}
                strokeWidth={activeStationId === 'bharati' ? '2' : '1'}
                opacity="0.95"
              />
              <text x="8" y="14" fill="#22d3ee" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                🇮🇳 BHARATI STATION
              </text>
              <text x="8" y="26" fill="#a5f3fc" fontSize="9" fontFamily="monospace">
                69°24'S • -25°C • 36 km/h
              </text>
            </g>
          </g>

          {/* 10. CARTOGRAPHIC NEATLINE & DEGREE GRADUATION TICKS */}
          <g pointerEvents="none">
            {/* Primary Double Neatline Circle */}
            <circle cx="500" cy="500" r="480" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
            <circle cx="500" cy="500" r="485" fill="none" stroke="#64748b" strokeWidth="1" />

            {/* Degree Ticks around the 60°S circle (Every 30 degrees) */}
            {[
              { deg: 0, label: '0°' },
              { deg: 30, label: '30°E' },
              { deg: 60, label: '60°E' },
              { deg: 90, label: '90°E' },
              { deg: 120, label: '120°E' },
              { deg: 150, label: '150°E' },
              { deg: 180, label: '180°' },
              { deg: 210, label: '150°W' },
              { deg: 240, label: '120°W' },
              { deg: 270, label: '90°W' },
              { deg: 300, label: '60°W' },
              { deg: 330, label: '30°W' },
            ].map(({ deg, label }) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 500 + 480 * Math.sin(rad);
              const y1 = 500 - 480 * Math.cos(rad);
              const x2 = 500 + 494 * Math.sin(rad);
              const y2 = 500 - 494 * Math.cos(rad);
              const xText = 500 + 497 * Math.sin(rad);
              const yText = 500 - 497 * Math.cos(rad);

              return (
                <g key={deg}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth="1.5" />
                  <text
                    x={xText}
                    y={yText + 3}
                    fill="#f8fafc"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor={Math.abs(Math.sin(rad)) < 0.1 ? 'middle' : Math.sin(rad) > 0 ? 'start' : 'end'}
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.9))"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* ========================================================================= */}
        {/* CORNER CARTOGRAPHIC INSET OVERLAYS (MATCHING THE IBCSO REFERENCE IMAGE)   */}
        {/* ========================================================================= */}

        {/* Top-Left: Research Stations Coordinates Index Block */}
        <div className="absolute top-4 left-4 max-w-[240px] bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md hidden sm:block pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5 mb-2">
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              Indian Antarctic Outposts
            </span>
          </div>
          <div className="space-y-2 text-[10px]">
            <div
              onClick={() => handleStationClick('bharati')}
              className={`p-1.5 rounded-lg cursor-pointer transition ${
                activeStationId === 'bharati' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="font-bold flex items-center justify-between text-cyan-300">
                <span>1. Bharati Station (2012)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Online
                </span>
              </div>
              <div className="text-[9.5px] font-mono text-slate-400">69°24'28"S, 76°11'14"E • Prydz Bay</div>
            </div>

            <div
              onClick={() => handleStationClick('maitri')}
              className={`p-1.5 rounded-lg cursor-pointer transition ${
                activeStationId === 'maitri' ? 'bg-sky-500/20 border border-sky-400/40 text-white' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="font-bold flex items-center justify-between text-sky-300">
                <span>2. Maitri Station (1989)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Online
                </span>
              </div>
              <div className="text-[9.5px] font-mono text-slate-400">70°45'57"S, 11°44'09"E • Queen Maud</div>
            </div>

            <div
              onClick={() => handleStationClick('dakshin_gangotri')}
              className={`p-1.5 rounded-lg cursor-pointer transition ${
                activeStationId === 'dakshin_gangotri' ? 'bg-amber-500/20 border border-amber-400/40 text-white' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="font-bold flex items-center justify-between text-amber-300">
                <span>3. Dakshin Gangotri (1983)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Historic
                </span>
              </div>
              <div className="text-[9.5px] font-mono text-slate-400">70°05'S, 12°00'E • Ice Shelf</div>
            </div>
          </div>
        </div>

        {/* Bottom-Right: Cartographic Title & Bathymetric Tint Scale Block */}
        <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md max-w-[290px] hidden sm:block pointer-events-auto">
          <div className="text-[11px] font-bold text-slate-200 tracking-wide">
            INTERNATIONAL BATHYMETRIC CHART OF THE SOUTHERN OCEAN (IBCSO)
          </div>
          <div className="text-[9px] font-mono text-slate-400 mt-0.5 space-y-0.5">
            <div>Projection: Polar Stereographic</div>
            <div>Standard Parallel: 71°S • Reference Ellipsoid: WGS 84</div>
            <div>Scale: 1 : 7,000,000 at 71°S</div>
          </div>

          {/* Scale bar indicator */}
          <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[9px] font-mono text-slate-300">
            <span>0 km</span>
            <div className="h-1.5 w-24 bg-gradient-to-r from-slate-200 via-slate-500 to-slate-200 border border-slate-500" />
            <span>500 km</span>
            <div className="h-1.5 w-24 bg-gradient-to-r from-slate-500 via-slate-200 to-slate-500 border border-slate-500" />
            <span>1,000 km</span>
          </div>

          {/* Bathymetric & Topographic Tint Depth Scale Bar */}
          <div className="mt-2 pt-2 border-t border-slate-700/60">
            <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 mb-1">
              <span>-7000 m (Abyss)</span>
              <span>-1000 m (Shelf)</span>
              <span>0 m</span>
              <span>+3500 m</span>
            </div>
            {/* Tint gradient: deep ocean abyss -> continental shelf -> ice sheet */}
            <div
              className="h-2.5 w-full rounded-sm border border-slate-600"
              style={{
                background:
                  'linear-gradient(to right, #051937, #004d7a, #008793, #00bf72, #a8eb12, #cbd5e1, #ffffff)',
              }}
            />
            <div className="text-[8px] text-center font-mono text-slate-400 mt-0.5">
              Bathymetric & Topographic Relief Tint
            </div>
          </div>
        </div>

        {/* Bottom-Left: Data Coverage Inset Indicator */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 shadow-xl backdrop-blur-md hidden md:flex items-center gap-2.5 pointer-events-auto">
          <div className="w-11 h-11 rounded-full border border-cyan-400/50 bg-[#07132b] flex items-center justify-center overflow-hidden">
            <Waves className="w-6 h-6 text-cyan-400 animate-pulse" />
          </div>
          <div className="text-[10px]">
            <span className="font-bold text-slate-200 block">NCPOR Polar Geospatial Data</span>
            <span className="text-[9px] font-mono text-cyan-300">Active High-Resolution Multibeam Tracklines</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE STATION TELEMETRY CARD (AT BOTTOM OF MAP)                     */}
      {/* ========================================================================= */}
      <div className="p-4 bg-slate-900 border-t border-sky-900/40 z-20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Station Details */}
          <div className="flex items-start gap-3.5">
            <div
              className="p-2.5 rounded-xl border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${activeStation.color}20`,
                borderColor: `${activeStation.color}50`,
                color: activeStation.color,
              }}
            >
              <Radio className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-white tracking-wide">
                  {activeStation.flag} {activeStation.name}
                </span>
                <span
                  className="text-[11px] font-mono px-2 py-0.5 rounded-full border font-semibold"
                  style={{
                    backgroundColor: `${activeStation.color}20`,
                    borderColor: `${activeStation.color}40`,
                    color: activeStation.color,
                  }}
                >
                  {activeStation.status}
                </span>
                <span className="text-xs text-slate-400">• {activeStation.type}</span>
              </div>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">{activeStation.description}</p>
            </div>
          </div>

          {/* Real-time Telemetry Stats & Action Button */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            <div className="flex items-center gap-3 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/80 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Thermometer className="w-4 h-4 text-cyan-400" />
                <span className="font-mono font-bold text-white">{activeStation.temp}</span>
              </div>
              <div className="h-4 w-[1px] bg-slate-700" />
              <div className="flex items-center gap-1.5 text-slate-300">
                <Wind className="w-4 h-4 text-sky-400" />
                <span className="font-mono font-bold text-white">{activeStation.wind}</span>
              </div>
              <div className="h-4 w-[1px] bg-slate-700" />
              <div className="flex items-center gap-1.5 text-slate-300">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="font-mono font-bold text-white">{activeStation.crew} Crew</span>
              </div>
            </div>

            {/* Switch to 3D Twin Action */}
            {activeStation.isIndian && (activeStation.id === 'bharati' || activeStation.id === 'maitri') && (
              <button
                type="button"
                onClick={() => {
                  if (onSelectStation) {
                    onSelectStation(activeStation.id as 'maitri' | 'bharati');
                  }
                  // Switch to station view
                  navigate(`/?station=${activeStation.id}`);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 font-bold text-xs hover:from-cyan-400 hover:to-sky-400 transition shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <span>OPEN 3D DIGITAL TWIN</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
