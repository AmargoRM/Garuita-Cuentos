// Música de fondo y efectos de sonido para grabar los videos.
//
// La música es ORIGINAL: no usa grabaciones ni canciones de nadie. Este archivo la
// compone y la "toca" con instrumentos sintetizados (ukelele, marimba, bajo, maraca,
// cajita de música), así que no tiene derechos de autor de terceros (ver musica/LICENCIAS.md).
//
// Cada cuento recibe su propia variación (tonalidad, acordes y melodía) a partir de su
// nombre, siempre con el mismo estilo alegre de Garuita. En las escenas de noche suena
// una cajita de música suave. Mientras habla el narrador la música baja sola.
//
// Los efectos de sonido son los mismos del motor (saltos, risas, "boing"...): aquí se
// graban en su segundo exacto, en vez de sonar por los parlantes.
(function () {
  const SR = 48000;

  // Números "al azar" pero siempre iguales para el mismo cuento.
  function semilla(texto) {
    let h = 2166136261;
    for (const ch of String(texto)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  function azar(seed) {
    let a = seed || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // ── Instrumentos (cada nota se calcula una vez y se reutiliza) ──────────
  const cache = new Map();
  function nota(ctx, tipo, midi) {
    const k = `${tipo}:${midi}:${ctx.sampleRate}`;
    if (cache.has(k)) return cache.get(k);
    const sr = ctx.sampleRate, f = hz(midi);
    const largo = { uke: 1.6, marimba: 1.0, bajo: 0.9, caja: 2.2, maraca: 0.12, palo: 0.15, tambor: 0.4 }[tipo];
    const n = Math.floor(sr * largo), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const r = azar(midi * 7919 + tipo.length);
    if (tipo === 'uke') {
      // Cuerda pulsada (Karplus-Strong): suena parecido a un ukelele.
      const N = Math.max(2, Math.round(sr / f)), lin = new Float32Array(N);
      let prev = 0;
      for (let i = 0; i < N; i++) { const x = r() * 2 - 1; prev = prev * 0.55 + x * 0.45; lin[i] = prev; }
      let p = 0;
      for (let i = 0; i < n; i++) {
        const a = lin[p], b = lin[(p + 1) % N];
        d[i] = a; lin[p] = 0.4985 * (a + b); p = (p + 1) % N;
      }
    } else if (tipo === 'marimba') {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5.5) + 0.35 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 22) + 0.12 * Math.sin(2 * Math.PI * f * 10 * t) * Math.exp(-t * 60); }
    } else if (tipo === 'bajo') {
      for (let i = 0; i < n; i++) { const t = i / sr, ph = (f * t) % 1; const tri = 4 * Math.abs(ph - 0.5) - 1; d[i] = (0.8 * Math.sin(2 * Math.PI * f * t) + 0.3 * tri) * Math.exp(-t * 4) * Math.min(1, t * 400); }
    } else if (tipo === 'caja') {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 3) + 0.2 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 6)) * Math.exp(-t * 2.2) * Math.min(1, t * 600); }
    } else if (tipo === 'maraca') {
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, x = r() * 2 - 1; lp = lp * 0.6 + x * 0.4; d[i] = (x - lp) * Math.exp(-t * 45) * Math.min(1, t * 900); }
    } else if (tipo === 'tambor') {
      // Tambor grave (bombo de feria) que baja de tono al sonar: le da empuje a la acción.
      for (let i = 0; i < n; i++) { const t = i / sr, fr = 55 + 90 * Math.exp(-t * 28); d[i] = Math.sin(2 * Math.PI * fr * t) * Math.exp(-t * 9) * Math.min(1, t * 2000); }
    } else if (tipo === 'palo') {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 820 * t) * Math.exp(-t * 55) + 0.4 * Math.sin(2 * Math.PI * 1230 * t) * Math.exp(-t * 70); }
    }
    cache.set(k, buf);
    return buf;
  }

  function tocar(ctx, destino, tipo, midi, t, vol, pan = 0) {
    if (t < 0) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = nota(ctx, tipo, midi); g.gain.value = vol; p.pan.value = pan;
    s.connect(g); g.connect(p); p.connect(destino); s.start(t);
  }

  // Eco suave de sala, para que los instrumentos no suenen "secos".
  function sala(ctx) {
    const n = Math.floor(ctx.sampleRate * 1.6), b = ctx.createBuffer(2, n, ctx.sampleRate), r = azar(42);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, 3); }
    const cv = ctx.createConvolver(); cv.buffer = b; return cv;
  }

  // ── Composición ─────────────────────────────────────────────────────────
  const PROGRESIONES = [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [3, 0, 4, 0], [0, 3, 0, 4], [5, 3, 0, 4]];
  const MAYOR = [0, 2, 4, 5, 7, 9, 11];
  const RITMOS = [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 3, 4, 6], [0, 2, 3, 4], [0, 4, 6], [0, 2, 4], [0, 2, 4, 5, 6], [0, 6]];
  const RASGUEO = [[0, 1, 0.55], [2, 1, 0.5], [3, -1, 0.35], [5, -1, 0.4], [6, 1, 0.5], [7, -1, 0.3]]; // [octavo, dirección, fuerza]

  // Grado de la escala (puede ser negativo o pasar de 7) -> nota MIDI.
  const grado = (tonica, g) => tonica + 12 * Math.floor(g / 7) + MAYOR[((g % 7) + 7) % 7];
  const acorde = (tonica, g) => [grado(tonica, g), grado(tonica, g + 2), grado(tonica, g + 4)];

  function componer(clave) {
    const r = azar(semilla(clave));
    const tonica = [60, 62, 65, 67, 64][Math.floor(r() * 5)];
    const pA = PROGRESIONES[Math.floor(r() * PROGRESIONES.length)];
    let pB = PROGRESIONES[Math.floor(r() * PROGRESIONES.length)];
    if (pB === pA) pB = PROGRESIONES[(PROGRESIONES.indexOf(pA) + 1) % PROGRESIONES.length];
    // Melodía: 4 compases por progresión. Notas fuertes = notas del acorde,
    // las demás se mueven de a un paso en la escala pentatónica (suena alegre y simple).
    const penta = [0, 1, 2, 4, 5];
    const hacerFrase = (prog) => {
      const compases = [];
      let g = 7 + prog[0] + [0, 2, 4][Math.floor(r() * 3)];
      for (let c = 0; c < 4; c++) {
        const ritmo = c === 3 ? [0, 2, 4] : RITMOS[Math.floor(r() * RITMOS.length)];
        const notas = ritmo.map((paso, i) => {
          if (i === 0 || paso === 4) {
            const ac = [prog[c], prog[c] + 2, prog[c] + 4].map((x) => x + 7);
            g = ac.reduce((m, x) => (Math.abs(x - g) < Math.abs(m - g) ? x : m), ac[0]);
          } else {
            g += r() < 0.5 ? 1 : -1;
            while (!penta.includes(((g % 7) + 7) % 7)) g += r() < 0.5 ? 1 : -1;
          }
          g = Math.max(5, Math.min(13, g));
          return [paso, g];
        });
        compases.push(notas);
      }
      // Termina en la tónica, para que la frase "cierre".
      const ult = compases[3]; ult[ult.length - 1] = [ult[ult.length - 1][0], prog[3] === 0 ? 7 : 7 + prog[3]];
      return compases;
    };
    const fraseA = hacerFrase(pA), fraseB = hacerFrase(pB);
    return { tonica, pA, pB, fraseA, fraseB, bpm: 100 + Math.floor(r() * 10) };
  }

  // Dibuja toda la música del video. `noche(t)` dice si en el segundo t es de noche y
  // `animo(t)` cómo va la música en ese momento: tranquila, accion, fiesta, triste o silencio
  // (null = la de siempre).
  function musica(ctx, destino, { clave, largo, noche, animo = () => null, bpm }) {
    const m = componer(clave);
    if (bpm) m.bpm = bpm; // canal de bebés: más lento
    const pulso = 60 / m.bpm, octavo = pulso / 2, compas = pulso * 4;
    const wet = sala(ctx), gw = ctx.createGain(); gw.gain.value = 0.22; wet.connect(gw); gw.connect(destino);
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(destino); bus.connect(wet);
    // Forma de 8 compases: A A B A, y cada tanto un bloque "liviano" sin melodía para descansar el oído.
    const totalCompases = Math.ceil(largo / compas) + 1;
    for (let c = 0; c < totalCompases; c++) {
      const t0 = c * compas;
      const bloque = Math.floor(c / 4), enBloque = c % 4;
      const forma = ['A', 'A', 'B', 'A', 'L'][bloque % 5];
      const prog = forma === 'B' ? m.pB : m.pA, frase = forma === 'B' ? m.fraseB : m.fraseA;
      const ac = acorde(m.tonica, prog[enBloque]);
      const raiz = grado(m.tonica, prog[enBloque]) - 24;
      const an = animo(t0 + 0.1);
      if (an === 'silencio') continue;
      if (an === 'triste') {
        // Triste: cajita lenta, suave, y un bajo largo; sin ritmo.
        [0, 2].forEach((k, i) => tocar(ctx, bus, 'caja', ac[k] + 12, t0 + i * 2 * pulso, 0.08, i ? 0.3 : -0.3));
        tocar(ctx, bus, 'bajo', raiz, t0, 0.14);
        continue;
      }
      if (noche(t0 + 0.1) || an === 'cuna') {
        // Noche: cajita de música en arpegio lento y bajo largo.
        [0, 1, 2, 1].forEach((k, i) => tocar(ctx, bus, 'caja', ac[k] + 12, t0 + i * pulso, 0.10, i % 2 ? 0.3 : -0.3));
        tocar(ctx, bus, 'bajo', raiz, t0, 0.18);
        continue;
      }
      if (an === 'suave' || an === 'canto') {
        // Bebés: ukelele suave en tiempos fuertes, bajo largo y melodía de marimba bajita.
        // Sin maracas ni tambor. En "canto" la melodía va más presente (acompaña la canción).
        const canto = an === 'canto';
        [0, 4].forEach((p8, j) => [ac[0], ac[1], ac[2]].forEach((nn, i) => tocar(ctx, bus, 'uke', nn, t0 + p8 * octavo + i * 0.03, (canto ? 0.09 : 0.065) * (j ? 0.8 : 1), -0.3)));
        tocar(ctx, bus, 'bajo', raiz, t0, 0.2);
        if (forma === 'L') { tocar(ctx, bus, 'caja', ac[2] + 12, t0, 0.05, 0.25); tocar(ctx, bus, 'caja', ac[1] + 12, t0 + 2 * pulso, 0.04, 0.25); }
        else frase[enBloque].forEach(([p8, g]) => tocar(ctx, bus, canto ? 'marimba' : 'caja', grado(m.tonica, g) + (canto ? 0 : 12), t0 + p8 * octavo, canto ? 0.2 : 0.06, 0.2));
        continue;
      }
      const calma = an === 'tranquila', accion = an === 'accion' || an === 'fiesta';
      const fu = calma ? 0.7 : accion ? 1.15 : 1;
      // Ukelele rasgueado (en la calma, solo los golpes fuertes).
      RASGUEO.forEach(([p, dir, fuerza], j) => {
        if (calma && j % 2) return;
        const cuerdas = [ac[0], ac[1], ac[2], ac[0] + 12];
        (dir > 0 ? cuerdas : cuerdas.slice().reverse()).forEach((n, i) => tocar(ctx, bus, 'uke', n, t0 + p * octavo + i * 0.012, 0.16 * fuerza * fu, -0.3));
      });
      // Bajo: raíz y quinta (en la acción, saltando en cada tiempo).
      if (accion) [0, 7, 12, 7].forEach((iv, k) => tocar(ctx, bus, 'bajo', raiz + iv, t0 + k * pulso, 0.3));
      else { tocar(ctx, bus, 'bajo', raiz, t0, 0.32 * fu); if (!calma) tocar(ctx, bus, 'bajo', raiz + 7, t0 + 2 * pulso, 0.26); }
      // Maraca y palito. Acción: maraca en dieciseisavos, palito en cada tiempo y tambor.
      if (accion) {
        for (let k = 0; k < 16; k++) tocar(ctx, bus, 'maraca', 0, t0 + (k * octavo) / 2, k % 2 ? 0.045 : 0.085, 0.4);
        for (let k = 0; k < 4; k++) tocar(ctx, bus, 'palo', 0, t0 + k * pulso, k % 2 ? 0.08 : 0.05, -0.15);
        [0, 1.5, 2, 3.5].forEach((b) => tocar(ctx, bus, 'tambor', 0, t0 + b * pulso, 0.42));
      } else if (!calma) {
        for (let k = 0; k < 8; k++) tocar(ctx, bus, 'maraca', 0, t0 + k * octavo, k % 2 ? 0.05 : 0.09, 0.4);
        tocar(ctx, bus, 'palo', 0, t0 + pulso, 0.06, -0.15); tocar(ctx, bus, 'palo', 0, t0 + 3 * pulso, 0.06, -0.15);
      } else tocar(ctx, bus, 'palo', 0, t0 + 2 * pulso, 0.04, -0.15);
      // Fiesta: unas chispitas de cajita encima.
      if (an === 'fiesta') [0, 1, 2].forEach((k) => tocar(ctx, bus, 'caja', ac[k] + 24, t0 + (k * 2 + 1) * octavo, 0.05, 0.35));
      // Melodía (marimba) o, en el bloque liviano, solo unas gotitas de cajita.
      if (forma === 'L' && !accion) {
        tocar(ctx, bus, 'caja', ac[2] + 12, t0, 0.06, 0.25); tocar(ctx, bus, 'caja', ac[1] + 12, t0 + 2.5 * pulso, 0.05, 0.25);
      } else {
        frase[enBloque].forEach(([p, g]) => {
          tocar(ctx, bus, 'marimba', grado(m.tonica, g), t0 + p * octavo, 0.22 * (calma ? 0.75 : 1), 0.2);
          if (accion) tocar(ctx, bus, 'marimba', grado(m.tonica, g) + 12, t0 + p * octavo, 0.1, -0.2); // la melodía doblada arriba
        });
      }
    }
    return { bus, m };
  }

  // Baja la música mientras habla el narrador (y la sube despacito al terminar).
  function bajarConVoz(param, tramos, { normal = 1, conVoz = 0.3, bajar = 0.25, subir = 0.6 } = {}) {
    param.setValueAtTime(normal, 0);
    const unidos = [];
    tramos.slice().sort((a, b) => a[0] - b[0]).forEach(([a, b]) => {
      const u = unidos[unidos.length - 1];
      if (u && a - u[1] < bajar + subir + 0.3) u[1] = Math.max(u[1], b); else unidos.push([a, b]);
    });
    unidos.forEach(([a, b]) => {
      const ini = Math.max(0, a - bajar);
      param.setValueAtTime(normal, ini);
      param.linearRampToValueAtTime(conVoz, Math.max(ini + 0.01, a));
      param.setValueAtTime(conVoz, b);
      param.linearRampToValueAtTime(normal, b + subir);
    });
  }

  function aEntero(buf) {
    const n = buf.length, l = buf.getChannelData(0), r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
    const out = new Int16Array(n * 2);
    for (let i = 0; i < n; i++) {
      out[2 * i] = Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767)));
      out[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767)));
    }
    return out;
  }

  // plan: el plan que deja main.jsx (escenas, eventos, narración).
  // Devuelve { musica, efectos }: audio estéreo de 16 bits, 48 kHz, desde `desde` hasta `hasta`.
  async function grabarSonido({ plan, desde = 0, hasta, musica: conMusica = true, efectos: conEfectos = true }) {
    const largo = Math.max(0.1, (hasta ?? plan.total) - desde);
    const n = Math.ceil(largo * SR);
    const res = { musica: null, efectos: null, info: {} };
    const escenaEn = (t) => { let i = 0; while (i < plan.scenes.length - 1 && t >= plan.scenes[i + 1].start) i++; return plan.scenes[i]; };
    const tramosVoz = plan.scenes.filter((s) => s.narr).map((s) => [s.start + s.narr[0] - desde, s.start + s.narr[1] - desde]);
    // Los diálogos de los personajes también bajan la música.
    plan.scenes.forEach((s) => (s.lines || []).forEach((l) => tramosVoz.push([s.start + l.t0 - desde, s.start + l.t1 - desde])));
    // Ánimo de la música en el segundo t (lo pone cada escena del cuento).
    const animoEn = (t) => { const sc = escenaEn(t), u = t - sc.start; let a = null; (sc.moods || []).forEach(([t0, x]) => { if (u >= t0) a = x; }); return a; };

    if (conMusica) {
      // La música se compone desde el segundo 0 del cuento: si se graba un pedazo, se dibuja entera y se recorta.
      const fin = desde + largo;
      const ctx = new OfflineAudioContext(2, Math.ceil(fin * SR), SR);
      const master = ctx.createGain(), duck = ctx.createGain();
      master.connect(duck); duck.connect(ctx.destination);
      const { m } = musica(ctx, master, { clave: plan.key || 'garuita', largo: fin, noche: (t) => escenaEn(t).lugar === 'noche', animo: animoEn, bpm: plan.bpm });
      bajarConVoz(duck.gain, tramosVoz.map(([a, b]) => [a + desde, b + desde]), { conVoz: 0.42 });
      // Entra suave al principio y se apaga suave al final.
      master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(1, 1.2);
      master.gain.setValueAtTime(1, Math.max(1.3, fin - 2.5)); master.gain.linearRampToValueAtTime(0, fin);
      const todo = aEntero(await ctx.startRendering());
      res.musica = todo.slice(Math.round(desde * SR) * 2, (Math.round(desde * SR) + n) * 2);
      res.info = { tonica: m.tonica, bpm: m.bpm };
    }

    if (conEfectos && window.GaruitaSFX) {
      const ctx = new OfflineAudioContext(2, n, SR);
      const SFX = window.GaruitaSFX, guardado = { ctx: SFX.ctx, buf: SFX.buf, at: SFX.at, dest: SFX.dest, offline: SFX.offline };
      const g = ctx.createGain(); g.connect(ctx.destination);
      Object.assign(SFX, { ctx, buf: null, dest: g, offline: true });
      try {
        (plan.events || []).forEach((e) => { if (e.t >= desde && e.t < desde + largo) { SFX.at = e.t - desde; SFX.play(e.s, e.a || {}); } });
      } finally { Object.assign(SFX, guardado); }
      res.efectos = aEntero(await ctx.startRendering());
    }
    return res;
  }

  window.GaruitaMusica = { grabarSonido, componer };
})();
