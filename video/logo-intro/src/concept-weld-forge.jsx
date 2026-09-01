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
// "Weld / Forge" — Rental Wrangler / JacRentals logo intro concept.
// A weld spark travels the perimeter of the steel shield badge, leaving a
// glowing molten-orange edge behind it. When the loop closes the seam cools
// to brushed steel, rivets pop into the frame corners with a tiny shake, the
// wordmark heats from dark to gold, and a hazard-stripe underline slides in.
// Yard data-plate design language: dark industrial steel, ONE safety-orange
// accent (used as the weld itself), hazard-stripe signature, riveted plate,
// stamped condensed uppercase type, restrained leather-tan touch.
// ---------------------------------------------------------------------------

const STEEL_BASE = '#14181d';
const STEEL_PANEL = '#1b2027';
const STEEL_PANEL_HI = '#20262d';
const ORANGE = '#ff7a1a';
const GOLD = '#f5c542';
const TAN = '#c2925a';
const RIVET_HI = '#3a4048';
const RIVET_LO = '#0e1215';
const STEEL_EDGE_COOL = '#b7c1cb'; // brushed-steel highlight the weld seam cools to
const WORD_COLD = '#2b3138'; // dark unheated steel the wordmark starts as

const FONT = '"Saira Condensed","Oswald","Arial Narrow",sans-serif';

const clamp01 = (t) => Math.max(0, Math.min(1, t));

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function lerpColor(a, b, t) {
  const tt = clamp01(t);
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * tt);
  const g = Math.round(ca.g + (cb.g - ca.g) * tt);
  const bl = Math.round(ca.b + (cb.b - ca.b) * tt);
  return `rgb(${r},${g},${bl})`;
}

// ---------------------------------------------------------------------------
// Shield outline geometry — same silhouette as the badge fill, expressed as
// line/cubic segments so we can sample it into a dense polyline. The weld
// spark travels this polyline at (approximately) constant speed, and the
// same polyline is drawn back with stroke-dasharray for the "traced" glow —
// so the dash length always matches the sampled arc length exactly.
// ---------------------------------------------------------------------------
const A = {
  p0: { x: 280, y: 34 },
  p1: { x: 456, y: 106 },
  c1a: { x: 472, y: 112 },
  c1b: { x: 482, y: 128 },
  p2: { x: 482, y: 146 },
  p3: { x: 482, y: 298 },
  c2a: { x: 482, y: 380 },
  c2b: { x: 426, y: 444 },
  p4: { x: 280, y: 518 },
  c3a: { x: 134, y: 444 },
  c3b: { x: 78, y: 380 },
  p5: { x: 78, y: 298 },
  p6: { x: 78, y: 146 },
  c4a: { x: 78, y: 128 },
  c4b: { x: 88, y: 112 },
  p7: { x: 104, y: 106 },
};

const SHIELD_SEGMENTS = [
  { type: 'L', from: A.p0, to: A.p1 },
  { type: 'C', from: A.p1, c1: A.c1a, c2: A.c1b, to: A.p2 },
  { type: 'L', from: A.p2, to: A.p3 },
  { type: 'C', from: A.p3, c1: A.c2a, c2: A.c2b, to: A.p4 },
  { type: 'C', from: A.p4, c1: A.c3a, c2: A.c3b, to: A.p5 },
  { type: 'L', from: A.p5, to: A.p6 },
  { type: 'C', from: A.p6, c1: A.c4a, c2: A.c4b, to: A.p7 },
  { type: 'L', from: A.p7, to: A.p0 },
];

function cubicPt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function buildPolyline(segments, samplesPerSeg) {
  const pts = [];
  segments.forEach((seg) => {
    for (let i = 0; i < samplesPerSeg; i++) {
      const t = i / samplesPerSeg;
      if (seg.type === 'L') {
        pts.push({ x: seg.from.x + (seg.to.x - seg.from.x) * t, y: seg.from.y + (seg.to.y - seg.from.y) * t });
      } else {
        pts.push(cubicPt(seg.from, seg.c1, seg.c2, seg.to, t));
      }
    }
  });
  pts.push({ ...segments[0].from });
  return pts;
}

const SHIELD_POLY = buildPolyline(SHIELD_SEGMENTS, 26);
const SHIELD_CUM = [0];
for (let i = 1; i < SHIELD_POLY.length; i++) {
  const prev = SHIELD_POLY[i - 1];
  const cur = SHIELD_POLY[i];
  SHIELD_CUM.push(SHIELD_CUM[i - 1] + Math.hypot(cur.x - prev.x, cur.y - prev.y));
}
const SHIELD_TOTAL_LEN = SHIELD_CUM[SHIELD_CUM.length - 1];
const SHIELD_D = SHIELD_POLY.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z';

