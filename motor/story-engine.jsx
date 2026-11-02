// Tío Conejo — motor de cuentos. Plans a story JSON into timed scenes and
// renders them on the CompositionStage of motor/escenario.jsx (horizontal or vertical).
(function () {
const INK = '#2A1A12';
const OUT = { stroke: INK, strokeWidth: 6, strokeLinejoin: 'round', strokeLinecap: 'round' };
const FD = "'Luckiest Guy', 'Fredoka', system-ui, sans-serif";
const FT = "'Fredoka', system-ui, sans-serif";
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
const bump = (u, a, b) => Math.sin(seg(u, a, b) * Math.PI);
const EZ = { glide: Easing.easeInOutSine, pop: Easing.easeOutBack, settle: Easing.easeOutCubic };
const rad = (d) => (d * Math.PI) / 180;
const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean);

const FMT = {
  horizontal: { id: 'horizontal', W: 1920, H: 1080, GY: 800, s: 1, spacing: 430, cap: { size: 50, bottom: 30, maxW: 1500 }, ban: { size: 132, top: 26, chars: 16 }, bub: 40 },
  vertical: { id: 'vertical', W: 1080, H: 1920, GY: 1290, s: 1.32, spacing: 245, cap: { size: 56, bottom: 330, maxW: 940 }, ban: { size: 118, top: 200, chars: 10 }, bub: 42 },
};

const IDS = ['conejo', 'cucaracha', 'gallina', 'zorra', 'coyote', 'tigre', 'tortuga', 'mono', 'danta', 'perezoso', 'tucan', 'vaca', 'perro', 'gato', 'mariposa'];
const ACTIONS = ['quieto', 'saltar', 'caminar', 'tocar', 'saludar', 'hablar', 'bailar', 'comer', 'dormir', 'reir', 'correr', 'abrazar', 'regalo', 'asustarse', 'recoger', 'tirar'];
const TRASH = ['botella', 'lata', 'bolsa', 'papel'];
const ENTRIES = ['ya', 'izquierda', 'derecha', 'aparece', 'puerta'];
const PLACES = { pueblito: 'Pueblito', bosque: 'Bosque', rio: 'Río', playa: 'Playa', mercado: 'Mercado', casa: 'Casa', noche: 'Noche' };
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const ALIAS = { zorro: 'zorra', tapir: 'danta', perezosa: 'perezoso', gallo: 'gallina', perrito: 'perro', gatito: 'gato', mona: 'mono', tigresa: 'tigre', toro: 'vaca' };
function normId(s) { const n = norm(s); return IDS.find((id) => n.includes(id)) || ALIAS[Object.keys(ALIAS).find((k) => n.includes(k))] || null; }
function normAct(s) {
  const n = norm(s);
  if (n.startsWith('regal') || n === 'dar' || n.startsWith('dar ')) return 'regalo';
  if (n.startsWith('asust') || n.includes('sorpr')) return 'asustarse';
  if (n.startsWith('abraz')) return 'abrazar';
  if (n.startsWith('toc')) return 'tocar';
  if (n.startsWith('recog') || n.startsWith('limpi') || n.startsWith('junt')) return 'recoger';
  if (n.startsWith('tir') || n.startsWith('bota')) return 'tirar';
  if (n.startsWith('ri') || n.startsWith('re')) return n.startsWith('reg') ? 'regalo' : 'reir';
  return ACTIONS.find((a) => n.startsWith(a.slice(0, 4))) || 'quieto';
}
function sanitizeStory(st) {
  st = st || {};
  const out = { id: st.id || 'x', titulo: String(st.titulo || 'Tío Conejo').slice(0, 40), escenas: [] };
  (Array.isArray(st.escenas) ? st.escenas : []).forEach((e) => {
    if (!e) return;
    const lugar = PLACES[norm(e.lugar)] ? norm(e.lugar) : 'pueblito';
    const seen = new Set();
    let cast = (Array.isArray(e.personajes) ? e.personajes : []).map((c) => ({
      id: normId(c && c.id), accion: normAct(c && c.accion), entrada: ENTRIES.includes(norm(c && c.entrada)) ? norm(c.entrada) : 'ya',
      dice: String((c && c.dice) || '').slice(0, 60), hacia: normId(c && c.hacia),
      objeto: TRASH.includes(norm(c && c.objeto)) ? norm(c.objeto) : null,
    })).filter((c) => c.id && !seen.has(c.id) && seen.add(c.id)).slice(0, 3);
    let door = false;
    cast.forEach((c) => { if (c.entrada === 'puerta') { if (door) c.entrada = 'aparece'; door = true; } });
    out.escenas.push({
      lugar, texto: String(e.texto || '').slice(0, 140), palabra: String(e.palabra || '').toUpperCase().slice(0, 18), personajes: cast,
      // Opcionales para cuentos ambientales:
      basura: clamp(Math.round(Number(e.basura) || 0), 0, 3), // 0 nada · 1 poca · 2 bastante · 3 mucha
      sucia: norm(e.agua) === 'sucia',                          // agua del río color lodo
      limpiar: !!e.limpiar,                                     // la basura va desapareciendo durante la escena
      botes: !!e.botes,                                         // tres basureros de reciclaje
    });
  });
  return out;
}

// ── Audio ───────────────────────────────────────────────────────────────
const VOICES = {
  conejo: { f: 520, t: 'sine' }, cucaracha: { f: 1100, t: 'square', lp: 2400, g: 0.05 }, gallina: { f: 640, t: 'triangle' },
  zorra: { f: 620, t: 'sine' }, coyote: { f: 360, t: 'triangle' }, tigre: { f: 230, t: 'sawtooth', lp: 900, g: 0.07 },
  tortuga: { f: 300, t: 'sine', slow: 1 }, mono: { f: 720, t: 'triangle' }, danta: { f: 220, t: 'triangle', lp: 900 },
  perezoso: { f: 260, t: 'sine', slow: 1 }, tucan: { f: 840, t: 'triangle' }, vaca: { f: 210, t: 'sawtooth', lp: 800, g: 0.07 },
  perro: { f: 440, t: 'triangle' }, gato: { f: 760, t: 'sine' }, mariposa: { f: 1250, t: 'sine', g: 0.06 },
};
const SFX = {
  ctx: null, listeners: new Set(), buf: null,
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
    const c = this.ctx, t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur * 0.85);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 8; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    let n = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; }
    n.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise({ dur = 0.15, gain = 0.12, delay = 0, lp = 700 }) {
    if (!this.running()) return;
    const c = this.ctx;
    if (!this.buf) { const b = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.buf = b; }
    const t0 = c.currentTime + delay, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.buf; fl.type = 'lowpass'; fl.frequency.value = lp;
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(c.destination); s.start(t0); s.stop(t0 + dur + 0.05);
  },
  voice(id, n) {
    const v = VOICES[id] || VOICES.conejo;
    if (id === 'vaca') return this.tone({ f: 230, f2: 175, dur: 0.75, type: 'sawtooth', gain: 0.07, vib: 6, lp: 850 });
    if (id === 'perro') { this.tone({ f: 520, f2: 380, dur: 0.16, type: 'triangle', gain: 0.13 }); this.tone({ f: 520, f2: 380, dur: 0.16, type: 'triangle', gain: 0.13, delay: 0.24 }); return; }
    if (id === 'gato') { this.tone({ f: 640, f2: 980, dur: 0.22, gain: 0.1 }); this.tone({ f: 980, f2: 620, dur: 0.3, gain: 0.1, delay: 0.2 }); return; }
    if (id === 'gallina') { [0, 0.15].forEach((d) => this.tone({ f: 620, dur: 0.1, type: 'triangle', gain: 0.13, delay: d })); this.tone({ f: 820, f2: 680, dur: 0.3, type: 'triangle', gain: 0.13, delay: 0.3 }); return; }
    const k = clamp(n, 2, 4), sp = v.slow ? 0.27 : 0.17, pat = [1, 1.16, 0.94, 1.24];
    for (let i = 0; i < k; i++) this.tone({ f: v.f * pat[i], f2: v.f * pat[i] * 1.06, dur: v.slow ? 0.2 : 0.13, type: v.t, gain: v.g || 0.11, delay: i * sp, lp: v.lp });
  },
  play(s, a) {
    switch (s) {
      case 'land': this.tone({ f: 140, f2: 90, dur: 0.12, gain: 0.07 }); break;
      case 'pop': this.tone({ f: 260, f2: 980, dur: 0.18, gain: 0.1 }); break;
      case 'knock': this.noise({ dur: 0.12, gain: 0.16 }); this.tone({ f: 170, f2: 120, dur: 0.14, type: 'triangle', gain: 0.22 }); break;
      case 'door': this.tone({ f: 420, f2: 640, dur: 0.22, type: 'triangle', gain: 0.08 }); break;
      case 'nom': this.tone({ f: 300, f2: 220, dur: 0.1, type: 'triangle', gain: 0.12 }); this.tone({ f: 300, f2: 220, dur: 0.1, type: 'triangle', gain: 0.12, delay: 0.16 }); break;
      case 'snore': this.tone({ f: 120, f2: 170, dur: 0.9, type: 'triangle', gain: 0.06, lp: 500 }); break;
      case 'laugh': [0, 1, 2, 3].forEach((i) => this.tone({ f: 760 - i * 60, dur: 0.1, type: 'triangle', gain: 0.1, delay: i * 0.12 })); break;
      case 'hug': this.tone({ f: 523, dur: 0.35, gain: 0.08 }); this.tone({ f: 784, dur: 0.5, gain: 0.08, delay: 0.15 }); break;
      case 'tada': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, dur: 0.4, type: 'triangle', gain: 0.1, delay: i * 0.11 })); break;
      case 'boing': this.tone({ f: 200, f2: 700, dur: 0.25, gain: 0.12, vib: 30 }); break;
      case 'chime': this.tone({ f: 1047, dur: 0.6, gain: 0.06 }); this.tone({ f: 1568, dur: 0.7, gain: 0.04, delay: 0.08 }); break;
      case 'swish': this.noise({ dur: 0.35, gain: 0.05, lp: 2500 }); break;
      case 'voz': this.voice(a.id, a.n); break;
    }
  },
  note(f) { this.tone({ f, dur: 0.9, gain: 0.032 }); this.tone({ f: f * 2, dur: 0.4, type: 'triangle', gain: 0.01 }); },
};
const MELODY = [659, 784, 880, 784, 659, 587, 523, 587, 659, 784, 880, 1047, 880, 784, 659, 587];

