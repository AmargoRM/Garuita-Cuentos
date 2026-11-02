// Tío Conejo comerciante — baby-friendly loop. Conejo hops door to door;
// friends pop up cuckoo-style, wave, and say hi. Built on animations-v2.jsx
// (SceneStage) + tweaks-panel.jsx.

const STAGE_W = 1920, STAGE_H = 1080;
const GROUND_Y = 760;
const HOUSE_W = 300, HOUSE_BODY_H = 380, ROOF_H = 120;
const DOOR_W = 210, DOOR_H = 340;
const CHAR_W = 210, CHAR_H = 300;
const INK = '#3A2415';

const HOUSES = [
  { key: 'conejo', name: 'CONEJO', wall: '#FFF3DD', roof: '#F2A65A', x: 210 },
  { key: 'cucaracha', name: 'CUCARACHA', wall: '#FFD166', roof: '#E4772E', x: 585 },
  { key: 'gallina', name: 'GALLINA', wall: '#FFC2CE', roof: '#E4572E', x: 960 },
  { key: 'zorra', name: 'ZORRA', wall: '#BDEBE4', roof: '#2E9E8F', x: 1335 },
  { key: 'coyote', name: 'COYOTE', wall: '#DCEBB0', roof: '#6FA83A', x: 1710 },
];

function parseScenes(raw) {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

function getPalette(tod) {
  if (tod === 'Atardecer') return { sky1: '#FFB37B', sky2: '#FFDCA8', ground: '#9BBF5B', groundDark: '#84A94C', sun: '#FFC163' };
  return { sky1: '#7FCBF2', sky2: '#CDEFFF', ground: '#8BC34A', groundDark: '#74AC3A', sun: '#FFD93D' };
}

// ── Audio (tiny synth, no assets) ───────────────────────────────────────────
const AudioFX = {
  ctx: null,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },
  tone(freq, dur, type, delay, gain, glideTo) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  },
  knock() {
    this.tone(150, 0.09, 'square', 0, 0.22);
    this.tone(150, 0.09, 'square', 0.16, 0.22);
  },
  sound(type) {
    switch (type) {
      case 'conejo': this.tone(520, 0.13, 'sine', 0, 0.2, 780); this.tone(780, 0.14, 'sine', 0.12, 0.16); break;
      case 'cucaracha': this.tone(1250, 0.05, 'square', 0, 0.10); this.tone(1450, 0.05, 'square', 0.09, 0.10); break;
      case 'gallina': this.tone(540, 0.10, 'triangle', 0, 0.18); this.tone(720, 0.12, 'triangle', 0.11, 0.18); break;
      case 'zorra': this.tone(660, 0.18, 'sine', 0, 0.18, 960); break;
      case 'coyote': this.tone(320, 0.55, 'sine', 0, 0.16, 210); break;
    }
  },
};

