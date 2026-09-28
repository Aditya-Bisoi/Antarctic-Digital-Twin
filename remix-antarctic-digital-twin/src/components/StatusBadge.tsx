interface StatusBadgeProps {
  status: 'Online' | 'Offline' | 'Maintenance' | 'Nominal' | 'Warning' | 'Critical' | 'Optimal' | 'Active';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export default function StatusBadge({
  status,
  size = 'md',
  pulse = true,
}: StatusBadgeProps) {
  const isOnlineOrNominal = ['Online', 'Nominal', 'Optimal', 'Active'].includes(status);
  const isWarning = ['Warning', 'Maintenance'].includes(status);

  const dotColor = isOnlineOrNominal
    ? 'bg-emerald-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-rose-500';

  const badgeBg = isOnlineOrNominal
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
    : isWarning
    ? 'bg-amber-50 text-amber-700 border-amber-200/70'
    : 'bg-rose-50 text-rose-700 border-rose-200/70';

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      id={`status-badge-${status.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${badgeBg} ${sizeClasses}`}
    >
      <span className="relative flex h-2 w-2">
        {pulse && isOnlineOrNominal && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      <span>{status}</span>
    </span>
  );
}
