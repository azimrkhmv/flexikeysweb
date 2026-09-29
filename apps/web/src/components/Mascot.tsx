import type { MascotMood } from "@/lib/types";

// The cloud hero: no name, doesn't talk down, doesn't teach — just supports (design board).
// Pure SVG + CSS so it works on the server and respects prefers-reduced-motion.

const PUFFS: [number, number, number][] = [
  [58, 100, 40], [100, 72, 50], [146, 96, 40], [100, 110, 44], [72, 120, 30], [130, 120, 32],
];

export function Mascot({
  mood = "calm",
  size = 160,
  hat,
  tint,
  float = true,
  className = "",
  label,
}: {
  mood?: MascotMood;
  size?: number;
  hat?: string;
  tint?: string;
  float?: boolean;
  className?: string;
  label?: string;
}) {
  const ink = "#2b3f66";
  const closed = mood === "sleepy";
  const arcs = mood === "happy" || mood === "celebrate" || mood === "wave";
  return (
    <div className={`relative inline-block ${float ? "fk-float" : ""} ${className}`} style={{ width: size, height: size * 0.82 }}>
      <svg viewBox="0 0 200 164" width={size} height={size * 0.82} role="img" aria-label={label ?? "FlexiKeys cloud"}>
        <defs>
          <linearGradient id={`fk-cloud-${mood}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={tint ?? "#dbe8f8"} />
          </linearGradient>
        </defs>
        {mood === "celebrate" && (
          <g fontSize="18" className="fk-pop">
            <text x="8" y="40">✨</text>
            <text x="170" y="34">⭐</text>
            <text x="178" y="120">✨</text>
            <text x="0" y="130">⭐</text>
          </g>
        )}
        <g transform={mood === "curious" ? "rotate(-6 100 100)" : undefined}>
          {PUFFS.map(([cx, cy, r], i) => (
            <circle key={`o${i}`} cx={cx} cy={cy} r={r + 3} fill="#c9d9ef" />
          ))}
          {PUFFS.map(([cx, cy, r], i) => (
            <circle key={`f${i}`} cx={cx} cy={cy} r={r} fill={`url(#fk-cloud-${mood})`} />
          ))}
          {/* cheeks */}
          <ellipse cx="66" cy="112" rx="11" ry="7" fill="#f6b9c6" opacity="0.75" />
          <ellipse cx="134" cy="112" rx="11" ry="7" fill="#f6b9c6" opacity="0.75" />
          {/* eyes */}
          {closed ? (
            <g stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none">
              <path d="M76 98 q8 7 16 0" />
              <path d="M108 98 q8 7 16 0" />
            </g>
          ) : arcs ? (
            <g stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none">
              <path d="M76 100 q8 -10 16 0" />
              <path d="M108 100 q8 -10 16 0" />
            </g>
          ) : (
            <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "fk-blink 5s infinite" }}>
              <ellipse cx="84" cy={mood === "thinking" ? 93 : 97} rx={mood === "curious" ? 8 : 7} ry={mood === "curious" ? 10 : 9} fill={ink} />
              <ellipse cx="116" cy={mood === "thinking" ? 93 : 97} rx={mood === "curious" ? 8 : 7} ry={mood === "curious" ? 10 : 9} fill={ink} />
              <circle cx={mood === "thinking" ? 87 : 86} cy={mood === "thinking" ? 89 : 93} r="2.6" fill="#fff" />
              <circle cx={mood === "thinking" ? 119 : 118} cy={mood === "thinking" ? 89 : 93} r="2.6" fill="#fff" />
            </g>
          )}
          {/* mouth */}
          {mood === "curious" ? (
            <ellipse cx="100" cy="118" rx="5" ry="6" fill={ink} />
          ) : mood === "sleepy" ? (
            <path d="M94 117 q6 4 12 0" stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          ) : mood === "thinking" ? (
            <path d="M94 119 q8 -3 14 1" stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          ) : arcs ? (
            <path d="M88 112 q12 16 24 0 z" fill={ink} />
          ) : (
            <path d="M90 113 q10 10 20 0" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
          )}
        </g>
        {mood === "wave" && (
          <g className="origin-center" style={{ transformBox: "fill-box", transformOrigin: "20% 80%", animation: "fk-float 1.2s ease-in-out infinite" }}>
            <circle cx="182" cy="70" r="14" fill="#c9d9ef" />
            <circle cx="182" cy="70" r="11.5" fill="#fff" />
          </g>
        )}
        {mood === "sleepy" && (
          <g fill="#8ea3c7" fontWeight="800">
            <text x="150" y="40" fontSize="18">z</text>
            <text x="164" y="24" fontSize="14">z</text>
          </g>
        )}
        {mood === "thinking" && <text x="150" y="36" fontSize="22">💭</text>}
        {hat && (
          <text x="100" y="42" fontSize="40" textAnchor="middle">
            {hat}
          </text>
        )}
      </svg>
    </div>
  );
}
