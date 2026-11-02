// Tío Conejo — versión cómic. Continuous composition on animations-v3.
const W = 1920, H = 1080, GY = 820;
const INK = '#2A1A12';
const OUT = { stroke: INK, strokeWidth: 6, strokeLinejoin: 'round', strokeLinecap: 'round' };
const FONT = "'Luckiest Guy', 'Fredoka', system-ui, sans-serif";

const MOTION = { glide: Easing.easeInOutSine, pop: Easing.easeOutBack, settle: Easing.easeOutCubic };
const seg = (T, a, b) => clamp((T - a) / (b - a), 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const bump = (T, a, b) => Math.sin(seg(T, a, b) * Math.PI);

const HOUSES = [
  { key: 'cucaracha', scene: 'Cucaracha', name: 'CUCARACHA', word: '¡CHIQUI!', x: 800, wall: '#FFD84D', wallS: '#E8BE2E', roof: '#FF6B6B', roofS: '#D94B4B', door: '#2EC4B6', doorS: '#1E9A8F', color: '#FF6FB5' },
  { key: 'gallina', scene: 'Gallina', name: 'GALLINA', word: '¡CO-CO!', x: 1450, wall: '#FF9EC7', wallS: '#E27CA8', roof: '#7B5CFF', roofS: '#5B3FD6', door: '#FFD84D', doorS: '#E2B92E', color: '#FF4D4D' },
  { key: 'zorra', scene: 'Zorra', name: 'ZORRA', word: '¡YIP YIP!', x: 2100, wall: '#7EE0C3', wallS: '#55C2A3', roof: '#FF8C42', roofS: '#DD6A22', door: '#FF5D8F', doorS: '#D93E6F', color: '#FF8C1A' },
  { key: 'coyote', scene: 'Coyote', name: 'COYOTE', word: '¡AUUU!', x: 2750, wall: '#B9A6FF', wallS: '#9682E6', roof: '#3FA34D', roofS: '#2C8139', door: '#FFB020', doorS: '#DB8E0B', color: '#7ED957' },
];
const doorC = (h) => h.x - 40;
const standX = (h) => h.x - 250;
const CONEJO_HOME = 250;
const EXIT_X = 3200;

const CAM_WIDE = { x: 1790, y: 380, s: 0.76 };
const camFor = (h) => ({ x: h.x - 150, y: 610, s: 1.7 });
const CAM_CONEJO = { x: 400, y: 610, s: 1.7 };

// Visit beat timings (seconds from the visit's cue)
const V = { hop0: 0.1, hop1: 2.3, raise: 2.4, k1: 2.8, k2: 3.15, armDown: 3.35, open: 3.55, rise: 3.6, sound: 3.75, wave0: 4.0, joy: 4.3, wave1: 5.6, duck: 5.75, close: 6.0, closed: 6.35 };

// ── Audio ─────────────────────────────────────────────────────────────────
const AudioFX = {
  ctx: null, listeners: new Set(), noise: null,
  running() { return !!this.ctx && this.ctx.state === 'running'; },
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.ctx.onstatechange = () => this.listeners.forEach((f) => f(this.running()));
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {}
  },
  tone({ f, f2, dur = 0.2, type = 'sine', gain = 0.12, delay = 0, vib = 0, lp }) {
    if (!this.running()) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur * 0.85);
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 9; lg.gain.value = vib;
      l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    let node = o;
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
    node.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  thump(delay = 0, gain = 0.16) {
    if (!this.running()) return;
    const c = this.ctx;
    if (!this.noise) {
      const b = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      this.noise = b;
    }
    const t0 = c.currentTime + delay, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; fl.type = 'lowpass'; fl.frequency.value = 700;
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    s.connect(fl); fl.connect(g); g.connect(c.destination); s.start(t0); s.stop(t0 + 0.15);
    this.tone({ f: 170, f2: 120, dur: 0.14, type: 'triangle', gain: 0.22, delay });
  },
  play(name) {
    switch (name) {
      case 'knock': this.thump(); break;
      case 'land': this.tone({ f: 140, f2: 90, dur: 0.12, gain: 0.07 }); break;
      case 'pop': this.tone({ f: 260, f2: 980, dur: 0.18, gain: 0.1 }); break;
      case 'close': this.tone({ f: 300, f2: 220, dur: 0.1, type: 'triangle', gain: 0.12 }); break;
      case 'conejo': this.tone({ f: 220, f2: 560, dur: 0.42, gain: 0.14, vib: 28 }); break;
      case 'cucaracha': [0, 0.08, 0.16, 0.24].forEach((d, i) => this.tone({ f: i % 2 ? 1700 : 1350, dur: 0.06, type: 'square', gain: 0.05, delay: d, lp: 2600 })); break;
      case 'gallina':
        this.tone({ f: 620, dur: 0.1, type: 'triangle', gain: 0.14 });
        this.tone({ f: 620, dur: 0.1, type: 'triangle', gain: 0.14, delay: 0.14 });
        this.tone({ f: 820, f2: 680, dur: 0.32, type: 'triangle', gain: 0.14, delay: 0.28 }); break;
      case 'zorra':
        this.tone({ f: 700, f2: 1150, dur: 0.13, gain: 0.12 });
        this.tone({ f: 700, f2: 1150, dur: 0.13, gain: 0.12, delay: 0.2 }); break;
      case 'coyote': this.tone({ f: 380, f2: 620, dur: 0.95, gain: 0.1, vib: 14, type: 'triangle', lp: 1800 }); break;
      case 'tada': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, dur: 0.4, type: 'triangle', gain: 0.1, delay: i * 0.11 })); break;
    }
  },
  note(f) {
    this.tone({ f, dur: 0.9, gain: 0.035 });
    this.tone({ f: f * 2, dur: 0.4, type: 'triangle', gain: 0.012 });
  },
};
const MELODY = [659, 784, 880, 784, 659, 587, 523, 587, 659, 784, 880, 1047, 880, 784, 659, 587];

