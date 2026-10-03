import React from 'react';
import {
  registerRoot,
  Composition,
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';

// ---------------------------------------------------------------------------
// "Constellation Draw" — Rental Wrangler / JacRentals logo intro concept.
// Yard data-plate design language: dark industrial steel, ONE safety-orange
// accent, hazard-stripe signature, riveted steel shield badge, stamped
// condensed uppercase type, restrained leather-tan touch. A cosmic western
// sky nod (constellation) that resolves into the industrial badge.
// ---------------------------------------------------------------------------

const STEEL_BASE = '#14181d';
const STEEL_PANEL = '#1b2027';
const STEEL_PANEL_HI = '#20262d';
const ORANGE = '#ff7a1a';
const GOLD = '#f5c542';
const TAN = '#c2925a';
const RIVET_HI = '#3a4048';
const RIVET_LO = '#0e1215';

const FONT = '"Saira Condensed","Oswald","Arial Narrow",sans-serif';

// 12 constellation points, arranged in a loose "dipper / shield-ish" scatter
// around the center in a normalized -1..1 box, converted to px later. Kept
// inside safe margins even at the widest spread.
const POINTS = [
  { x: -0.62, y: -0.58 },
  { x: -0.30, y: -0.82 },
  { x: 0.10, y: -0.86 },
  { x: 0.46, y: -0.62 },
  { x: 0.68, y: -0.28 },
  { x: 0.58, y: 0.14 },
  { x: 0.30, y: 0.48 },
  { x: -0.06, y: 0.62 },
  { x: -0.42, y: 0.46 },
  { x: -0.66, y: 0.10 },
  { x: -0.20, y: -0.16 },
  { x: 0.14, y: -0.10 },
];

// Edges connecting the scatter into a single constellation figure (indices
// into POINTS). Kept as a simple wandering path plus a couple of chords so
// the "draw" reads as a real constellation, not a random mess.
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7],
  [7, 8], [8, 9], [9, 0], [10, 11], [1, 10], [6, 11],
];

const RIVET_POSITIONS = [
  { top: 14, left: 14 },
  { top: 14, right: 14 },
  { bottom: 14, left: 14 },
  { bottom: 14, right: 14 },
];

