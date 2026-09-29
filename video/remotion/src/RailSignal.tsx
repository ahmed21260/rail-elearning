import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Lamp = "red" | "yellow" | "green" | "off";

export type RailSignalProps = {
  module: string;
  name: string;
  tag: string;
  rule: string;
  /** Feux du haut vers le bas. */
  lamps: [Lamp, Lamp];
};

const LAMP_COLORS: Record<Lamp, string> = {
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  off: "#1e293b",
};

const fadeUp = (frame: number, start: number, distance = 40) => ({
  opacity: interpolate(frame, [start, start + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
  transform: `translateY(${interpolate(frame, [start, start + 18], [distance, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  })}px)`,
});

export const RailSignal: React.FC<RailSignalProps> = ({ module, name, tag, rule, lamps }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();

  const signalIn = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  const trainX = interpolate(frame, [0, durationInFrames], [-560, width + 40]);

  return (
    <AbsoluteFill style={{ background: "#0b1220", color: "#f1f5f9", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {/* Signal */}
      <div
        style={{
          position: "absolute",
          left: 260,
          top: 150,
          width: 260,
          height: 820,
          opacity: signalIn,
          transform: `translateY(${(1 - signalIn) * 80}px)`,
        }}
      >
        <div style={{ position: "absolute", left: 115, top: 420, width: 30, height: 400, background: "#475569", borderRadius: 4 }} />
        <div
          style={{
            position: "absolute",
            width: 260,
            height: 440,
            background: "#020617",
            border: "6px solid #334155",
            borderRadius: 130,
          }}
        >
          {lamps.map((lamp, i) => {
            const on = lamp !== "off";
            const lit = interpolate(frame, [24 + i * 8, 32 + i * 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const pulse = on ? 0.8 + 0.2 * Math.cos((frame / fps) * Math.PI * 2) : 1;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 55,
                  top: i === 0 ? 40 : 245,
                  width: 138,
                  height: 138,
                  borderRadius: "50%",
                  background: on ? LAMP_COLORS[lamp] : LAMP_COLORS.off,
                  opacity: on ? lit * pulse : 1,
                  boxShadow: on ? `0 0 60px 18px ${LAMP_COLORS[lamp]}88` : "none",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Texte */}
      <div style={{ position: "absolute", left: 700, top: 250, width: 1060 }}>
        <div style={{ ...fadeUp(frame, 10), fontSize: 30, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#38bdf8" }}>
          {module}
        </div>
        <div style={{ ...fadeUp(frame, 16), marginTop: 20, fontSize: 28, fontWeight: 700, color: "#fca5a5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {tag}
        </div>
        <div style={{ ...fadeUp(frame, 22, 60), marginTop: 20, fontSize: 112, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {name}
        </div>
        <div style={{ ...fadeUp(frame, 36), marginTop: 36, fontSize: 46, lineHeight: 1.25, color: "#cbd5e1" }}>{rule}</div>
      </div>

      {/* Voie + train */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 260 }}>
        {Array.from({ length: 32 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: i * 60, top: 140, width: 22, height: 90, borderRadius: 3, background: "#1e293b" }} />
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, height: 10, background: "#64748b" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 210, height: 10, background: "#64748b" }} />
      </div>
      <svg viewBox="0 0 520 120" width={520} height={120} style={{ position: "absolute", bottom: 104, left: 0, transform: `translateX(${trainX}px)` }}>
        <rect x="0" y="10" width="440" height="90" rx="18" fill="#e2e8f0" />
        <path d="M440 10 H470 Q520 10 520 60 V100 H440 Z" fill="#cbd5e1" />
        {[20, 120, 220, 320].map((x) => (
          <rect key={x} x={x} y="30" width="80" height="36" rx="6" fill="#0f172a" />
        ))}
        <rect x="455" y="28" width="45" height="30" rx="6" fill="#0f172a" />
        <rect x="0" y="76" width="520" height="8" fill="#38bdf8" />
        {[70, 160, 360, 450].map((cx) => (
          <circle key={cx} cx={cx} cy="108" r="12" fill="#334155" />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