// ── Drawing primitives ──────────────────────────────────────────────────
function Blob({ cx, cy, rx, ry, fill, shade, rot = 0, hi = true }) {
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={shade} />
      <ellipse cx={cx - rx * 0.08} cy={cy - ry * 0.09} rx={rx * 0.88} ry={ry * 0.87} fill={fill} />
      {hi && <ellipse cx={cx - rx * 0.42} cy={cy - ry * 0.5} rx={rx * 0.2} ry={ry * 0.1} fill="#fff" opacity="0.6" transform={`rotate(-30 ${cx - rx * 0.42} ${cy - ry * 0.5})`} />}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" {...OUT} />
    </g>
  );
}
function Arm({ x, y, rot, len, w, fill, hand, hr }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <line x1="0" y1="0" x2="0" y2={len} stroke={INK} strokeWidth={w + 12} strokeLinecap="round" />
      <circle cx="0" cy={len} r={hr} fill={hand || fill} {...OUT} />
      {!hand && <line x1="0" y1="0" x2="0" y2={len} stroke={fill} strokeWidth={w} strokeLinecap="round" />}
      {hand && <line x1="0" y1="0" x2="0" y2={len - hr} stroke={fill} strokeWidth={w} strokeLinecap="round" />}
    </g>
  );
}
function Eye({ x, y, r, closed, look = 0 }) {
  if (closed) return <path d={`M ${x - r} ${y} Q ${x} ${y + r * 0.6} ${x + r} ${y}`} fill="none" {...OUT} />;
  const px = x + look * r * 0.22, py = y + r * 0.08;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#fff" {...OUT} strokeWidth={5} />
      <circle cx={px} cy={py} r={r * 0.64} fill={INK} />
      <circle cx={px - r * 0.24} cy={py - r * 0.26} r={r * 0.24} fill="#fff" />
      <circle cx={px + r * 0.22} cy={py + r * 0.22} r={r * 0.1} fill="#fff" />
    </g>
  );
}
function Mouth({ x, y, w, open = 0 }) {
  if (open < 0.08) return <path d={`M ${x - w / 2} ${y} Q ${x} ${y + w * 0.55} ${x + w / 2} ${y}`} fill="none" {...OUT} />;
  const h = w * 0.3 + open * w * 0.5;
  return (
    <g>
      <path d={`M ${x - w / 2} ${y} Q ${x} ${y + h * 1.6} ${x + w / 2} ${y} Z`} fill="#8C2433" {...OUT} />
      <ellipse cx={x} cy={y + h * 0.55} rx={w * 0.2} ry={h * 0.18} fill="#FF7A8A" />
    </g>
  );
}
const Cheeks = ({ y, dx, c = '#FF7FA0' }) => (
  <g opacity="0.6"><ellipse cx={-dx} cy={y} rx="14" ry="9" fill={c} /><ellipse cx={dx} cy={y} rx="14" ry="9" fill={c} /></g>
);
const blinkAt = (T, seed) => ((T + seed) % 3.4) < 0.13;