// ── Shared face bits ─────────────────────────────────────────────────────────
function Eyes({ size }) {
  size = size || 34;
  const pupil = size * 0.45;
  return (
    <React.Fragment>
      <div style={{ position: 'absolute', left: 40, top: 55, width: size, height: size, background: '#fff', borderRadius: '50%', border: `4px solid ${INK}` }}>
        <div style={{ position: 'absolute', left: '58%', top: '58%', width: pupil, height: pupil, background: '#241509', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
      </div>
      <div style={{ position: 'absolute', right: 40, top: 55, width: size, height: size, background: '#fff', borderRadius: '50%', border: `4px solid ${INK}` }}>
        <div style={{ position: 'absolute', left: '58%', top: '58%', width: pupil, height: pupil, background: '#241509', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
      </div>
    </React.Fragment>
  );
}
function Cheeks({ color }) {
  return (
    <React.Fragment>
      <div style={{ position: 'absolute', left: 16, top: 100, width: 28, height: 18, background: color, borderRadius: '50%', opacity: 0.6 }} />
      <div style={{ position: 'absolute', right: 16, top: 100, width: 28, height: 18, background: color, borderRadius: '50%', opacity: 0.6 }} />
    </React.Fragment>
  );
}
function Smile() {
  return <div style={{ position: 'absolute', left: '50%', top: 106, width: 48, height: 26, borderBottom: `7px solid ${INK}`, borderRadius: '0 0 40px 40px', transform: 'translateX(-50%)' }} />;
}
function Arm({ side, rot, color }) {
  const isRight = side === 'right';
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 110,
      transform: `translateX(calc(-50% ${isRight ? '+' : '-'} 96px)) rotate(${rot}deg)`,
      transformOrigin: 'top center', width: 36, height: 80, background: color, borderRadius: 20, border: `7px solid ${INK}`,
    }} />
  );
}

// ── Friend busts (peek through the doorway) ────────────────────────────────
function CucarachaBust({ waveT }) {
  const armRot = -18 + waveT * 48;
  const c = '#EE8A3F';
  return (
    <div style={{ position: 'relative', width: CHAR_W, height: CHAR_H }}>
      <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 200, height: 150, background: '#E4772E', borderRadius: '60% 60% 30px 30px', border: `8px solid ${INK}` }} />
      <Arm side="right" rot={armRot} color="#E4772E" />
      <Arm side="left" rot={16} color="#E4772E" />
      <div style={{ position: 'absolute', left: '50%', bottom: 130, transform: 'translateX(-50%)', width: 170, height: 170, background: c, borderRadius: '50%', border: `8px solid ${INK}` }}>
        <div style={{ position: 'absolute', left: 34, top: -52, width: 10, height: 66, background: INK, borderRadius: 6, transform: 'rotate(-24deg)', transformOrigin: 'bottom center' }} />
        <div style={{ position: 'absolute', left: 20, top: -68, width: 22, height: 22, background: INK, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', right: 34, top: -52, width: 10, height: 66, background: INK, borderRadius: 6, transform: 'rotate(24deg)', transformOrigin: 'bottom center' }} />
        <div style={{ position: 'absolute', right: 20, top: -68, width: 22, height: 22, background: INK, borderRadius: '50%' }} />
        <Eyes />
        <Cheeks color="#C24A17" />
        <Smile />
      </div>
    </div>
  );
}
function GallinaBust({ waveT }) {
  const armRot = -18 + waveT * 46;
  return (
    <div style={{ position: 'relative', width: CHAR_W, height: CHAR_H }}>
      <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 200, height: 150, background: '#FFFDF5', borderRadius: '60% 60% 30px 30px', border: `8px solid ${INK}` }} />
      <Arm side="right" rot={armRot} color="#FFE9A8" />
      <Arm side="left" rot={16} color="#FFE9A8" />
      <div style={{ position: 'absolute', left: '50%', bottom: 130, transform: 'translateX(-50%)', width: 170, height: 170, background: '#FFFDF5', borderRadius: '50%', border: `8px solid ${INK}` }}>
        <div style={{ position: 'absolute', left: 50, top: -24, width: 22, height: 32, background: '#FF4D5E', borderRadius: '50%', border: `5px solid ${INK}` }} />
        <div style={{ position: 'absolute', left: 74, top: -36, width: 22, height: 40, background: '#FF4D5E', borderRadius: '50%', border: `5px solid ${INK}` }} />
        <div style={{ position: 'absolute', left: 98, top: -24, width: 22, height: 32, background: '#FF4D5E', borderRadius: '50%', border: `5px solid ${INK}` }} />
        <div style={{ position: 'absolute', left: '50%', top: 92, width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: `22px solid #FF9A3D`, transform: 'translateX(-50%)' }} />
        <Eyes />
        <Cheeks color="#FF8FA3" />
      </div>
    </div>
  );
}
function ZorraBust({ waveT }) {
  const armRot = -18 + waveT * 46;
  const body = '#FF8A3D';
  return (
    <div style={{ position: 'relative', width: CHAR_W, height: CHAR_H }}>
      <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 200, height: 150, background: body, borderRadius: '60% 60% 30px 30px', border: `8px solid ${INK}` }} />
      <Arm side="right" rot={armRot} color={body} />
      <Arm side="left" rot={16} color={body} />
      <div style={{ position: 'absolute', left: '50%', bottom: 130, transform: 'translateX(-50%)', width: 170, height: 170, background: body, borderRadius: '50%', border: `8px solid ${INK}` }}>
        <div style={{ position: 'absolute', left: -2, top: -66, width: 0, height: 0, borderLeft: '32px solid transparent', borderRight: '32px solid transparent', borderBottom: `76px solid ${INK}` }} />
        <div style={{ position: 'absolute', left: 4, top: -58, width: 0, height: 0, borderLeft: '26px solid transparent', borderRight: '26px solid transparent', borderBottom: `64px solid ${body}` }} />
        <div style={{ position: 'absolute', right: -2, top: -66, width: 0, height: 0, borderLeft: '32px solid transparent', borderRight: '32px solid transparent', borderBottom: `76px solid ${INK}` }} />
        <div style={{ position: 'absolute', right: 4, top: -58, width: 0, height: 0, borderLeft: '26px solid transparent', borderRight: '26px solid transparent', borderBottom: `64px solid ${body}` }} />
        <div style={{ position: 'absolute', left: '50%', top: 80, width: 92, height: 70, background: '#FFF3E2', borderRadius: '50%', transform: 'translateX(-50%)', border: `6px solid ${INK}` }} />
        <Eyes />
        <Cheeks color="#E4572E" />
        <div style={{ position: 'absolute', left: '50%', top: 120, width: 18, height: 14, background: INK, borderRadius: '50%', transform: 'translateX(-50%)' }} />
      </div>
    </div>
  );
}
function CoyoteBust({ waveT }) {
  const armRot = -18 + waveT * 46;
  const body = '#B79574', muzzle = '#F1E3CB';
  return (
    <div style={{ position: 'relative', width: CHAR_W, height: CHAR_H }}>
      <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 200, height: 150, background: body, borderRadius: '60% 60% 30px 30px', border: `8px solid ${INK}` }} />
      <Arm side="right" rot={armRot} color={body} />
      <Arm side="left" rot={16} color={body} />
      <div style={{ position: 'absolute', left: '50%', bottom: 130, transform: 'translateX(-50%)', width: 170, height: 170, background: body, borderRadius: '50%', border: `8px solid ${INK}` }}>
        <div style={{ position: 'absolute', left: -6, top: -76, width: 0, height: 0, borderLeft: '36px solid transparent', borderRight: '36px solid transparent', borderBottom: `88px solid ${INK}` }} />
        <div style={{ position: 'absolute', left: 0, top: -68, width: 0, height: 0, borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: `76px solid ${body}` }} />
        <div style={{ position: 'absolute', right: -6, top: -76, width: 0, height: 0, borderLeft: '36px solid transparent', borderRight: '36px solid transparent', borderBottom: `88px solid ${INK}` }} />
        <div style={{ position: 'absolute', right: 0, top: -68, width: 0, height: 0, borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: `76px solid ${body}` }} />
        <div style={{ position: 'absolute', left: '50%', top: 80, width: 96, height: 74, background: muzzle, borderRadius: '50%', transform: 'translateX(-50%)', border: `6px solid ${INK}` }} />
        <Eyes />
        <Cheeks color="#8C6A4E" />
        <div style={{ position: 'absolute', left: '50%', top: 122, width: 18, height: 14, background: INK, borderRadius: '50%', transform: 'translateX(-50%)' }} />
      </div>
    </div>
  );
}

