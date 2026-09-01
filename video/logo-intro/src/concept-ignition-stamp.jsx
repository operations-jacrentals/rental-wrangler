import React from 'react';
import {
  registerRoot,
  Composition,
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

// ---------------------------------------------------------------------------
// "Ignition Stamp" — Rental Wrangler / JacRentals logo intro concept.
// Yard data-plate design language: dark industrial steel, ONE safety-orange
// accent, hazard-stripe signature, riveted steel shield badge, stamped
// condensed uppercase type. Beat: plate fades up -> hazard bar wipes in ->
// shield badge drops + settles with a metallic glint sweep -> wordmark
// stamps in letter-by-letter -> orange underline snaps out -> EST. 2099.
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

const clampOpts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

const WORD_1 = 'RENTAL';
const WORD_2 = 'WRANGLER';

function Rivet({ style }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${RIVET_HI}, ${RIVET_LO} 70%)`,
        boxShadow: '0 1px 1px rgba(0,0,0,0.6)',
        ...style,
      }}
    />
  );
}

function HazardBar({ frame }) {
  // Wipes in from the left across the lower third — a reveal mask, the
  // fixed-size pattern behind it never stretches.
  const progress = interpolate(frame, [6, 30], [0, 1], clampOpts);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: `${progress * 100}%`,
        height: 132,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 1920,
          height: 132,
          backgroundImage:
            'repeating-linear-gradient(135deg, #f5c542 0 13px, #14181d 13px 26px)',
          opacity: 0.9,
        }}
      />
    </div>
  );
}

function ShieldBadge({ frame, fps }) {
  const dropSpring = spring({
    frame,
    fps,
    delay: 8,
    config: { damping: 14, stiffness: 120, mass: 1 },
    from: -480,
    to: 0,
  });
  const opacity = interpolate(frame, [8, 22], [0, 1], clampOpts);

  // Diagonal white metallic glint sweeping across the settled badge.
  const glintX = interpolate(frame, [24, 48], [-70, 170], clampOpts);

  const w = 372;
  const h = 412;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 96,
        width: w,
        height: h,
        marginLeft: -w / 2,
        transform: `translateY(${dropSpring}px)`,
        opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath:
            'polygon(50% 0%, 88% 14%, 88% 56%, 50% 100%, 12% 56%, 12% 14%)',
          background: `linear-gradient(155deg, ${STEEL_PANEL_HI} 0%, ${STEEL_PANEL} 55%, #14181d 100%)`,
          boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
          overflow: 'hidden',
        }}
      >
        {/* subtle radial sheen on the plate face */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 34%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)',
          }}
        />
        {/* metallic glint sweep, clipped to the shield silhouette */}
        <div
          style={{
            position: 'absolute',
            top: '-40%',
            left: `${glintX}%`,
            width: '26%',
            height: '180%',
            background:
              'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 100%)',
            transform: 'rotate(18deg)',
            filter: 'blur(2px)',
          }}
        />
        {/* monogram placeholder */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '38%',
            textAlign: 'center',
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 96,
            letterSpacing: 2,
            color: GOLD,
            textShadow: '0 2px 0 #6b4d16, 0 5px 12px rgba(0,0,0,0.55)',
            transform: 'translateY(-50%)',
          }}
        >
          RW
        </div>
      </div>
      <Rivet style={{ top: 78, left: 66 }} />
      <Rivet style={{ top: 78, right: 66 }} />
      <Rivet style={{ top: 190, left: 30 }} />
      <Rivet style={{ top: 190, right: 30 }} />
    </div>
  );
}

function StampLetter({ ch, i, frame, fps }) {
  const delay = 36 + i * 2;
  const s = spring({
    frame,
    fps,
    delay,
    config: { damping: 12, stiffness: 220, mass: 0.7 },
    from: 1.18,
    to: 1,
  });
  const opacity = interpolate(frame, [delay, delay + 5], [0, 1], clampOpts);
  const impact = interpolate(s, [1, 1.18], [0, 1], clampOpts);
  const shadowOffset = interpolate(impact, [0, 1], [1, 7]);
  const shadowBlur = interpolate(impact, [0, 1], [2, 16]);

  if (ch === ' ') {
    return <span style={{ display: 'inline-block', width: 22 }} />;
  }

  return (
    <span
      style={{
        display: 'inline-block',
        transform: `scale(${s})`,
        opacity,
        textShadow: `0 ${shadowOffset}px ${shadowBlur}px rgba(0,0,0,0.65)`,
      }}
    >
      {ch}
    </span>
  );
}

function Wordmark({ frame, fps }) {
  const letters = `${WORD_1} ${WORD_2}`.split('');
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 104,
        letterSpacing: 1,
        color: GOLD,
        textTransform: 'uppercase',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {letters.map((ch, i) => (
        <StampLetter key={i} ch={ch} i={i} frame={frame} fps={fps} />
      ))}
    </div>
  );
}

function Underline({ frame, fps }) {
  const s = spring({
    frame,
    fps,
    delay: 68,
    config: { damping: 10, stiffness: 280, mass: 0.6 },
    from: 0,
    to: 1,
  });
  return (
    <div
      style={{
        width: 560,
        height: 7,
        marginTop: 20,
        background: ORANGE,
        boxShadow: `0 0 16px 1px ${ORANGE}`,
        borderRadius: 3,
        transform: `scaleX(${s})`,
        transformOrigin: 'center',
      }}
    />
  );
}

function Main() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 16], [0, 1], clampOpts);
  const estOpacity = interpolate(frame, [78, 90], [0, 1], clampOpts);

  return (
    <AbsoluteFill style={{ background: STEEL_BASE, overflow: 'hidden' }}>
      {/* dark steel plate + vignette */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity,
          background:
            'radial-gradient(ellipse at 50% 42%, #232a33 0%, #171c22 48%, #0b0e12 100%)',
        }}
      />

      {/* faint constellation dots, on-brand background texture */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity * 0.5,
          backgroundImage:
            'radial-gradient(1.5px 1.5px at 14% 20%, rgba(255,255,255,0.35) 0, transparent 60%),' +
            'radial-gradient(1.5px 1.5px at 84% 18%, rgba(255,255,255,0.28) 0, transparent 60%),' +
            'radial-gradient(1.5px 1.5px at 70% 76%, rgba(255,255,255,0.22) 0, transparent 60%),' +
            'radial-gradient(1.5px 1.5px at 22% 80%, rgba(255,255,255,0.28) 0, transparent 60%),' +
            'radial-gradient(1.5px 1.5px at 92% 58%, rgba(255,255,255,0.2) 0, transparent 60%)',
        }}
      />

      {/* corner rivets framing the whole plate */}
      <Rivet style={{ top: 24, left: 24, opacity: bgOpacity }} />
      <Rivet style={{ top: 24, right: 24, opacity: bgOpacity }} />
      <Rivet style={{ bottom: 24, left: 24, opacity: bgOpacity }} />
      <Rivet style={{ bottom: 24, right: 24, opacity: bgOpacity }} />

      <HazardBar frame={frame} />

      <ShieldBadge frame={frame} fps={fps} />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 176,
          flexDirection: 'column',
        }}
      >
        <Wordmark frame={frame} fps={fps} />
        <Underline frame={frame} fps={fps} />
        <div
          style={{
            marginTop: 16,
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: 7,
            color: TAN,
            textTransform: 'uppercase',
            opacity: estOpacity,
          }}
        >
          EST. 2099
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

registerRoot(() => (
  <Composition
    id="ignition-stamp"
    component={Main}
    durationInFrames={92}
    fps={30}
    width={1920}
    height={1080}
  />
));