function pointAtProgress(p) {
  const target = clamp01(p) * SHIELD_TOTAL_LEN;
  for (let i = 1; i < SHIELD_CUM.length; i++) {
    if (SHIELD_CUM[i] >= target) {
      const segLen = SHIELD_CUM[i] - SHIELD_CUM[i - 1];
      const segT = segLen === 0 ? 0 : (target - SHIELD_CUM[i - 1]) / segLen;
      const a = SHIELD_POLY[i - 1];
      const b = SHIELD_POLY[i];
      return { x: a.x + (b.x - a.x) * segT, y: a.y + (b.y - a.y) * segT };
    }
  }
  return SHIELD_POLY[SHIELD_POLY.length - 1];
}

// ---------------------------------------------------------------------------
// Timeline (frames @ 30fps, 92 total ~= 3.07s)
// ---------------------------------------------------------------------------
const FADE_IN_END = 10;
const TRACE_START = 10;
const TRACE_END = 56; // weld spark closes the loop here
const SPARK_FADE_START = TRACE_START;
const SPARK_FADE_IN_END = TRACE_START + 3;
const SPARK_FADE_OUT_START = TRACE_END - 2;
const SPARK_FADE_OUT_END = TRACE_END + 6;
const PANEL_FADE_START = 40;
const PANEL_FADE_END = 70;
const COOL_START = TRACE_END;
const COOL_END = COOL_START + 15;
const RIVET_BASE = 60;
const RIVET_STAGGER = 4;
const WORD_HEAT_START = 66;
const WORD_HEAT_END = WORD_HEAT_START + 20;
const EST_START = 84;
const EST_END = 92;
const UNDERLINE_START = 78;
const UNDERLINE_END = 92;
const UNDERLINE_W = 176;

const RIVET_POSITIONS = [
  { top: 40, left: 40 },
  { top: 40, right: 40 },
  { bottom: 40, left: 40 },
  { bottom: 40, right: 40 },
];