// ── Characters (origin = feet, bottom centre; y up is negative) ──────────
// Doorway arch: half-width 100, top at -290, arch centre at -190.
function Cucaracha({ T, wave, talk }) {
  const rA = lerp(-25, -165 + 18 * Math.sin(T * Math.PI * 3), wave);
  const ant = Math.sin(T * 3.2) * 7 + talk * 10 * Math.sin(T * 30);
  const closed = blinkAt(T, 0.3);
  const leg = '#6B3418';
  return (
    <g>
      <Arm x={-50} y={-48} rot={35} len={36} w={11} fill={leg} hr={10} />
      <Arm x={50} y={-48} rot={-35} len={36} w={11} fill={leg} hr={10} />
      <Blob cx={0} cy={-72} rx={72} ry={72} fill="#C4612C" shade="#8E3E17" />
      <path d="M 0 -140 L 0 -8" fill="none" {...OUT} />
      <ellipse cx="-34" cy="-96" rx="10" ry="22" fill="#fff" opacity="0.35" transform="rotate(20 -34 -96)" />
      <Arm x={-56} y={-104} rot={28} len={50} w={12} fill={leg} hr={12} />
      <Arm x={52} y={-108} rot={rA} len={58} w={12} fill={leg} hr={13} />
      <g transform={`rotate(${ant} -18 -222)`}>
        <path d="M -18 -222 Q -26 -262 -50 -262" fill="none" {...OUT} strokeWidth={7} />
        <circle cx="-52" cy="-262" r="11" fill="#FF6FB5" {...OUT} strokeWidth={5} />
      </g>
      <g transform={`rotate(${-ant} 18 -222)`}>
        <path d="M 18 -222 Q 26 -262 50 -262" fill="none" {...OUT} strokeWidth={7} />
        <circle cx="52" cy="-262" r="11" fill="#FF6FB5" {...OUT} strokeWidth={5} />
      </g>
      <Blob cx={0} cy={-176} rx={64} ry={56} fill="#F2A86C" shade="#D07F45" />
      <g transform="translate(40 -220) rotate(18)">
        <path d="M 0 0 L -22 -14 L -22 14 Z M 0 0 L 22 -14 L 22 14 Z" fill="#FF6FB5" {...OUT} strokeWidth={5} />
        <circle cx="0" cy="0" r="7" fill="#FF6FB5" {...OUT} strokeWidth={5} />
      </g>
      <Eye x={-24} y={-184} r={17} closed={closed} look={0.5} />
      <Eye x={24} y={-184} r={17} closed={closed} look={0.5} />
      <Cheeks y={-160} dx={42} />
      <Mouth x={0} y={-152} w={30} open={talk} />
    </g>
  );
}
function Gallina({ T, wave, talk }) {
  const rA = lerp(-20, -160 + 20 * Math.sin(T * Math.PI * 3), wave);
  const closed = blinkAt(T, 1.1);
  const o = talk * Math.abs(Math.sin(T * 22));
  return (
    <g>
      <Blob cx={0} cy={-80} rx={82} ry={80} fill="#FFFFFF" shade="#E3D8C6" />
      <path d="M -40 -40 Q -20 -28 0 -40 Q 20 -28 40 -40" fill="none" {...OUT} strokeWidth={5} opacity="0.5" />
      <g transform="translate(-62 -112) rotate(18)"><Blob cx={0} cy={36} rx={24} ry={42} fill="#FFFFFF" shade="#E3D8C6" hi={false} /></g>
      <g transform={`translate(62 -112) rotate(${rA})`}><Blob cx={0} cy={38} rx={24} ry={44} fill="#FFFFFF" shade="#E3D8C6" hi={false} /></g>
      <circle cx="-22" cy="-228" r="16" fill="#FF3B3B" {...OUT} />
      <circle cx="0" cy="-242" r="20" fill="#FF3B3B" {...OUT} />
      <circle cx="22" cy="-228" r="16" fill="#FF3B3B" {...OUT} />
      <Blob cx={0} cy={-178} rx={58} ry={56} fill="#FFFFFF" shade="#E3D8C6" />
      <Eye x={-22} y={-192} r={15} closed={closed} />
      <Eye x={22} y={-192} r={15} closed={closed} />
      <Cheeks y={-166} dx={40} />
      <ellipse cx="0" cy={-136 + o * 8} rx="9" ry="13" fill="#FF3B3B" {...OUT} strokeWidth={5} />
      <path d={`M -13 ${-160 + o * 4} L 13 ${-160 + o * 4} L 0 ${-146 + o * 10} Z`} fill="#FF9F1C" {...OUT} strokeWidth={5} />
      <path d="M -17 -172 L 17 -172 L 0 -154 Z" fill="#FFB938" {...OUT} strokeWidth={5} />
    </g>
  );
}
function Zorra({ T, wave, talk }) {
  const rA = lerp(-22, -162 + 18 * Math.sin(T * Math.PI * 3), wave);
  const wag = Math.sin(T * 4) * 12;
  const closed = blinkAt(T, 2.0);
  const fur = '#FF8A2B', furS = '#D9661A', cream = '#FFF4E4', creamS = '#EFD9BC', dark = '#5A2C14';
  return (
    <g>
      <g transform={`rotate(${wag} 50 -40)`}>
        <Blob cx={66} cy={-92} rx={28} ry={62} rot={28} fill={fur} shade={furS} hi={false} />
        <ellipse cx="92" cy="-142" rx="16" ry="20" fill={cream} transform="rotate(28 92 -142)" {...OUT} />
      </g>
      <Blob cx={0} cy={-72} rx={68} ry={72} fill={fur} shade={furS} />
      <Blob cx={0} cy={-64} rx={40} ry={52} fill={cream} shade={creamS} hi={false} />
      <Arm x={-54} y={-108} rot={26} len={50} w={20} fill={fur} hand={dark} hr={14} />
      <Arm x={54} y={-110} rot={rA} len={56} w={20} fill={fur} hand={dark} hr={14} />
      <path d="M -66 -186 L -52 -266 L -14 -220 Z" fill={fur} {...OUT} />
      <path d="M -54 -204 L -50 -246 L -30 -220 Z" fill={dark} />
      <path d="M 66 -186 L 52 -266 L 14 -220 Z" fill={fur} {...OUT} />
      <path d="M 54 -204 L 50 -246 L 30 -220 Z" fill={dark} />
      <Blob cx={0} cy={-170} rx={76} ry={58} fill={fur} shade={furS} />
      <path d="M -70 -160 Q -46 -118 0 -124 Q 46 -118 70 -160 Q 36 -142 0 -150 Q -36 -142 -70 -160 Z" fill={cream} {...OUT} strokeWidth={5} />
      <Eye x={-30} y={-186} r={16} closed={closed} look={-0.3} />
      <Eye x={30} y={-186} r={16} closed={closed} look={-0.3} />
      <Cheeks y={-158} dx={50} />
      <ellipse cx="0" cy="-160" rx="11" ry="8" fill={INK} />
      <Mouth x={0} y={-148} w={26} open={talk * Math.abs(Math.sin(T * 16))} />
    </g>
  );
}
function Coyote({ T, wave, talk }) {
  const rA = lerp(-22, -162 + 18 * Math.sin(T * Math.PI * 3), wave);
  const closed = blinkAt(T, 2.7) && talk < 0.1;
  const tilt = -10 * talk;
  const fur = '#C9B08C', furS = '#A3896A', cream = '#F6ECDB', creamS = '#E2D2B8', ear = '#F4B9A6';
  return (
    <g>
      <Blob cx={0} cy={-72} rx={68} ry={72} fill={fur} shade={furS} />
      <Blob cx={0} cy={-62} rx={38} ry={50} fill={cream} shade={creamS} hi={false} />
      <Arm x={-54} y={-108} rot={26} len={50} w={20} fill={fur} hr={14} />
      <Arm x={54} y={-110} rot={rA} len={56} w={20} fill={fur} hr={14} />
      <g transform={`rotate(${tilt} 0 -130)`}>
        <path d="M -60 -190 L -44 -274 L -12 -222 Z" fill={fur} {...OUT} />
        <path d="M -48 -206 L -42 -252 L -26 -222 Z" fill={ear} />
        <path d="M 60 -190 L 44 -274 L 12 -222 Z" fill={fur} {...OUT} />
        <path d="M 48 -206 L 42 -252 L 26 -222 Z" fill={ear} />
        <Blob cx={0} cy={-172} rx={70} ry={58} fill={fur} shade={furS} />
        <path d="M -14 -228 Q -4 -246 0 -230 Q 6 -246 14 -228" fill={fur} {...OUT} strokeWidth={5} />
        <Blob cx={0} cy={-146} rx={42} ry={28} fill={cream} shade={creamS} hi={false} />
        <Eye x={-28} y={-190} r={15} closed={closed} />
        <Eye x={28} y={-190} r={15} closed={closed} />
        <Cheeks y={-160} dx={50} />
        <ellipse cx="0" cy="-164" rx="13" ry="9" fill={INK} />
        {talk > 0.1
          ? <ellipse cx="0" cy="-138" rx={8 + talk * 4} ry={7 + talk * 7} fill="#8C2433" {...OUT} strokeWidth={5} />
          : <Mouth x={0} y={-146} w={26} />}
      </g>
      <path d="M -52 -128 Q 0 -108 52 -128 L 0 -86 Z" fill="#FF4B4B" {...OUT} />
      <circle cx="-18" cy="-116" r="4" fill="#fff" /><circle cx="14" cy="-110" r="4" fill="#fff" /><circle cx="0" cy="-98" r="3.5" fill="#fff" />
    </g>
  );
}
const FRIENDS = { cucaracha: Cucaracha, gallina: Gallina, zorra: Zorra, coyote: Coyote };

