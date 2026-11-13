/** A half-circle gauge: the arc fills to `percent` (capped at 100), coloured by how full it is. */
export function Gauge({
  percent,
  label,
  tone,
  children,
}: {
  percent: number | null;
  label: string;
  /** Override the colour; otherwise green, amber from 90%, red over 100%. */
  tone?: string;
  children?: React.ReactNode;
}) {
  const value = percent === null ? 0 : Math.max(0, Math.min(percent, 100));
  const colour = tone ?? (percent === null ? "#cbd5e1" : percent > 100 ? "#e11d48" : percent >= 90 ? "#f59e0b" : "#10b981");
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 100 58" className="w-full max-w-[200px]" role="img" aria-label={`${label}: ${percent === null ? "not set" : `${percent}%`}`}>
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#eef2f6" strokeWidth="10" strokeLinecap="round" pathLength={100} />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={colour}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${value} 100`}
          style={{ transition: "stroke-dasharray 700ms ease-out, stroke 300ms" }}
          opacity={value === 0 ? 0 : 1}
        />
        <text x="50" y="46" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 17, fontWeight: 600 }}>
          {percent === null ? "—" : `${percent}%`}
        </text>
      </svg>
      <figcaption className="-mt-1 text-center">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {children && <span className="mt-0.5 block text-xs text-slate-500">{children}</span>}
      </figcaption>
    </figure>
  );
}
