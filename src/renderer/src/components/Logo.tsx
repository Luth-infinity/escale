/** Le logo d'Escale (build/icon.svg) : une route et ses escales, sur le vert d'eau. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-escale-fond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1fb3a9" />
          <stop offset="1" stopColor="#007a74" />
        </linearGradient>
      </defs>
      <rect x="20" y="20" width="984" height="984" rx="225" fill="url(#logo-escale-fond)" />
      <rect x="487" y="340" width="50" height="344" fill="#fff" opacity=".45" />
      <circle cx="512" cy="282" r="64" fill="none" stroke="#fff" strokeWidth="40" />
      <circle cx="512" cy="512" r="104" fill="#fff" />
      <circle cx="512" cy="742" r="64" fill="none" stroke="#fff" strokeWidth="40" />
    </svg>
  );
}