// ── Primitives ───────────────────────────────────────────────────────────
function Blob({ cx, cy, rx, ry, fill, shade, rot = 0, hi = true }) {
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={shade || fill} />
      <ellipse cx={cx - rx * 0.08} cy={cy - ry * 0.09} rx={rx * 0.88} ry={ry * 0.87} fill={fill} />
      {hi && <ellipse cx={cx - rx * 0.42} cy={cy - ry * 0.5} rx={rx * 0.2} ry={ry * 0.1} fill="#fff" opacity="0.55" transform={`rotate(-30 ${cx - rx * 0.42} ${cy - ry * 0.5})`} />}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" {...OUT} />
    </g>
  );
}
function Arm({ x, y, rot, len, w, fill, hand, hr }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <line x1="0" y1="0" x2="0" y2={len} stroke={INK} strokeWidth={w + 12} strokeLinecap="round" />
      <circle cx="0" cy={len} r={hr} fill={hand || fill} {...OUT} />
      <line x1="0" y1="0" x2="0" y2={hand ? len - hr : len} stroke={fill} strokeWidth={w} strokeLinecap="round" />
    </g>
  );
}
function EyeX({ x, y, r, mode, look }) {
  if (mode === 'blink' || mode === 'sleep') return <path d={`M ${x - r} ${y} Q ${x} ${y + r * 0.7} ${x + r} ${y}`} fill="none" {...OUT} />;
  if (mode === 'happy') return <path d={`M ${x - r} ${y + 5} Q ${x} ${y - r * 0.9} ${x + r} ${y + 5}`} fill="none" {...OUT} />;
  const wide = mode === 'wide', R = wide ? r * 1.22 : r, pr = wide ? 0.42 : 0.64;
  const px = x + (look || 0) * R * 0.22, py = y + R * 0.08;
  return (
    <g>
      <circle cx={x} cy={y} r={R} fill="#fff" {...OUT} strokeWidth={5} />
      <circle cx={px} cy={py} r={R * pr} fill={INK} />
      <circle cx={px - R * 0.24} cy={py - R * 0.26} r={R * 0.24} fill="#fff" />
      <circle cx={px + R * 0.2} cy={py + R * 0.2} r={R * 0.1} fill="#fff" />
    </g>
  );
}
function MouthX({ x, y, w, p }) {
  if (p.mood === 'o') return <ellipse cx={x} cy={y + 8} rx={w * 0.26} ry={w * 0.34} fill="#8C2433" {...OUT} strokeWidth={5} />;
  const open = p.mood === 'laugh' ? Math.max(0.6, p.mouth) : p.mouth;
  if (open < 0.08) {
    if (p.mood === 'sleep') return <path d={`M ${x - w * 0.25} ${y + 4} Q ${x} ${y + 11} ${x + w * 0.25} ${y + 4}`} fill="none" {...OUT} strokeWidth={5} />;
    return <path d={`M ${x - w / 2} ${y} Q ${x} ${y + w * 0.55} ${x + w / 2} ${y}`} fill="none" {...OUT} />;
  }
  const h = w * 0.3 + open * w * 0.5;
  return (
    <g>
      <path d={`M ${x - w / 2} ${y} Q ${x} ${y + h * 1.6} ${x + w / 2} ${y} Z`} fill="#8C2433" {...OUT} />
      <ellipse cx={x} cy={y + h * 0.55} rx={w * 0.2} ry={h * 0.18} fill="#FF7A8A" />
    </g>
  );
}
const talking = (p) => p.mouth > 0.08 || p.mood === 'o' || p.mood === 'laugh';
const Cheeks = ({ y, dx, c }) => (<g opacity="0.6"><ellipse cx={-dx} cy={y} rx="14" ry="9" fill={c || '#FF7FA0'} /><ellipse cx={dx} cy={y} rx="14" ry="9" fill={c || '#FF7FA0'} /></g>);
const Tri = ({ d, fill, sw }) => <path d={d} fill={fill} {...OUT} strokeWidth={sw || 6} />;
const Bow = ({ x, y, c, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M 0 0 L -24 -13 L -24 13 Z M 0 0 L 24 -13 L 24 13 Z" fill={c} {...OUT} strokeWidth={5} />
    <circle cx="0" cy="0" r="7" fill={c} {...OUT} strokeWidth={5} />
  </g>
);
const Tail = ({ d, fill, w = 20 }) => (<g><path d={d} fill="none" stroke={INK} strokeWidth={w + 12} strokeLinecap="round" /><path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" /></g>);
const Antennae = ({ T, p, y, tip, heart }) => {
  const a = Math.sin(T * 3.2 + (p.seed || 0)) * 7 + (talking(p) ? 8 * Math.sin(T * 30) : 0);
  return [-1, 1].map((s) => (
    <g key={s} transform={`rotate(${a * s} ${18 * s} ${y})`}>
      <path d={`M ${18 * s} ${y} Q ${26 * s} ${y - 40} ${50 * s} ${y - 40}`} fill="none" {...OUT} strokeWidth={7} />
      <circle cx={52 * s} cy={y - 40} r="11" fill={tip} {...OUT} strokeWidth={5} />
    </g>
  ));
};

// ── Species ─────────────────────────────────────────────────────────────
const G0 = { headCy: -222, headRx: 80, headRy: 66, eyeY: -236, eyeDX: 30, eyeR: 17, cheekY: -204, cheekDX: 52, bodyCy: -100, bodyRx: 70, bodyRy: 80, bellyCy: -94, bellyRx: 40, bellyRy: 58, armX: 58, armY: -150, armLen: 66, armW: 24, handR: 16, footDX: 36, mouthY: -190 };
const SPECIES = {
  conejo: {
    fur: '#E6BE90', furS: '#C49668', body: '#2F7DEB', bodyS: '#1D5BC0', belly: '#FFF5E6', bellyS: '#ECD9C0', food: 'zanahoria', tall: 410,
    ears: (p) => [-1, 1].map((s) => (
      <g key={s} transform={`rotate(${(12 + p.ear) * s} ${26 * s} -262)`}>
        <Blob cx={30 * s} cy={-334} rx={24} ry={70} fill="#E6BE90" shade="#C49668" />
        <ellipse cx={30 * s - 1} cy={-328} rx="11" ry="50" fill="#FF9FBF" />
      </g>
    )),
    face: (p) => (
      <g>
        {talking(p) && <MouthX x={0} y={-186} w={30} p={p} />}
        <ellipse cx="-15" cy="-197" rx="22" ry="16" fill="#FFF5E6" {...OUT} strokeWidth={5} />
        <ellipse cx="15" cy="-197" rx="22" ry="16" fill="#FFF5E6" {...OUT} strokeWidth={5} />
        {!talking(p) && <path d="M -9 -183 L -9 -170 L 9 -170 L 9 -183" fill="#fff" {...OUT} strokeWidth={4} />}
        <ellipse cx="0" cy="-209" rx="12" ry="9" fill="#FF9FBF" {...OUT} strokeWidth={5} />
      </g>
    ),
    deco: () => <Bow x={0} y={-160} c="#FF3B3B" />,
  },
  cucaracha: {
    fur: '#F2A86C', furS: '#D07F45', body: '#C4612C', bodyS: '#8E3E17', arm: '#6B3418', feet: '#6B3418', size: 0.95, tall: 300,
    g: { bodyRx: 74, bodyRy: 76, bodyCy: -84, headCy: -196, headRx: 66, headRy: 58, eyeY: -204, eyeDX: 25, eyeR: 17, cheekY: -180, cheekDX: 44, armY: -116, armX: 54, armLen: 58, armW: 12, handR: 12, footDX: 30, mouthY: -172 },
    back: () => [-1, 1].map((s) => <Arm key={s} x={52 * s} y={-56} rot={-35 * s} len={36} w={11} fill="#6B3418" hr={10} />),
    deco: () => (<g><path d="M 0 -158 L 0 -12" fill="none" {...OUT} /><ellipse cx="-34" cy="-110" rx="10" ry="22" fill="#fff" opacity="0.35" transform="rotate(20 -34 -110)" /></g>),
    top: (p, T) => (<g><Antennae T={T} p={p} y={-246} tip="#FF6FB5" /><Bow x={40} y={-244} c="#FF6FB5" s={0.9} /></g>),
  },
  gallina: {
    fur: '#FFFFFF', furS: '#E3D8C6', feet: '#FF9F1C', feetS: '#E07F00', wing: true, food: 'maiz', tall: 280,
    g: { bodyRx: 82, bodyRy: 82, bodyCy: -88, headCy: -198, headRx: 60, headRy: 58, eyeY: -212, eyeDX: 23, eyeR: 15, cheekY: -186, cheekDX: 40, armX: 64, armY: -128 },
    deco: () => <path d="M -44 -48 Q -22 -34 0 -48 Q 22 -34 44 -48" fill="none" {...OUT} strokeWidth={5} opacity="0.45" />,
    top: () => (<g><circle cx="-22" cy="-250" r="16" fill="#FF3B3B" {...OUT} /><circle cx="0" cy="-264" r="20" fill="#FF3B3B" {...OUT} /><circle cx="22" cy="-250" r="16" fill="#FF3B3B" {...OUT} /></g>),
    face: (p) => {
      const o = talking(p) ? 0.4 + 0.6 * Math.abs(p.mouth) : 0;
      return (
        <g>
          <ellipse cx="0" cy={-154 + o * 8} rx="9" ry="13" fill="#FF3B3B" {...OUT} strokeWidth={5} />
          <path d={`M -13 ${-178 + o * 4} L 13 ${-178 + o * 4} L 0 ${-164 + o * 10} Z`} fill="#FF9F1C" {...OUT} strokeWidth={5} />
          <path d="M -17 -190 L 17 -190 L 0 -172 Z" fill="#FFB938" {...OUT} strokeWidth={5} />
        </g>
      );
    },
  },
  zorra: {
    fur: '#FF8A2B', furS: '#D9661A', belly: '#FFF4E4', bellyS: '#EFD9BC', hand: '#5A2C14', feet: '#5A2C14', feetS: '#3E1D0C', tall: 330,
    g: { headRx: 78, headRy: 60 },
    back: (p, T) => (
      <g transform={`rotate(${Math.sin(T * 4 + (p.seed || 0)) * 12} 46 -54)`}>
        <Blob cx={84} cy={-110} rx={30} ry={64} rot={30} fill="#FF8A2B" shade="#D9661A" hi={false} />
        <ellipse cx="114" cy="-160" rx="17" ry="21" fill="#FFF4E4" transform="rotate(30 114 -160)" {...OUT} />
      </g>
    ),
    ears: () => [-1, 1].map((s) => (<g key={s}><Tri d={`M ${-66 * s} -238 L ${-52 * s} -318 L ${-14 * s} -272 Z`} fill="#FF8A2B" /><path d={`M ${-54 * s} -256 L ${-50 * s} -298 L ${-30 * s} -272 Z`} fill="#5A2C14" /></g>)),
    face: (p) => (
      <g>
        <path d="M -72 -212 Q -46 -170 0 -176 Q 46 -170 72 -212 Q 36 -194 0 -202 Q -36 -194 -72 -212 Z" fill="#FFF4E4" {...OUT} strokeWidth={5} />
        <ellipse cx="0" cy="-212" rx="11" ry="8" fill={INK} />
        <MouthX x={0} y={-199} w={26} p={p} />
      </g>
    ),
  },
  coyote: {
    fur: '#C9B08C', furS: '#A3896A', belly: '#F6ECDB', bellyS: '#E2D2B8', tall: 340,
    g: { headRx: 72, headRy: 60 },
    ears: () => [-1, 1].map((s) => (<g key={s}><Tri d={`M ${-60 * s} -242 L ${-44 * s} -326 L ${-12 * s} -274 Z`} fill="#C9B08C" /><path d={`M ${-48 * s} -258 L ${-42 * s} -304 L ${-26 * s} -274 Z`} fill="#F4B9A6" /></g>)),
    face: (p) => (
      <g>
        <Blob cx={0} cy={-196} rx={44} ry={28} fill="#F6ECDB" shade="#E2D2B8" hi={false} />
        <ellipse cx="0" cy="-214" rx="13" ry="9" fill={INK} />
        <MouthX x={0} y={-198} w={24} p={p} />
      </g>
    ),
    deco: () => (<g><path d="M -54 -168 Q 0 -146 54 -168 L 0 -122 Z" fill="#FF4B4B" {...OUT} /><circle cx="-18" cy="-156" r="4" fill="#fff" /><circle cx="14" cy="-150" r="4" fill="#fff" /><circle cx="0" cy="-136" r="3.5" fill="#fff" /></g>),
  },
  tigre: {
    fur: '#FF9A1F', furS: '#D97706', belly: '#FFF4E4', bellyS: '#EFD9BC', size: 1.06, tall: 320,
    back: (p, T) => <g><Tail d={`M 40 -50 Q 130 -40 ${130 + Math.sin(T * 3) * 8} -150`} fill="#FF9A1F" w={22} /><path d="M 98 -52 L 104 -30 M 124 -84 L 146 -80 M 128 -120 L 150 -124" {...OUT} strokeWidth={7} /></g>,
    deco: () => <path d="M -66 -130 Q -48 -122 -40 -108 M -70 -88 Q -52 -82 -46 -66 M 66 -130 Q 48 -122 40 -108 M 70 -88 Q 52 -82 46 -66" fill="none" {...OUT} strokeWidth={7} />,
    ears: () => [-1, 1].map((s) => (<g key={s}><circle cx={58 * s} cy={-276} r="25" fill="#FF9A1F" {...OUT} /><circle cx={58 * s} cy={-276} r="12" fill="#5A2C14" /></g>)),
    headDeco: () => <path d="M -16 -287 L -8 -266 M 0 -288 L 0 -262 M 16 -287 L 8 -266 M -79 -232 L -58 -228 M -78 -212 L -60 -212 M 79 -232 L 58 -228 M 78 -212 L 60 -212" fill="none" {...OUT} strokeWidth={7} />,
    face: (p) => (
      <g>
        {talking(p) && <MouthX x={0} y={-188} w={30} p={p} />}
        <ellipse cx="-17" cy="-198" rx="24" ry="18" fill="#FFF4E4" {...OUT} strokeWidth={5} />
        <ellipse cx="17" cy="-198" rx="24" ry="18" fill="#FFF4E4" {...OUT} strokeWidth={5} />
        <path d="M -12 -218 L 12 -218 L 0 -205 Z" fill="#FF7FA0" {...OUT} strokeWidth={5} />
        {!talking(p) && <path d="M -14 -184 Q 0 -174 14 -184" fill="none" {...OUT} strokeWidth={5} />}
      </g>
    ),
  },
  tortuga: {
    fur: '#8FD16A', furS: '#62A845', body: '#3FA34D', bodyS: '#2C8139', belly: '#F7E08A', bellyS: '#E2C55E', food: 'lechuga', tall: 300, slow: true,
    g: { bodyRx: 86, bodyRy: 80, bellyRx: 58, bellyRy: 64, headRx: 72, headRy: 62, headCy: -226 },
    deco: () => (<g><path d="M -54 -120 L 54 -120 M -58 -86 L 58 -86 M -50 -54 L 50 -54" fill="none" stroke="#C9A93E" strokeWidth="6" strokeLinecap="round" /><path d="M -76 -140 Q -90 -100 -76 -60 M 76 -140 Q 90 -100 76 -60" fill="none" stroke="#2C8139" strokeWidth="8" strokeLinecap="round" /></g>),
    top: () => <circle cx="34" cy="-276" r="11" fill="#FFD84D" {...OUT} strokeWidth={5} />,
    face: (p) => <MouthX x={0} y={-200} w={34} p={p} />,
  },
  mono: {
    fur: '#8B5A3C', furS: '#6B4129', belly: '#F2C9A0', bellyS: '#DDB083', food: 'banano', tall: 300,
    back: (p, T) => <Tail d={`M 44 -40 C 150 -40 ${160 + Math.sin(T * 2.6) * 8} -170 104 -172 C 64 -172 72 -122 104 -128`} fill="#8B5A3C" w={16} />,
    ears: () => [-1, 1].map((s) => (<g key={s}><circle cx={84 * s} cy={-226} r="28" fill="#8B5A3C" {...OUT} /><circle cx={84 * s} cy={-226} r="15" fill="#F2C9A0" /></g>)),
    headDeco: () => (<g><ellipse cx="-26" cy="-232" rx="34" ry="30" fill="#F2C9A0" /><ellipse cx="26" cy="-232" rx="34" ry="30" fill="#F2C9A0" /><ellipse cx="0" cy="-198" rx="54" ry="34" fill="#F2C9A0" /><path d="M -10 -288 Q 0 -306 8 -288 Q 18 -302 22 -284" fill="none" {...OUT} strokeWidth={5} /></g>),
    face: (p) => (<g><circle cx="-7" cy="-210" r="4" fill={INK} /><circle cx="7" cy="-210" r="4" fill={INK} /><MouthX x={0} y={-196} w={36} p={p} /></g>),
  },
  danta: {
    fur: '#7A7390', furS: '#5C5672', belly: '#E8DDF0', bellyS: '#CFC2DC', size: 1.08, tall: 310, slow: true,
    ears: () => [-1, 1].map((s) => (<g key={s}><circle cx={56 * s} cy={-276} r="20" fill="#7A7390" {...OUT} /><circle cx={56 * s} cy={-276} r="9" fill="#fff" /></g>)),
    headDeco: () => <ellipse cx="0" cy="-196" rx="62" ry="30" fill="#E8DDF0" />,
    face: (p) => (
      <g>
        <MouthX x={0} y={-164} w={24} p={p} />
        <Blob cx={0} cy={-200} rx={30} ry={30} fill="#9A92B0" shade="#7E7696" hi={false} />
        <ellipse cx="0" cy="-176" rx="24" ry="13" fill="#8A82A2" {...OUT} strokeWidth={5} />
        <circle cx="-8" cy="-176" r="4" fill={INK} /><circle cx="8" cy="-176" r="4" fill={INK} />
      </g>
    ),
    g: { eyeR: 15, eyeY: -242 },
  },
  perezoso: {
    fur: '#C9A27A', furS: '#A5805A', belly: '#EADBC4', bellyS: '#D6C2A4', hand: '#6B4A2E', food: 'banano', tall: 300, slow: true,
    headDeco: () => (<g><ellipse cx="0" cy="-216" rx="64" ry="50" fill="#F4E9D8" /><ellipse cx="-32" cy="-234" rx="28" ry="16" fill="#6B4A2E" transform="rotate(-18 -32 -234)" /><ellipse cx="32" cy="-234" rx="28" ry="16" fill="#6B4A2E" transform="rotate(18 32 -234)" /><path d="M -12 -288 Q -4 -300 2 -287 Q 10 -300 16 -286" fill="none" {...OUT} strokeWidth={5} /></g>),
    face: (p) => (<g><ellipse cx="0" cy="-210" rx="14" ry="10" fill="#4A3020" /><MouthX x={0} y={-196} w={30} p={p} /></g>),
    g: { eyeR: 14 },
  },
  tucan: {
    fur: '#2B2B35', furS: '#15151C', belly: '#FFF6D6', bellyS: '#EADFB8', feet: '#4FA3F7', feetS: '#2C7FD6', wing: true, tall: 300,
    g: { bellyRy: 52, bellyCy: -110 },
    headDeco: () => (<g><circle cx="-30" cy="-236" r="27" fill="#9BE15D" /><circle cx="30" cy="-236" r="27" fill="#9BE15D" /></g>),
    face: (p) => {
      const o = talking(p) ? 0.3 + 0.7 * p.mouth : 0;
      return (
        <g>
          <ellipse cx="0" cy="-180" rx="38" ry="52" fill="#FFC21A" {...OUT} />
          <ellipse cx="0" cy="-150" rx="31" ry="18" fill="#FF7A1A" />
          <ellipse cx="0" cy="-134" rx="17" ry="10" fill="#E8323C" />
          <ellipse cx="0" cy="-180" rx="38" ry="52" fill="none" {...OUT} />
          {o > 0 && <ellipse cx="0" cy="-176" rx="28" ry={4 + o * 10} fill="#8C2433" {...OUT} strokeWidth={4} />}
          <ellipse cx="-14" cy="-206" rx="8" ry="4" fill="#fff" opacity="0.6" />
        </g>
      );
    },
    cheek: '#FF9F1C',
  },
  vaca: {
    fur: '#FFFFFF', furS: '#DCD3C8', size: 1.08, tall: 320,
    deco: () => (<g><ellipse cx="-34" cy="-124" rx="20" ry="16" fill={INK} /><ellipse cx="38" cy="-72" rx="16" ry="13" fill={INK} /><path d="M -40 -164 Q 0 -150 40 -164" fill="none" stroke="#7B5CFF" strokeWidth="10" strokeLinecap="round" /><circle cx="0" cy="-146" r="15" fill="#FFD23F" {...OUT} strokeWidth={5} /></g>),
    ears: () => [-1, 1].map((s) => (<g key={s}><path d={`M ${44 * s} -280 Q ${54 * s} -310 ${38 * s} -322`} fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" /><path d={`M ${44 * s} -280 Q ${54 * s} -310 ${38 * s} -322`} fill="none" stroke="#FFF1D0" strokeWidth="9" strokeLinecap="round" /><ellipse cx={98 * s} cy={-246} rx="32" ry="15" fill="#fff" transform={`rotate(${-18 * s} ${98 * s} -246)`} {...OUT} /><ellipse cx={100 * s} cy={-246} rx="16" ry="6" fill="#FFB3C7" transform={`rotate(${-18 * s} ${100 * s} -246)`} /></g>)),
    headDeco: () => <ellipse cx="38" cy="-262" rx="22" ry="16" fill={INK} />,
    face: (p) => (
      <g>
        <Blob cx={0} cy={-186} rx={52} ry={32} fill="#FFB3C7" shade="#F293AF" hi={false} />
        <ellipse cx="-17" cy="-190" rx="7" ry="9" fill="#B8476A" /><ellipse cx="17" cy="-190" rx="7" ry="9" fill="#B8476A" />
        <MouthX x={0} y={-172} w={30} p={p} />
      </g>
    ),
  },
  perro: {
    fur: '#E9B15C', furS: '#C88E3A', belly: '#FFF2DC', bellyS: '#EAD8B8', tall: 300,
    back: (p, T) => <g transform={`rotate(${Math.sin(T * 9) * 16} 46 -60)`}><Blob cx={84} cy={-96} rx={15} ry={42} rot={40} fill="#E9B15C" shade="#C88E3A" hi={false} /></g>,
    deco: () => (<g><path d="M -48 -164 Q 0 -146 48 -164" fill="none" stroke="#FF3B3B" strokeWidth="14" strokeLinecap="round" /><circle cx="0" cy="-146" r="11" fill="#FFD23F" {...OUT} strokeWidth={4} /></g>),
    face: (p) => (
      <g>
        <Blob cx={0} cy={-196} rx={42} ry={28} fill="#FFF2DC" shade="#EAD8B8" hi={false} />
        <ellipse cx="0" cy="-214" rx="16" ry="11" fill={INK} />
        <MouthX x={0} y={-197} w={26} p={p} />
      </g>
    ),
    top: (p) => [-1, 1].map((s) => <Blob key={s} cx={80 * s} cy={-214 + p.ear * 0.6} rx={24} ry={54} rot={18 * s} fill="#A0622D" shade="#7E4A1E" hi={false} />),
  },
  gato: {
    fur: '#A8B0C4', furS: '#848DA4', belly: '#FFFFFF', bellyS: '#E3E6EE', tall: 320,
    back: (p, T) => <Tail d={`M 44 -40 Q 130 -40 ${120 + Math.sin(T * 2) * 10} -150 Q 116 -186 90 -180`} fill="#A8B0C4" w={18} />,
    ears: () => [-1, 1].map((s) => (<g key={s}><Tri d={`M ${-70 * s} -248 L ${-56 * s} -318 L ${-20 * s} -280 Z`} fill="#A8B0C4" /><path d={`M ${-58 * s} -262 L ${-54 * s} -298 L ${-34 * s} -278 Z`} fill="#FFB3C7" /></g>)),
    headDeco: () => <path d="M -12 -286 L -8 -268 M 0 -288 L 0 -266 M 12 -286 L 8 -268" fill="none" {...OUT} strokeWidth={6} />,
    face: (p) => (
      <g>
        <path d="M -48 -204 L -100 -212 M -48 -196 L -100 -192 M 48 -204 L 100 -212 M 48 -196 L 100 -192" fill="none" {...OUT} strokeWidth={4} />
        <path d="M -9 -212 L 9 -212 L 0 -202 Z" fill="#FF8FB0" {...OUT} strokeWidth={4} />
        {talking(p) ? <MouthX x={0} y={-196} w={24} p={p} /> : <path d="M -16 -194 Q -8 -184 0 -194 Q 8 -184 16 -194" fill="none" {...OUT} strokeWidth={5} />}
      </g>
    ),
  },
  mariposa: {
    fur: '#9F86FF', furS: '#7B5CFF', body: '#7B5CFF', bodyS: '#5B3FD6', size: 0.9, hover: 70, noFeet: true, tall: 320,
    g: { bodyRx: 40, bodyRy: 82, armX: 34, armLen: 50, armW: 14, handR: 10, headRx: 72, headRy: 62 },
    back: (p, T) => {
      const f = 0.72 + 0.28 * Math.sin(T * 7 + (p.seed || 0));
      return (
        <g transform={`scale(${f} 1)`}>
          {[-1, 1].map((s) => (
            <g key={s}>
              <ellipse cx={118 * s} cy={-170} rx="96" ry="74" fill="#FF6FB5" transform={`rotate(${-18 * s} ${118 * s} -170)`} {...OUT} />
              <circle cx={128 * s} cy={-176} r="26" fill="#FFD84D" {...OUT} strokeWidth={5} />
              <circle cx={88 * s} cy={-210} r="12" fill="#fff" />
              <ellipse cx={84 * s} cy={-76} rx="62" ry="50" fill="#FFD84D" transform={`rotate(${22 * s} ${84 * s} -76)`} {...OUT} />
              <circle cx={92 * s} cy={-72} r="14" fill="#2EC4B6" {...OUT} strokeWidth={4} />
            </g>
          ))}
        </g>
      );
    },
    top: (p, T) => <Antennae T={T} p={p} y={-278} tip="#FFD84D" />,
  },
};
Object.values(SPECIES).forEach((s) => { s.g = Object.assign({}, G0, s.g || {}); s.body = s.body || s.fur; s.bodyS = s.bodyS || s.furS; s.size = s.size || 1; });

function handPos(g, side, rot) { return { x: side * g.armX - g.armLen * Math.sin(rad(rot)), y: g.armY + g.armLen * Math.cos(rad(rot)) }; }
function Food({ kind, x, y, left }) {
  if (left <= 0.05) return null;
  const s = 0.4 + 0.6 * left;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {kind === 'zanahoria' && (<g><path d="M -14 -40 L 14 -40 L 0 30 Z" fill="#FF8A1F" {...OUT} strokeWidth={5} /><path d="M -6 -40 L -14 -64 M 0 -40 L 0 -68 M 6 -40 L 14 -64" stroke="#3FB34F" strokeWidth="8" strokeLinecap="round" /></g>)}
      {kind === 'banano' && <path d="M -30 -30 Q -24 20 30 24 Q -4 2 -18 -36 Z" fill="#FFD84D" {...OUT} strokeWidth={5} />}
      {kind === 'maiz' && (<g><ellipse cx="0" cy="-6" rx="14" ry="30" fill="#FFD23F" {...OUT} strokeWidth={5} /><path d="M -14 10 Q -22 30 -6 34 M 14 10 Q 22 30 6 34" fill="#7ED957" {...OUT} strokeWidth={4} /></g>)}
      {kind === 'lechuga' && <circle cx="0" cy="-6" r="26" fill="#7ED957" {...OUT} strokeWidth={5} />}
      {TRASH.includes(kind) && <TrashItem kind={kind} x={0} y={-6} s={1.1} rot={-10} />}
      {kind === 'manzana' && (<g><circle cx="0" cy="-4" r="24" fill="#FF3B3B" {...OUT} strokeWidth={5} /><path d="M 0 -26 Q 12 -40 22 -32" fill="#3FB34F" {...OUT} strokeWidth={4} /></g>)}
    </g>
  );
}

function TrashItem({ kind, x, y, s = 1, rot = 0, o = 1 }) {
  if (s <= 0.02) return null;
  const st = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' };
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      {kind === 'botella' && (<g><rect x="-15" y="-34" width="30" height="62" rx="12" fill="#CDEFFF" {...st} /><rect x="-15" y="-10" width="30" height="16" fill="#FF6FB5" {...st} /><rect x="-8" y="-46" width="16" height="13" rx="3" fill="#2F7DEB" {...st} /></g>)}
      {kind === 'lata' && (<g><rect x="-17" y="-28" width="34" height="56" rx="6" fill="#FF3B3B" {...st} /><ellipse cx="0" cy="-28" rx="17" ry="6" fill="#D9D9D9" {...st} /><path d="M -17 4 L 17 -6" stroke="#fff" strokeWidth="6" /></g>)}
      {kind === 'bolsa' && (<g><path d="M -30 -20 Q -36 30 0 32 Q 36 30 30 -20 Z" fill="#F4F4F4" {...st} /><path d="M -22 -20 Q -22 -46 -8 -30 M 22 -20 Q 22 -46 8 -30" fill="none" {...st} strokeWidth={5} /></g>)}
      {kind === 'papel' && <path d="M -26 -18 L -6 -24 L 4 -14 L 26 -20 L 20 4 L 28 18 L 4 22 L -10 14 L -28 20 L -20 0 Z" fill="#FFD84D" {...st} />}
    </g>
  );
}
// Basura de la escena: flota en el río o queda tirada en el suelo.
const TRASH_SPOTS = [[-700, -190], [520, -90], [-260, -150], [820, -60], [120, -210], [-980, -120], [360, -170], [-520, -70], [980, -140], [-60, -95]];
function SceneTrash({ sc, u, T }) {
  const n = [0, 3, 6, 10][sc.basura || 0];
  if (!n) return null;
  const k = sc.halfW / 960, river = sc.lugar === 'rio';
  return (
    <g>
      {TRASH_SPOTS.slice(0, n).map(([x, y], j) => {
        const gone = sc.limpiar ? EZ.glide(seg(u, 1 + ((j + 0.5) / n) * (sc.dur - 2.6), 1.6 + ((j + 0.5) / n) * (sc.dur - 2.6))) : 0;
        const yy = river ? y + Math.sin(T * 1.6 + j) * 6 : 30 + (j % 3) * 22;
        return <TrashItem key={j} kind={TRASH[j % 4]} x={x * k} y={yy} s={(river ? 1 : 1.15) * (1 - gone)} rot={river ? 70 + Math.sin(T * 1.2 + j * 2) * 12 : (j * 47) % 90 - 45} />;
      })}
    </g>
  );
}
function RecycleBins({ halfW }) {
  const cols = [['#2F7DEB', 'P'], ['#FFD23F', 'L'], ['#3FB34F', 'O']];
  const x0 = halfW - 170;
  return (
    <g>
      {cols.map(([c, l], j) => (
        <g key={j} transform={`translate(${x0 - j * 150} 0)`}>
          <path d="M -55 -150 L 55 -150 L 45 0 L -45 0 Z" fill={c} {...OUT} />
          <rect x="-64" y="-176" width="128" height="30" rx="10" fill={c} {...OUT} />
          <path d="M -20 -100 A 22 22 0 1 1 20 -100" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
          <path d="M 20 -100 l -12 -2 l 10 -10 z" fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function Character({ id, p, T }) {
  const sp = SPECIES[id] || SPECIES.conejo, g = sp.g;
  const k = sp.size * p.k * (p.pop == null ? 1 : p.pop);
  if (k <= 0.01) return null;
  const hover = sp.hover ? sp.hover + Math.sin(T * 2.2 + (p.seed || 0)) * 14 : 0;
  const yy = p.y + hover;
  const arm = (side, rot) => sp.wing
    ? (<g transform={`translate(${side * g.armX} ${g.armY}) rotate(${rot})`}><Blob cx={0} cy={g.armLen * 0.55} rx={24} ry={g.armLen * 0.68} fill={sp.body} shade={sp.bodyS} hi={false} /></g>)
    : <Arm x={side * g.armX} y={g.armY} rot={rot} len={g.armLen} w={g.armW} fill={sp.arm || sp.fur} hand={sp.hand} hr={g.handR} />;
  const hp = p.food ? handPos(g, 1, p.rArm) : null;
  return (
    <g>
      {!p.noShadow && <ellipse cx={p.x} cy={6} rx={Math.max(30, 80 - Math.min(yy, 220) * 0.18) * k} ry={12 * k} fill={INK} opacity="0.14" />}
      <g transform={`translate(${p.x} ${-yy}) rotate(${p.lean || 0}) scale(${p.dir * p.sx * k} ${p.sy * k})`}>
        {sp.back && sp.back(p, T)}
        {!sp.noFeet && [-1, 1].map((s) => <Blob key={s} cx={g.footDX * s} cy={-14} rx={36} ry={18} fill={sp.feet || sp.fur} shade={sp.feetS || sp.furS} hi={false} />)}
        <Blob cx={0} cy={g.bodyCy} rx={g.bodyRx} ry={g.bodyRy} fill={sp.body} shade={sp.bodyS} />
        {sp.belly && <Blob cx={0} cy={g.bellyCy} rx={g.bellyRx} ry={g.bellyRy} fill={sp.belly} shade={sp.bellyS} hi={false} />}
        {sp.deco && sp.deco(p, T)}
        {arm(-1, p.lArm)}
        {arm(1, p.rArm)}
        {hp && <Food kind={p.food} x={hp.x} y={hp.y} left={1 - p.bites * 0.3} />}
        <g transform={`rotate(${p.tilt} 0 ${g.headCy + 60})`}>
          {sp.ears && sp.ears(p, T)}
          <Blob cx={0} cy={g.headCy} rx={g.headRx} ry={g.headRy} fill={sp.fur} shade={sp.furS} />
          {sp.headDeco && sp.headDeco(p, T)}
          <EyeX x={-g.eyeDX} y={g.eyeY} r={g.eyeR} mode={p.eyes} look={p.look} />
          <EyeX x={g.eyeDX} y={g.eyeY} r={g.eyeR} mode={p.eyes} look={p.look} />
          <Cheeks y={g.cheekY} dx={g.cheekDX} c={sp.cheek} />
          {sp.face ? sp.face(p, T) : <MouthX x={0} y={g.mouthY} w={28} p={p} />}
          {sp.top && sp.top(p, T)}
        </g>
      </g>
    </g>
  );
}
const charTop = (m, p) => -((p.y || 0) + (SPECIES[m.id].hover || 0) + SPECIES[m.id].tall * SPECIES[m.id].size * m.k);

// ── Motion ───────────────────────────────────────────────────────────────
function hopAt(u, tr) {
  const { t0, t1, x0, x1, n, h } = tr;
  if (u <= t0) return { x: x0, y: 0, sx: 1, sy: 1, vy: 0 };
  if (u >= t1) return { x: x1, y: 0, sx: 1, sy: 1, vy: 0 };
  const d = (t1 - t0) / n, i = Math.min(n - 1, Math.floor((u - t0) / d)), q0 = (u - t0 - i * d) / d;
  const xa = lerp(x0, x1, i / n), xb = lerp(x0, x1, (i + 1) / n);
  if (q0 < 0.2) { const c = Math.sin((q0 / 0.2) * Math.PI); return { x: xa, y: 0, sx: 1 + 0.1 * c, sy: 1 - 0.14 * c, vy: 0, moving: true }; }
  if (q0 < 0.8) {
    const q = (q0 - 0.2) / 0.6, st = 1 - Math.sin(q * Math.PI);
    return { x: lerp(xa, xb, EZ.glide(q)), y: h * Math.sin(q * Math.PI), sx: 1 - 0.06 * st, sy: 1 + 0.1 * st, vy: Math.cos(q * Math.PI), moving: true };
  }
  const c = Math.sin(((q0 - 0.8) / 0.2) * Math.PI);
  return { x: xb, y: 0, sx: 1 + 0.12 * c, sy: 1 - 0.16 * c, vy: -0.6 * c, moving: true };
}
const landings = (tr) => { const d = (tr.t1 - tr.t0) / tr.n, o = []; for (let i = 0; i < tr.n; i++) o.push({ t: tr.t0 + i * d + d * 0.8, x: lerp(tr.x0, tr.x1, (i + 1) / tr.n) }); return o; };
const lastX = (m) => (m.tracks.length ? m.tracks[m.tracks.length - 1].x1 : m.x);

function memberPose(m, u, T, sc) {
  const p = { x: m.x, y: 0, sx: 1, sy: 1, dir: m.dir, lean: 0, rArm: -14, lArm: 14, tilt: 0, eyes: 'open', mood: 'smile', mouth: 0, look: m.look, ear: 0, k: m.k, pop: 1, seed: m.seed, bites: 0 };
  let tr = null;
  for (const t of m.tracks) if (u >= t.t0) tr = t;
  if (tr) {
    const h = hopAt(u, tr);
    Object.assign(p, { x: h.x, y: h.y, sx: h.sx, sy: h.sy, ear: h.vy * 14 });
    if (u < tr.t1 && tr.x1 !== tr.x0) { p.dir = tr.x1 > tr.x0 ? 1 : -1; p.look = 0.5; p.moving = true; }
  } else if (m.tracks.length) p.x = m.tracks[0].x0;
  p.sy *= 1 + 0.018 * Math.sin(T * 2.4 + m.seed);
  if (((T + m.seed) % 3.6) < 0.13) p.eyes = 'blink';
  if (m.entrance === 'aparece') { p.pop = EZ.pop(seg(u, m.enterT0, m.enterT0 + 0.45)); if (u < m.enterT0) p.hidden = true; }
  if (m.entrance === 'puerta') { p.rise = EZ.pop(seg(u, sc.doorOpen + 0.05, sc.doorOpen + 0.5)); if (u < sc.doorOpen) p.hidden = true; }
  const a = m.actStart, ua = u - a, on = u >= a;
  const wave = (w) => { p.rArm = lerp(p.rArm, -128 + 24 * Math.sin(T * Math.PI * 3.2), w); };
  switch (m.action) {
    case 'saludar': { const ph = ((ua % 5) + 5) % 5; wave(on ? EZ.settle(seg(ph, 0, 0.35)) * (1 - EZ.settle(seg(ph, 2.6, 3))) : 0); break; }
    case 'tocar': {
      const { ka, kb } = m.knock;
      const up = EZ.settle(seg(u, ka - 0.45, ka - 0.15)) * (1 - EZ.settle(seg(u, kb + 0.2, kb + 0.5)));
      p.rArm = lerp(p.rArm, -100 + 18 * (bump(u, ka - 0.1, ka + 0.1) + bump(u, kb - 0.1, kb + 0.1)), up);
      const w0 = sc.doorOpen + 0.7; wave(EZ.settle(seg(u, w0, w0 + 0.3)) * (1 - EZ.settle(seg(u, w0 + 2.4, w0 + 2.8))));
      break;
    }
    case 'hablar': if (on) { p.lArm = 20 + 24 * (0.5 + 0.5 * Math.sin(T * 4)); p.tilt = 3 * Math.sin(T * 2); } break;
    case 'bailar': {
      const d = on ? EZ.settle(seg(u, a, a + 0.4)) : 0;
      p.lean = 9 * Math.sin(T * Math.PI * 1.5) * d;
      p.rArm = lerp(p.rArm, -118 + 28 * Math.sin(T * Math.PI * 3), d);
      p.lArm = lerp(p.lArm, 118 + 28 * Math.sin(T * Math.PI * 3 + Math.PI), d);
      if (d > 0.5 && Math.sin(T * 1.3 + m.seed) > 0.2) p.eyes = 'happy';
      break;
    }
    case 'comer': {
      p.food = SPECIES[m.id].food || 'manzana';
      if (ua > 0.3) {
        const ph = (ua - 0.3) % 1.6, n = Math.floor((ua - 0.3) / 1.6);
        p.rArm = lerp(-30, 138, bump(ph, 0, 0.8));
        p.bites = Math.min(3, n + (ph > 0.4 ? 1 : 0));
        if (ph > 0.45 && ph < 1.4) { p.mouth = 0.28 * Math.abs(Math.sin(T * 14)); p.eyes = 'happy'; }
      } else p.rArm = -30;
      if (p.bites >= 3) p.food = null;
      break;
    }
    case 'recoger': {
      if (ua > 0.3) {
        const ph = (ua - 0.3) % 2.2, n = Math.floor((ua - 0.3) / 2.2);
        const down = EZ.settle(seg(ph, 0, 0.5)) * (1 - EZ.settle(seg(ph, 0.6, 1.0)));
        p.lean = 20 * down;
        p.rArm = ph < 0.6 ? lerp(-14, -40, down) : lerp(-40, -150, EZ.settle(seg(ph, 0.6, 1.0))) * (1 - EZ.settle(seg(ph, 1.7, 2.1))) + -14 * EZ.settle(seg(ph, 1.7, 2.1));
        if (ph > 0.55 && ph < 1.8) { p.food = TRASH[(n + m.i) % 4]; p.eyes = 'happy'; }
      }
      break;
    }
    case 'tirar': {
      const t0 = a + 0.3, rel = a + 1.0;
      if (u < rel) { p.food = m.objeto || TRASH[(sc.idx + m.i) % 4]; p.rArm = lerp(-14, 120, EZ.settle(seg(u, t0, rel - 0.15))); }
      else { const sw = seg(u, rel, rel + 0.25); p.rArm = sw < 1 ? lerp(120, -110, EZ.settle(sw)) : lerp(-110, -14, EZ.settle(seg(u, rel + 0.5, rel + 1.0))); p.lean = 10 * bump(u, rel - 0.1, rel + 0.5); }
      break;
    }
    case 'dormir': if (on) { p.eyes = 'sleep'; p.mood = 'sleep'; p.tilt = 10 * EZ.settle(seg(u, a, a + 1)); p.sy *= 1 + 0.03 * Math.sin(T * 1.8); p.rArm = 6; p.lArm = -6; } break;
    case 'reir': if (on && (ua % 3.5) < 2.2) { p.eyes = 'happy'; p.mood = 'laugh'; p.mouth = 0.6 + 0.4 * Math.abs(Math.sin(T * 12)); p.sx *= 1 + 0.03 * Math.sin(T * 24); p.tilt = -6 + 4 * Math.sin(T * 10); p.lArm = 40; } break;
    case 'correr': if (p.moving) { p.lean = 8 * p.dir; p.eyes = p.eyes === 'blink' ? 'blink' : 'happy'; p.rArm = 30 * Math.sin(T * 14); p.lArm = -30 * Math.sin(T * 14); } break;
    case 'asustarse': {
      const s = a + 0.3, sc2 = seg(u, s, s + 0.1) * (1 - seg(u, s + 1.4, s + 1.8));
      if (sc2 > 0) { p.eyes = 'wide'; p.mood = 'o'; p.rArm = lerp(p.rArm, -158, sc2); p.lArm = lerp(p.lArm, 158, sc2); }
      else if (u > s + 1.8 && u < s + 2.8) p.eyes = 'happy';
      break;
    }
  }
  if (m.hug != null || m.huggedAt != null) {
    const t = m.hug != null ? m.hug : m.huggedAt, up = EZ.settle(seg(u, t - 0.3, t));
    p.rArm = lerp(p.rArm, -112, up); p.lArm = lerp(p.lArm, 112, up);
    if (u > t) { p.eyes = 'happy'; if (u < t + 1.2) p.mood = 'laugh'; }
  }
  if (m.give != null) { const hold = 1 - EZ.settle(seg(u, m.give, m.give + 0.3)); p.rArm = lerp(p.rArm, 42, hold); p.lArm = lerp(p.lArm, -42, hold); }
  if (m.receiveAt != null) {
    const hold = EZ.settle(seg(u, m.receiveAt - 0.1, m.receiveAt + 0.2));
    p.rArm = lerp(p.rArm, 42, hold); p.lArm = lerp(p.lArm, -42, hold);
    if (u > m.receiveAt) { p.eyes = 'happy'; if (u < m.receiveAt + 1.3) p.mood = 'laugh'; }
  }
  if (m.speak && u >= m.speak[0] && u < m.speak[1] && p.eyes !== 'sleep') { p.mouth = Math.max(p.mouth, 0.25 + 0.6 * Math.abs(Math.sin(T * 13))); p.tilt += 3 * Math.sin(T * 6); }
  return p;
}

// ── Planning ─────────────────────────────────────────────────────────────
// nd = segundos de la narración grabada para esta escena (0 si no hay audio).
function planScene(raw, idx, fmt, age, nd = 0) {
  const baby = age !== 'ninos', pace = baby ? 1.12 : 1;
  const halfW = fmt.W / 2 / fmt.s;
  const cast = raw.personajes || [];
  const n = cast.length;
  const k = n > 3 ? (fmt.id === 'vertical' ? 0.62 : 0.82) : 1;
  const spacing = n > 1 ? Math.min(fmt.spacing, (halfW * 2 * 0.8) / n) : 0;
  const sc = { idx, lugar: raw.lugar, texto: raw.texto || '', palabra: raw.palabra || '', src: raw.src, kind: raw._title ? 'title' : raw._fin ? 'fin' : 'scene', events: [], basura: raw.basura || 0, sucia: !!raw.sucia, limpiar: !!raw.limpiar, botes: !!raw.botes };
  const ev = (t, s, a) => sc.events.push({ t, s, a });
  const members = cast.map((c, i) => {
    const x = (i - (n - 1) / 2) * spacing;
    const dir = x < -1 ? -1 : 1;
    return { id: c.id, action: c.accion, entrance: c.entrada, dice: c.dice, hacia: c.hacia, objeto: c.objeto, x, k, dir, look: (x < -1 ? 0.45 : x > 1 ? -0.45 : 0) * dir, seed: idx * 1.7 + i * 2.3, tracks: [], i };
  });
  let order = 0;
  members.forEach((m) => {
    if (m.entrance === 'izquierda' || m.entrance === 'derecha') {
      const from = m.entrance === 'izquierda' ? -halfW - 230 : halfW + 230;
      const hops = Math.max(2, Math.round(Math.abs(m.x - from) / 300));
      const t0 = 0.35 + order * 0.35, t1 = t0 + hops * 0.5 * pace;
      m.tracks.push({ t0, t1, x0: from, x1: m.x, n: hops, h: 80, snd: true });
      m.enterEnd = t1; order++;
    } else if (m.entrance === 'aparece') { m.enterT0 = 0.45 + order * 0.35; m.enterEnd = m.enterT0 + 0.5; order++; ev(m.enterT0, 'pop'); }
    else m.enterEnd = 0;
  });
  const knocker = members.find((m) => m.action === 'tocar');
  const inDoor = members.find((m) => m.entrance === 'puerta');
  members.forEach((m) => { if (m.action === 'tocar' && m !== knocker) m.action = 'saludar'; });
  if (knocker || inDoor) {
    let dx = inDoor ? inDoor.x : knocker.x + Math.max(spacing, 330);
    if (!inDoor && dx > halfW - 200) dx = knocker.x - Math.max(spacing, 330);
    sc.door = { x: dx, col: idx % 4 };
  }
  if (knocker) {
    const ke = knocker.enterEnd + 0.2, side = sc.door.x >= knocker.x ? 1 : -1, sx = sc.door.x - side * 215 * knocker.k;
    let t = ke;
    if (Math.abs(sx - knocker.x) > 30) { const hops = Math.max(1, Math.round(Math.abs(sx - knocker.x) / 260)); knocker.tracks.push({ t0: ke, t1: ke + hops * 0.5, x0: knocker.x, x1: sx, n: hops, h: 60, snd: true }); t += hops * 0.5; }
    knocker.dir = side; knocker.look = 0.5;
    const ka = t + 0.6, kb = ka + 0.42;
    knocker.knock = { ka, kb }; knocker.actStart = ke;
    sc.doorOpen = kb + 0.45; ev(ka, 'knock'); ev(kb, 'knock');
  } else if (inDoor) sc.doorOpen = 1.0;
  if (sc.door) ev(sc.doorOpen, 'door');
  if (inDoor) { inDoor.enterEnd = sc.doorOpen + 0.5; ev(sc.doorOpen + 0.1, 'pop'); }
  const entDone = Math.max(0, ...members.map((m) => m.enterEnd));
  members.forEach((m, i) => { if (m.actStart == null) m.actStart = m.enterEnd > 0 ? m.enterEnd + 0.2 : 0.4 + i * 0.2; });
  let oneShot = 0;
  members.forEach((m) => {
    if (m.action !== 'abrazar' && m.action !== 'regalo') return;
    const t = members.find((o) => o !== m && o.id === m.hacia) || members.filter((o) => o !== m).sort((A, B) => Math.abs(A.x - m.x) - Math.abs(B.x - m.x))[0];
    if (!t) { m.action = 'saludar'; return; }
    const start = Math.max(m.actStart, t.enterEnd + 0.2), side = t.x >= m.x ? 1 : -1;
    const sx = t.x - side * (m.action === 'abrazar' ? 150 : 215) * m.k;
    m.tracks.push({ t0: start, t1: start + 1.0, x0: lastX(m), x1: sx, n: 2, h: 55, snd: true });
    m.dir = side; m.look = 0.5; t.dir = -side; t.look = 0.5;
    const contact = start + 1.1;
    if (m.action === 'abrazar') { m.hug = contact; t.huggedAt = contact; m.hugT = t; ev(contact, 'hug'); }
    else { m.give = contact + 0.3; t.receiveAt = contact + 0.8; m.giftT = t; ev(contact + 0.8, 'tada'); }
    oneShot = Math.max(oneShot, contact + 2.4);
  });
  let st = Math.max(entDone, sc.doorOpen ? sc.doorOpen + 0.7 : 0) + 0.3;
  members.forEach((m) => {
    if (!m.dice) return;
    const len = clamp(1.4 + words(m.dice).length * 0.34, 1.9, 4.5) * pace;
    m.speak = [st, st + len]; ev(st, 'voz', { id: m.id, n: words(m.dice).length }); st += len + 0.25;
  });
  const capW = words(sc.texto).length;
  sc.cap = [0.4, 0.4 + capW * (baby ? 0.42 : 0.34)];
  // Con narración real, el subtítulo dura exactamente lo que dura el audio.
  if (nd > 0) { sc.narr = [0.4, 0.4 + nd]; if (capW) sc.cap = [0.4, 0.4 + nd]; }
  if (sc.kind === 'title') sc.ban = [0.35, 4.2];
  else if (sc.kind === 'fin') sc.ban = [1.0, 5.6];
  else if (sc.palabra) sc.ban = [inDoor ? sc.doorOpen + 0.35 : Math.max(0.9, entDone - 0.2), 0];
  if (sc.ban && !sc.ban[1]) sc.ban[1] = sc.ban[0] + 2.6;
  if (sc.ban) ev(sc.ban[0], 'chime');
  let dur = Math.max(baby ? 6 : 5, st + 0.6, sc.cap[1] + 1.3, sc.ban ? sc.ban[1] + 0.35 : 0, oneShot + 0.4, sc.doorOpen ? sc.doorOpen + 2.8 : 0, entDone + 2.2);
  if (sc.kind === 'title') dur = 4.6;
  if (sc.kind === 'fin') dur = 6;
  dur = Math.min(dur, 15);
  // La escena nunca termina antes que su narración (deja 0.7 s de respiro al final).
  if (sc.narr) dur = Math.max(dur, sc.narr[1] + 0.7);
  dur = Math.round(dur * 10) / 10;
  sc.dur = dur;
  members.forEach((m) => {
    const a = m.actStart, x = lastX(m), end = dur - 0.4;
    const rep = (per, h, snd) => { const nn = Math.floor((end - a) / per); if (nn >= 1) m.tracks.push({ t0: a, t1: a + nn * per, x0: x, x1: x, n: nn, h, snd }); };
    if (m.action === 'saltar') rep(1.0 * pace, 85, true);
    if (m.action === 'caminar') rep(0.6, 26);
    if (m.action === 'bailar') rep(0.85, 34);
    if (m.action === 'correr') {
      const R = Math.min(Math.max(spacing * 0.45, 150), 230); let t = a, i = 0, from = x;
      while (t + 1.1 <= end) { const to = x + (i % 2 ? -R : R); m.tracks.push({ t0: t, t1: t + 1.1, x0: from, x1: to, n: 3, h: 38 }); from = to; t += 1.1; i++; }
    }
    if (m.action === 'tirar') { ev(a + 1.0, 'swish'); ev(a + 1.8, 'pop'); }
    if (m.action === 'recoger') for (let t = a + 0.3 + 0.9; t < dur - 0.3; t += 2.2) ev(t, 'pop');
    if (m.action === 'asustarse') { m.tracks.push({ t0: a + 0.3, t1: a + 0.85, x0: x, x1: x, n: 1, h: 120 }); ev(a + 0.3, 'boing'); }
    if (m.receiveAt != null) m.tracks.push({ t0: m.receiveAt + 0.1, t1: m.receiveAt + 0.7, x0: x, x1: x, n: 1, h: 60 });
    if (m.action === 'comer') for (let b = 0; b < 3; b++) ev(a + 0.3 + 0.45 + b * 1.6, 'nom');
    if (m.action === 'dormir') for (let t = a + 1; t < dur; t += 2.6) ev(t, 'snore');
    if (m.action === 'reir') for (let t = a; t < dur - 0.5; t += 3.5) ev(t, 'laugh');
    m.tracks.sort((A, B) => A.t0 - B.t0);
    m.tracks.forEach((tr) => { if (tr.snd) landings(tr).forEach((l) => ev(l.t, 'land')); });
  });
  if (idx > 0) ev(0.02, 'swish');
  sc.members = members; sc.knocker = knocker; sc.halfW = halfW; sc.spacing = spacing;
  return sc;
}

// narr = { titulo: s, escenas: [s, ...] } con la duración de cada audio de narración (opcional).
function planStory(story, fmt, age, narr) {
  const st = sanitizeStory(story);
  const list = [];
  const esc = st.escenas.length ? st.escenas : [{ lugar: 'pueblito', texto: '', palabra: '', personajes: [{ id: 'conejo', accion: 'saludar', entrada: 'aparece' }] }];
  const first = esc[0], last = esc[esc.length - 1];
  list.push({ _title: true, lugar: first.lugar, palabra: st.titulo.toUpperCase(), personajes: [{ id: (first.personajes[0] || {}).id || 'conejo', accion: 'saludar', entrada: 'aparece' }] });
  esc.forEach((e, i) => list.push(Object.assign({}, e, { src: i })));
  const ids = [];
  esc.forEach((e) => e.personajes.forEach((c) => { if (!ids.includes(c.id)) ids.push(c.id); }));
  list.push({ _fin: true, lugar: last.lugar, palabra: '¡FIN!', personajes: (ids.length ? ids : ['conejo']).slice(0, 5).map((id) => ({ id, accion: 'bailar', entrada: 'aparece' })) });
  let t = 0;
  const scenes = list.map((raw, i) => {
    const nd = !narr ? 0 : raw._title ? Number(narr.titulo) || 0 : raw._fin ? 0 : Number((narr.escenas || [])[raw.src]) || 0;
    const sc = planScene(raw, i, fmt, age, nd);
    sc.start = t; t += sc.dur;
    sc.label = sc.kind === 'title' ? 'Título' : sc.kind === 'fin' ? 'Fin' : `${sc.src + 1} · ${PLACES[sc.lugar]}`;
    return sc;
  });
  const events = [];
  scenes.forEach((sc) => sc.events.forEach((e) => events.push({ t: sc.start + e.t, s: e.s, a: e.a })));
  events.sort((A, B) => A.t - B.t);
  return { scenes, total: Math.round(t * 10) / 10, events, key: st.id };
}

// ── Scenery ─────────────────────────────────────────────────────────────
const SKY = { pueblito: ['#3FA9F0', '#BDEBFF'], bosque: ['#45C2B8', '#D6F7E4'], rio: ['#46B4F5', '#CDEFFF'], playa: ['#2FB8F2', '#FFE6B0'], mercado: ['#5CC1F2', '#FFEFC6'], noche: ['#3550B8', '#8E7BE0'] };
const GROUND = { pueblito: '#6CC04A', bosque: '#58B045', rio: '#6CC04A', playa: '#FFE2A0', mercado: '#EBCB92', casa: '#D99A5B', noche: '#3E9E74' };
const HOUSE_COL = [
  { wall: '#FFD84D', roof: '#FF6B6B', door: '#2EC4B6', doorS: '#1E9A8F' },
  { wall: '#FF9EC7', roof: '#7B5CFF', door: '#FFD84D', doorS: '#E2B92E' },
  { wall: '#7EE0C3', roof: '#FF8C42', door: '#FF5D8F', doorS: '#D93E6F' },
  { wall: '#B9A6FF', roof: '#3FA34D', door: '#FFB020', doorS: '#DB8E0B' },
];

function Sky({ kind, fmt, T, id }) {
  const { W, H } = fmt, V = fmt.id === 'vertical';
  if (kind === 'casa') {
    return (
      <g>
        <defs><pattern id={`dt-${id}`} width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="30" cy="30" r="7" fill="#FFC96B" /></pattern></defs>
        <rect width={W} height={H} fill="#FFE3A3" /><rect width={W} height={H} fill={`url(#dt-${id})`} />
      </g>
    );
  }
  const [a, b] = SKY[kind] || SKY.pueblito, night = kind === 'noche';
  const sx = V ? W * 0.2 : W * 0.1, sy = V ? H * 0.085 : H * 0.15, mx = V ? W * 0.76 : W * 0.85, my = V ? H * 0.09 : H * 0.17;
  return (
    <g>
      <defs>
        <linearGradient id={`sk-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
        <pattern id={`dt-${id}`} width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="3.2" fill="#fff" opacity={night ? 0.08 : 0.2} /></pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#sk-${id})`} />
      <rect width={W} height={H} fill={`url(#dt-${id})`} />
      {night ? (
        <g>
          {Array.from({ length: 28 }).map((_, j) => {
            const x = ((j * 397) % 1000) / 1000 * W, y = ((j * 613) % 1000) / 1000 * H * 0.55, tw = 0.6 + 0.4 * Math.sin(T * 2 + j);
            return <path key={j} transform={`translate(${x} ${y}) scale(${tw * (j % 3 ? 0.7 : 1.1)})`} d="M 0 -18 Q 4 -4 18 0 Q 4 4 0 18 Q -4 4 -18 0 Q -4 -4 0 -18 Z" fill="#FFF3B0" {...OUT} strokeWidth={3} />;
          })}
          <g transform={`translate(${mx} ${my})`}>
            <circle r="100" fill="#FFF3B0" opacity="0.25" /><circle r="80" fill="#FFF3B0" {...OUT} />
            <circle cx="30" cy="-30" r="12" fill="#F2DE8A" /><circle cx="-34" cy="26" r="8" fill="#F2DE8A" />
            <path d="M -32 -6 Q -22 2 -12 -6 M 12 -6 Q 22 2 32 -6" fill="none" {...OUT} /><path d="M -16 22 Q 0 34 16 22" fill="none" {...OUT} />
            <Cheeks y={12} dx={42} c="#FFB3C7" />
          </g>
        </g>
      ) : (
        <g transform={`translate(${sx} ${sy})`}>
          {Array.from({ length: 10 }).map((_, j) => <path key={j} transform={`rotate(${j * 36 + T * 6})`} d="M -14 -96 L 0 -132 L 14 -96 Z" fill="#FFD23F" {...OUT} strokeWidth={5} />)}
          <circle r="84" fill="#FFD23F" {...OUT} />
          <path d="M -36 -10 Q -26 -22 -16 -10 M 16 -10 Q 26 -22 36 -10" fill="none" {...OUT} />
          <path d="M -22 18 Q 0 38 22 18" fill="none" {...OUT} />
          <Cheeks y={10} dx={46} c="#FF8A3D" />
        </g>
      )}
    </g>
  );
}
function Cloud({ x, y, s, c = '#fff' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -120 30 Q -150 30 -150 0 Q -150 -34 -110 -34 Q -100 -80 -50 -74 Q -20 -118 30 -96 Q 70 -120 100 -80 Q 150 -84 152 -36 Q 186 -20 160 30 Z" fill={c} {...OUT} />
    </g>
  );
}
function Tree({ x, s = 1, c1 = '#3FB34F', c2 = '#4CC35C', fruit = '#FF5D8F' }) {
  return (
    <g transform={`translate(${x} 0) scale(${s})`}>
      <path d="M -20 0 L -14 -170 L 14 -170 L 20 0 Z" fill="#9C6B3F" {...OUT} />
      <circle cx="-60" cy="-230" r="70" fill={c1} {...OUT} /><circle cx="60" cy="-230" r="70" fill={c1} {...OUT} />
      <circle cx="0" cy="-300" r="85" fill={c2} {...OUT} />
      <circle cx="-30" cy="-330" r="18" fill="#fff" opacity="0.3" />
      {fruit && <g><circle cx="40" cy="-250" r="10" fill={fruit} {...OUT} strokeWidth={4} /><circle cx="-56" cy="-210" r="10" fill={fruit} {...OUT} strokeWidth={4} /></g>}
    </g>
  );
}
function Flower({ x, y = 26, c }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1="0" y1="0" x2="0" y2="-26" stroke={INK} strokeWidth="5" />
      {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.sin(rad(a)) * 11} cy={-30 - Math.cos(rad(a)) * 11} r="9" fill={c} {...OUT} strokeWidth={4} />)}
      <circle cx="0" cy="-30" r="7" fill="#FFD84D" {...OUT} strokeWidth={4} />
    </g>
  );
}
function BgHouse({ x, s = 0.8, c, lit }) {
  return (
    <g transform={`translate(${x} 0) scale(${s})`}>
      <rect x="-190" y="-340" width="380" height="340" rx="18" fill={c.wall} {...OUT} />
      <path d="M -238 -318 L -20 -512 Q 0 -528 20 -512 L 238 -318 Z" fill={c.roof} {...OUT} />
      <path d="M -100 0 L -100 -170 A 70 70 0 0 1 40 -170 L 40 0 Z" fill={c.door} {...OUT} />
      <circle cx="112" cy="-210" r="46" fill={lit ? '#FFE27A' : '#BDEBFF'} {...OUT} />
      <path d="M 112 -256 L 112 -164 M 66 -210 L 158 -210" {...OUT} />
    </g>
  );
}
function Palm({ x, s = 1, flip = 1 }) {
  return (
    <g transform={`translate(${x} 0) scale(${s * flip} ${s})`}>
      <path d="M -18 0 Q 0 -200 60 -420 L 90 -414 Q 34 -200 22 0 Z" fill="#B8834F" {...OUT} />
      {[-150, -110, -60, -20, 20].map((a, j) => <path key={j} transform={`translate(76 -420) rotate(${a})`} d="M 0 0 Q 90 -40 190 10 Q 90 -6 0 0 Z" fill={j % 2 ? '#3FB34F' : '#4CC35C'} {...OUT} />)}
      <circle cx="64" cy="-400" r="16" fill="#8B5A3C" {...OUT} strokeWidth={5} /><circle cx="90" cy="-396" r="16" fill="#8B5A3C" {...OUT} strokeWidth={5} />
    </g>
  );
}
function Stall({ x, c1, c2, fruits }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <path d="M -170 0 L -170 -330 M 170 0 L 170 -330" {...OUT} strokeWidth={14} />
      <path d="M -170 0 L -170 -330 M 170 0 L 170 -330" stroke="#B8834F" strokeWidth="6" />
      <rect x="-200" y="-150" width="400" height="150" rx="10" fill="#C98B4E" {...OUT} />
      <path d="M -200 -100 L 200 -100 M -200 -50 L 200 -50" stroke="#A86F38" strokeWidth="6" />
      {fruits.map((f, j) => <circle key={j} cx={-150 + j * 50} cy={-170} r="24" fill={f} {...OUT} strokeWidth={5} />)}
      <path d="M -220 -330 L 220 -330 L 200 -420 L -200 -420 Z" fill={c1} {...OUT} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => <path key={j} d={`M ${-220 + j * 55} -330 q 27.5 40 55 0`} fill={j % 2 ? c1 : c2} {...OUT} strokeWidth={5} />)}
    </g>
  );
}
function Backdrop({ kind, T, W, sucia }) {
  const gnd = GROUND[kind] || GROUND.pueblito;
  const ground = (<g><rect x={-W - 400} y="0" width={W * 2 + 800} height="1600" fill={gnd} /><path d={`M ${-W - 400} 0 L ${W + 400} 0`} {...OUT} /></g>);
  const clouds = (c) => (<g><Cloud x={-560 + Math.sin(T * 0.12) * 60} y={-640} s={1} c={c} /><Cloud x={420 - Math.sin(T * 0.1) * 50} y={-700} s={0.85} c={c} /><Cloud x={-150} y={-980} s={0.9} c={c} /><Cloud x={1300} y={-620} s={0.9} c={c} /></g>);
  const hills = (c1, c2) => [-1400, -700, 0, 700, 1400].map((hx, j) => <ellipse key={hx} cx={hx} cy="40" rx="560" ry={j % 2 ? 250 : 200} fill={j % 2 ? c1 : c2} {...OUT} />);
  switch (kind) {
    case 'bosque':
      return (
        <g>
          {clouds('#fff')}
          {Array.from({ length: 14 }).map((_, j) => <Tree key={j} x={-1700 + j * 260} s={0.75} c1="#7ED98A" c2="#8FE39A" fruit={null} />)}
          {ground}
          <path d="M -300 -900 L -180 -900 L 120 0 L -160 0 Z M 360 -900 L 440 -900 L 640 0 L 460 0 Z" fill="#fff" opacity="0.13" />
          <Tree x={-760} s={1.15} c1="#2E9E44" c2="#3FB34F" fruit="#FFD23F" /><Tree x={800} s={1.2} c1="#2E9E44" c2="#3FB34F" fruit="#FFD23F" />
          {[[-470, '#FF4B4B'], [560, '#FF6FB5']].map(([mx, mc]) => (
            <g key={mx} transform={`translate(${mx} 0)`}><rect x="-14" y="-60" width="28" height="60" rx="10" fill="#FFF5E6" {...OUT} strokeWidth={5} /><path d="M -56 -54 Q -50 -112 0 -116 Q 50 -112 56 -54 Z" fill={mc} {...OUT} strokeWidth={5} /><circle cx="-18" cy="-86" r="8" fill="#fff" /><circle cx="16" cy="-94" r="6" fill="#fff" /></g>
          ))}
          {[-1200, 1250].map((bx) => <g key={bx}><circle cx={bx - 50} cy="-40" r="60" fill="#3FB34F" {...OUT} /><circle cx={bx + 40} cy="-50" r="70" fill="#4CC35C" {...OUT} /></g>)}
        </g>
      );
    case 'rio':
      return (
        <g>
          {clouds('#fff')}
          <rect x={-W - 400} y="-300" width={W * 2 + 800} height="320" fill="#7ED957" />
          <path d={`M ${-W - 400} -300 L ${W + 400} -300`} {...OUT} />
          {[-1300, -700, 650, 1200].map((tx) => <Tree key={tx} x={tx} s={0.55} fruit={null} />)}
          <rect x={-W - 400} y="-250" width={W * 2 + 800} height="230" fill={sucia ? '#8A8F5E' : '#3FA9F0'} />
          <path d={`M ${-W - 400} -250 L ${W + 400} -250`} {...OUT} />
          {[-200, -140, -80].map((wy, j) => (
            <path key={wy} d={Array.from({ length: 22 }).map((_, q) => `${q ? 'L' : 'M'} ${-W - 300 + q * 140 + ((T * 40 * (j % 2 ? -1 : 1)) % 140)} ${wy + (q % 2 ? 10 : -10)}`).join(' ')} fill="none" stroke={sucia ? '#B5B88C' : '#BDEBFF'} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {[[-520, -120], [380, -170], [900, -90]].map(([lx, ly]) => <g key={lx} transform={`translate(${lx + Math.sin(T + lx) * 6} ${ly})`}><ellipse rx="50" ry="16" fill={sucia ? '#8C8A4A' : '#3FB34F'} {...OUT} strokeWidth={5} />{!sucia && <circle cx="10" cy="-8" r="10" fill="#FF6FB5" {...OUT} strokeWidth={4} />}</g>)}
          <rect x={-W - 400} y="-20" width={W * 2 + 800} height="1600" fill={gnd} />
          <path d={`M ${-W - 400} -20 Q -600 -40 0 -20 T ${W + 400} -20`} fill="none" {...OUT} />
          {[-980, 1000].map((rx) => <g key={rx}><path d={`M ${rx} 0 L ${rx - 10} -120 M ${rx + 20} 0 L ${rx + 30} -140 M ${rx + 44} 0 L ${rx + 48} -100`} stroke="#2E9E44" strokeWidth="10" strokeLinecap="round" /><ellipse cx={rx - 10} cy="-130" rx="10" ry="22" fill="#8B5A3C" {...OUT} strokeWidth={4} /></g>)}
        </g>
      );
    case 'playa':
      return (
        <g>
          {clouds('#fff')}
          <rect x={-W - 400} y="-320" width={W * 2 + 800} height="320" fill="#2EC4E6" />
          <path d={`M ${-W - 400} -320 L ${W + 400} -320`} {...OUT} />
          <g transform={`translate(${520 + Math.sin(T * 0.3) * 40} ${-330 + Math.sin(T * 1.4) * 5})`}><path d="M -70 0 L 70 0 L 50 30 L -50 30 Z" fill="#FF6B6B" {...OUT} strokeWidth={5} /><path d="M 0 0 L 0 -110 L 60 -10 Z" fill="#fff" {...OUT} strokeWidth={5} /></g>
          {[-250, -170, -100].map((wy, j) => <path key={wy} d={Array.from({ length: 24 }).map((_, q) => `${q ? 'L' : 'M'} ${-W - 300 + q * 130 + ((T * 30) % 130)} ${wy + (q % 2 ? 9 : -9)}`).join(' ')} fill="none" stroke="#BDF3FF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity={0.9 - j * 0.2} />)}
          <rect x={-W - 400} y="-60" width={W * 2 + 800} height="1700" fill={gnd} />
          <path d={`M ${-W - 400} -60 Q -700 -${80 + Math.sin(T * 1.2) * 10} 0 -60 T ${W + 400} -60`} fill="#FFF7E0" {...OUT} />
          <Palm x={-980} s={1.05} /><Palm x={1000} s={1} flip={-1} />
          <g transform="translate(700 0)"><rect x="-70" y="-70" width="140" height="70" fill="#F2C46B" {...OUT} /><rect x="-40" y="-130" width="80" height="60" fill="#F2C46B" {...OUT} /><path d="M 0 -130 L 0 -180 L 30 -166 L 0 -152" fill="#FF6B6B" {...OUT} strokeWidth={4} /></g>
        </g>
      );
    case 'mercado':
      return (
        <g>
          {clouds('#fff')}
          <path d={`M ${-W - 300} -600 Q 0 -500 ${W + 300} -600`} fill="none" stroke={INK} strokeWidth="5" />
          {Array.from({ length: 22 }).map((_, j) => { const x = -W - 200 + j * ((W * 2 + 400) / 22), y = -600 + 100 * (1 - Math.pow((x / (W + 300)), 2)); return <path key={j} d={`M ${x - 26} ${y - 4} L ${x + 26} ${y - 4} L ${x} ${y + 46} Z`} fill={['#FF6B6B', '#FFD84D', '#2EC4B6', '#7B5CFF'][j % 4]} {...OUT} strokeWidth={4} />; })}
          <Stall x={-820} c1="#FF6B6B" c2="#fff" fruits={['#FF3B3B', '#FF9F1C', '#FFD84D', '#7ED957', '#FF3B3B', '#FF9F1C', '#FFD84D']} />
          <Stall x={820} c1="#2EC4B6" c2="#fff" fruits={['#7ED957', '#FFD84D', '#FF6FB5', '#FF9F1C', '#7ED957', '#FFD84D', '#FF6FB5']} />
          <Stall x={0} c1="#7B5CFF" c2="#FFD84D" fruits={['#FF9F1C', '#FF3B3B', '#7ED957', '#FFD84D', '#FF9F1C', '#FF3B3B', '#7ED957']} />
          {ground}
          {[-1, 1].map((s) => <path key={s} d={`M ${s * 300} 0 L ${s * 520} 260`} stroke="#D9B276" strokeWidth="8" />)}
        </g>
      );
    case 'casa':
      return (
        <g>
          <rect x={-W - 400} y="-200" width={W * 2 + 800} height="200" fill="#FFB86B" />
          <path d={`M ${-W - 400} -200 L ${W + 400} -200`} {...OUT} />
          <g transform="translate(-620 -560)"><rect x="-150" y="-130" width="300" height="260" rx="20" fill="#9FDcFF" {...OUT} /><Cloud x={-30} y={20} s={0.5} /><path d="M 0 -130 L 0 130 M -150 0 L 150 0" {...OUT} /><path d="M -170 -150 Q -120 -40 -170 140 L -200 140 L -200 -150 Z M 170 -150 Q 120 -40 170 140 L 200 140 L 200 -150 Z" fill="#FF6FB5" {...OUT} /></g>
          <g transform="translate(520 -560)"><rect x="-90" y="-80" width="180" height="160" rx="10" fill="#FFF5E6" stroke="#C98B4E" strokeWidth="16" /><rect x="-90" y="-80" width="180" height="160" rx="10" fill="none" {...OUT} /><path d="M 0 30 C -60 -10 -40 -60 0 -30 C 40 -60 60 -10 0 30 Z" fill="#FF3B3B" {...OUT} strokeWidth={5} /></g>
          <g transform="translate(1120 0)"><rect x="-120" y="-180" width="240" height="24" rx="8" fill="#C98B4E" {...OUT} /><path d="M -90 -156 L -100 0 M 90 -156 L 100 0" {...OUT} strokeWidth={14} /><path d="M -90 -156 L -100 0 M 90 -156 L 100 0" stroke="#C98B4E" strokeWidth="6" /><path d="M -30 -180 L -40 -240 L 40 -240 L 30 -180 Z" fill="#FF8C42" {...OUT} strokeWidth={5} /><circle cx="0" cy="-270" r="34" fill="#3FB34F" {...OUT} strokeWidth={5} /></g>
          <rect x={-W - 400} y="0" width={W * 2 + 800} height="1600" fill={gnd} />
          <path d={`M ${-W - 400} 0 L ${W + 400} 0`} {...OUT} />
          {[-1600, -1200, -800, -400, 0, 400, 800, 1200, 1600].map((px) => <path key={px} d={`M ${px} 0 L ${px * 1.5} 600`} stroke="#C0824A" strokeWidth="6" />)}
          <ellipse cx="0" cy="60" rx="700" ry="70" fill="#FF6FB5" {...OUT} />
          <ellipse cx="0" cy="60" rx="600" ry="48" fill="none" stroke="#FFD84D" strokeWidth="8" strokeDasharray="20 18" />
        </g>
      );
    case 'noche':
      return (
        <g>
          <Cloud x={-560} y={-640} s={0.9} c="#B9B0F5" /><Cloud x={500} y={-720} s={0.75} c="#B9B0F5" />
          {hills('#2F8466', '#3F9C78')}
          <BgHouse x={-760} c={HOUSE_COL[1]} lit /><BgHouse x={780} c={HOUSE_COL[3]} lit />
          {ground}
          {Array.from({ length: 9 }).map((_, j) => { const fx = -900 + j * 230 + Math.sin(T * 0.8 + j) * 40, fy = -120 - (j % 3) * 90 + Math.cos(T * 1.1 + j * 2) * 30; return <g key={j}><circle cx={fx} cy={fy} r="18" fill="#FFF3B0" opacity={0.25 + 0.2 * Math.sin(T * 3 + j)} /><circle cx={fx} cy={fy} r="7" fill="#FFF3B0" /></g>; })}
        </g>
      );
    default:
      return (
        <g>
          {clouds('#fff')}
          {hills('#8ED65F', '#A3E070')}
          <Tree x={-1280} s={1} /><Tree x={1300} s={1.05} />
          <BgHouse x={-760} c={HOUSE_COL[0]} /><BgHouse x={780} c={HOUSE_COL[2]} />
          {ground}
          <rect x={-W - 400} y="34" width={W * 2 + 800} height="80" fill="#F2D38D" />
          <path d={`M ${-W - 400} 34 L ${W + 400} 34 M ${-W - 400} 114 L ${W + 400} 114`} {...OUT} />
        </g>
      );
  }
}
function Foreground({ kind }) {
  if (kind === 'casa' || kind === 'playa' || kind === 'mercado') {
    if (kind === 'playa') return <g>{[[-560, 70, '#FF6FB5'], [300, 120, '#FF9F1C'], [-200, 200, '#fff']].map(([x, y, c]) => <path key={x} transform={`translate(${x} ${y})`} d="M 0 -22 L 6 -6 L 22 -6 L 9 4 L 14 20 L 0 10 L -14 20 L -9 4 L -22 -6 L -6 -6 Z" fill={c} {...OUT} strokeWidth={4} />)}</g>;
    return null;
  }
  const cs = ['#FF5D8F', '#fff', '#FF9F1C', '#7B5CFF'];
  return <g>{[-1100, -640, -330, 380, 700, 1160].map((x, j) => <Flower key={x} x={x} y={kind === 'pueblito' ? 24 : 40} c={kind === 'noche' ? '#B9B0F5' : cs[j % 4]} />)}</g>;
}
function Casita({ x, open, shake, c, id, children }) {
  const dl = x - 125, dr = x + 125, ac = -235;
  const arch = `M ${dl} 0 L ${dl} ${ac} A 125 125 0 0 1 ${dr} ${ac} L ${dr} 0 Z`;
  const sx = lerp(1, -0.3, open);
  return (
    <g>
      <rect x={x - 230} y="-440" width="460" height="440" rx="20" fill={c.wall} {...OUT} />
      <path d={`M ${x - 284} -414 Q ${x - 296} -438 ${x - 270} -454 L ${x - 22} -640 Q ${x} -656 ${x + 22} -640 L ${x + 270} -454 Q ${x + 296} -438 ${x + 284} -414 Z`} fill={c.roof} {...OUT} />
      <path d={`M ${x - 170} -500 Q ${x - 80} -570 ${x - 30} -604`} stroke="#fff" strokeWidth="10" strokeLinecap="round" opacity="0.4" fill="none" />
      <path d={arch} fill="#8A5530" {...OUT} />
      <ellipse cx={x} cy="-150" rx="80" ry="120" fill="#B77845" opacity="0.6" />
      <defs><clipPath id={id}><path d={arch} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>{children}</g>
      <g transform={`translate(${dl + shake} 0) scale(${sx} 1) translate(${-dl} 0)`}>
        <path d={arch} fill={sx < 0 ? c.doorS : c.door} {...OUT} />
        <path d={`M ${x - 40} -300 L ${x - 40} -14 M ${x + 40} -300 L ${x + 40} -14`} stroke={c.doorS} strokeWidth="8" strokeLinecap="round" />
        <circle cx={dr - 28} cy="-140" r="13" fill="#FFD84D" {...OUT} strokeWidth={5} />
      </g>
      <rect x={dl - 24} y="-8" width="298" height="22" rx="10" fill="#E7D3B0" {...OUT} />
    </g>
  );
}

// ── Effects ─────────────────────────────────────────────────────────────
function Burst({ cx, cy, t, color }) {
  if (t <= 0 || t >= 1) return null;
  const k = EZ.settle(t), op = 1 - t, rays = [], stars = [];
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2 + 0.2, r0 = 150 + k * 40, r1 = 190 + k * 110;
    rays.push(<line key={j} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0 * 0.9} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1 * 0.9} stroke={INK} strokeWidth={10 * op + 2} strokeLinecap="round" />);
  }
  for (let j = 0; j < 6; j++) {
    const a = -Math.PI / 2 + (j - 2.5) * 0.55, r = 140 + k * 200, sc = (1 - t * 0.6) * (j % 2 ? 0.8 : 1.1);
    stars.push(<path key={j} transform={`translate(${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r * 0.8}) rotate(${t * 180 + j * 30}) scale(${sc})`} d="M 0 -24 Q 5 -5 24 0 Q 5 5 0 24 Q -5 5 -24 0 Q -5 -5 0 -24 Z" fill={j % 2 ? '#fff' : color} {...OUT} strokeWidth={4} />);
  }
  return <g opacity={Math.min(1, op * 2)}>{rays}{stars}</g>;
}
function FxBubble({ x, y, t, text, size = 1, fill = '#fff', color = '#FF3B3B' }) {
  if (t <= 0 || t >= 1) return null;
  const s = EZ.pop(seg(t, 0, 0.3)) * (1 - EZ.glide(seg(t, 0.8, 1))) * size, pts = [];
  const rx = Math.max(1.35, text.length * 0.26);
  for (let j = 0; j < 22; j++) { const a = (j / 22) * Math.PI * 2, r = j % 2 ? 62 : 88; pts.push(`${Math.cos(a) * r * rx},${Math.sin(a) * r}`); }
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${-6 + Math.sin(t * 9) * 3})`}>
      <polygon points={pts.join(' ')} fill={fill} {...OUT} />
      <text x="0" y="16" textAnchor="middle" fontFamily={FD} fontSize="54" fill={color} stroke={INK} strokeWidth="8" paintOrder="stroke" strokeLinejoin="round">{text}</text>
    </g>
  );
}
function wrap(text, max) {
  const out = []; let line = '';
  words(text).forEach((w) => { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); });
  if (line) out.push(line);
  return out.slice(0, 3);
}
function Speech({ x, y, t, text, fs, halfW, cx }) {
  if (t <= 0 || t >= 1) return null;
  const lines = wrap(text, 16), lw = Math.max(...lines.map((l) => l.length));
  const bw = lw * fs * 0.56 + 70, bh = lines.length * fs * 1.15 + 44;
  const bx = clamp(x, -halfW + bw / 2 + 24, halfW - bw / 2 - 24), by = y - bh / 2 - 40;
  const s = EZ.pop(seg(t, 0, 0.18)) * (1 - EZ.glide(seg(t, 0.88, 1)));
  const tx = clamp(cx - bx, -bw / 2 + 40, bw / 2 - 40);
  return (
    <g transform={`translate(${bx} ${by + Math.sin(t * 8) * 3}) scale(${s})`}>
      <path d={`M ${tx - 22} ${bh / 2 - 6} L ${tx + (cx > bx ? 34 : -34)} ${bh / 2 + 44} L ${tx + 22} ${bh / 2 - 6} Z`} fill="#fff" {...OUT} />
      <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={Math.min(44, bh / 2)} fill="#fff" {...OUT} />
      <rect x={tx - 18} y={bh / 2 - 12} width="36" height="14" fill="#fff" />
      {lines.map((l, j) => <text key={j} x="0" y={-bh / 2 + 22 + fs * 0.9 + j * fs * 1.15} textAnchor="middle" fontFamily={FT} fontWeight="600" fontSize={fs} fill={INK}>{l}</text>)}
    </g>
  );
}
const Heart = ({ x, y, s, o }) => <path transform={`translate(${x} ${y}) scale(${s})`} opacity={o} d="M 0 18 C -34 -6 -24 -34 0 -18 C 24 -34 34 -6 0 18 Z" fill="#FF4D7D" {...OUT} strokeWidth={4} />;
function Effects({ sc, u, T, poses }) {
  const out = [];
  const m0 = sc.members;
  if (sc.knocker) {
    const { ka, kb } = sc.knocker.knock, dx = sc.door.x;
    out.push(<FxBubble key="k1" x={dx - 60} y={-470} t={seg(u, ka - 0.02, ka + 1.0)} text="¡TUN!" />);
    out.push(<FxBubble key="k2" x={dx + 80} y={-560} t={seg(u, kb - 0.02, kb + 0.9)} text="¡TUN!" size={0.9} fill="#FFD84D" />);
  }
  if (sc.door) out.push(<Burst key="db" cx={sc.door.x} cy={-190} t={seg(u, sc.doorOpen, sc.doorOpen + 0.7)} color="#FFD23F" />);
  m0.forEach((m, j) => {
    const p = poses[j], top = charTop(m, p);
    if (m.entrance === 'aparece') out.push(<Burst key={`ap${j}`} cx={m.x} cy={-200 * m.k} t={seg(u, m.enterT0, m.enterT0 + 0.7)} color="#FF6FB5" />);
    const a = m.actStart;
    if (m.action === 'tirar') {
      const rel = a + 1.0, fl = seg(u, rel, rel + 0.8), river = sc.lugar === 'rio';
      if (u >= rel) {
        const hx = m.x + 60 * m.dir * m.k, hy = -220 * m.k;
        const tx = clamp(m.x + 380 * m.dir, -sc.halfW + 80, sc.halfW - 80), ty = river ? -130 : 50;
        const bob = fl >= 1 && river ? Math.sin(T * 1.6) * 6 : 0;
        out.push(<TrashItem key={`th${j}`} kind={m.objeto || TRASH[(sc.idx + m.i) % 4]} x={lerp(hx, tx, fl)} y={lerp(hy, ty, fl) - Math.sin(fl * Math.PI) * 220 + bob} s={1.1} rot={fl < 1 ? fl * 540 : river ? 70 : 20} />);
        out.push(<FxBubble key={`pl${j}`} x={tx} y={ty - 150} t={seg(u, rel + 0.75, rel + 1.9)} text={river ? '¡PLAF!' : '¡PAF!'} size={0.65} fill="#9FDcFF" color="#fff" />);
      }
    }
    if (m.action === 'comer') out.push(<FxBubble key={`nm${j}`} x={p.x + 150 * p.dir} y={top + 40} t={seg(u, a + 0.7, a + 2.0)} text="¡ÑAM!" size={0.75} fill="#FFD84D" />);
    if (m.action === 'reir') for (let t = a; t < sc.dur - 0.5; t += 3.5) out.push(<FxBubble key={`jj${j}${t}`} x={p.x + 160 * (p.x > 0 ? -1 : 1)} y={top + 20} t={seg(u, t, t + 1.4)} text="¡JA JA!" size={0.7} fill="#7EE0C3" color="#FFD23F" />);
    if (m.action === 'asustarse') {
      out.push(<FxBubble key={`ay${j}`} x={p.x + 130} y={top - 10} t={seg(u, a + 0.3, a + 1.4)} text="¡AY!" size={0.7} fill="#B9A6FF" color="#fff" />);
      const on = seg(u, a + 0.35, a + 0.45) * (1 - seg(u, a + 1.4, a + 1.8));
      if (on > 0) [-1, 1].forEach((s) => out.push(<path key={`sw${j}${s}`} transform={`translate(${p.x + s * 95 * m.k} ${top + 70 + Math.sin(T * 8 + s) * 6})`} opacity={on} d="M 0 -20 Q 14 0 0 10 Q -14 0 0 -20 Z" fill="#9FDcFF" {...OUT} strokeWidth={4} />));
    }
    if (m.action === 'dormir' && u > a + 0.8) for (let q = 0; q < 3; q++) {
      const ph = (((u - a - 0.8) + q * 0.9) % 2.7) / 2.7;
      out.push(<text key={`z${j}${q}`} x={p.x + 70 + ph * 70} y={top + 40 - ph * 130} fontFamily={FD} fontSize={34 + ph * 30} fill="#fff" stroke={INK} strokeWidth="6" paintOrder="stroke" opacity={1 - ph}>Z</text>);
    }
    if (m.action === 'correr' && p.moving) [0, 1, 2].forEach((q) => out.push(<line key={`sp${j}${q}`} x1={p.x - p.dir * (110 + q * 10)} y1={-p.y - 90 - q * 50} x2={p.x - p.dir * (190 + q * 30)} y2={-p.y - 90 - q * 50} stroke={INK} strokeWidth="7" strokeLinecap="round" opacity="0.6" />));
    if (m.hug != null && u > m.hug) {
      const t = m.hugT, mx = (p.x + poses[m0.indexOf(t)].x) / 2;
      for (let q = 0; q < 5; q++) { const ph = clamp((u - m.hug - q * 0.25) / 1.6, 0, 1); if (ph > 0 && ph < 1) out.push(<Heart key={`h${j}${q}`} x={mx + Math.sin(q * 2.1) * 90 + Math.sin(ph * 6) * 10} y={top + 80 - ph * 240} s={0.9 + q * 0.12} o={1 - ph} />); }
    }
    if (m.give != null) {
      const ti = m0.indexOf(m.giftT), tp = poses[ti];
      const k = EZ.glide(seg(u, m.give, m.receiveAt != null ? m.receiveAt : m.giftT.receiveAt));
      const bx = lerp(p.x, tp.x, k), by = lerp(-p.y - 100 * m.k, -tp.y - 100 * m.giftT.k, k) - Math.sin(k * Math.PI) * 60;
      out.push(<g key={`gb${j}`} transform={`translate(${bx} ${by})`}><rect x="-44" y="-40" width="88" height="80" rx="8" fill="#FF5D8F" {...OUT} /><path d="M 0 -40 L 0 40 M -44 0 L 44 0" stroke="#FFD84D" strokeWidth="12" /><path d="M 0 -40 L 0 40 M -44 0 L 44 0" fill="none" stroke={INK} strokeWidth="2" opacity="0.3" /><Bow x={0} y={-44} c="#FFD84D" /></g>);
      const r = m.giftT.receiveAt;
      out.push(<Burst key={`gx${j}`} cx={tp.x} cy={-180} t={seg(u, r, r + 0.8)} color="#FFD84D" />);
      if (u > r && u < r + 1.8) for (let q = 0; q < 14; q++) { const ph = (u - r) / 1.8, cx = tp.x + Math.sin(q * 2.4) * 220, cy = -520 + ph * 520 + (q % 3) * 30; out.push(<rect key={`cf${j}${q}`} x={cx} y={cy} width="18" height="10" rx="3" transform={`rotate(${q * 40 + ph * 400} ${cx + 9} ${cy + 5})`} fill={['#FF6FB5', '#FFD84D', '#2EC4B6', '#7B5CFF'][q % 4]} opacity={1 - ph * 0.6} />); }
    }
    m.tracks.forEach((tr, ti) => { if (!tr.snd) return; landings(tr).forEach((l, li) => {
      const q = (u - l.t) / 0.55; if (q <= 0 || q >= 1) return; const kk = EZ.settle(q);
      [-1, 1].forEach((d) => [0, 1].forEach((jj) => out.push(<circle key={`d${j}-${ti}-${li}-${d}-${jj}`} cx={l.x + d * (70 + kk * (60 + jj * 40))} cy={-6 - kk * (14 + jj * 14)} r={(16 - jj * 5) * (1 - q * 0.7)} fill="#fff" {...OUT} strokeWidth={4} opacity={1 - q} />)));
    }); });
  });
  return <g>{out}</g>;
}

function SceneWorld({ sc, u, T, fmt, uid }) {
  const halfW = sc.halfW, s = fmt.s * (1 + 0.05 * EZ.glide(clamp(u / sc.dur, 0, 1)));
  const poses = sc.members.map((m) => memberPose(m, u, T, sc));
  const dj = sc.members.findIndex((m) => m.entrance === 'puerta');
  const kn = sc.knocker;
  const shake = kn ? Math.sin(u * 60) * 4 * (bump(u, kn.knock.ka - 0.02, kn.knock.ka + 0.16) + bump(u, kn.knock.kb - 0.02, kn.knock.kb + 0.16)) : 0;
  const open = sc.door ? EZ.pop(seg(u, sc.doorOpen, sc.doorOpen + 0.25)) : 0;
  return (
    <g>
      <Sky kind={sc.lugar} fmt={fmt} T={T} id={uid} />
      <g transform={`translate(${fmt.W / 2} ${fmt.GY}) scale(${s})`}>
        <Backdrop kind={sc.lugar} T={T} W={halfW + 300} sucia={sc.sucia} />
        {sc.botes && <RecycleBins halfW={halfW} />}
        <SceneTrash sc={sc} u={u} T={T} />
        {sc.door && (
          <Casita x={sc.door.x} open={open} shake={shake} c={HOUSE_COL[sc.door.col]} id={`door-${uid}`}>
            {dj >= 0 && !poses[dj].hidden && <Character id={sc.members[dj].id} p={Object.assign({}, poses[dj], { y: -(1 - poses[dj].rise) * 420, noShadow: true })} T={T} />}
          </Casita>
        )}
        {poses.map((p, j) => (j === dj || p.hidden ? null : <Character key={j} id={sc.members[j].id} p={p} T={T} />))}
        <Effects sc={sc} u={u} T={T} poses={poses} />
        <Foreground kind={sc.lugar} />
        {sc.members.map((m, j) => m.speak && <Speech key={`s${j}`} x={poses[j].x} cx={poses[j].x} y={charTop(m, j === dj ? Object.assign({}, poses[j], { y: 0 }) : poses[j])} t={seg(u, m.speak[0], m.speak[1] + 0.3)} text={m.dice} fs={fmt.bub} halfW={halfW} />)}
      </g>
    </g>
  );
}

// ── HTML overlays ───────────────────────────────────────────────────────
function Banner({ sc, u, fmt }) {
  if (!sc.ban || u < sc.ban[0] || u >= sc.ban[1]) return null;
  const outK = EZ.glide(seg(u, sc.ban[1] - 0.35, sc.ban[1]));
  const lines = wrap(sc.palabra, fmt.ban.chars);
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(fmt.ban.size, (fmt.W * 0.9) / (longest * 0.66));
  const pal = ['#FFD23F', '#FF6FB5', '#7EE0C3', '#FF8C42', '#B9A6FF'];
  let n = 0;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: fmt.ban.top, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.1, pointerEvents: 'none' }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: 'flex', gap: size * 0.04 }}>
          {line.split('').map((ch, j) => {
            const q = n++, k = EZ.pop(seg(u, sc.ban[0] + q * 0.05, sc.ban[0] + q * 0.05 + 0.4)), s = k * (1 - outK);
            return (
              <span key={j} style={{
                display: 'inline-block', minWidth: ch === ' ' ? size * 0.3 : 0, fontFamily: FD, fontSize: size, lineHeight: 1, color: sc.kind === 'scene' ? pal[(sc.idx + 1) % 5] : pal[q % 5],
                WebkitTextStroke: `${Math.round(size * 0.1)}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${Math.round(size * 0.08)}px 0 ${INK}`,
                transform: `translateY(${Math.sin(u * 4 + q * 0.7) * 6 * k - outK * 30}px) scale(${s}) rotate(${Math.sin(q * 1.7) * 5}deg)`, opacity: s > 0.02 ? 1 : 0,
              }}>{ch}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
function Caption({ sc, u, fmt }) {
  if (!sc.texto) return null;
  const ws = words(sc.texto), [c0, c1] = sc.cap;
  const lit = u < c0 ? -1 : Math.floor(((u - c0) / Math.max(0.01, c1 - c0)) * ws.length);
  const s = EZ.pop(seg(u, 0.2, 0.5)) * (1 - EZ.glide(seg(u, sc.dur - 0.3, sc.dur)));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: fmt.cap.bottom, display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 30px' }}>
      <div style={{ maxWidth: fmt.cap.maxW, background: '#fff', border: `6px solid ${INK}`, borderRadius: 36, padding: '16px 34px 20px', boxShadow: `0 8px 0 ${INK}`, fontFamily: FT, fontWeight: 600, fontSize: fmt.cap.size, lineHeight: 1.22, textAlign: 'center', color: INK, textWrap: 'balance', transform: `scale(${s})`, opacity: s > 0.02 ? 1 : 0 }}>
        {ws.map((w, j) => (
          <React.Fragment key={j}>
            <span style={{ display: 'inline-block', padding: '0 6px', borderRadius: 12, background: j === lit ? '#FFD23F' : 'transparent', color: j < lit ? '#1D5BC0' : INK, transform: j === lit ? 'scale(1.08)' : 'none' }}>{w}</span>{' '}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function StoryFrame({ plan, fmt, opts }) {
  const { T, playing } = useComposition();
  const tl = useTimeline();
  React.useEffect(() => { if (window.__tcLastStory !== plan.key) { window.__tcLastStory = plan.key; tl.setTime(0); } }, []);
  const prevT = React.useRef(T);
  let i = 0;
  while (i < plan.scenes.length - 1 && T >= plan.scenes[i + 1].start) i++;
  const sc = plan.scenes[i], u = T - sc.start;
  React.useEffect(() => {
    const p0 = prevT.current; prevT.current = T;
    if (!playing || !(T > p0) || T - p0 > 0.5) return;
    if (opts.sound) plan.events.forEach((e) => { if (e.t > p0 && e.t <= T) SFX.play(e.s, e.a); });
    if (opts.music) {
      const night = sc.lugar === 'noche', a = Math.floor(p0 / 0.5), b = Math.floor(T / 0.5);
      if (b > a && (!night || b % 2 === 0)) SFX.note(MELODY[b % MELODY.length] * (night ? 0.5 : 1));
    }
  }, [T]);
  const prev = i > 0 && u < 0.75 ? plan.scenes[i - 1] : null;
  const R = Math.hypot(fmt.W, fmt.H), iris = prev ? EZ.glide(seg(u, 0.02, 0.75)) * R : R;
  const cy = fmt.GY - 220;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#3FA9F0' }}>
      <svg width={fmt.W} height={fmt.H} viewBox={`0 0 ${fmt.W} ${fmt.H}`} style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs><clipPath id="tc-iris"><circle cx={fmt.W / 2} cy={cy} r={Math.max(1, iris)} /></clipPath></defs>
        {prev && <SceneWorld sc={prev} u={prev.dur + u} T={T} fmt={fmt} uid={`p${prev.idx}`} />}
        <g clipPath={prev ? 'url(#tc-iris)' : undefined}><SceneWorld sc={sc} u={u} T={T} fmt={fmt} uid={`c${sc.idx}`} /></g>
        {prev && <circle cx={fmt.W / 2} cy={cy} r={iris} fill="none" stroke={INK} strokeWidth="16" />}
      </svg>
      {opts.captions && <Caption sc={sc} u={u} fmt={fmt} />}
      <Banner sc={sc} u={u} fmt={fmt} />
    </div>
  );
}

function SoundHint() {
  const [on, setOn] = React.useState(SFX.running());
  React.useEffect(() => { const f = (v) => setOn(v); SFX.listeners.add(f); return () => SFX.listeners.delete(f); }, []);
  if (on || new URLSearchParams(location.search).has('captura')) return null;
  return (
    <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: '#fff', border: `3px solid ${INK}`, fontFamily: FT, fontWeight: 600, fontSize: 14, color: INK, whiteSpace: 'nowrap' }}>
      Tocá el video para activar el sonido
    </div>
  );
}

function StoryPlayer(props) {
  const fmt = FMT[props.format] || FMT.horizontal;
  const age = props.age || 'bebes';
  const plan = React.useMemo(() => planStory(props.story, fmt, age, props.narracion), [props.story, fmt, age, props.narracion]);
  React.useEffect(() => {
    if (props.onPlan) props.onPlan({ total: plan.total, scenes: plan.scenes.map((s) => ({ src: s.src, dur: s.dur, kind: s.kind, start: s.start, narr: s.narr || null })) });
  }, [plan]);
  const scenesJSON = React.useMemo(() => JSON.stringify(plan.scenes.map((s) => ({ name: s.label, dur: s.dur }))), [plan]);
  const opts = { sound: props.sound !== false, music: props.music !== false, captions: props.captions !== false };
  return (
    <div onPointerDown={() => SFX.unlock()} style={{ position: 'absolute', inset: 0, background: '#1B1410' }}>
      <CompositionStage key={scenesJSON + fmt.id} width={fmt.W} height={fmt.H} scenes={scenesJSON} playback={'{"mode":"loop"}'} bg="#1B1410">
        <StoryFrame plan={plan} fmt={fmt} opts={opts} />
      </CompositionStage>
      <SoundHint />
    </div>
  );
}

Object.assign(window, { StoryPlayer, TC_ENGINE: { sanitizeStory, planStory, IDS, ACTIONS, ENTRIES, PLACES, TRASH } });
})();