function Conejo({ x, y, sx, sy, ear, rArm, lArm, talk, T }) {
  const fur = '#E6BE90', furS = '#C49668', cream = '#FFF5E6', creamS = '#ECD9C0', pink = '#FF9FBF';
  const closed = blinkAt(T, 0.8);
  return (
    <g transform={`translate(${x} ${GY - y}) scale(${sx} ${sy})`}>
      <ellipse cx="0" cy="4" rx={80 + y * 0.1} ry="12" fill={INK} opacity={0.15 - y * 0.0008} transform={`translate(0 ${y / sy})`} />
      <Blob cx={-36} cy={-14} rx={36} ry={18} fill={fur} shade={furS} hi={false} />
      <Blob cx={36} cy={-14} rx={36} ry={18} fill={fur} shade={furS} hi={false} />
      <Arm x={-58} y={-150} rot={lArm} len={66} w={24} fill={fur} hr={16} />
      <Blob cx={0} cy={-100} rx={70} ry={80} fill="#2F7DEB" shade="#1D5BC0" />
      <Blob cx={0} cy={-96} rx={38} ry={62} fill={cream} shade={creamS} hi={false} />
      <Arm x={58} y={-150} rot={rArm} len={66} w={24} fill={fur} hr={16} />
      <g transform={`rotate(${-12 - ear} -26 -262)`}>
        <Blob cx={-30} cy={-334} rx={24} ry={70} fill={fur} shade={furS} />
        <ellipse cx="-31" cy="-328" rx="11" ry="50" fill={pink} />
      </g>
      <g transform={`rotate(${12 + ear} 26 -262)`}>
        <Blob cx={30} cy={-334} rx={24} ry={70} fill={fur} shade={furS} />
        <ellipse cx="29" cy="-328" rx="11" ry="50" fill={pink} />
      </g>
      <Blob cx={0} cy={-222} rx={80} ry={66} fill={fur} shade={furS} />
      <Eye x={-30} y={-238} r={17} closed={closed} look={0.4} />
      <Eye x={30} y={-238} r={17} closed={closed} look={0.4} />
      <Cheeks y={-206} dx={52} />
      {talk > 0.1 && <Mouth x={0} y={-186} w={30} open={talk} />}
      <ellipse cx="-15" cy="-197" rx="22" ry="16" fill={cream} {...OUT} strokeWidth={5} />
      <ellipse cx="15" cy="-197" rx="22" ry="16" fill={cream} {...OUT} strokeWidth={5} />
      {talk <= 0.1 && <path d="M -9 -183 L -9 -170 L 9 -170 L 9 -183" fill="#fff" {...OUT} strokeWidth={4} />}
      <ellipse cx="0" cy="-209" rx="12" ry="9" fill={pink} {...OUT} strokeWidth={5} />
      <g transform="translate(0 -160)">
        <path d="M 0 0 L -24 -13 L -24 13 Z M 0 0 L 24 -13 L 24 13 Z" fill="#FF3B3B" {...OUT} strokeWidth={5} />
        <circle cx="0" cy="0" r="7" fill="#FF3B3B" {...OUT} strokeWidth={5} />
      </g>
    </g>
  );
}

// ── Choreography helpers ────────────────────────────────────────────────
function hopAt(T, tr) {
  const { t0, t1, x0, x1, n, h } = tr;
  if (T <= t0) return { x: x0, y: 0, sx: 1, sy: 1, vy: 0 };
  if (T >= t1) return { x: x1, y: 0, sx: 1, sy: 1, vy: 0 };
  const d = (t1 - t0) / n, i = Math.min(n - 1, Math.floor((T - t0) / d)), p = (T - t0 - i * d) / d;
  const xa = lerp(x0, x1, i / n), xb = lerp(x0, x1, (i + 1) / n);
  if (p < 0.2) { const c = Math.sin((p / 0.2) * Math.PI); return { x: xa, y: 0, sx: 1 + 0.1 * c, sy: 1 - 0.14 * c, vy: 0 }; }
  if (p < 0.8) {
    const q = (p - 0.2) / 0.6, st = 1 - Math.sin(q * Math.PI);
    return { x: lerp(xa, xb, MOTION.glide(q)), y: h * Math.sin(q * Math.PI), sx: 1 - 0.06 * st, sy: 1 + 0.1 * st, vy: Math.cos(q * Math.PI) };
  }
  const c = Math.sin(((p - 0.8) / 0.2) * Math.PI);
  return { x: xb, y: 0, sx: 1 + 0.12 * c, sy: 1 - 0.16 * c, vy: -0.6 * c };
}
function landings(tr) {
  const d = (tr.t1 - tr.t0) / tr.n, out = [];
  for (let i = 0; i < tr.n; i++) out.push({ t: tr.t0 + i * d + d * 0.8, x: lerp(tr.x0, tr.x1, (i + 1) / tr.n) });
  return out;
}

function buildPlan(C) {
  const tracks = [{ t0: C.Inicio + 1.0, t1: C.Inicio + 2.8, x0: -300, x1: CONEJO_HOME, n: 2, h: 95 }];
  HOUSES.forEach((h, i) => {
    const c = C[h.scene];
    const from = i === 0 ? CONEJO_HOME : standX(HOUSES[i - 1]);
    tracks.push({ t0: c + V.hop0, t1: c + V.hop1, x0: from, x1: standX(h), n: i === 0 ? 2 : 3, h: 85 });
    tracks.push({ t0: c + V.joy, t1: c + V.joy + 0.6, x0: standX(h), x1: standX(h), n: 1, h: 45 });
  });
  const last = standX(HOUSES[3]), F = C.Final;
  tracks.push({ t0: F + 1.9, t1: F + 3.3, x0: last, x1: last, n: 2, h: 60 });
  tracks.push({ t0: F + 4.2, t1: F + 5.9, x0: last, x1: EXIT_X, n: 3, h: 80 });
  const events = [];
  tracks.forEach((tr) => landings(tr).forEach((l) => events.push({ t: l.t, s: 'land' })));
  events.push({ t: C.Inicio + 3.0, s: 'conejo' });
  HOUSES.forEach((h) => {
    const c = C[h.scene];
    events.push({ t: c + V.k1, s: 'knock' }, { t: c + V.k2, s: 'knock' }, { t: c + V.open + 0.02, s: 'pop' }, { t: c + V.sound, s: h.key }, { t: c + V.closed - 0.05, s: 'close' });
  });
  HOUSES.forEach((h, i) => events.push({ t: F + 1.35 + i * 0.2, s: 'pop' }));
  events.push({ t: F + 2.4, s: 'tada' }, { t: F + 2.6, s: 'conejo' });
  HOUSES.forEach((h, i) => events.push({ t: F + 4.75 + i * 0.1, s: 'close' }));
  return { tracks, events };
}

