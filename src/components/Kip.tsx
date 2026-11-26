export function Kip({ size = 80, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-label="Kip, o axolote">
      {([[-1, 18], [-1, 34], [1, 18], [1, 34]] as const).map(([s, y], i) => (
        <path key={i} transform={`translate(${s === -1 ? 18 : 82} ${y}) rotate(${s * 20})`}
          d="M0-7 2-2 7-2 3 1 5 7 0 3-5 7-3 1-7-2-2-2Z" fill="var(--gold)" />
      ))}
      <ellipse cx="50" cy="55" rx="34" ry="30" fill="var(--kip)" />
      <ellipse cx="50" cy="66" rx="20" ry="12" fill="var(--kip-belly)" />
      <circle cx="38" cy="50" r="5" fill="var(--navy)" /><circle cx="62" cy="50" r="5" fill="var(--navy)" />
      <circle cx="39.5" cy="48.5" r="1.6" fill="white" /><circle cx="63.5" cy="48.5" r="1.6" fill="white" />
      <path d="M43 60q7 6 14 0" stroke="var(--navy)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="60" r="4" fill="var(--blush)" /><circle cx="70" cy="60" r="4" fill="var(--blush)" />
    </svg>
  );
}
export function Fog({ level }: { level: number }) {
  if (!level) return null;
  const op = [0, 0.4, 0.7, 0.92][level];
  return <div className="fog pointer-events-none absolute inset-0 rounded-full" style={{ opacity: op }} />;
}
