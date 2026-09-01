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
// "Data-Plate Boot" — Rental Wrangler / JacRentals logo intro concept.
// A machine HUD booting up. Beat: cyan-white scanline sweeps top->bottom over
// dark steel -> riveted steel panel slides in from the right + locks with a
// soft bounce -> a circular KPI-ring sweep draws 0->360 around the badge ->
// wordmark "RENTAL WRANGLER" reveals under a small "SYSTEM ONLINE" stamp ->
// one safety-orange status blip pulses in a corner -> "EST. 2099" clicks in.
// ---------------------------------------------------------------------------

const STEEL_BASE = '#14181d';
const STEEL_PANEL = '#1b2027';
const STEEL_PANEL_HI = '#20262d';
const ORANGE = '#ff7a1a';
const GOLD = '#f5c542';
const TAN = '#c2925a';
const RIVET_HI = '#3a4048';
const RIVET_LO = '#0e1215';
const SCAN_CYAN = '#bff2ff';

const FONT = '"Saira Condensed","Oswald","Arial Narrow",sans-serif';

const clampOpts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

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

// Thin cyan-white HUD scanline sweeping top -> bottom over frames 0-20, then
// fading out — the "booting up" beat.
function Scanline({ frame }) {
  const y = interpolate(frame, [0, 20], [-40, 1120], {
    ...clampOpts,
    easing: Easing.inOut(Easing.ease),
  });
  const opacity = interpolate(frame, [0, 4, 16, 24], [0, 0.9, 0.9, 0], clampOpts);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        height: 6,
        opacity,
        background: `linear-gradient(180deg, rgba(191,242,255,0) 0%, ${SCAN_CYAN} 50%, rgba(191,242,255,0) 100%)`,
        boxShadow: `0 0 24px 6px rgba(191,242,255,0.55)`,
      }}
    />
  );
}

// Riveted steel panel that slides in from the right and locks with a subtle
// spring bounce (frames ~10-34), forming the backdrop for the badge + wordmark.
function Panel({ frame, fps }) {
  const x = spring({
    frame,
    fps,
    delay: 10,
    config: { damping: 13, stiffness: 110, mass: 1 },
    from: 1400,
    to: 0,
  });
  const opacity = interpolate(frame, [10, 24], [0, 1], clampOpts);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 1160,
        height: 760,
        marginLeft: -580,
        marginTop: -380,
        transform: `translateX(${x}px)`,
        opacity,
        borderRadius: 18,
        background: `linear-gradient(155deg, ${STEEL_PANEL_HI} 0%, ${STEEL_PANEL} 55%, #14181d 100%)`,
        boxShadow: '0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <Rivet style={{ top: 26, left: 26 }} />
      <Rivet style={{ top: 26, right: 26 }} />
      <Rivet style={{ bottom: 26, left: 26 }} />
      <Rivet style={{ bottom: 26, right: 26 }} />
    </div>
  );
}

// Circular KPI-ring sweep drawing an arc from 0 -> 360 degrees around the
// badge, frames ~24-56, via a conic-gradient masked to a ring.
function KpiRing({ frame }) {
  const opacity = interpolate(frame, [22, 30], [0, 1], clampOpts);
  const sweep = interpolate(frame, [24, 58], [0, 360], {
    ...clampOpts,
    easing: Easing.out(Easing.cubic),
  });
  const size = 420;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 316,
        width: size,
        height: size,
        marginLeft: -size / 2,
        opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `conic-gradient(from -90deg, ${GOLD} 0deg, ${GOLD} ${sweep}deg, rgba(255,255,255,0.06) ${sweep}deg, rgba(255,255,255,0.06) 360deg)`,
          WebkitMaskImage:
            'radial-gradient(circle, transparent 0, transparent 191px, black 192px, black 200px, transparent 201px)',
          maskImage:
            'radial-gradient(circle, transparent 0, transparent 191px, black 192px, black 200px, transparent 201px)',
        }}
      />
    </div>
  );
}

// Riveted steel shield / rounded-hex plate placeholder badge, sitting inside
// the KPI ring. Real badge art comes from Jac later.
function ShieldBadge({ frame }) {
  const scale = spring({
    frame,
    fps: 30,
    delay: 18,
    config: { damping: 14, stiffness: 150, mass: 0.8 },
    from: 0.4,
    to: 1,
  });
  const opacity = interpolate(frame, [18, 30], [0, 1], clampOpts);
  const w = 300;
  const h = 300;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 316,
        width: 420,
        height: 420,
        marginLeft: -210,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: w,
          height: h,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath:
              'polygon(50% 0%, 88% 14%, 88% 56%, 50% 100%, 12% 56%, 12% 14%)',
            background: `linear-gradient(155deg, ${STEEL_PANEL_HI} 0%, ${STEEL_PANEL} 55%, #14181d 100%)`,
            boxShadow: '0 14px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 50% 34%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 60%)',
            }}
          />
          {/* faint constellation dots on the plate face — on-brand texture */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.6,
              backgroundImage:
                'radial-gradient(1.4px 1.4px at 22% 22%, rgba(255,255,255,0.5) 0, transparent 60%),' +
                'radial-gradient(1.4px 1.4px at 76% 26%, rgba(255,255,255,0.4) 0, transparent 60%),' +
                'radial-gradient(1.4px 1.4px at 66% 74%, rgba(255,255,255,0.35) 0, transparent 60%),' +
                'radial-gradient(1.4px 1.4px at 28% 76%, rgba(255,255,255,0.4) 0, transparent 60%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '40%',
              textAlign: 'center',
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 72,
              letterSpacing: 2,
              color: GOLD,
              textShadow: '0 2px 0 #6b4d16, 0 5px 10px rgba(0,0,0,0.55)',
              transform: 'translateY(-50%)',
            }}
          >
            RW
          </div>
        </div>
        <Rivet style={{ top: 58, left: 46 }} />
        <Rivet style={{ top: 58, right: 46 }} />
        <Rivet style={{ top: 146, left: 16 }} />
        <Rivet style={{ top: 146, right: 16 }} />
      </div>
    </div>
  );
}