function conejoPose(T, C, plan) {
  let tr = null;
  for (const t of plan.tracks) if (T >= t.t0) tr = t;
  const hp = tr ? hopAt(T, tr) : { x: -300, y: 0, sx: 1, sy: 1, vy: 0 };
  let rArm = -15, lArm = 15, talk = 0;
  const waves = [[C.Inicio + 2.9, C.Inicio + 4.6], [C.Final + 1.9, C.Final + 4.2]];
  HOUSES.forEach((h) => {
    const c = C[h.scene];
    const up = MOTION.settle(seg(T, c + V.raise, c + V.raise + 0.3)) * (1 - MOTION.settle(seg(T, c + V.armDown, c + V.armDown + 0.3)));
    const knock = bump(T, c + V.k1 - 0.1, c + V.k1 + 0.1) + bump(T, c + V.k2 - 0.1, c + V.k2 + 0.1);
    rArm = lerp(rArm, -102 + 18 * knock, up);
    waves.push([c + V.wave0 + 0.2, c + V.wave1]);
  });
  let wv = 0;
  waves.forEach(([a, b]) => { wv = Math.max(wv, MOTION.settle(seg(T, a, a + 0.35)) * (1 - MOTION.settle(seg(T, b - 0.3, b)))); });
  const wAng = -150 + 22 * Math.sin(T * Math.PI * 3.2);
  rArm = lerp(rArm, wAng, wv);
  const both = MOTION.settle(seg(T, C.Final + 1.9, C.Final + 2.3)) * (1 - MOTION.settle(seg(T, C.Final + 3.9, C.Final + 4.2)));
  lArm = lerp(lArm, 150 - 22 * Math.sin(T * Math.PI * 3.2), both);
  talk = bump(T, C.Inicio + 3.0, C.Inicio + 3.6) + bump(T, C.Final + 2.6, C.Final + 3.2);
  const ear = hp.vy * 14 + (hp.y > 0 ? 0 : -hp.vy * 6);
  return { ...hp, rArm, lArm, talk, ear };
}

function friendState(T, C, i) {
  const h = HOUSES[i], c = C[h.scene], F = C.Final;
  const fo = F + 1.3 + i * 0.2, fd = F + 4.4 + i * 0.1;
  const windows = [
    { open: c + V.open, rise: c + V.rise, duck: c + V.duck, close: c + V.close },
    { open: fo, rise: fo + 0.05, duck: fd, close: fd + 0.25 },
  ];
  let pop = 0, door = 0, squash = 0;
  windows.forEach((w) => {
    const r = MOTION.pop(seg(T, w.rise, w.rise + 0.4));
    const lift = bump(T, w.duck, w.duck + 0.12) * 0.06;
    const down = MOTION.glide(seg(T, w.duck + 0.08, w.duck + 0.38));
    pop = Math.max(pop, T >= w.rise ? clamp(r + lift - down, -0.2, 1.3) * (T < w.duck + 0.38 ? 1 : 0) : 0);
    const dOpen = MOTION.pop(seg(T, w.open, w.open + 0.22));
    const dClose = MOTION.settle(seg(T, w.close, w.close + 0.35));
    door = Math.max(door, dOpen * (1 - dClose));
    squash = Math.max(squash, bump(T, w.rise + 0.3, w.rise + 0.6));
  });
  const wave = MOTION.settle(seg(T, c + V.wave0, c + V.wave0 + 0.3)) * (1 - MOTION.settle(seg(T, c + V.wave1, c + V.wave1 + 0.25)))
    + MOTION.settle(seg(T, F + 2.0, F + 2.3)) * (1 - MOTION.settle(seg(T, F + 4.1, F + 4.4)));
  const talk = bump(T, c + V.sound, c + V.sound + (h.key === 'coyote' ? 1.0 : 0.6));
  const knockShake = Math.sin((T - c) * 60) * 3 * (bump(T, c + V.k1 - 0.02, c + V.k1 + 0.16) + bump(T, c + V.k2 - 0.02, c + V.k2 + 0.16));
  return { pop, door, squash, wave: clamp(wave, 0, 1), talk, knockShake };
}

function camAt(T, C) {
  const ease = (a, b, t0, t1) => {
    const k = MOTION.glide(seg(T, t0, t1));
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k) };
  };
  if (T < C.Cucaracha) return ease(CAM_WIDE, CAM_CONEJO, C.Inicio + 0.8, C.Inicio + 3.0);
  for (let i = HOUSES.length - 1; i >= 0; i--) {
    const c = C[HOUSES[i].scene];
    if (T >= c && T < (i === 3 ? C.Final : C[HOUSES[i + 1].scene])) return ease(i === 0 ? CAM_CONEJO : camFor(HOUSES[i - 1]), camFor(HOUSES[i]), c, c + 2.2);
  }
  return ease(camFor(HOUSES[3]), CAM_WIDE, C.Final, C.Final + 1.9);
}

