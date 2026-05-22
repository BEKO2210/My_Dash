// Animated radar mark — the same sweep as the README logo (assets/logo.svg):
// a sector rotating 360° every 4s plus two blips that flash as it passes.
// Pure SMIL SVG, so it animates without any JS.
export function RadarLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mc-radar-sweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8cff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#4f8cff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* rings + crosshair */}
      <g fill="none" stroke="#4f8cff">
        <circle cx="48" cy="48" r="46" strokeOpacity="0.2" />
        <circle cx="48" cy="48" r="31" strokeOpacity="0.3" />
        <circle cx="48" cy="48" r="16" strokeOpacity="0.42" />
        <line x1="48" y1="2" x2="48" y2="94" strokeOpacity="0.12" />
        <line x1="2" y1="48" x2="94" y2="48" strokeOpacity="0.12" />
      </g>

      {/* rotating sweep */}
      <g>
        <path d="M48 48 L48 2 A46 46 0 0 1 80.5 15.5 Z" fill="url(#mc-radar-sweep)" />
        <line x1="48" y1="48" x2="48" y2="2" stroke="#9bbcff" strokeWidth="2" strokeOpacity="0.9" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 48 48"
          to="360 48 48"
          dur="4s"
          repeatCount="indefinite"
        />
      </g>

      {/* blips */}
      <circle cx="68" cy="26" r="3" fill="#9bbcff">
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          dur="4s"
          keyTimes="0;0.15;0.4;0.55"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="34" cy="66" r="2.5" fill="#9bbcff">
        <animate
          attributeName="opacity"
          values="0;0;1;1;0"
          dur="4s"
          keyTimes="0;0.5;0.65;0.85;1"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