function Rivet({ frame, delay }) {
  const local = frame - delay;
  if (local < -1) return null;
  const s = spring({ frame, fps: 30, delay, config: { damping: 11, stiffness: 190, mass: 0.55 } });
  const scale = interpolate(s, [0, 1], [0, 1]);
  const shakeEnv = interpolate(local, [0, 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shakeX = Math.sin(local * 2.4) * 2.4 * shakeEnv;
  const shakeY = Math.cos(local * 3.1) * 1.6 * shakeEnv;
  return (
    <div
      style={{
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${RIVET_HI}, ${RIVET_LO} 70%)`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.7), 0 0 6px rgba(255,122,26,0.15)',
        transform: `translate(${shakeX}px, ${shakeY}px) scale(${scale})`,
      }}
    />
  );
}

function HazardEdge() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 8,
        backgroundImage: 'repeating-linear-gradient(135deg, #f5c542 0 13px, #14181d 13px 26px)',
        opacity: 0.85,
      }}
    />
  );
}

function ShieldBadge({ frame, fps }) {
  const w = 560;
  const h = 560;

  const traceProgress = interpolate(frame, [TRACE_START, TRACE_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sparkOpacity = interpolate(
    frame,
    [SPARK_FADE_START, SPARK_FADE_IN_END, SPARK_FADE_OUT_START, SPARK_FADE_OUT_END],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const sparkPos = pointAtProgress(traceProgress);

  const panelOpacity = interpolate(frame, [PANEL_FADE_START, PANEL_FADE_END], [0.05, 0.92], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const coolT = interpolate(frame, [COOL_START, COOL_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const edgeColor = lerpColor(ORANGE, STEEL_EDGE_COOL, coolT);
  const edgeWidth = interpolate(coolT, [0, 1], [6, 3]);
  const hotGlow = interpolate(frame, [COOL_START, COOL_END], [0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sheenGlow = interpolate(coolT, [0, 1], [0, 0.4]);

  // Before the loop closes, keep the traced portion hot orange with a strong
  // glow (the "leaving a glowing molten-orange edge behind it" beat).
  const preCloseGlow = traceProgress > 0 && traceProgress < 1 ? 0.9 : hotGlow;
  const strokeColor = traceProgress < 1 ? ORANGE : edgeColor;
  const strokeGlowOrange = traceProgress < 1 ? 0.9 : hotGlow;
  const strokeWidth = traceProgress < 1 ? 6 : edgeWidth;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: w,
        height: h,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <svg width={w} height={h} viewBox="0 0 560 560" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="wfShieldFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={STEEL_PANEL_HI} />
            <stop offset="55%" stopColor={STEEL_PANEL} />
            <stop offset="100%" stopColor="#171b21" />
          </linearGradient>
          <radialGradient id="wfBadgeGlow" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* interior plate fill — a faint ghost while welding, solid once cooled */}
        <path d={SHIELD_D} fill="url(#wfShieldFace)" opacity={panelOpacity} />
        <path d={SHIELD_D} fill="url(#wfBadgeGlow)" opacity={panelOpacity} />

        {/* the traced / cooled seam itself */}
        <path
          d={SHIELD_D}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={SHIELD_TOTAL_LEN}
          strokeDashoffset={SHIELD_TOTAL_LEN * (1 - traceProgress)}
          style={{
            filter:
              `drop-shadow(0 0 ${10 * strokeGlowOrange}px rgba(255,122,26,${strokeGlowOrange}))` +
              ` drop-shadow(0 0 ${6 * sheenGlow}px rgba(255,255,255,${sheenGlow}))`,
          }}
        />

        {/* the traveling weld spark */}
        {sparkOpacity > 0.001 && (
          <g opacity={sparkOpacity}>
            <circle cx={sparkPos.x} cy={sparkPos.y} r={17} fill="rgba(255,140,40,0.28)" />
            <circle cx={sparkPos.x} cy={sparkPos.y} r={9} fill="rgba(255,190,110,0.7)" />
            <circle cx={sparkPos.x} cy={sparkPos.y} r={4.2} fill="#fff7e6" />
          </g>
        )}
      </svg>
    </div>
  );
}

function Main() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, FADE_IN_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const wordHeatT = interpolate(frame, [WORD_HEAT_START, WORD_HEAT_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const wordColor = lerpColor(WORD_COLD, GOLD, wordHeatT);
  const wordGlow = interpolate(
    frame,
    [WORD_HEAT_START, WORD_HEAT_START + 10, WORD_HEAT_END],
    [0, 0.75, 0.12],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const wordOpacity = interpolate(frame, [WORD_HEAT_START - 4, WORD_HEAT_START + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const estOpacity = interpolate(frame, [EST_START, EST_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const underlineW = interpolate(frame, [UNDERLINE_START, UNDERLINE_END], [0, UNDERLINE_W], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ background: STEEL_BASE, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          opacity: bgOpacity,
          background: 'radial-gradient(ellipse at 50% 42%, #202730 0%, #171c22 45%, #0d1013 100%)',
        }}
      />
      {/* a few white constellation dots — restrained, industrial-night accent */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity * 0.4,
          backgroundImage:
            'radial-gradient(1px 1px at 14% 20%, rgba(255,255,255,0.3) 0, transparent 60%),' +
            'radial-gradient(1px 1px at 84% 18%, rgba(255,255,255,0.25) 0, transparent 60%),' +
            'radial-gradient(1px 1px at 88% 66%, rgba(255,255,255,0.22) 0, transparent 60%),' +
            'radial-gradient(1px 1px at 9% 72%, rgba(255,255,255,0.24) 0, transparent 60%)',
        }}
      />

      <ShieldBadge frame={frame} fps={fps} />

      {RIVET_POSITIONS.map((p, i) => (
        <div key={i} style={{ position: 'absolute', ...p }}>
          <Rivet frame={frame} delay={RIVET_BASE + i * RIVET_STAGGER} />
        </div>
      ))}

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ opacity: wordOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 58,
              letterSpacing: 4,
              color: wordColor,
              textTransform: 'uppercase',
              textShadow: `0 2px 0 rgba(0,0,0,0.45), 0 0 ${18 * wordGlow}px rgba(255,122,26,${wordGlow})`,
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
              color: wordColor,
              textTransform: 'uppercase',
              textShadow: `0 2px 0 rgba(0,0,0,0.45), 0 0 ${18 * wordGlow}px rgba(255,122,26,${wordGlow})`,
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
              height: 6,
              backgroundImage: 'repeating-linear-gradient(135deg, #f5c542 0 8px, #14181d 8px 16px)',
              borderRadius: 2,
              boxShadow: underlineW > 4 ? '0 0 8px 0 rgba(245,197,66,0.35)' : 'none',
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

      <HazardEdge />
    </AbsoluteFill>
  );
}

registerRoot(() => (
  <Composition id="weld-forge" component={Main} durationInFrames={92} fps={30} width={1920} height={1080} />
));