// ── Scenery ─────────────────────────────────────────────────────────────
function Cloud({ x, y, s }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -120 30 Q -150 30 -150 0 Q -150 -34 -110 -34 Q -100 -80 -50 -74 Q -20 -118 30 -96 Q 70 -120 100 -80 Q 150 -84 152 -36 Q 186 -20 160 30 Z" fill="#fff" {...OUT} />
      <path d="M -110 30 Q 20 14 150 30" fill="none" stroke="#D7EEFF" strokeWidth="12" strokeLinecap="round" />
    </g>
  );
}
function Tree({ x, s = 1 }) {
  return (
    <g transform={`translate(${x} ${GY}) scale(${s})`}>
      <path d="M -18 0 L -14 -170 L 14 -170 L 18 0 Z" fill="#9C6B3F" {...OUT} />
      <circle cx="-60" cy="-230" r="70" fill="#3FB34F" {...OUT} />
      <circle cx="60" cy="-230" r="70" fill="#3FB34F" {...OUT} />
      <circle cx="0" cy="-300" r="85" fill="#4CC35C" {...OUT} />
      <circle cx="-30" cy="-330" r="18" fill="#fff" opacity="0.35" />
      <circle cx="40" cy="-250" r="10" fill="#FF5D8F" {...OUT} strokeWidth={4} />
      <circle cx="-56" cy="-210" r="10" fill="#FF5D8F" {...OUT} strokeWidth={4} />
    </g>
  );
}
function Flower({ x, y, c }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1="0" y1="0" x2="0" y2="-26" stroke={INK} strokeWidth="5" />
      {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.sin(a * Math.PI / 180) * 11} cy={-30 - Math.cos(a * Math.PI / 180) * 11} r="9" fill={c} {...OUT} strokeWidth={4} />)}
      <circle cx="0" cy="-30" r="7" fill="#FFD84D" {...OUT} strokeWidth={4} />
    </g>
  );
}
function House({ h, i, f, T, children }) {
  const x = h.x, dc = doorC(h), dl = dc - 100, dr = dc + 100;
  const arch = `M ${dl} ${GY} L ${dl} ${GY - 190} A 100 100 0 0 1 ${dr} ${GY - 190} L ${dr} ${GY} Z`;
  const sx = lerp(1, -0.34, f.door);
  return (
    <g>
      <rect x={x - 190} y={GY - 340} width="380" height="340" rx="18" fill={h.wallS} {...OUT} />
      <rect x={x - 190 + 3} y={GY - 340 + 3} width="352" height="320" rx="16" fill={h.wall} />
      <rect x={x - 190} y={GY - 340} width="380" height="340" rx="18" fill="none" {...OUT} />
      <path d={`M ${x - 238} ${GY - 318} Q ${x - 248} ${GY - 340} ${x - 226} ${GY - 356} L ${x - 22} ${GY - 512} Q ${x} ${GY - 528} ${x + 22} ${GY - 512} L ${x + 226} ${GY - 356} Q ${x + 248} ${GY - 340} ${x + 238} ${GY - 318} Z`} fill={h.roof} {...OUT} />
      <path d={`M ${x - 200} ${GY - 330} L ${x + 200} ${GY - 330}`} stroke={h.roofS} strokeWidth="14" strokeLinecap="round" />
      <path d={`M ${x - 150} ${GY - 400} Q ${x - 60} ${GY - 470} ${x - 20} ${GY - 494}`} stroke="#fff" strokeWidth="10" strokeLinecap="round" opacity="0.4" fill="none" />
      <circle cx={x + 112} cy={GY - 210} r="46" fill="#BDEBFF" {...OUT} />
      <path d={`M ${x + 112} ${GY - 256} L ${x + 112} ${GY - 164} M ${x + 66} ${GY - 210} L ${x + 158} ${GY - 210}`} {...OUT} />
      <path d={`M ${x + 86} ${GY - 236} Q ${x + 96} ${GY - 246} ${x + 106} ${GY - 248}`} stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x={x + 62} y={GY - 160} width="100" height="26" rx="8" fill={h.roof} {...OUT} />
      <Flower x={x + 84} y={GY - 160} c="#FF5D8F" /><Flower x={x + 112} y={GY - 162} c="#fff" /><Flower x={x + 140} y={GY - 160} c="#FF9F1C" />
      <path d={arch} fill="#8A5530" {...OUT} />
      <ellipse cx={dc} cy={GY - 140} rx="70" ry="110" fill="#B77845" opacity="0.6" />
      <defs><clipPath id={`door-${i}`}><path d={arch} /></clipPath></defs>
      <g clipPath={`url(#door-${i})`}>{children}</g>
      <g transform={`translate(${dl + f.knockShake} 0) scale(${sx} 1) translate(${-dl} 0)`}>
        <path d={arch} fill={sx < 0 ? h.doorS : h.door} {...OUT} />
        <path d={`M ${dc - 35} ${GY - 250} L ${dc - 35} ${GY - 10} M ${dc + 35} ${GY - 250} L ${dc + 35} ${GY - 10}`} stroke={h.doorS} strokeWidth="8" strokeLinecap="round" />
        <circle cx={dr - 26} cy={GY - 130} r="12" fill="#FFD84D" {...OUT} strokeWidth={5} />
      </g>
      <rect x={dl - 22} y={GY - 8} width="244" height="22" rx="10" fill="#E7D3B0" {...OUT} />
    </g>
  );
}

