import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { StationData } from '../types';
import StatusBadge from './StatusBadge';

interface StationCardProps {
  station: StationData;
}

export default function StationCard({ station }: StationCardProps) {
  const navigate = useNavigate();

  return (
    <div
      id={`station-card-${station.id}`}
      className="group relative bg-white rounded-2xl border border-sky-100/90 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-300 overflow-hidden flex flex-col"
    >
      {/* Image container */}
      <div className="relative h-56 w-full overflow-hidden bg-sky-100">
        <img
          src={station.image}
          alt={station.name}
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (station.id === 'bharati') {
              (e.currentTarget as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Bharati_permanent_Antarctic_research_station.jpg';
            }
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        {/* Subtle ice gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-slate-800 backdrop-blur-sm shadow-sm">
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            <span>{station.region}</span>
          </span>
          <StatusBadge status={station.status} />
        </div>

        {/* Name overlay on bottom of image */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">
            {station.name}
          </h3>
          <p className="text-xs text-sky-100/90 font-medium">
            {station.coordinates}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
          {station.description}
        </p>

        {/* Action Button */}
        <div className="pt-2">
          <button
            id={`btn-view-${station.id}`}
            type="button"
            onClick={() => navigate(`/stations/${station.id}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-600 text-white font-medium text-sm hover:bg-sky-700 active:bg-sky-800 transition-colors duration-200 shadow-sm hover:shadow"
          >
            <span>View Station</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
