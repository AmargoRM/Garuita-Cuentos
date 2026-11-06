// Garuita Cuentos — motor para el canal de BEBÉS (0 a 2 años).
//
// Dibuja un episodio escrito como el guion de Amargo: partes → escenas con sus segundos,
// lo que se ve y las frases de la narración (con pausas para que el bebé repita).
// Estilo: acuarela infantil suave, colores pastel, formas redondeadas, fondos simples,
// movimientos lentos, sin sustos ni ruidos fuertes. Reutiliza los personajes del motor
// (story-engine.jsx) con una línea café suave en vez de la negra.
//
// Formato del episodio: ver cuentos/finca-tica.json y README.md (sección "Episodios para bebés").
(function () {
const E = window.TC_ENGINE;
const { Character, SPECIES, handPos, Cloud } = E;
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
const glide = Easing.easeInOutSine, settle = Easing.easeOutCubic;
const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean);
const TINTA = '#7A5A48';                 // línea café suave
const L = (w = 4) => ({ stroke: TINTA, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round' });
const FT = "'Fredoka', system-ui, sans-serif";

const FMT = {
  horizontal: { id: 'horizontal', W: 1920, H: 1080, GY: 830, s: 1 },
  vertical: { id: 'vertical', W: 1080, H: 1920, GY: 1300, s: 1.25 },
};

// Paleta pastel de la serie.
const P = {
  cielo: ['#BFE3F2', '#FFF4E2'], cieloGris: ['#D5DCE3', '#EEF1F2'], cieloTarde: ['#F7C6A3', '#FFE9C9'], cieloNoche: ['#5E6E9E', '#9C9CC8'],
  volcan: '#A7C4B5', volcanS: '#93B3A3', volcanTop: '#C3B6D6',
  loma1: '#C6E3AE', loma2: '#B4D99C', loma3: '#D3EBBE', pasto: '#BCDDA0', pastoNoche: '#7E9C8E',
  madera: '#E6C49B', maderaS: '#D2AA7E', maderaO: '#B98D64', teja: '#EBA48F', tejaS: '#D98D79',
  puerta: '#A9D1DE', vidrio: '#FFF6DA', cafe: '#86B98F', cafeS: '#74A97F', grano: '#EE8E8E',
  sol: '#FFE29A', solGlow: '#FFF1C7', nube: '#FFFFFF', flor: ['#F7B7C9', '#FFE29A', '#C9B8E8', '#FFFFFF'],
};

// ── Plan: cuándo dice cada frase, cuánto dura cada escena ──────────────────
// durs = { "p00-e01-f01": segundos, ... } (duración real de cada audio, si existe).
function fraseId(pi, ei, fi) { return `p${String(pi).padStart(2, '0')}-e${String(ei + 1).padStart(2, '0')}-f${String(fi + 1).padStart(2, '0')}`; }
function normFrase(f) { return typeof f === 'string' ? { texto: f } : Object.assign({}, f); }
function planBebes(ep, fmt, durs, voz) {
  durs = durs || {};
  const scenes = [], audios = [];
  let t = 0, idx = 0;
  (ep.partes || []).forEach((parte, pi) => {
    (parte.escenas || []).forEach((raw, ei) => {
      const frases = (raw.frases || []).map(normFrase).map((f, fi) => {
        const id = fraseId(pi, ei, fi), d = Number(durs[id]) || 0;
        return Object.assign(f, { id, audio: d > 0, d: d > 0 ? d : Math.max(0.9, 0.42 * words(f.texto).length + 0.3), quien: f.quien || 'narrador' });
      });
      const seg0 = Number(raw.seg) || 20, n = frases.length;
      const lead = Number(raw.inicio) || (idx === 0 ? 0.9 : 1.2), tail = 1.6;
      const sum = frases.reduce((s, f) => s + f.d, 0);
      const maxGap = raw.ritmo === 'junto' ? 1.1 : 6.5;
      let gap = n > 1 ? clamp((seg0 - lead - tail - sum) / n, 0.5, maxGap) : 0;
      let u = lead;
      frases.forEach((f, fi) => { f.t0 = u; f.t1 = u + f.d; u = f.t1 + (fi < n - 1 ? gap : 0); });
      const dur = Math.max(seg0, u + tail);
      const marca = (en) => {
        if (typeof en === 'number') return en;
        // "f2" = justo antes de la frase 2 · "f2+" = al terminar · "f2@0.5" = a la mitad de la frase 2.
        const m = /^f(\d+)(\+|@([\d.]+))?$/.exec(String(en || ''));
        if (!m) return 0.3;
        const f = frases[Math.min(n - 1, Math.max(0, Number(m[1]) - 1))];
        if (!f) return 0.3;
        if (m[3] != null) return lerp(f.t0, f.t1, Number(m[3]));
        return m[2] === '+' ? f.t1 + 0.25 : f.t0 - 0.3;
      };
      const cast = (raw.personajes || []).map((c, ci) => ({
        id: c.id, x: Number(c.x) || 0, accion: c.accion || 'quieto', ropa: c.ropa || null, sentada: !!c.sentada, seed: idx * 1.7 + ci * 2.3,
        aparece: c.aparece != null ? marca(c.aparece) : null, dir: c.dir === -1 ? -1 : 1,
        acciones: (c.acciones || []).map(([en, a]) => [marca(en), a]).sort((A, B) => A[0] - B[0]),
        desde: c.desde != null ? Number(c.desde) : null, hasta: c.hasta != null ? Number(c.hasta) : null, k: c.k,
        sombrero: !!c.sombrero, hastaX: c.hasta_x != null ? Number(c.hasta_x) : null, hamaca: !!c.hamaca, y: Number(c.y) || 0, encarreta: !!c.carreta,
      }));
      // Cosas que aparecen en un momento: números grandes, burbujas con un objeto ("como una fresa").
      const numeros = (raw.numeros || []).map(([en, txt, x, dura]) => ({ t: marca(en), txt: String(txt), x: Number(x) || 0, dura: Number(dura) || 3.2 }));
      const muestras = (raw.muestras || []).map((x) => ({ t: marca(x.en), objeto: x.objeto, x: Number(x.x) || 0, y: Number(x.y) || -420, dura: Number(x.dura) || 5 }));
      const chaps = (raw.chaps || []).map((en) => marca(en));
      const sc = {
        idx, parte: pi, parteId: parte.id, kind: 'scene', src: idx, lugar: raw.lugar || 'finca', start: t, dur, raw, cast, frases,
        numeros, muestras, chaps, carretaT0: raw.carreta && raw.carreta.en != null ? marca(raw.carreta.en) : 1.5, camara: raw.camara || null, label: `${parte.nombre || parte.id} · ${ei + 1}`,
        // Para la música (motor/musica.js): ánimo y frases que bajan el volumen.
        moods: [[0, raw.musica || (raw.lugar === 'noche' ? 'cuna' : 'suave')]],
        lines: frases.map((f) => ({ t0: f.t0, t1: f.t1, id: f.quien, audio: f.audio })),
        sonidos: (raw.sonidos || []).map((x) => ({ id: x.id, vol: Number(x.vol) || 0.5, t: marca(x.en) })).filter((x) => x.t < dur),
      };
      frases.forEach((f) => { if (f.audio) audios.push({ archivo: `voz/${voz}/${f.id}.wav`, inicio: Math.round((t + f.t0) * 1000) / 1000 }); });
      // Sonidos que suenan toda la escena (lluvia, grillos): "fondo": {"id": "garua", "vol": 0.3}.
      if (raw.fondo_sonido) { const fs = raw.fondo_sonido; for (let q = 0; q < dur - 1; q += fs.largo || 20) sc.sonidos.push({ id: fs.id, vol: fs.vol || 0.3, t: q }); }
      sc.sonidos.forEach((x) => audios.push({ archivo: `sonidos/${x.id}.ogg`, inicio: Math.round((t + x.t) * 1000) / 1000, vol: x.vol }));
      scenes.push(sc); t += dur; idx++;
    });
  });
  return { scenes, total: Math.round(t * 100) / 100, events: [], key: ep.id || 'bebes', audios, bpm: ep.bpm || 80 };
}

// ── Poses (todo lento y suave) ─────────────────────────────────────────────
function accionEn(c, u) { let a = c.accion; c.acciones.forEach(([t, x]) => { if (u >= t) a = x; }); return a; }
function pose(c, u, T, sc, fmt, n) {
  const halfW = fmt.W / 2 / fmt.s;
  const k = c.k || (n >= 5 ? (fmt.id === 'vertical' ? 0.6 : 0.84) : n >= 3 ? 0.92 : 1.05);
  const p = { x: c.x * halfW * 0.92, y: 0, sx: 1, sy: 1, dir: c.dir, lean: 0, rArm: -14, lArm: 14, tilt: 0, eyes: 'open', mood: 'smile', mouth: 0, look: 0, ear: 0, k, pop: 1, seed: c.seed, bites: 0 };
  p.sy *= 1 + 0.015 * Math.sin(T * 1.9 + c.seed);                     // respira
  if (((T + c.seed * 1.3) % 4.4) < 0.16) p.eyes = 'blink';            // parpadea despacito
  p.tilt = 2.5 * Math.sin(T * 0.7 + c.seed);
  if (c.aparece != null) {
    const q = seg(u, c.aparece, c.aparece + 0.9);
    if (q <= 0) p.hidden = true;
    p.pop = Easing.easeOutBack(q) * 0.92 + 0.08 * q;
  }
  const a = accionEn(c, u);
  const ola = (w) => { p.rArm = lerp(p.rArm, -122 + 20 * Math.sin(T * Math.PI * 1.25 + c.seed), w); };
  switch (a) {
    case 'saludar': { const t0 = c.aparece != null ? c.aparece + 0.6 : 0.3; ola(settle(seg(u, t0, t0 + 0.6))); if (u > t0) p.eyes = p.eyes === 'blink' ? 'blink' : 'open'; break; }
    case 'bailar': {
      p.lean = 7 * Math.sin(T * Math.PI * 0.9 + c.seed * 0.2);
      p.rArm = -112 + 22 * Math.sin(T * Math.PI * 0.9); p.lArm = 112 + 22 * Math.sin(T * Math.PI * 0.9 + Math.PI);
      p.y = 10 * Math.abs(Math.sin(T * Math.PI * 0.9)); if (Math.sin(T * 0.6 + c.seed) > 0.1) p.eyes = 'happy';
      break;
    }
    case 'pancita': p.rArm = 44; p.lArm = -44; p.tilt = 5 * Math.sin(T * 1.1); p.lean = 2 * Math.sin(T * 1.1); break;
    case 'revolver': {
      const ph = T * Math.PI * 0.95;
      p.rArm = -74 + 9 * Math.sin(ph); p.lArm = 20; p.lean = 3 + 2 * Math.sin(ph);
      p.sostiene = <Cuchara inclina={18 + 10 * Math.cos(ph)} />; p.look = 0.4;
      break;
    }
    case 'olerOlla': { p.rArm = -74 + 5 * Math.sin(T * 2); p.sostiene = <Cuchara inclina={18} />; p.eyes = 'happy'; p.tilt = -8 + 2 * Math.sin(T * 1.3); p.lean = -3; break; }
    case 'oler': { p.rArm = -95 + 4 * Math.sin(T * 2); p.eyes = 'happy'; p.tilt = -9 + 2 * Math.sin(T * 1.3); p.lean = 6; break; }
    case 'saltar': { const q = Math.abs(Math.sin(T * Math.PI * 0.75 + c.seed)); p.y = 70 * q; p.sy *= 1 + 0.06 * (q - 0.5); p.ear = (q - 0.5) * 18; p.rArm = -40 - 30 * q; p.lArm = 40 + 30 * q; if (q > 0.5) p.eyes = 'happy'; break; }
    case 'tocar': { p.rArm = -96 + 6 * Math.sin(T * 1.6); p.look = 0.5; p.lean = 4; break; }
    case 'montado': { p.eyes = Math.sin(T * 0.7 + c.seed) > 0 ? 'happy' : p.eyes; p.rArm = -120 + 14 * Math.sin(T * 2.2); p.lArm = 30; p.lean = 3 * Math.sin(T * 1.4); break; }
    case 'caminar': {
      const q = c.hastaX != null ? glide(seg(u, 0.5, sc.dur - 2)) : 0;
      if (c.hastaX != null) p.x = lerp(c.x, c.hastaX, q) * halfW * 0.92;
      const paso = Math.sin(T * Math.PI * 1.1 + c.seed); p.y = 8 * Math.abs(paso); p.lean = 3 * paso; p.rArm = -14 + 10 * paso; p.lArm = 14 + 10 * paso;
      break;
    }
    case 'mirarAqui': { p.look = -0.8; p.tilt = -7 + 2 * Math.sin(T); p.dir = -1; p.rArm = -100; break; }
    case 'mirarAlla': { p.look = 0.8; p.tilt = 7 + 2 * Math.sin(T); p.dir = 1; p.rArm = -100; break; }
    case 'banano': { p.rArm = -60 + 4 * Math.sin(T * 2); p.sostiene = <Banano />; p.eyes = 'happy'; if (c.sombrero) p.sombrero = (g) => <Pina x={0} y={g.headCy - g.headRy - 50} s={0.9} />; break; }
    case 'adios': { ola(1); p.eyes = Math.sin(T * 0.7 + c.seed) > 0 ? 'happy' : p.eyes; break; }
    case 'mirar': { const m = Math.sin(T * 0.9 + c.seed); p.look = 0.7 * m; p.tilt = 8 * m; p.lean = 4 * m; p.rArm = -30; break; }
    case 'levantar': { p.rArm = -168 + 4 * Math.sin(T * 2); p.lArm = 168 - 4 * Math.sin(T * 2); p.eyes = 'happy'; p.y = 10 * Math.abs(Math.sin(T * 1.6)); p.sombrero = (g) => <Pina x={0} y={g.headCy - g.headRy - 120} s={1.1} />; break; }
    case 'sombreroPina':
    case 'reir': {
      const r = (u + c.seed) % 4 < 2.6; if (r) { p.eyes = 'happy'; p.mood = 'laugh'; p.mouth = 0.45 + 0.3 * Math.abs(Math.sin(T * 8)); p.tilt = -5 + 4 * Math.sin(T * 7); }
      p.lArm = 40; p.rArm = -40;
      if (a === 'sombreroPina') p.sombrero = (g) => <Pina x={0} y={g.headCy - g.headRy - 50} s={0.9} />;
      break;
    }
    case 'sombreroQuieto': { p.sombrero = (g) => <Pina x={0} y={g.headCy - g.headRy - 50} s={0.9} />; p.eyes = Math.sin(T * 0.8) > -0.2 ? 'happy' : p.eyes; p.lean = 4 * Math.sin(T * 1.2); break; }
    case 'comerBanano': {
      const per = 3.4, ph = ((u + c.seed) % per) / per, up = Math.sin(clamp((ph - 0.1) / 0.55, 0, 1) * Math.PI);
      p.rArm = lerp(-40, 136, up); p.lArm = 20; const b = <Banano pelado />;
      if (up > 0.6) p.sostieneArriba = b; else p.sostiene = b;
      if (ph > 0.42 && ph < 0.85) { p.mouth = 0.22 * Math.abs(Math.sin(T * 9)); p.eyes = 'happy'; }
      if (c.sombrero) p.sombrero = (g) => <Pina x={0} y={g.headCy - g.headRy - 50} s={0.9} />;
      break;
    }
    case 'cargar': case 'poner': case 'abrazar': {
      const granos = sc.numeros.filter((x) => u >= x.t + 0.4 && /^\d$/.test(x.txt)).reduce((m, x) => Math.max(m, Number(x.txt)), 0);
      p.encima = (g) => <Canasta g={g} granos={a === 'cargar' && !sc.numeros.length ? 0 : Math.min(3, granos || (a === 'abrazar' ? 3 : 0))} />;
      if (a === 'cargar') { p.rArm = 36; p.lArm = -36; }
      if (a === 'poner') { const q = Math.sin(T * Math.PI * 0.6 + c.seed); p.rArm = lerp(30, -128, (q + 1) / 2); p.lArm = -36; p.look = 0.5 * (q + 1) / 2; }
      if (a === 'abrazar') { p.rArm = 58; p.lArm = -58; p.eyes = 'happy'; p.tilt = 6 * Math.sin(T * 0.9); p.lean = 3 * Math.sin(T * 0.9); }
      break;
    }
    case 'tocarGrano': { p.rArm = -120 + 5 * Math.sin(T * 1.8); p.lArm = -36; p.look = 0.6; p.tilt = -6; p.encima = (g) => <Canasta g={g} granos={0} />; break; }
    case 'hoja': { p.sombrero = (g) => <HojaGrande y={g.headCy - g.headRy - 30} T={T} />; p.rArm = -160; p.eyes = Math.sin(T * 0.7) > 0 ? 'happy' : p.eyes; break; }
    case 'charco': { const q = Math.max(0, Math.sin(T * Math.PI * 0.8)); p.lean = -4 * q; p.y = 6 * q; p.eyes = q > 0.5 ? 'happy' : p.eyes; p.rArm = -40; p.lArm = 40; break; }
    case 'mecer': { p.eyes = Math.sin(T * 0.5 + c.seed) > -0.4 ? 'happy' : p.eyes; p.rArm = 20; p.lArm = -20; break; }
    case 'bostezar': {
      const per = 7, ph = ((u + c.seed * 2) % per) / per, q = Math.sin(clamp((ph - 0.1) / 0.4, 0, 1) * Math.PI);
      if (q > 0.05) { p.mood = 'o'; p.mouth = 0.6 * q; p.eyes = 'sleep'; p.rArm = lerp(-14, -160, q); p.lArm = lerp(14, 160, q); p.sy *= 1 + 0.05 * q; }
      else if (ph > 0.6) p.eyes = 'sleep';
      break;
    }
    case 'dormir': { p.eyes = 'sleep'; p.mood = 'sleep'; p.tilt = 9 + 2 * Math.sin(T * 0.8 + c.seed); p.sy *= 1 + 0.025 * Math.sin(T * 1.4 + c.seed); p.rArm = 8; p.lArm = -8; break; }
    case 'comer':
    case 'comerTortilla': {
      const per = 3.2, ph = ((u + c.seed) % per) / per, up = Math.sin(clamp((ph - 0.1) / 0.55, 0, 1) * Math.PI);
      p.rArm = lerp(-58, 134, up); p.lArm = -10;
      const obj = a === 'comer' ? <Cuchara inclina={lerp(-20, -150, up)} llena={up > 0.05 && ph < 0.45} corta /> : <PedazoTortilla s={1 - 0.3 * Math.floor(((u + c.seed) / per) % 3) / 2} />;
      if (up > 0.6) p.sostieneArriba = obj; else p.sostiene = obj;
      if (ph > 0.42 && ph < 0.85) { p.mouth = 0.22 * Math.abs(Math.sin(T * 9)); p.eyes = 'happy'; }
      break;
    }
    case 'limpiarse': { p.rArm = 150 + 6 * Math.sin(T * 4); p.sostieneArriba = <Servilleta />; p.eyes = 'happy'; p.tilt = 4 * Math.sin(T * 1.6); break; }
    case 'feliz': { p.eyes = Math.sin(T * 0.8 + c.seed) > -0.3 ? 'happy' : p.eyes; p.lean = 4 * Math.sin(T * 1.2); p.rArm = -40 + 10 * Math.sin(T * 1.2); p.lArm = 40 - 10 * Math.sin(T * 1.2); break; }
    default: break;
  }
  if (c.ropa === 'delantal') p.encima = (g) => <Delantal g={g} />;
  if (c.sentada) p.y += 72; // sentadita en su silla, detrás de la mesa
  if (c.y) p.y += c.y;
  if (c.hamaca) { const m = Math.sin(T * 0.85), r = p.x / 580; p.x += 26 * m; p.y += 25 + 100 * r * r; p.lean += -4 * m; p.noSombra = true; }
  if (c.encarreta && sc.raw.carreta) { p.x = carretaX(sc, u, halfW) - 60; p.y += 140 + (u > sc.carretaT0 ? 4 * Math.abs(Math.sin(T * 3)) : 0); }
  return p;
}

// ── Utensilios y comida ────────────────────────────────────────────────────
function Cuchara({ inclina = 15, llena, corta }) {
  const lg = corta ? 62 : 108;
  return (
    <g transform={`rotate(${inclina})`}>
      <path d={`M 0 -18 L 0 ${lg}`} {...L(14)} /><path d={`M 0 -18 L 0 ${lg}`} stroke="#D6A271" strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="0" cy={lg + 14} rx="15" ry="20" fill="#D6A271" {...L(4)} />
      {llena && <g><ellipse cx="0" cy={lg + 10} rx="12" ry="9" fill="#FFFDF4" /><circle cx="-4" cy={lg + 9} r="3.2" fill="#6D5A66" /><circle cx="5" cy={lg + 12} r="3" fill="#6D5A66" /></g>}
    </g>
  );
}
function PedazoTortilla({ s = 1 }) {
  return <g transform={`scale(${s})`}><path d="M -26 -6 A 30 30 0 0 1 30 -10 L 2 26 Z" fill="#F6DFA6" {...L(4)} /><circle cx="-6" cy="-2" r="3" fill="#D7B271" /><circle cx="10" cy="-6" r="2.5" fill="#D7B271" /></g>;
}
function Servilleta() {
  return (
    <g transform="rotate(-12)">
      <path d="M -30 -26 L 30 -30 L 34 26 L -26 30 Z" fill="#CFE8F5" {...L(4)} />
      <path d="M -10 -28 L -6 28 M 12 -29 L 16 27 M -28 -6 L 32 -8 M -27 12 L 33 10" stroke="#9FCBE3" strokeWidth="5" />
    </g>
  );
}
function Delantal({ g }) {
  const y0 = g.bodyCy - g.bodyRy * 0.45, y1 = g.bodyCy + g.bodyRy * 0.86, w = g.bodyRx * 0.72;
  return (
    <g>
      <path d={`M ${-w * 0.62} ${y0} Q 0 ${y0 - 10} ${w * 0.62} ${y0} L ${w} ${y1 - 20} Q 0 ${y1 + 14} ${-w} ${y1 - 20} Z`} fill="#F9C3D2" {...L(4)} />
      {[[-0.4, 0.35], [0.35, 0.3], [0, 0.6], [-0.5, 0.75], [0.5, 0.72], [0.05, 0.1]].map(([a, b], j) => <circle key={j} cx={a * w} cy={lerp(y0, y1, b)} r="5" fill="#fff" opacity="0.9" />)}
      <path d={`M ${-w * 0.35} ${lerp(y0, y1, 0.48)} L ${w * 0.35} ${lerp(y0, y1, 0.48)} L ${w * 0.3} ${lerp(y0, y1, 0.7)} L ${-w * 0.3} ${lerp(y0, y1, 0.7)} Z`} fill="#F6AFC2" {...L(3.5)} />
    </g>
  );
}
function Pina({ x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[-30, -12, 0, 12, 30].map((a, j) => <path key={j} d={`M 0 -36 Q ${a * 0.6} -80 ${a * 1.5} ${-96 + Math.abs(a) * 0.6}`} fill="none" stroke="#8CC48A" strokeWidth="13" strokeLinecap="round" />)}
      <ellipse cx="0" cy="12" rx="42" ry="54" fill="#F6CF7A" {...L(4)} />
      {[-1, 0, 1].map((r) => [-1, 0, 1].map((q) => <path key={`${r}${q}`} d={`M ${q * 22 - 7} ${r * 26 + 12} l 7 -7 l 7 7`} fill="none" stroke="#D9A85A" strokeWidth="4" strokeLinecap="round" />))}
    </g>
  );
}
function Banano({ pelado }) {
  return (
    <g transform="rotate(-30)">
      <path d="M -10 -50 Q 24 -10 -4 44 Q 10 -6 -22 -44 Z" fill="#FBE59A" {...L(4)} />
      {pelado && [-1, 1].map((sg) => <path key={sg} d={`M -6 10 Q ${sg * 26} 26 ${sg * 20} 50`} fill="none" stroke="#F3D06A" strokeWidth="12" strokeLinecap="round" />)}
      {!pelado && <path d="M -10 -50 L -14 -60" {...L(6)} />}
    </g>
  );
}
function Canasta({ g, granos = 0 }) {
  const y = g.bodyCy + 10, w = 78;
  return (
    <g transform={`translate(0 ${y})`}>
      <path d={`M ${-w} -40 Q 0 -150 ${w} -40`} fill="none" stroke="#C99B6E" strokeWidth="10" />
      {Array.from({ length: granos }).map((_, j) => <circle key={j} cx={-28 + j * 28} cy={-44 - (j % 2) * 8} r="14" fill={P.grano} {...L(3)} />)}
      <path d={`M ${-w} -40 L ${w} -40 L ${w - 14} 40 Q 0 52 ${-w + 14} 40 Z`} fill="#E2BE8E" {...L(4)} />
      {[-14, 8, 28].map((yy) => <path key={yy} d={`M ${-w + 8} ${yy} L ${w - 8} ${yy}`} stroke="#C99B6E" strokeWidth="4" />)}
    </g>
  );
}
function HojaGrande({ y, T }) {
  return (
    <g transform={`translate(0 ${y}) rotate(${3 * Math.sin(T * 1.1)})`}>
      <path d="M 0 0 L 0 -40" {...L(6)} />
      <path d="M -170 -40 Q -150 -150 0 -160 Q 150 -150 170 -40 Q 0 -70 -170 -40 Z" fill="#A8D69A" {...L(4)} />
      <path d="M 0 -150 L 0 -52 M 0 -110 L -90 -70 M 0 -110 L 90 -70" fill="none" stroke="#86BC7E" strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}
function Fresa({ s = 1 }) {
  return <g transform={`scale(${s})`}><path d="M -40 -20 Q 0 -44 40 -20 Q 36 30 0 52 Q -36 30 -40 -20 Z" fill="#F29A9A" {...L(4)} />{[[-16, -6], [12, -10], [-2, 14], [18, 16], [-20, 22], [0, 34]].map(([a, b], j) => <ellipse key={j} cx={a} cy={b} rx="3" ry="4.5" fill="#FFF3C4" />)}<path d="M -26 -26 L -8 -40 L 0 -26 L 8 -40 L 26 -26" fill="#9CCB8E" {...L(3.5)} /></g>;
}
function Burbuja({ m, u, T }) {
  const q = seg(u, m.t, m.t + 0.8) * (1 - seg(u, m.t + m.dura - 0.8, m.t + m.dura));
  if (q <= 0) return null;
  const k = Easing.easeOutBack(Math.min(1, q));
  return (
    <g transform={`translate(${m.x} ${m.y + Math.sin(T * 1.4) * 8}) scale(${k})`} opacity={Math.min(1, q * 1.5)}>
      <circle r="120" fill="#FFFFFF" opacity="0.92" {...L(4)} />
      {m.objeto === 'fresa' && <Fresa s={1.5} />}
      {m.objeto === 'sol' && <Sol x={0} y={0} s={0.85} T={T} />}
      {m.objeto === 'pina' && <Pina s={1} y={10} />}
      {m.objeto === 'rojo' && <g><circle r="66" fill="#F4A3A3" {...L(5)} /><circle r="44" fill="#FFF1E4" {...L(3)} /><circle r="14" fill="#F4A3A3" {...L(3)} /></g>}
      {m.objeto === 'amarillo' && <Flor5 c="#FFE29A" r={34} />}
      {m.objeto === 'azul' && <Estrella s={2} />}
    </g>
  );
}
function carretaX(sc, u, halfW) {
  const c = sc.raw.carreta, x0 = (Number(c.x) || 0) * halfW;
  return c.hasta_x != null ? lerp(x0, Number(c.hasta_x) * halfW, glide(seg(u, sc.carretaT0, sc.dur - 0.5))) : x0;
}
function Carreta({ x, giro, T }) {
  // Carreta típica pintada: rueda roja con flores, flor amarilla y estrella azul en el costado.
  return (
    <g transform={`translate(${x} 0)`}>
      <path d="M 120 -120 L 330 -60" {...L(14)} /><path d="M 120 -120 L 330 -60" stroke="#D2AA7E" strokeWidth="8" strokeLinecap="round" />
      <rect x="-230" y="-300" width="360" height="170" rx="16" fill="#E9CFA4" {...L(5)} />
    </g>
  );
}
function RuedaCarreta({ giro }) {
  return (
    <g>
      <g transform={`translate(-50 -110) rotate(${giro})`}>
        <circle r="112" fill="#F4A3A3" {...L(5)} />
        <circle r="86" fill="#FFF1E4" {...L(3)} />
        {Array.from({ length: 8 }).map((_, j) => <g key={j} transform={`rotate(${j * 45})`}><path d="M 0 -18 L 0 -84" stroke="#F4A3A3" strokeWidth="10" strokeLinecap="round" /><circle cy="-60" r="10" fill="#FFE29A" {...L(2.5)} /></g>)}
        <circle r="22" fill="#F4A3A3" {...L(4)} />
      </g>
    </g>
  );
}
function Flor5({ c, r = 20 }) {
  return <g>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.sin(a * Math.PI / 180) * r} cy={-Math.cos(a * Math.PI / 180) * r} r={r * 0.8} fill={c} {...L(3.5)} />)}<circle r={r * 0.6} fill="#FFFFFF" {...L(3)} /></g>;
}
function Luna({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r="130" fill="#FFF6C9" opacity="0.25" /><circle r="84" fill="#FFF1B0" {...L(4)} />
      <path d="M -32 -4 Q -22 6 -12 -4 M 12 -4 Q 22 6 32 -4" fill="none" {...L(5)} /><path d="M -14 22 Q 0 32 14 22" fill="none" {...L(4)} />
      <ellipse cx="-44" cy="14" rx="11" ry="7" fill="#FFC6B6" opacity="0.7" /><ellipse cx="44" cy="14" rx="11" ry="7" fill="#FFC6B6" opacity="0.7" />
    </g>
  );
}
function Lluvia({ W, T, n = 46 }) {
  return <g>{Array.from({ length: n }).map((_, j) => { const ph = (T * 0.32 + (j * 0.618) % 1) % 1, x = -W + ((j * 137) % (W * 2)), y = -1100 + ph * 1150; return <path key={j} d={`M ${x} ${y} q -6 16 0 22 q 6 -6 0 -22 Z`} fill="#BFDDF0" {...L(2)} opacity={0.85} />; })}</g>;
}
function Luciernagas({ W, T, n = 16 }) {
  return <g>{Array.from({ length: n }).map((_, j) => { const x = -W * 0.9 + ((j * 211) % (W * 1.8)) + Math.sin(T * 0.4 + j) * 40, y = -120 - ((j * 97) % 420) + Math.cos(T * 0.5 + j * 2) * 30, b = 0.35 + 0.65 * Math.max(0, Math.sin(T * 1.1 + j * 1.7)); return <g key={j} opacity={b}><circle cx={x} cy={y} r="26" fill="#FFF3A8" opacity="0.35" /><circle cx={x} cy={y} r="9" fill="#FFF7C2" /></g>; })}</g>;
}
function Estrellas({ W, T }) {
  return <g>{Array.from({ length: 22 }).map((_, j) => { const x = -W + ((j * 397) % (W * 2)), y = -1000 + ((j * 613) % 560), tw = 0.6 + 0.4 * Math.sin(T * 0.9 + j); return <path key={j} transform={`translate(${x} ${y}) scale(${tw * 0.8})`} d="M 0 -16 Q 4 -4 16 0 Q 4 4 0 16 Q -4 4 -16 0 Q -4 -4 0 -16 Z" fill="#FFF3C4" opacity="0.9" />; })}</g>;
}
function Numero({ m, u }) {
  const q = seg(u, m.t, m.t + 0.6) * (1 - seg(u, m.t + m.dura - 0.6, m.t + m.dura));
  if (q <= 0) return null;
  const k = Easing.easeOutBack(Math.min(1, seg(u, m.t, m.t + 0.6)));
  const cols = { '1': '#F7B7C9', '2': '#FFE29A', '3': '#A9CBEE', '4': '#C9B8E8', '5': '#B4D99C' };
  return <text x={m.x} y={-560} transform={`translate(${m.x} -590) scale(${k}) translate(${-m.x} 590)`} textAnchor="middle" fontFamily={FT} fontWeight="700" fontSize={190} fill={cols[m.txt] || '#FFE29A'} stroke={TINTA} strokeWidth="6" paintOrder="stroke" opacity={q}>{m.txt}</text>;
}
function Estrella({ c = '#A9CBEE', s = 1 }) {
  return <path transform={`scale(${s})`} d="M 0 -36 L 10 -12 L 36 -10 L 16 8 L 22 34 L 0 20 L -22 34 L -16 8 L -36 -10 L -10 -12 Z" fill={c} {...L(4)} />;
}
function CarretaFrente({ x, giro }) {
  // Costado delantero pintado (flor amarilla y estrella azul) y la rueda roja: Chepe queda "adentro".
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="-230" y="-250" width="360" height="120" rx="14" fill="#F6E3C0" {...L(5)} />
      <g transform="translate(-140 -190) scale(0.85)"><Flor5 c="#FFE29A" r={26} /></g>
      <g transform="translate(60 -190) scale(1.1)"><Estrella /></g>
      <RuedaCarreta giro={giro} />
    </g>
  );
}
function Arbol({ x, s = 1 }) {
  return <g transform={`translate(${x} 0) scale(${s})`}><path d="M -34 0 Q -24 -220 -30 -430 L 30 -430 Q 24 -220 34 0 Z" fill={P.maderaS} {...L(5)} /><circle cx="-90" cy="-470" r="130" fill={P.loma2} {...L(4)} /><circle cx="90" cy="-480" r="130" fill={P.loma1} {...L(4)} /><circle cx="0" cy="-580" r="140" fill={P.cafe} {...L(4)} /></g>;
}
function HamacaAtras({ T }) {
  return <g><Arbol x={-760} s={1.05} /><Arbol x={760} s={1.05} /><path d={`M -730 -380 Q ${26 * Math.sin(T * 0.85)} 80 730 -380`} fill="none" stroke="#E7B3C1" strokeWidth="10" /></g>;
}
function HamacaFrente({ T }) {
  const m = 26 * Math.sin(T * 0.85), cols = ['#F7B7C9', '#FFE29A', '#A9CBEE', '#B4D99C', '#C9B8E8'];
  return (
    <g transform={`translate(${m} 0)`}>
      <path d="M -730 -380 L -560 -150 M 730 -380 L 560 -150" stroke="#C99B6E" strokeWidth="6" />
      <path d="M -580 -170 Q 0 30 580 -170 L 580 -120 Q 0 120 -580 -120 Z" fill="#FFF1E4" {...L(5)} />
      {cols.map((c, j) => <path key={j} d={`M ${-580 + j * 10} ${-162 + j * 9} Q 0 ${40 + j * 16} ${580 - j * 10} ${-162 + j * 9}`} fill="none" stroke={c} strokeWidth="9" />)}
    </g>
  );
}
function Cobija({ halfW }) {
  const w = halfW * 0.86, cuadros = [];
  for (let j = -6; j <= 6; j++) cuadros.push(<path key={`v${j}`} d={`M ${j * w / 6} -70 L ${j * w / 6} 70`} stroke="#F4A3A3" strokeWidth="18" opacity="0.6" />);
  [-25, 30].forEach((y) => cuadros.push(<path key={`h${y}`} d={`M ${-w} ${y} L ${w} ${y}`} stroke="#F4A3A3" strokeWidth="18" opacity="0.6" />));
  return <g><path d={`M ${-w} -60 Q 0 -90 ${w} -60 L ${w} 80 L ${-w} 80 Z`} fill="#FCE6C8" {...L(5)} />{cuadros}<path d={`M ${-w} -60 Q 0 -90 ${w} -60`} fill="none" {...L(5)} /></g>;
}
function MataPina({ x, y = 0, s = 1, fruta = true }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[-70, -45, -20, 20, 45, 70].map((a, j) => <path key={j} d={`M 0 0 Q ${a * 1.2} ${-60 - Math.abs(a) * 0.3} ${a * 2.2} ${-110 + Math.abs(a) * 0.9}`} fill="none" stroke={j % 2 ? '#86B98F' : '#9CCB8E'} strokeWidth="16" strokeLinecap="round" />)}
      {fruta && <Pina x={0} y={-80} s={0.62} />}
    </g>
  );
}
function MataCafe({ x, y = 0, s = 1, granos = 7, T = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 0 L 0 -60" stroke={P.maderaO} strokeWidth="14" strokeLinecap="round" />
      <ellipse cx="0" cy="-170" rx="150" ry="140" fill={P.cafe} {...L(4)} />
      <ellipse cx="-50" cy="-200" rx="70" ry="50" fill={P.cafeS} opacity="0.5" />
      {Array.from({ length: granos }).map((_, j) => <circle key={j} cx={-90 + ((j * 47) % 180)} cy={-110 - ((j * 61) % 140)} r="15" fill={P.grano} {...L(3)} />)}
    </g>
  );
}
function Vapor({ x, y, T, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 1, 2].map((j) => { const ph = ((T * 0.35 + j / 3) % 1); return <path key={j} d={`M ${-30 + j * 30} 0 q -14 -30 0 -60 q 14 -30 0 -60`} transform={`translate(${Math.sin(T + j) * 6} ${-ph * 70})`} fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" opacity={0.55 * Math.sin(ph * Math.PI)} />; })}
    </g>
  );
}
function OllaAtras({ x, k = 1 }) {
  return (
    <g transform={`translate(${x} 0) scale(${k})`}>
      <ellipse cx="0" cy="-118" rx="96" ry="24" fill="#8E99A6" {...L(4)} />
      <ellipse cx="0" cy="-114" rx="84" ry="17" fill="#FFFDF4" />
      {Array.from({ length: 16 }).map((_, j) => <ellipse key={j} cx={-66 + ((j * 37) % 132)} cy={-116 + ((j * 13) % 9) - 3} rx="6" ry="4" fill={j % 2 ? '#6D5A66' : '#FFFFFF'} />)}
    </g>
  );
}
function OllaFrente({ x, k = 1 }) {
  return (
    <g transform={`translate(${x} 0) scale(${k})`}>
      <path d="M -96 -118 Q -98 -20 -78 -6 Q 0 10 78 -6 Q 98 -20 96 -118 Q 0 -92 -96 -118 Z" fill="#AEB8C4" {...L(4)} />
      <path d="M -70 -90 Q -74 -40 -60 -24" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.5" />
      {[-1, 1].map((s) => <path key={s} d={`M ${s * 96} -100 q ${s * 30} 4 ${s * 28} 26`} fill="none" {...L(9)} />)}
      <path d="M -120 0 L 120 0 L 110 26 L -110 26 Z" fill="#E7A88E" {...L(4)} transform="translate(0 -4)" />
    </g>
  );
}
// Frijolitos repartidos sobre la montañita de gallo pinto (siempre en el mismo lugar).
const FRIJOLES = Array.from({ length: 26 }).map((_, j) => { const a = (j * 2.399) % (Math.PI * 2), r = Math.sqrt((j + 0.5) / 26); return [Math.cos(a) * r * 50, -20 + Math.sin(a) * r * 18 - (1 - r) * 12]; });
function Plato({ x, y, lleno, k = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <ellipse cx="0" cy="0" rx="98" ry="30" fill="#FFFFFF" {...L(4)} />
      <ellipse cx="0" cy="-2" rx="76" ry="21" fill="none" stroke="#B9D6EE" strokeWidth="5" />
      {lleno && (
        <g>
          <path d="M -64 0 Q -58 -44 0 -48 Q 58 -44 64 0 Q 0 12 -64 0 Z" fill="#FFFDF4" {...L(3.5)} />
          {FRIJOLES.map(([bx, by], j) => <ellipse key={j} cx={bx} cy={by} rx="5.5" ry="4" fill="#7A6573" transform={`rotate(${j * 37} ${bx} ${by})`} />)}
          <g transform="translate(-6 -38)"><circle r="7" fill="#9CCB8E" /><circle cx="9" cy="3" r="5" fill="#9CCB8E" /></g>
        </g>
      )}
      {!lleno && <g opacity="0.8"><circle cx="-16" cy="-4" r="3" fill="#F2E3C8" /><circle cx="22" cy="2" r="2.5" fill="#F2E3C8" /></g>}
    </g>
  );
}
function Tortillas({ x, y, n = 2 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="4" rx="64" ry="20" fill="#E9F3FA" {...L(3.5)} />
      {Array.from({ length: n }).map((_, j) => <g key={j} transform={`translate(0 ${-j * 7})`}><ellipse cx="0" cy="-2" rx="50" ry="14" fill="#F6DFA6" {...L(3.5)} /><circle cx="-18" cy="-4" r="3" fill="#D7B271" /><circle cx="14" cy="-1" r="3" fill="#D7B271" /><circle cx="2" cy="-7" r="2.4" fill="#D7B271" /></g>)}
    </g>
  );
}
function Mesa({ halfW, top = -100, children }) {
  return (
    <g>
      <rect x={-halfW * 0.62} y={top} width={halfW * 1.24} height={30} rx="12" fill="#D9AE80" {...L(4)} />
      <rect x={-halfW * 0.6} y={top + 30} width={halfW * 1.2} height={-top - 30 + 4} fill="#C99B6E" {...L(4)} />
      <path d={`M ${-halfW * 0.6} ${top + 70} L ${halfW * 0.6} ${top + 70}`} stroke="#B78A5E" strokeWidth="4" opacity="0.6" />
      {children}
    </g>
  );
}

// ── Lugares ────────────────────────────────────────────────────────────────
function Cielo({ fmt, colores, id }) {
  return (
    <g>
      <defs><linearGradient id={`c-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={colores[0]} /><stop offset="1" stopColor={colores[1]} /></linearGradient></defs>
      <rect width={fmt.W} height={fmt.H} fill={`url(#c-${id})`} />
    </g>
  );
}
function Sol({ x, y, s = 1, T }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r="150" fill={P.solGlow} opacity="0.6" /><circle r="118" fill={P.solGlow} opacity="0.7" />
      {Array.from({ length: 10 }).map((_, j) => <ellipse key={j} transform={`rotate(${j * 36 + T * 3})`} cx="0" cy="-118" rx="10" ry="20" fill="#FFE7AE" />)}
      <circle r="88" fill={P.sol} {...L(4)} />
      <path d="M -36 -8 Q -26 -18 -16 -8 M 16 -8 Q 26 -18 36 -8" fill="none" {...L(5)} />
      <path d="M -20 18 Q 0 34 20 18" fill="none" {...L(5)} />
      <ellipse cx="-50" cy="12" rx="13" ry="8" fill="#FFB9A0" opacity="0.7" /><ellipse cx="50" cy="12" rx="13" ry="8" fill="#FFB9A0" opacity="0.7" />
    </g>
  );
}
function Volcan({ x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -720 0 Q -420 -40 -230 -330 Q -170 -420 -100 -430 Q 0 -400 100 -430 Q 170 -420 230 -330 Q 420 -40 720 0 Z" fill={P.volcan} {...L(5)} />
      <path d="M -100 -430 Q 0 -400 100 -430 Q 150 -424 186 -380 Q 120 -352 70 -372 Q 20 -340 -30 -372 Q -90 -346 -186 -380 Q -150 -424 -100 -430 Z" fill={P.volcanTop} {...L(4)} />
      <path d="M -330 -150 Q -260 -120 -200 -150 M 210 -170 Q 270 -140 330 -165" fill="none" stroke={P.volcanS} strokeWidth="10" strokeLinecap="round" />
    </g>
  );
}
function Lomas({ W, y = 0, c = [P.loma1, P.loma2, P.loma3], cafe }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <ellipse cx={-W * 0.55} cy="40" rx={W * 0.7} ry="230" fill={c[0]} {...L(4)} />
      <ellipse cx={W * 0.6} cy="60" rx={W * 0.75} ry="250" fill={c[1]} {...L(4)} />
      {cafe && <Cafetal W={W} />}
      <ellipse cx="0" cy="120" rx={W * 0.95} ry="200" fill={c[2]} {...L(4)} />
    </g>
  );
}
function Cafetal({ W, filas = 3 }) {
  const out = [];
  for (let r = 0; r < filas; r++) for (let j = 0; j < 9; j++) {
    const x = -W * 0.95 + j * 120 + r * 50, y = -150 + r * 50 + Math.sin(j * 0.7 + r) * 14;
    if (x > -W * 0.1) continue;
    out.push(<g key={`${r}-${j}`}><circle cx={x} cy={y} r={30 - r * 3} fill={P.cafe} {...L(3)} /><circle cx={x + 6} cy={y - 6} r="4" fill={P.grano} /></g>);
  }
  for (let r = 0; r < filas; r++) for (let j = 0; j < 9; j++) {
    const x = W * 0.25 + j * 120 - r * 40, y = -170 + r * 52 + Math.sin(j * 0.9 + r) * 14;
    out.push(<g key={`b${r}-${j}`}><circle cx={x} cy={y} r={30 - r * 3} fill={P.cafeS} {...L(3)} /><circle cx={x - 7} cy={y - 4} r="4" fill={P.grano} /></g>);
  }
  return <g>{out}</g>;
}
function Nubes({ W, T, y = -560 }) {
  return (
    <g opacity="0.95">
      <Cloud x={-W * 0.55 + Math.sin(T * 0.05) * 50} y={y} s={0.75} c={P.nube} />
      <Cloud x={W * 0.48 - Math.sin(T * 0.04) * 40} y={y - 90} s={0.6} c={P.nube} />
      <Cloud x={-W * 0.05 + Math.sin(T * 0.03) * 30} y={y - 210} s={0.45} c={P.nube} />
    </g>
  );
}
function Casita({ x, s = 1 }) {
  return (
    <g transform={`translate(${x} 0) scale(${s})`}>
      <rect x="-220" y="-300" width="440" height="300" rx="10" fill={P.madera} {...L(5)} />
      {[-250, -200, -150, -100, -50].map((y) => <path key={y} d={`M -220 ${y} L 220 ${y}`} stroke={P.maderaS} strokeWidth="4" />)}
      <path d="M -270 -290 L 0 -470 L 270 -290 Z" fill={P.teja} {...L(5)} />
      <path d="M -200 -330 L 200 -330 M -130 -380 L 130 -380 M -60 -425 L 60 -425" stroke={P.tejaS} strokeWidth="5" strokeLinecap="round" />
      <path d="M -60 0 L -60 -170 Q 0 -200 60 -170 L 60 0 Z" fill={P.puerta} {...L(4)} />
      <circle cx="38" cy="-86" r="7" fill="#FFE29A" {...L(3)} />
      {[-150, 150].map((wx) => <g key={wx}><rect x={wx - 46} y="-226" width="92" height="80" rx="8" fill={P.vidrio} {...L(4)} /><path d={`M ${wx} -226 L ${wx} -146`} {...L(4)} /><path d={`M ${wx - 60} -146 L ${wx + 60} -146`} {...L(6)} /></g>)}
      {[[-196, '#F7B7C9'], [-160, '#FFE29A'], [-126, '#F7B7C9'], [128, '#C9B8E8'], [162, '#F7B7C9'], [196, '#FFE29A']].map(([fx, c]) => <circle key={fx} cx={fx} cy="-130" r="11" fill={c} {...L(3)} />)}
    </g>
  );
}
function Flores({ xs, y = 30, s = 1 }) {
  return (
    <g>{xs.map((x, j) => (
      <g key={j} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M 0 0 L 0 -30" {...L(4)} />
        {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.sin(a * Math.PI / 180) * 11} cy={-34 - Math.cos(a * Math.PI / 180) * 11} r="9" fill={P.flor[j % 4]} {...L(3)} />)}
        <circle cx="0" cy="-34" r="6" fill="#FFE29A" {...L(3)} />
      </g>
    ))}</g>
  );
}
function Cerca({ W }) {
  const xs = []; for (let x = -W; x <= W; x += 150) xs.push(x);
  return (
    <g transform="translate(0 -40)">
      <path d={`M ${-W} -60 L ${W} -60 M ${-W} -20 L ${W} -20`} stroke={P.maderaO} strokeWidth="9" strokeLinecap="round" opacity="0.8" />
      {xs.map((x) => <rect key={x} x={x - 9} y="-90" width="18" height="90" rx="6" fill={P.madera} {...L(3)} />)}
    </g>
  );
}

