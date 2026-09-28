import { useState, useEffect } from 'react';
import { Compass, Sparkles, Activity } from 'lucide-react';
import { STATIONS, QUICK_ACCESS_ITEMS, HERO_BANNER_IMAGE } from '../data/mockData';
import { QuickAccessItem, StationData } from '../types';
import { api } from '../api/client';
import StationCard from './StationCard';
import QuickAccessCard from './QuickAccessCard';
import QuickAccessModal from './QuickAccessModal';

export default function HomePage() {
  const [selectedQuickAccess, setSelectedQuickAccess] = useState<QuickAccessItem | null>(null);
  const [stations, setStations] = useState<Record<'maitri' | 'bharati', StationData>>(STATIONS);

  useEffect(() => {
    let isMounted = true;
    api.getStations().then((list) => {
      if (isMounted && list && list.length > 0) {
        const stationMap: Record<string, StationData> = {};
        list.forEach((s) => {
          stationMap[s.id] = s;
        });
        if (stationMap.maitri && stationMap.bharati) {
          setStations(stationMap as Record<'maitri' | 'bharati', StationData>);
        }
      }
    });
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="space-y-12 pb-16">
      {/* 1. HERO SECTION */}
      <section
        id="hero-section"
        className="relative rounded-3xl overflow-hidden shadow-sm border border-sky-100/80 bg-slate-900 min-h-[340px] flex items-center"
      >
        {/* Antarctic Background Image with Subtle Polar Overlay */}
        <img
          src={HERO_BANNER_IMAGE}
          alt="Antarctic Landscape"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center brightness-90 saturate-75"
        />

        {/* Crisp Icy Gradient Overlay for High Contrast Legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/65 to-sky-950/40" />

        {/* Hero Content */}
        <div className="relative z-10 p-8 sm:p-12 max-w-2xl text-white space-y-4">
          {/* Subtle Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 backdrop-blur-md border border-sky-400/30 text-sky-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-sky-300" />
            <span>National Centre for Polar and Ocean Research</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Monitor India’s Antarctic Research Stations
          </h1>

          <p className="text-base sm:text-lg text-sky-100/90 font-normal leading-relaxed">
            Select a station to view its infrastructure, energy, environmental and operational data.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-sky-200/80">
            <span className="flex items-center gap-1.5 bg-slate-800/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-sky-400/20">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              2 Permanent Stations Active
            </span>
            <span className="flex items-center gap-1.5 bg-slate-800/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-sky-400/20">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              East Antarctica Territory
            </span>
          </div>
        </div>
      </section>

      {/* 2. STATION SELECTION SECTION */}
      <section id="station-selection-section" className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Select a Station
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Choose a research station to continue.
          </p>
        </div>

        {/* Two Large Station Cards Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          <StationCard station={stations.maitri} />
          <StationCard station={stations.bharati} />
        </div>
      </section>

      {/* 3. QUICK ACCESS SECTION */}
      <section id="quick-access-section" className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Quick Access
          </h2>
          <p className="text-sm text-slate-500">
            Instant insights across common polar telemetry channels.
          </p>
        </div>

        {/* Four Simple Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {QUICK_ACCESS_ITEMS.map((item) => (
            <QuickAccessCard
              key={item.id}
              item={item}
              onClick={(clickedItem) => setSelectedQuickAccess(clickedItem)}
            />
          ))}
        </div>
      </section>

      {/* 4. FOOTER */}
      <footer
        id="app-home-footer"
        className="pt-10 mt-12 border-t border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500"
      >
        <p className="text-center sm:text-left">
          AntarcticTwin — Digital monitoring platform for Indian Antarctic research stations.
        </p>
        <div className="flex items-center gap-4 text-slate-400">
          <span>Telemetry Protocol v4.2</span>
          <span>•</span>
          <span>ISEA 45th Expedition</span>
        </div>
      </footer>

      {/* Quick Access Details Modal */}
      <QuickAccessModal
        item={selectedQuickAccess}
        onClose={() => setSelectedQuickAccess(null)}
      />
    </div>
  );
}