function SystemOnlineStamp({ frame, fps }) {
  const s = spring({
    frame,
    fps,
    delay: 58,
    config: { damping: 11, stiffness: 260, mass: 0.6 },
    from: 1.3,
    to: 1,
  });
  const opacity = interpolate(frame, [58, 65], [0, 1], clampOpts);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 14px',
        borderRadius: 3,
        border: `1px solid rgba(255,122,26,0.5)`,
        background: 'rgba(255,122,26,0.08)',
        opacity,
        transform: `scale(${s})`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: ORANGE,
          boxShadow: `0 0 8px 2px ${ORANGE}`,
        }}
      />
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 19,
          letterSpacing: 5,
          color: ORANGE,
          textTransform: 'uppercase',
        }}
      >
        System Online
      </span>
    </div>
  );
}

function Wordmark({ frame, fps }) {
  const s = spring({
    frame,
    fps,
    delay: 64,
    config: { damping: 15, stiffness: 160, mass: 0.8 },
    from: 0.9,
    to: 1,
  });
  const opacity = interpolate(frame, [64, 74], [0, 1], clampOpts);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 800,
        letterSpacing: 1,
        color: GOLD,
        textTransform: 'uppercase',
        lineHeight: 1.02,
        textAlign: 'center',
        opacity,
        transform: `scale(${s})`,
      }}
    >
      <div style={{ fontSize: 68 }}>RENTAL</div>
      <div style={{ fontSize: 68 }}>WRANGLER</div>
    </div>
  );
}

// One safety-orange status blip pulsing in a corner — the single accent use.
function StatusBlip({ frame }) {
  const opacity = interpolate(frame, [72, 80], [0, 1], clampOpts);
  const pulse = interpolate(frame % 20, [0, 10, 20], [0.55, 1, 0.55]);
  return (
    <div
      style={{
        position: 'absolute',
        top: 138,
        right: 138,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: ORANGE,
        opacity: opacity * pulse,
        boxShadow: `0 0 18px 5px rgba(255,122,26,${0.6 * opacity})`,
      }}
    />
  );
}

function EstPlate({ frame, fps }) {
  const s = spring({
    frame,
    fps,
    delay: 80,
    config: { damping: 10, stiffness: 300, mass: 0.6 },
    from: 0,
    to: 1,
  });
  return (
    <div
      style={{
        marginTop: 14,
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: 20,
        letterSpacing: 7,
        color: TAN,
        textTransform: 'uppercase',
        transform: `scaleX(${s})`,
        transformOrigin: 'center',
      }}
    >
      EST. 2099
    </div>
  );
}

function Main() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 10], [0, 1], clampOpts);

  return (
    <AbsoluteFill style={{ background: STEEL_BASE, overflow: 'hidden' }}>
      {/* dark steel base + vignette */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity,
          background:
            'radial-gradient(ellipse at 50% 42%, #232a33 0%, #171c22 48%, #0b0e12 100%)',
        }}
      />

      {/* faint HUD grid texture, on-brand background */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity * 0.35,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <Scanline frame={frame} />

      <Panel frame={frame} fps={fps} />

      <KpiRing frame={frame} />
      <ShieldBadge frame={frame} />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 118,
          flexDirection: 'column',
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <SystemOnlineStamp frame={frame} fps={fps} />
        </div>
        <Wordmark frame={frame} fps={fps} />
        <EstPlate frame={frame} fps={fps} />
      </AbsoluteFill>

      <StatusBlip frame={frame} />

      {/* corner rivets framing the whole frame */}
      <Rivet style={{ top: 24, left: 24, opacity: bgOpacity }} />
      <Rivet style={{ top: 24, right: 24, opacity: bgOpacity }} />
      <Rivet style={{ bottom: 24, left: 24, opacity: bgOpacity }} />
      <Rivet style={{ bottom: 24, right: 24, opacity: bgOpacity }} />
    </AbsoluteFill>
  );
}

registerRoot(() => (
  <Composition
    id="data-plate-boot"
    component={Main}
    durationInFrames={92}
    fps={30}
    width={1920}
    height={1080}
  />
));