function Fondo({ sc, u, T, fmt }) {
  const W = fmt.W / fmt.s / 2 + 400;
  switch (sc.lugar) {
    case 'volcan': {
      const sube = sc.raw.sol === 'sale' ? glide(seg(u, 0, sc.dur * 0.85)) : 1;
      return (
        <g>
          <Sol x={-70} y={lerp(-250, -560, sube)} s={1} T={T} />
          <Volcan x={0} y={-20} s={1.15} />
          <Nubes W={W} T={T} y={-600} />
          <Lomas W={W} y={30} />
          <rect x={-W} y="160" width={W * 2} height="900" fill={P.loma3} />
          <Flores xs={[-760, -520, -280, 300, 560, 790]} y={130} />
        </g>
      );
    }
    case 'cocina': {
      const ancho = W;
      return (
        <g>
          <rect x={-ancho} y="-1300" width={ancho * 2} height="1300" fill="#F3DCBA" />
          {Array.from({ length: 22 }).map((_, j) => <path key={j} d={`M ${-ancho + j * 140} -1300 L ${-ancho + j * 140} 0`} stroke="#E6C9A1" strokeWidth="5" />)}
          {/* Ventana con vista al cafetal */}
          <g transform="translate(-470 -560)">
            <rect x="-210" y="-170" width="420" height="300" rx="16" fill="#C9E7F2" />
            <clipPath id={`vent-${sc.idx}`}><rect x="-210" y="-170" width="420" height="300" rx="16" /></clipPath>
            <g clipPath={`url(#vent-${sc.idx})`}>
              <Sol x={120} y={-110} s={0.45} T={T} />
              <ellipse cx="-120" cy="110" rx="260" ry="120" fill={P.loma1} {...L(3)} />
              <ellipse cx="160" cy="130" rx="260" ry="120" fill={P.loma2} {...L(3)} />
              {[[-170, 50], [-90, 40], [-10, 55], [70, 60], [150, 62], [-130, 95], [-40, 100], [50, 105], [140, 108]].map(([cx, cy], j) => <g key={j}><circle cx={cx} cy={cy} r="20" fill={P.cafe} {...L(2.5)} /><circle cx={cx + 5} cy={cy - 5} r="3.5" fill={P.grano} /></g>)}
            </g>
            <rect x="-210" y="-170" width="420" height="300" rx="16" fill="none" stroke={P.maderaO} strokeWidth="22" />
            <rect x="-210" y="-170" width="420" height="300" rx="16" fill="none" {...L(4)} />
            <path d="M 0 -170 L 0 130" stroke={P.maderaO} strokeWidth="14" />
            <path d="M -236 140 L 236 140" stroke={P.maderaO} strokeWidth="26" strokeLinecap="round" />
            <path d="M -250 -190 Q -190 -40 -250 140 L -280 140 L -280 -190 Z M 250 -190 Q 190 -40 250 140 L 280 140 L 280 -190 Z" fill="#F7C9D4" {...L(3.5)} />
          </g>
          {/* Repisa con frascos y tacitas */}
          <g transform="translate(470 -620)">
            <rect x="-230" y="0" width="460" height="22" rx="8" fill={P.maderaO} {...L(3.5)} />
            {[[-170, '#F7B7C9', 70], [-90, '#FFE29A', 90], [-10, '#C9B8E8', 64]].map(([fx, c, h]) => <g key={fx}><rect x={fx - 30} y={-h} width="60" height={h} rx="14" fill={c} {...L(3.5)} /><rect x={fx - 34} y={-h - 14} width="68" height="18" rx="6" fill="#E9C59A" {...L(3)} /></g>)}
            {[90, 170].map((tx) => <g key={tx}><path d={`M ${tx - 32} -54 L ${tx + 32} -54 L ${tx + 24} 0 L ${tx - 24} 0 Z`} fill="#FFFFFF" {...L(3.5)} /><path d={`M ${tx + 30} -42 q 22 4 0 26`} fill="none" {...L(5)} /></g>)}
          </g>
          {/* Piso */}
          <rect x={-ancho} y="0" width={ancho * 2} height="900" fill="#E2BE93" />
          <path d={`M ${-ancho} 0 L ${ancho} 0`} {...L(5)} />
          {Array.from({ length: 14 }).map((_, j) => <path key={j} d={`M ${-ancho + j * 220} 0 L ${(-ancho + j * 220) * 1.4} 600`} stroke="#D2AA7E" strokeWidth="4" />)}
        </g>
      );
    }
    case 'garua':
      return (
        <g>
          <Lomas W={W} y={-40} c={['#BCD3B4', '#AFCBA6', '#C9DDC0']} />
          <rect x={-W} y="0" width={W * 2} height="900" fill="#B6D2A4" />
          <path d={`M ${-W} 0 Q 0 -24 ${W} 0`} fill="#B6D2A4" {...L(4)} />
          <path d={`M ${-W} 120 Q -300 60 0 90 Q 300 120 ${W} 70 L ${W} 170 Q 300 210 0 180 Q -300 150 ${-W} 210 Z`} fill="#E6D3B3" {...L(3.5)} />
          <Flores xs={[-860, -620, 640, 880]} y={60} s={1} />
        </g>
      );
    case 'pinal':
      return (
        <g>
          <Sol x={W * 0.45} y={-680} s={0.6} T={T} />
          <Nubes W={W} T={T} y={-640} />
          <Lomas W={W} y={-60} />
          <rect x={-W} y="0" width={W * 2} height="900" fill={P.pasto} />
          <path d={`M ${-W} 0 Q 0 -24 ${W} 0`} fill={P.pasto} {...L(4)} />
          {[-1100, -900, -700, -500, 500, 700, 900, 1100].map((x, j) => <MataPina key={j} x={x} y={-10} s={0.8} fruta={j % 3 !== 1} />)}
          {[-1000, -800, -600, 600, 800, 1000].map((x, j) => <MataPina key={`b${j}`} x={x} y={90} s={1} fruta={j % 2 === 0} />)}
        </g>
      );
    case 'cafetal':
      return (
        <g>
          <Sol x={-W * 0.5} y={-680} s={0.6} T={T} />
          <Nubes W={W} T={T} y={-640} />
          <Lomas W={W} y={-60} cafe />
          <rect x={-W} y="0" width={W * 2} height="900" fill={P.pasto} />
          <path d={`M ${-W} 0 Q 0 -24 ${W} 0`} fill={P.pasto} {...L(4)} />
          {(sc.raw.matas || [-0.7, 0.75]).map((x, j) => <MataCafe key={j} x={x * W * 0.8} y={0} s={1.15} T={T} />)}
        </g>
      );
    case 'hamaca':
      return (
        <g>
          <Sol x={0} y={-720} s={0.55} T={T} />
          <Nubes W={W} T={T} y={-640} />
          <Lomas W={W} y={-60} cafe />
          <rect x={-W} y="0" width={W * 2} height="900" fill={P.pasto} />
          <path d={`M ${-W} 0 Q 0 -24 ${W} 0`} fill={P.pasto} {...L(4)} />
          <Flores xs={[-900, -620, 620, 900]} y={90} s={1.1} />
        </g>
      );
    case 'atardecer': {
      const baja = glide(seg(u, 0, sc.dur * 0.9));
      return (
        <g>
          <Sol x={-W * 0.5} y={lerp(-620, -120, baja)} s={1} T={T} />
          <Volcan x={0} y={-20} s={1.15} />
          <Lomas W={W} y={30} c={['#D7D9A6', '#C9D098', '#E2E2B6']} />
          <rect x={-W} y="160" width={W * 2} height="900" fill="#E2E2B6" />
          <Flores xs={[-760, -520, 560, 790]} y={130} />
        </g>
      );
    }
    case 'noche':
      return (
        <g>
          <Estrellas W={W} T={T} />
          {sc.raw.luna !== false && <Luna x={W * 0.38} y={-720} s={0.85} />}
          <Volcan x={-W * 0.3} y={-150} s={0.62} />
          <Lomas W={W} y={-60} c={['#8FA9A0', '#86A197', '#94AEA2']} />
          <g transform="translate(0 -95)"><Casita x={W * 0.15} s={0.42} /></g>
          <rect x={-W} y="0" width={W * 2} height="900" fill={P.pastoNoche} />
          <path d={`M ${-W} 0 Q 0 -24 ${W} 0`} fill={P.pastoNoche} {...L(4)} />
          {sc.raw.luciernagas && <Luciernagas W={W} T={T} />}
        </g>
      );
    case 'finca':
    default:
      return (
        <g>
          <Sol x={-W * 0.62 + 400} y={-650} s={0.72} T={T} />
          <Volcan x={W * 0.25} y={-150} s={0.62} />
          <Nubes W={W} T={T} y={-620} />
          <Lomas W={W} y={-60} cafe />
          <g transform="translate(0 -95)"><Casita x={-W * 0.12} s={0.42} /></g>
          <rect x={-W} y="0" width={W * 2} height="900" fill={P.pasto} />
          <path d={`M ${-W} 0 Q 0 -24 ${W} 0`} fill={P.pasto} {...L(4)} />
          <Flores xs={[-860, -700, -380, 420, 720, 880]} y={90} s={1.1} />
        </g>
      );
  }
}