function Burst({ cx, cy, t, color }) {
  if (t <= 0 || t >= 1) return null;
  const k = MOTION.settle(t), op = 1 - t;
  const rays = [];
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2 + 0.2;
    const r0 = 150 + k * 40, r1 = 190 + k * 110;
    rays.push(<line key={j} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0 * 0.9} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1 * 0.9} stroke={INK} strokeWidth={10 * op + 2} strokeLinecap="round" />);
  }
  const stars = [];
  for (let j = 0; j < 6; j++) {
    const a = -Math.PI / 2 + (j - 2.5) * 0.55, r = 140 + k * 200;
    const sx = cx + Math.cos(a) * r, sy = cy + Math.sin(a) * r * 0.8, sc = (1 - t * 0.6) * (j % 2 ? 0.8 : 1.1);
    stars.push(<path key={j} transform={`translate(${sx} ${sy}) rotate(${t * 180 + j * 30}) scale(${sc})`} d="M 0 -24 Q 5 -5 24 0 Q 5 5 0 24 Q -5 5 -24 0 Q -5 -5 0 -24 Z" fill={j % 2 ? '#fff' : color} {...OUT} strokeWidth={4} />);
  }
  return <g opacity={Math.min(1, op * 2)}>{rays}{stars}</g>;
}
function Bubble({ x, y, t, text, size = 1, fill = '#fff', color = '#FF3B3B' }) {
  if (t <= 0 || t >= 1) return null;
  const s = MOTION.pop(seg(t, 0, 0.3)) * (1 - MOTION.glide(seg(t, 0.8, 1))) * size;
  const pts = [];
  for (let j = 0; j < 22; j++) { const a = (j / 22) * Math.PI * 2, r = j % 2 ? 62 : 88; pts.push(`${Math.cos(a) * r * 1.35},${Math.sin(a) * r}`); }
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${-6 + Math.sin(t * 9) * 3})`}>
      <polygon points={pts.join(' ')} fill={fill} {...OUT} />
      <text x="0" y="16" textAnchor="middle" fontFamily={FONT} fontSize="56" fill={color} stroke={INK} strokeWidth="8" paintOrder="stroke" strokeLinejoin="round">{text}</text>
    </g>
  );
}
function Talk({ x, y, t, text }) {
  if (t <= 0 || t >= 1) return null;
  const s = MOTION.pop(seg(t, 0, 0.25)) * (1 - MOTION.glide(seg(t, 0.82, 1)));
  const w = 34 * text.length + 60;
  return (
    <g transform={`translate(${x} ${y + Math.sin(t * 8) * 4}) scale(${s})`}>
      <path d={`M ${-w / 2 + 40} 46 L ${-w / 2 + 10} 86 L ${-w / 2 + 80} 46 Z`} fill="#fff" {...OUT} />
      <rect x={-w / 2} y="-50" width={w} height="100" rx="50" fill="#fff" {...OUT} />
      <rect x={-w / 2 + 36} y="40" width="50" height="14" fill="#fff" />
      <text x="0" y="18" textAnchor="middle" fontFamily={FONT} fontSize="54" fill={INK}>{text}</text>
    </g>
  );
}
function Dust({ T, plan }) {
  const out = [];
  plan.tracks.forEach((tr, ti) => landings(tr).forEach((l, li) => {
    const a = (T - l.t) / 0.55;
    if (a <= 0 || a >= 1) return;
    const k = MOTION.settle(a);
    [-1, 1].forEach((d) => [0, 1].forEach((j) => {
      out.push(<circle key={`${ti}-${li}-${d}-${j}`} cx={l.x + d * (70 + k * (60 + j * 40))} cy={GY - 6 - k * (14 + j * 14)} r={(16 - j * 5) * (1 - a * 0.7)} fill="#fff" {...OUT} strokeWidth={4} opacity={1 - a} />);
    }));
  }));
  return <g>{out}</g>;
}

// ── Name banner (screen space) ──────────────────────────────────────────
function Banner({ T, items }) {
  const cur = items.find((it) => T >= it.at && T < it.until);
  if (!cur) return null;
  const outK = MOTION.glide(seg(T, cur.until - 0.35, cur.until));
  const letters = cur.text.split('');
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 22, display: 'flex', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}>
      {letters.map((ch, j) => {
        const k = MOTION.pop(seg(T, cur.at + j * 0.06, cur.at + j * 0.06 + 0.4));
        const bob = Math.sin(T * 4 + j * 0.7) * 8 * k;
        const s = k * (1 - outK);
        return (
          <span key={j} style={{
            display: 'inline-block', fontFamily: FONT, fontSize: 150, lineHeight: 1, color: cur.color,
            WebkitTextStroke: `14px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 12px 0 ${INK}`,
            transform: `translateY(${bob - outK * 30}px) scale(${s}) rotate(${Math.sin(j * 1.7) * 5}deg)`, opacity: s > 0.02 ? 1 : 0,
          }}>{ch}</span>
        );
      })}
    </div>
  );
}

const TweakCtx = React.createContext({});

function TioConejoComic() {
  const { T, CUES: C, authoredTotal } = useComposition();
  const loopK = T / (authoredTotal || 39);
  const tw = React.useContext(TweakCtx);
  const timeline = useTimeline();
  const plan = React.useMemo(() => buildPlan(C), [C.Inicio, C.Cucaracha, C.Gallina, C.Zorra, C.Coyote, C.Final]);
  const prevT = React.useRef(T);

  React.useEffect(() => {
    const p = prevT.current; prevT.current = T;
    if (!(T > p) || T - p > 0.4) return;
    if (tw.soundOn) plan.events.forEach((e) => { if (e.t > p && e.t <= T) AudioFX.play(e.s); });
    if (tw.musicOn) {
      const a = Math.floor(p / 0.5), b = Math.floor(T / 0.5);
      if (b > a) AudioFX.note(MELODY[b % MELODY.length]);
    }
  }, [T]);

  const onTap = () => {
    AudioFX.unlock();
    if (!tw.tapAdvance) return;
    let scenes = [];
    try { scenes = JSON.parse(window.OM_SCENES); } catch (e) {}
    let acc = 0, next = 0;
    const now = timeline.time;
    for (const s of scenes) { if (acc > now + 0.05) { next = acc; break; } acc += s.dur; }
    timeline.setTime(next);
  };

  const cam = camAt(T, C);
  const camT = `translate(${W / 2} ${H / 2}) scale(${cam.s}) translate(${-cam.x} ${-cam.y})`;
  const cj = conejoPose(T, C, plan);
  const fs = HOUSES.map((h, i) => friendState(T, C, i));

  const banners = [{ at: C.Inicio + 3.0, until: C.Inicio + 4.9, text: 'CONEJO', color: '#FFD23F' }];
  HOUSES.forEach((h) => banners.push({ at: C[h.scene] + 3.8, until: C[h.scene] + 5.9, text: h.name, color: h.color }));
  banners.push({ at: C.Final + 2.4, until: C.Final + 4.5, text: '¡AMIGOS!', color: '#FFFFFF' });

  const px = cam.x;
  return (
    <div onClick={onTap} data-screen-label={`t=${Math.floor(T)}s`} style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'pointer', background: '#4FB8F0' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3FA9F0" /><stop offset="1" stopColor="#BDEBFF" /></linearGradient>
          <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="3.2" fill="#fff" opacity="0.22" /></pattern>
        </defs>
        <rect width={W} height={H} fill="url(#sky)" />
        <rect width={W} height={H} fill="url(#dots)" />
        <g transform={`translate(${170 - (px - 1000) * 0.03} 150)`}>
          {Array.from({ length: 10 }).map((_, j) => (
            <path key={j} transform={`rotate(${j * 36 + loopK * 72})`} d="M -14 -96 L 0 -132 L 14 -96 Z" fill="#FFD23F" {...OUT} strokeWidth={5} />
          ))}
          <circle r="84" fill="#FFD23F" {...OUT} />
          <path d="M -36 -10 Q -26 -22 -16 -10 M 16 -10 Q 26 -22 36 -10" fill="none" {...OUT} />
          <path d="M -22 18 Q 0 38 22 18" fill="none" {...OUT} />
          <Cheeks y={10} dx={46} c="#FF8A3D" />
        </g>
        <g transform={camT}>
          <g transform={`translate(${(px - 1775) * 0.6} ${(cam.y - 370) * 0.5})`}>
            <Cloud x={300 + Math.sin(loopK * Math.PI * 2) * 120} y={-80} s={1.1} />
            <Cloud x={1400 - Math.sin(loopK * Math.PI * 2) * 90} y={20} s={0.9} />
            <Cloud x={2500 + Math.sin(loopK * Math.PI * 4) * 70} y={-120} s={1.2} />
            <Cloud x={3300} y={40} s={0.8} />
          </g>
          <g transform={`translate(${(px - 1775) * 0.35} 0)`}>
            {[-400, 500, 1400, 2300, 3200, 4100].map((hx, j) => (
              <ellipse key={hx} cx={hx} cy={GY + 40} rx="620" ry={j % 2 ? 260 : 210} fill={j % 2 ? '#8ED65F' : '#A3E070'} {...OUT} />
            ))}
          </g>
          <rect x="-2000" y={GY} width="7000" height="1200" fill="#6CC04A" />
          <path d={`M -2000 ${GY} L 5000 ${GY}`} {...OUT} />
          {[1125, 1775, 2425].map((tx) => <Tree key={tx} x={tx} s={0.95} />)}
          <Tree x={-120} s={1.1} />
          <Tree x={3150} s={1.05} />
          {HOUSES.map((h, i) => {
            const f = fs[i], Fr = FRIENDS[h.key];
            const sq = f.squash * 0.07;
            return (
              <House key={h.key} h={h} i={i} f={f} T={T}>
                {f.pop > 0.001 && (
                  <g transform={`translate(${doorC(h)} ${GY + (1 - f.pop) * 330}) scale(${1 + sq} ${1 - sq})`}>
                    <Fr T={T} wave={f.wave} talk={f.talk} />
                  </g>
                )}
              </House>
            );
          })}
          <rect x="-2000" y={GY + 40} width="7000" height="90" fill="#F2D38D" />
          <path d={`M -2000 ${GY + 40} L 5000 ${GY + 40} M -2000 ${GY + 130} L 5000 ${GY + 130}`} {...OUT} />
          {[-40, 420, 1120, 1780, 2430, 3060, 3400].map((fx, j) => <Flower key={fx} x={fx} y={GY + 28} c={['#FF5D8F', '#fff', '#FF9F1C', '#7B5CFF'][j % 4]} />)}
          {HOUSES.map((h, i) => {
            const c = C[h.scene];
            return (
              <g key={h.key}>
                <Burst cx={doorC(h)} cy={GY - 160} t={seg(T, c + V.open, c + V.open + 0.7)} color={h.color} />
                <Burst cx={doorC(h)} cy={GY - 160} t={seg(T, C.Final + 1.3 + i * 0.2, C.Final + 2.0 + i * 0.2)} color={h.color} />
              </g>
            );
          })}
          <Dust T={T} plan={plan} />
          <Conejo x={cj.x} y={cj.y} sx={cj.sx} sy={cj.sy} ear={cj.ear} rArm={cj.rArm} lArm={cj.lArm} talk={cj.talk} T={T} />
          {tw.words && <Talk x={CONEJO_HOME + 190} y={GY - 430} t={seg(T, C.Inicio + 3.0, C.Inicio + 4.6)} text="¡BOING!" />}
          {HOUSES.map((h) => {
            const c = C[h.scene], dc = doorC(h);
            return (
              <g key={h.key}>
                <Bubble x={dc - 40} y={GY - 360} t={seg(T, c + V.k1 - 0.02, c + V.k1 + 1.0)} text="¡TUN!" />
                <Bubble x={dc + 80} y={GY - 440} t={seg(T, c + V.k2 - 0.02, c + V.k2 + 0.85)} text="¡TUN!" size={0.9} fill="#FFD84D" />
                {tw.words && <Talk x={dc + 230} y={GY - 360} t={seg(T, c + V.sound, c + V.sound + 1.6)} text={h.word} />}
              </g>
            );
          })}
        </g>
      </svg>
      <Banner T={T} items={banners} />
    </div>
  );
}

function SoundHint() {
  const [on, setOn] = React.useState(AudioFX.running());
  React.useEffect(() => { const f = (v) => setOn(v); AudioFX.listeners.add(f); return () => AudioFX.listeners.delete(f); }, []);
  if (on) return null;
  return (
    <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, background: '#fff', border: `3px solid ${INK}`, fontFamily: FONT, fontSize: 16, whiteSpace: 'nowrap', color: INK, letterSpacing: '0.02em', boxShadow: `0 4px 0 ${INK}` }}>
      <svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#FFD23F" stroke={INK} strokeWidth="2" strokeLinejoin="round" /><path d="M16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" /></svg>
      Tocá la pantalla para activar el sonido
    </div>
  );
}

function TioConejoComicApp() {
  const defaults = window.TWEAK_DEFAULTS || { motionEditor: true, soundOn: true, musicOn: true, tapAdvance: true, words: true };
  const [t, setTweak] = useTweaks(defaults);
  return (
    <div onPointerDown={() => AudioFX.unlock()} style={{ position: 'absolute', inset: 0, background: '#3FA9F0' }}>
      <TweakCtx.Provider value={t}>
        <CompositionStage width={W} height={H} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#3FA9F0">
          <TioConejoComic />
        </CompositionStage>
      </TweakCtx.Provider>
      <SoundHint />
      <TweaksPanel>
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={(v) => setTweak('motionEditor', v)} />
        <TweakToggle label="Sonidos" value={t.soundOn} onChange={(v) => setTweak('soundOn', v)} />
        <TweakToggle label="Musiquita de fondo" value={t.musicOn} onChange={(v) => setTweak('musicOn', v)} />
        <TweakToggle label="Avanzar al tocar" value={t.tapAdvance} onChange={(v) => setTweak('tapAdvance', v)} />
        <TweakToggle label="Globos de sonido (¡CO-CO!)" value={t.words} onChange={(v) => setTweak('words', v)} />
      </TweaksPanel>
    </div>
  );
}

Object.assign(window, { TioConejoComicApp });