const CHARACTERS = { cucaracha: CucarachaBust, gallina: GallinaBust, zorra: ZorraBust, coyote: CoyoteBust };

// ── Conejo, the walker (full body, hops between doors) ─────────────────────
function FullConejo({ x, bounce, gesture, gestureT, waveT }) {
  const pawRot = gesture === 'knock' ? Math.sin(gestureT * Math.PI * 4) * 34
    : gesture === 'greet' ? -20 + Math.sin(gestureT * Math.PI * 6) * 44 : 0;
  const earFlop = clamp(bounce / 26, 0, 1) * 10;
  return (
    <div style={{ position: 'absolute', left: x, top: GROUND_Y - 330, transform: `translate(-50%, ${-bounce}px)`, width: 220, height: 360 }}>
      <div style={{ position: 'absolute', left: 50, bottom: 0, width: 56, height: 44, background: '#FFF3DD', borderRadius: '26px 26px 30px 30px', border: `7px solid ${INK}` }} />
      <div style={{ position: 'absolute', right: 50, bottom: 0, width: 56, height: 44, background: '#FFF3DD', borderRadius: '26px 26px 30px 30px', border: `7px solid ${INK}` }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 36, transform: 'translateX(-50%)', width: 190, height: 190, background: '#FFF8EC', borderRadius: '50%', border: `8px solid ${INK}` }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 120, transform: `translateX(calc(-50% + 98px)) rotate(${pawRot}deg)`, transformOrigin: 'top center', width: 34, height: 78, background: '#FFF8EC', borderRadius: 18, border: `7px solid ${INK}` }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 120, transform: 'translateX(calc(-50% - 98px)) rotate(14deg)', transformOrigin: 'top center', width: 34, height: 78, background: '#FFF8EC', borderRadius: 18, border: `7px solid ${INK}` }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 150, transform: 'translateX(-50%)', width: 180, height: 180, background: '#FFFCF6', borderRadius: '50%', border: `8px solid ${INK}` }}>
        <div style={{ position: 'absolute', left: 22, top: -140, width: 48, height: 150, background: '#FFFCF6', borderRadius: 30, border: `7px solid ${INK}`, transform: `rotate(${-14 + earFlop}deg)`, transformOrigin: 'bottom center' }}>
          <div style={{ position: 'absolute', left: 9, top: 16, width: 22, height: 110, background: '#FF9EC4', borderRadius: 16 }} />
        </div>
        <div style={{ position: 'absolute', right: 22, top: -140, width: 48, height: 150, background: '#FFFCF6', borderRadius: 30, border: `7px solid ${INK}`, transform: `rotate(${14 - earFlop}deg)`, transformOrigin: 'bottom center' }}>
          <div style={{ position: 'absolute', left: 9, top: 16, width: 22, height: 110, background: '#FF9EC4', borderRadius: 16 }} />
        </div>
        <Eyes size={36} />
        <Cheeks color="#FF9EC4" />
        <div style={{ position: 'absolute', left: '50%', top: 100, width: 26, height: 22, background: '#FF9EC4', borderRadius: '50%', transform: 'translateX(-50%)', border: `4px solid ${INK}` }} />
        <Smile />
      </div>
    </div>
  );
}