// Lo que va delante de los personajes (mesa, olla...) y detrás (parte de atrás de la olla).
function Atras({ sc, poses, fmt, u, T }) {
  const halfW = fmt.W / fmt.s / 2;
  if (sc.raw.carreta) { const x = carretaX(sc, u, halfW), x0 = (Number(sc.raw.carreta.x) || 0) * halfW; return <Carreta x={x} giro={(x - x0) / 112 * 57.3} T={T} />; }
  if (sc.raw.hamaca) return <HamacaAtras T={T} />;
  if (sc.raw.olla) { const c = poses[0]; return <OllaAtras x={(c ? c.x : 0) + 178 * (c ? c.k : 1)} k={c ? c.k : 1} />; }
  return null;
}
function Delante({ sc, poses, fmt, T, u }) {
  const halfW = fmt.W / fmt.s / 2, out = [];
  if (sc.raw.carreta) { const x = carretaX(sc, u, halfW), x0 = (Number(sc.raw.carreta.x) || 0) * halfW; out.push(<CarretaFrente key="cf" x={x} giro={(x - x0) / 112 * 57.3} />); }
  if (sc.raw.hamaca) out.push(<HamacaFrente key="hf" T={T} />);
  if (sc.raw.cobija) out.push(<Cobija key="co" halfW={halfW} />);
  if (sc.raw.gotas && poses[0]) { const c = poses[0]; for (let j = 0; j < 6; j++) { const ph = (T * 0.55 + j / 6) % 1, x = c.x - 70 + ((j * 53) % 150), y0 = -200 * c.k; out.push(<path key={`g${j}`} transform={`translate(${x} ${lerp(y0 - 420, y0, ph)}) scale(1.6)`} d="M 0 -14 Q 9 2 0 10 Q -9 2 0 -14 Z" fill="#BFDDF0" {...L(2.5)} opacity={ph < 0.92 ? 0.95 : 0} />); } }
  if (sc.raw.charco) {
    const cx = (Number(sc.raw.charco.x) || 0) * halfW * 0.92;
    out.push(<ellipse key="ch" cx={cx} cy={40} rx={190} ry={34} fill="#A9CFE8" {...L(4)} />);
    sc.chaps.forEach((t0, j) => { for (let r = 0; r < 2; r++) { const q = seg(u, t0 + r * 0.45, t0 + r * 0.45 + 1.6); if (q > 0 && q < 1) out.push(<ellipse key={`r${j}${r}`} cx={cx} cy={40} rx={40 + 150 * q} ry={8 + 26 * q} fill="none" stroke="#FFFFFF" strokeWidth={5} opacity={1 - q} />); } });
  }
  if (sc.raw.olla) { const c = poses[0], x = (c ? c.x : 0) + 178 * (c ? c.k : 1), k = c ? c.k : 1; out.push(<OllaFrente key="of" x={x} k={k} />); out.push(<Vapor key="va" x={x} y={-150 * k} T={T} />); }
  if (sc.raw.mesa) {
    const lleno = sc.raw.mesa === 'llena';
    out.push(
      <Mesa key="me" halfW={halfW} top={-104}>
        <Plato x={36} y={-112} lleno={lleno} />
        {lleno && <Tortillas x={-210} y={-112} n={2} />}
        {lleno && <Vapor x={36} y={-150} T={T} s={0.6} />}
        <g transform="translate(250 -112)"><path d="M -30 -66 L 30 -66 L 24 0 L -24 0 Z" fill="#FFFFFF" {...L(3.5)} /><path d="M -24 -40 L 24 -40 L 22 -4 L -22 -4 Z" fill="#FFE7B8" /><path d="M 28 -56 q 24 6 0 30" fill="none" {...L(5)} /></g>
      </Mesa>
    );
  }
  return <g>{out}</g>;
}