function Rivet({ style }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${RIVET_HI}, ${RIVET_LO} 70%)`,
        boxShadow: '0 1px 1px rgba(0,0,0,0.6)',
        ...style,
      }}
    />
  );
}

function HazardEdge({ side }) {
  // Thin hazard-stripe accent strip, used once along the bottom of the frame
  // as the signature — restrained, not everywhere.
  const isTop = side === 'top';
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        [isTop ? 'top' : 'bottom']: 0,
        height: 8,
        backgroundImage:
          'repeating-linear-gradient(135deg, #f5c542 0 13px, #14181d 13px 26px)',
        opacity: 0.85,
      }}
    />
  );
}

function ShieldBadge({ scale, opacity }) {
  // Rounded-hex / shield steel plate, riveted corners. Placeholder hero —
  // real badge art comes from Jac later.
  const w = 560;
  const h = 560;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: w,
        height: h,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
      }}
    >
      <svg width={w} height={h} viewBox="0 0 560 560">
        <defs>
          <linearGradient id="shieldFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={STEEL_PANEL_HI} />
            <stop offset="55%" stopColor={STEEL_PANEL} />
            <stop offset="100%" stopColor="#171b21" />
          </linearGradient>
          <linearGradient id="shieldEdge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a424c" />
            <stop offset="100%" stopColor="#0b0e12" />
          </linearGradient>
          <radialGradient id="badgeGlow" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        {/* shield / rounded-hex silhouette */}
        <path
          d="M280 18
             L470 96
             C490 104 502 122 502 144
             L502 300
             C502 392 440 462 280 542
             C120 462 58 392 58 300
             L58 144
             C58 122 70 104 90 96
             Z"
          fill="url(#shieldEdge)"
        />
        <path
          d="M280 34
             L456 106
             C472 112 482 128 482 146
             L482 298
             C482 380 426 444 280 518
             C134 444 78 380 78 298
             L78 146
             C78 128 88 112 104 106
             Z"
          fill="url(#shieldFace)"
          stroke={ORANGE}
          strokeOpacity="0.35"
          strokeWidth="2"
        />
        <path
          d="M280 34
             L456 106
             C472 112 482 128 482 146
             L482 298
             C482 380 426 444 280 518
             C134 444 78 380 78 298
             L78 146
             C78 128 88 112 104 106
             Z"
          fill="url(#badgeGlow)"
        />
      </svg>
    </div>
  );
}

function Constellation({ frame, fps, w, h }) {
  const cx = w / 2;
  const cy = h / 2 - 40;
  const spread = 300;

  // Phase timing (frames):
  // 0-40: dots twinkle in, staggered
  // 18-56: lines draw between them
  // 46-72: whole constellation converges + fades toward badge
  const dotIn = (i) =>
    spring({ frame, fps, config: { damping: 16, stiffness: 140, mass: 0.6 }, delay: i * 3 });

  const convergeStart = 46;
  const convergeEnd = 74;
  const converge = interpolate(frame, [convergeStart, convergeEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const groupOpacity = interpolate(frame, [convergeStart, convergeEnd], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const easedConverge = Easing.bezier(0.35, 0, 0.2, 1)(converge);

  const pos = (i) => {
    const p = POINTS[i];
    const px = cx + p.x * spread * (1 - easedConverge);
    const py = cy + p.y * spread * (1 - easedConverge);
    return { px, py };
  };

  return (
    <svg
      width={w}
      height={h}
      style={{ position: 'absolute', left: 0, top: 0, opacity: groupOpacity }}
    >
      <g>
        {EDGES.map(([a, b], i) => {
          const lineStart = 16 + i * 2.6;
          const lineDraw = interpolate(frame, [lineStart, lineStart + 16], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const pa = pos(a);
          const pb = pos(b);
          const len = Math.hypot(pb.px - pa.px, pb.py - pa.py);
          return (
            <line
              key={i}
              x1={pa.px}
              y1={pa.py}
              x2={pb.px}
              y2={pb.py}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={1.4}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - lineDraw)}
            />
          );
        })}
        {POINTS.map((_, i) => {
          const s = dotIn(i);
          const { px, py } = pos(i);
          const r = interpolate(s, [0, 1], [0, 3.4]);
          const glow = interpolate(s, [0, 1], [0, 1]);
          const isHero = i === 10 || i === 11; // two "brighter" stars near center
          return (
            <g key={i}>
              {isHero && (
                <circle
                  cx={px}
                  cy={py}
                  r={r * 3.2}
                  fill={GOLD}
                  opacity={glow * 0.12}
                />
              )}
              <circle
                cx={px}
                cy={py}
                r={isHero ? r * 1.25 : r}
                fill="#ffffff"
                opacity={glow}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function PulseRing({ frame, fps }) {
  const start = 62;
  const dur = 26;
  const local = frame - start;
  if (local < 0) return null;
  const t = interpolate(local, [0, dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = Easing.out(Easing.cubic)(t);
  const size = interpolate(eased, [0, 1], [120, 620]);
  const opacity = interpolate(t, [0, 0.15, 1], [0, 0.7, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: '50%',
        border: `2px solid ${ORANGE}`,
        boxShadow: `0 0 24px 0 ${ORANGE}`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
}

function Main() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Background: deep space-steel radial gradient, present throughout.
  const bgOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Badge resolve: scale + fade in as constellation converges.
  const badgeStart = 50;
  const badgeSpring = spring({
    frame,
    fps,
    delay: badgeStart,
    config: { damping: 15, stiffness: 130, mass: 0.9 },
  });
  const badgeScale = interpolate(badgeSpring, [0, 1], [0.7, 1]);
  const badgeOpacity = interpolate(frame, [badgeStart, badgeStart + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Wordmark fades up inside the badge.
  const wordStart = 66;
  const wordOpacity = interpolate(frame, [wordStart, wordStart + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordY = interpolate(frame, [wordStart, wordStart + 14], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // EST. 2099 settles last.
  const estStart = 78;
  const estOpacity = interpolate(frame, [estStart, estStart + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Underline sweep beneath wordmark — the ONE orange accent usage as a
  // deliberate underline (in addition to the pulse ring, which is the other
  // sanctioned orange moment; kept restrained/sequential, not simultaneous
  // busy-ness).
  const underlineStart = 70;
  const underlineW = interpolate(frame, [underlineStart, underlineStart + 14], [0, 132], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        background: STEEL_BASE,
        overflow: 'hidden',
      }}
    >
      {/* deep space-steel radial gradient */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity,
          background:
            'radial-gradient(ellipse at 50% 40%, #232a33 0%, #171c22 45%, #0e1215 100%)',
        }}
      />
      {/* faint static starfield speckle, very subtle, industrial-night not fantasy */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity * 0.5,
          backgroundImage:
            'radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.35) 0, transparent 60%),' +
            'radial-gradient(1px 1px at 82% 15%, rgba(255,255,255,0.28) 0, transparent 60%),' +
            'radial-gradient(1px 1px at 68% 78%, rgba(255,255,255,0.25) 0, transparent 60%),' +
            'radial-gradient(1px 1px at 24% 82%, rgba(255,255,255,0.3) 0, transparent 60%),' +
            'radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,0.22) 0, transparent 60%),' +
            'radial-gradient(1px 1px at 6% 55%, rgba(255,255,255,0.2) 0, transparent 60%)',
        }}
      />

      {/* corner rivets on the frame itself, subtle plate framing */}
      {RIVET_POSITIONS.map((p, i) => (
        <Rivet key={i} style={{ ...p, opacity: bgOpacity }} />
      ))}

      <Constellation frame={frame} fps={fps} w={width} h={height} />

      <PulseRing frame={frame} fps={fps} />

      <ShieldBadge scale={badgeScale} opacity={badgeOpacity} />

      {/* wordmark + est, layered above the badge center */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            transform: `translateY(${wordY}px)`,
            opacity: wordOpacity,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 58,
              letterSpacing: 4,
              color: GOLD,
              textTransform: 'uppercase',
              textShadow: '0 2px 0 #6b4d16, 0 4px 10px rgba(0,0,0,0.55)',
              lineHeight: 1.02,
              textAlign: 'center',
            }}
          >
            RENTAL
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 58,
              letterSpacing: 4,
              color: GOLD,
              textTransform: 'uppercase',
              textShadow: '0 2px 0 #6b4d16, 0 4px 10px rgba(0,0,0,0.55)',
              lineHeight: 1.02,
              textAlign: 'center',
              marginTop: 2,
            }}
          >
            WRANGLER
          </div>
          <div
            style={{
              marginTop: 12,
              width: underlineW,
              height: 3,
              background: ORANGE,
              boxShadow: `0 0 10px 1px ${ORANGE}`,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              marginTop: 14,
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: 20,
              letterSpacing: 6,
              color: TAN,
              textTransform: 'uppercase',
              opacity: estOpacity,
            }}
          >
            EST. 2099
          </div>
        </div>
      </AbsoluteFill>

      <HazardEdge side="bottom" />
    </AbsoluteFill>
  );
}

registerRoot(() => (
  <Composition
    id="constellation-draw"
    component={Main}
    durationInFrames={92}
    fps={30}
    width={1920}
    height={1080}
  />
));