// ── Background: sky, sun, clouds, ground, houses ───────────────────────────
function Cloud({ x, y, scale }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${scale})`, width: 160, height: 70 }}>
      <div style={{ position: 'absolute', left: 0, top: 20, width: 110, height: 50, background: '#fff', borderRadius: 30, opacity: 0.95 }} />
      <div style={{ position: 'absolute', left: 40, top: 0, width: 90, height: 60, background: '#fff', borderRadius: 30, opacity: 0.95 }} />
    </div>
  );
}
function House({ house, shake }) {
  return (
    <React.Fragment>
      <div style={{ position: 'absolute', left: house.x - (HOUSE_W + 50) / 2, top: GROUND_Y - HOUSE_BODY_H - ROOF_H + 12, width: HOUSE_W + 50, height: ROOF_H, background: house.roof, clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)', border: `7px solid ${INK}`, borderBottomWidth: 0 }} />
      <div style={{ position: 'absolute', left: house.x - HOUSE_W / 2, top: GROUND_Y - HOUSE_BODY_H, width: HOUSE_W, height: HOUSE_BODY_H, background: house.wall, borderRadius: '22px 22px 0 0', border: `7px solid ${INK}`, borderBottom: 'none' }} />
      <div style={{
        position: 'absolute', left: house.x - DOOR_W / 2, top: GROUND_Y - DOOR_H, width: DOOR_W, height: DOOR_H,
        background: '#4A2E1C', borderRadius: '95px 95px 0 0', border: `7px solid ${INK}`, overflow: 'hidden',
        transform: `translateX(${shake || 0}px)`,
      }} />
    </React.Fragment>
  );
}
function VillageBg({ palette, progress, activeIndex, doorShake }) {
  const drift = Math.sin(progress * Math.PI * 2) * 14;
  return (
    <React.Fragment>
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: GROUND_Y, background: `linear-gradient(180deg, ${palette.sky1} 0%, ${palette.sky2} 100%)` }} />
      <div style={{ position: 'absolute', left: 0, top: GROUND_Y, right: 0, bottom: 0, background: palette.ground }} />
      <div style={{ position: 'absolute', left: -20, top: GROUND_Y - 14, right: -20, height: 30, background: palette.groundDark, borderRadius: '50%' }} />
      <div style={{ position: 'absolute', left: 110, top: 80, width: 150, height: 150 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 22, height: 74, background: palette.sun, borderRadius: 11, transform: `translate(-50%,-50%) rotate(${i * 45}deg) translateY(-98px)` }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, background: palette.sun, borderRadius: '50%', border: '7px solid rgba(58,36,21,0.25)' }} />
      </div>
      <Cloud x={560 + drift} y={130} scale={1} />
      <Cloud x={1420 - drift} y={185} scale={0.8} />
      {HOUSES.map((h, i) => <House key={h.key} house={h} shake={i === activeIndex ? doorShake : 0} />)}
    </React.Fragment>
  );
}
function DoorwayPeek({ house, revealAmt, children }) {
  const windowH = DOOR_H - 14;
  const r = clamp(revealAmt, 0, 1.1);
  const hiddenTop = windowH + 20;
  const revealedTop = 30;
  const topPx = hiddenTop + (revealedTop - hiddenTop) * r;
  return (
    <div style={{ position: 'absolute', left: house.x - DOOR_W / 2 + 7, top: GROUND_Y - DOOR_H + 7, width: DOOR_W - 14, height: windowH, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '50%', top: topPx, transform: 'translateX(-50%)', width: CHAR_W }}>
        {children}
      </div>
    </div>
  );
}
function NamePlate({ name, revealAmt, color }) {
  const amt = clamp(revealAmt, 0, 1.1);
  const scale = 0.55 + amt * 0.55;
  const opacity = clamp(revealAmt, 0, 1);
  return (
    <div style={{ position: 'absolute', left: '50%', top: 74, transform: `translate(-50%,0) scale(${scale})`, opacity, transformOrigin: 'center', background: color, padding: '22px 64px', borderRadius: 100, border: `8px solid ${INK}`, boxShadow: '0 10px 0 rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: 'Fredoka, system-ui, sans-serif', fontWeight: 700, fontSize: 88, color: '#fff', letterSpacing: '0.02em', textShadow: '0 4px 0 rgba(0,0,0,0.18)' }}>{name}</div>
    </div>
  );
}

// ── One "visit": conejo hops in, knocks (or, for the intro, just arrives),
// the friend pops up, waves, name shows, then everyone settles — settled
// start/end state so cuts loop cleanly.
function phasesFor(isIntro) {
  return isIntro
    ? { hop: [0, 0.34], act: [0.34, 0.46], reveal: [0.46, 0.54], hold: [0.54, 0.82], duck: [0.82, 0.90] }
    : { hop: [0, 0.30], act: [0.30, 0.42], reveal: [0.42, 0.50], hold: [0.50, 0.80], duck: [0.80, 0.90] };
}
function revealAmount(progress, ph) {
  if (progress < ph.reveal[0]) return 0;
  if (progress < ph.duck[0]) {
    const t = clamp((progress - ph.reveal[0]) / (ph.reveal[1] - ph.reveal[0]), 0, 1);
    return Easing.easeOutBack(t);
  }
  if (progress < ph.duck[1]) {
    const t = clamp((progress - ph.duck[0]) / (ph.duck[1] - ph.duck[0]), 0, 1);
    return 1 - Easing.easeInCubic(t);
  }
  return 0;
}

const TweaksCtx = React.createContext({ soundOn: true, tapAdvance: true, timeOfDay: 'Día' });

function Visit(props) {
  const scene = props.scene;
  const progress = props.progress;
  const tweaks = React.useContext(TweaksCtx);
  const timeline = useTimeline();
  const knockFired = React.useRef(false);
  const soundFired = React.useRef(false);

  const isIntro = scene.mode === 'intro';
  const houseIdx = scene.houseIndex;
  const house = HOUSES[houseIdx];
  const prevHouse = houseIdx > 0 ? HOUSES[houseIdx - 1] : null;
  const ph = phasesFor(isIntro);

  const standX = house.x - 195;
  const fromX = isIntro ? -220 : prevHouse.x - 195;
  const hopT = clamp((progress - ph.hop[0]) / (ph.hop[1] - ph.hop[0]), 0, 1);
  const conejoX = fromX + (standX - fromX) * Easing.easeInOutSine(hopT);
  const hopBounce = hopT > 0 && hopT < 1 ? Math.abs(Math.sin(hopT * Math.PI * 4)) * 24 : 0;

  const actT = clamp((progress - ph.act[0]) / (ph.act[1] - ph.act[0]), 0, 1);
  const acting = progress >= ph.act[0] && progress < ph.act[1];

  const revealAmt = revealAmount(progress, ph);
  const holdActive = progress >= ph.reveal[0] && progress < ph.duck[1];
  const waveT = holdActive ? Math.sin(progress * Math.PI * 9) * 0.5 + 0.5 : 0;
  const doorShake = acting && !isIntro ? Math.sin(actT * Math.PI * 8) * 4 : 0;

  React.useEffect(() => {
    if (!tweaks.soundOn) return;
    if (!knockFired.current && progress >= ph.act[0] + 0.02) {
      knockFired.current = true;
      if (!isIntro) AudioFX.knock();
    }
    if (!soundFired.current && progress >= ph.reveal[0] + 0.03) {
      soundFired.current = true;
      AudioFX.sound(scene.character);
    }
  }, [progress]);

  function handleTap() {
    AudioFX.ensure();
    if (!tweaks.tapAdvance) return;
    const scenes = parseScenes(window.OM_SCENES);
    let acc = 0;
    const starts = scenes.map((s) => { const v = acc; acc += s.dur; return v; });
    const cur = timeline.time;
    let next;
    for (let i = 0; i < starts.length; i++) { if (starts[i] > cur + 0.02) { next = starts[i]; break; } }
    timeline.setTime(next !== undefined ? next : 0);
  }

  const palette = getPalette(tweaks.timeOfDay);
  const Friend = CHARACTERS[scene.character];

  return (
    <div style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} onClick={handleTap}>
      <VillageBg palette={palette} progress={progress} activeIndex={houseIdx} doorShake={doorShake} />
      {!isIntro && Friend && (
        <DoorwayPeek house={house} revealAmt={revealAmt}>
          <Friend waveT={waveT} />
        </DoorwayPeek>
      )}
      <FullConejo
        x={conejoX}
        bounce={hopBounce}
        gesture={acting ? (isIntro ? 'greet' : 'knock') : null}
        gestureT={actT}
        waveT={waveT}
      />
      <NamePlate name={scene.name.toUpperCase()} revealAmt={revealAmt} color={house.roof} />
    </div>
  );
}

// ── App shell ────────────────────────────────────────────────────────────
function TioConejoApp() {
  const defaults = window.TWEAK_DEFAULTS || { motionEditor: true, soundOn: true, tapAdvance: true, timeOfDay: 'Día' };
  const tw = useTweaks(defaults);
  const t = tw[0], setTweak = tw[1];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <TweaksCtx.Provider value={t}>
        <SceneStage width={STAGE_W} height={STAGE_H} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#7FCBF2">
          {{ Conejo: Visit, Cucaracha: Visit, Gallina: Visit, Zorra: Visit, Coyote: Visit }}
        </SceneStage>
      </TweaksCtx.Provider>
      <TweaksPanel>
        <TweakToggle label="Editor de movimiento" value={t.motionEditor} onChange={(v) => setTweak('motionEditor', v)} />
        <TweakToggle label="Sonido" value={t.soundOn} onChange={(v) => setTweak('soundOn', v)} />
        <TweakToggle label="Avanzar al tocar" value={t.tapAdvance} onChange={(v) => setTweak('tapAdvance', v)} />
        <TweakRadio label="Ambiente" value={t.timeOfDay} options={['Día', 'Atardecer']} onChange={(v) => setTweak('timeOfDay', v)} />
      </TweaksPanel>
    </div>
  );
}

Object.assign(window, { TioConejoApp });