// Notitas musicales que flotan despacio mientras cantan.
function Notas({ T, W }) {
  return <g>{Array.from({ length: 7 }).map((_, j) => { const ph = (T * 0.16 + j / 7) % 1, x = -W * 0.8 + j * (W * 1.6 / 6) + Math.sin(T * 0.8 + j) * 30; return <text key={j} x={x} y={-420 - ph * 260} fontFamily={FT} fontWeight="600" fontSize={60} fill={P.flor[j % 3]} stroke={TINTA} strokeWidth="3" paintOrder="stroke" opacity={Math.sin(ph * Math.PI) * 0.9}>{j % 2 ? '♪' : '♫'}</text>; })}</g>;
}

// Cámara: va despacito de un encuadre al otro durante la escena.
function camara(sc, u) {
  const c = sc.camara;
  const a = Object.assign({ x: 0, y: 0, z: 1 }, c ? c[0] : {}), b = Object.assign({ x: 0, y: 0, z: 1.04 }, c ? c[1] || c[0] : { z: 1.04 });
  const q = glide(clamp(u / sc.dur, 0, 1));
  return { x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q), z: lerp(a.z, b.z, q) };
}

function Escena({ sc, u, T, fmt }) {
  const n = sc.cast.length;
  const poses = sc.cast.map((c) => pose(c, u, T, sc, fmt, n));
  const cam = camara(sc, u), s = fmt.s * cam.z;
  if (fmt.id === 'vertical') cam.y -= 140; // en vertical, los personajes un poco más abajo
  return (
    <g>
      <Cielo fmt={fmt} colores={sc.lugar === 'noche' ? P.cieloNoche : sc.lugar === 'garua' ? P.cieloGris : sc.lugar === 'atardecer' ? P.cieloTarde : P.cielo} id={sc.idx} />
      {/* El centro de la pantalla mira al punto (cam.x, cam.y) medido desde el encuadre normal. */}
      <g transform={`translate(${fmt.W / 2} ${fmt.H / 2}) scale(${s}) translate(${-cam.x} ${-(cam.y - (fmt.GY - fmt.H / 2) / fmt.s)})`}>
        <Fondo sc={sc} u={u} T={T} fmt={fmt} />
        {sc.raw.notas && <Notas T={T} W={fmt.W / fmt.s / 2} />}
        <Atras sc={sc} poses={poses} fmt={fmt} u={u} T={T} />
        {poses.map((p, j) => {
          if (p.hidden) return null;
          return <g key={j}>{!sc.cast[j].sentada && !sc.cast[j].hamaca && <ellipse cx={p.x} cy={6} rx={78 * p.k * p.pop} ry={12 * p.k} fill={TINTA} opacity="0.12" />}<Character id={sc.cast[j].id} p={Object.assign({}, p, { noShadow: true })} T={T} /></g>;
        })}
        <Delante sc={sc} poses={poses} fmt={fmt} T={T} u={u} />
        {sc.raw.lluvia && <Lluvia W={fmt.W / fmt.s / 2 + 300} T={T} />}
        {sc.muestras.map((m, j) => <Burbuja key={`m${j}`} m={m} u={u} T={T} />)}
        {sc.numeros.map((m, j) => <Numero key={`n${j}`} m={m} u={u} />)}
      </g>
    </g>
  );
}

// Filtros de acuarela: bordes apenas temblorosos, colores lavados y textura de papel.
function Filtros({ fmt }) {
  return (
    <defs>
      <filter id="acuarela" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="ruido" />
        <feDisplacementMap in="SourceGraphic" in2="ruido" scale="5" xChannelSelector="R" yChannelSelector="G" result="mov" />
        <feColorMatrix in="mov" type="saturate" values="0.86" result="sat" />
        <feComponentTransfer in="sat"><feFuncR type="linear" slope="0.93" intercept="0.06" /><feFuncG type="linear" slope="0.93" intercept="0.06" /><feFuncB type="linear" slope="0.93" intercept="0.055" /></feComponentTransfer>
      </filter>
      <filter id="papel" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="3" result="g" />
        <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.28  0 0 0 -1.6 1.1" />
      </filter>
      <filter id="manchas" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="11" result="m" />
        <feColorMatrix in="m" type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.9  0 0 0 -2.2 1.25" />
      </filter>
      <radialGradient id="vineta" cx="50%" cy="50%" r="75%"><stop offset="0.65" stopColor="#FFF8EC" stopOpacity="0" /><stop offset="1" stopColor="#FFF8EC" stopOpacity="0.75" /></radialGradient>
    </defs>
  );
}

function Episodio({ plan, fmt }) {
  const { T } = useComposition();
  let i = 0;
  while (i < plan.scenes.length - 1 && T >= plan.scenes[i + 1].start) i++;
  const sc = plan.scenes[i], u = T - sc.start;
  const fade = 1.0, prev = i > 0 && u < fade ? plan.scenes[i - 1] : null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#FFF8EC' }}>
      <svg width={fmt.W} height={fmt.H} viewBox={`0 0 ${fmt.W} ${fmt.H}`} style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <Filtros fmt={fmt} />
        <g filter="url(#acuarela)">
          {prev && <Escena sc={prev} u={prev.dur + u} T={T} fmt={fmt} />}
          <g opacity={prev ? glide(seg(u, 0, fade)) : 1}><Escena sc={sc} u={u} T={T} fmt={fmt} /></g>
        </g>
        <rect width={fmt.W} height={fmt.H} filter="url(#manchas)" opacity="0.22" />
        <rect width={fmt.W} height={fmt.H} filter="url(#papel)" opacity="0.16" />
        <rect width={fmt.W} height={fmt.H} fill="url(#vineta)" />
      </svg>
    </div>
  );
}

function EpisodioBebes(props) {
  const fmt = FMT[props.format] || FMT.horizontal;
  React.useMemo(() => E.setTinta(TINTA, 4.5), []);
  const plan = React.useMemo(() => planBebes(props.story, fmt, props.duraciones, props.voz || props.story.id), [props.story, fmt, props.duraciones]);
  React.useEffect(() => { if (props.onPlan) props.onPlan(plan); }, [plan]);
  const scenesJSON = React.useMemo(() => JSON.stringify(plan.scenes.map((s) => ({ name: s.label, dur: s.dur }))), [plan]);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#1B1410' }}>
      <CompositionStage key={scenesJSON + fmt.id} width={fmt.W} height={fmt.H} scenes={scenesJSON} bg="#1B1410">
        <Episodio plan={plan} fmt={fmt} />
      </CompositionStage>
    </div>
  );
}

Object.assign(window, { EpisodioBebes, TC_BEBES: { planBebes, fraseId } });
})();
