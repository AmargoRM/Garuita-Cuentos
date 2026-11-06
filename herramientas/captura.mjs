// Captura un cuento sin Claude Design.
//
//   npm run captura -- --cuento ejemplo --formato horizontal --fotos 6
//       -> salida/ejemplo-horizontal-01.png ... (fotos repartidas en el cuento)
//   npm run captura -- --cuento ejemplo --formato vertical --video
//       -> salida/ejemplo-vertical.mp4 (30 cuadros por segundo)
//
// El video sale con música de fondo original (motor/musica.js), los efectos de sonido
// del motor y, si el cuento tiene narración importada (npm run voz), con esa voz.
// La música baja sola mientras habla el narrador.
// Opciones: --edad ninos | --fps 30 | --desde 0 --hasta 10 (segundos, para pruebas)
//           --sin-voz (ignora la narración) | --sin-musica | --sin-efectos
//           --volumen-musica 1 (más alto: 1.5, más bajo: 0.6)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { crearServidor } from './servidor.mjs';

// Playwright (navegador automático) se busca donde esté instalado.
const { chromium } = createRequire(import.meta.url)('playwright');

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };

const cuento = String(opt('cuento', 'ejemplo'));
const formato = opt('formato', 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
const edad = opt('edad', 'bebes');
const fps = Number(opt('fps', 30));
const quiereVideo = opt('video', false) === true;
const fotos = Number(opt('fotos', 6));
const sinVoz = opt('sin-voz', false) === true;
const sinMusica = opt('sin-musica', false) === true;
const sinEfectos = opt('sin-efectos', false) === true;
const volumenMusica = Number(opt('volumen-musica', 1)) || 1;
const [W, H] = formato === 'vertical' ? [1080, 1920] : [1920, 1080];

if (!fs.existsSync(path.join(raiz, 'publico', 'motor.js'))) {
  console.error('Falta publico/motor.js. Corré primero: npm run build');
  process.exit(1);
}
const salida = path.join(raiz, 'salida');
fs.mkdirSync(salida, { recursive: true });

const servidor = crearServidor();
await new Promise((r) => servidor.listen(0, r));
const url = `http://localhost:${servidor.address().port}/?captura&cuento=${encodeURIComponent(cuento)}&formato=${formato}&edad=${edad}${sinVoz ? '&narracion=no' : ''}`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errores = [];
pagina.on('pageerror', (e) => errores.push(e.message));
pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

try {
  await pagina.goto(url);
  await pagina.waitForFunction(() => (window.__garuitaListo && window.__garuita && window.__garuitaNarracion) || window.__garuitaError, null, { timeout: 30000 });
  const err = await pagina.evaluate(() => window.__garuitaError);
  if (err) throw new Error(err);
  const duracion = await pagina.evaluate(() => window.__garuita.duracion);
  const desde = Number(opt('desde', 0));
  const hasta = Math.min(Number(opt('hasta', duracion)), duracion);
  const narracion = await pagina.evaluate(() => window.__garuitaNarracion);
  console.log(`Cuento "${cuento}" (${formato}): ${duracion.toFixed(1)} s, ${narracion.length ? `${narracion.length} audios de narración` : 'sin narración'}`);
  const lienzo = pagina.locator('#lienzo');
  const ir = (t) => pagina.evaluate((x) => window.__garuita.ir(x), t);

  if (!quiereVideo) {
    for (let i = 0; i < fotos; i++) {
      const t = desde + ((hasta - desde) * (i + 0.5)) / fotos;
      await ir(t);
      const f = path.join(salida, `${cuento}-${formato}-${String(i + 1).padStart(2, '0')}.png`);
      await lienzo.screenshot({ path: f });
      console.log(`  foto ${i + 1}/${fotos} en ${t.toFixed(1)} s -> ${path.relative(raiz, f)}`);
    }
  } else {
    const archivo = path.join(salida, `${cuento}-${formato}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', archivo],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const termino = new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg terminó con código ${c}`)))));
    const total = Math.round((hasta - desde) * fps);
    for (let i = 0; i < total; i++) {
      await ir(desde + i / fps);
      const buf = await lienzo.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % fps === 0) process.stdout.write(`\r  cuadro ${i}/${total}`);
    }
    ff.stdin.end();
    await termino;
    const usados = narracion.filter((n) => n.inicio >= desde && n.inicio < hasta);
    process.stdout.write(`\n  armando el sonido: ${[usados.length && `${usados.length} audios de narración`, !sinMusica && 'música', !sinEfectos && 'efectos'].filter(Boolean).join(', ') || 'nada'}`);
    const pistas = await grabarPistas(pagina, archivo, desde, hasta);
    ponerSonido(archivo, usados, pistas, desde, hasta - desde);
    console.log(`\n  video -> ${path.relative(raiz, archivo)}`);
  }
  if (errores.length) { console.error('Errores en la página:\n  ' + errores.join('\n  ')); process.exitCode = 1; }
} finally {
  await navegador.close();
  servidor.close();
}

// Pide al motor la música y los efectos ya dibujados y los guarda como WAV junto al video.
async function grabarPistas(pagina, archivo, desde, hasta) {
  if (sinMusica && sinEfectos) return {};
  const largos = await pagina.evaluate((o) => window.__garuitaGrabarSonido(o), { desde, hasta, musica: !sinMusica, efectos: !sinEfectos });
  const pistas = {};
  for (const nombre of ['musica', 'efectos']) {
    if (!largos[nombre]) continue;
    const partes = [];
    for (let i = 0; i < largos[nombre]; i += 4_000_000) {
      partes.push(Buffer.from(await pagina.evaluate(([p, a, b]) => window.__garuitaPedazo(p, a, b), [nombre, i, 4_000_000]), 'base64'));
    }
    const f = archivo.replace(/\.mp4$/, `.${nombre}.wav`);
    fs.writeFileSync(f, wav(Buffer.concat(partes), 48000, 2));
    pistas[nombre] = f;
  }
  return pistas;
}

// Arma un archivo WAV (16 bits) a partir de los datos crudos.
function wav(datos, sr, canales) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + datos.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(canales, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * canales * 2, 28); h.writeUInt16LE(canales * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(datos.length, 40);
  return Buffer.concat([h, datos]);
}

// Junta el video mudo con la voz (cada audio en su segundo exacto), la música y los efectos.
// Volúmenes: voz al 100 %, efectos bien audibles y la música de fondo bien por debajo.
// Al final se empareja el volumen general al nivel que usa YouTube (-14 LUFS).
function ponerSonido(archivo, lista, pistas, desde, largo) {
  const temporal = archivo.replace(/\.mp4$/, '.con-sonido.mp4');
  const entradas = [], filtros = [], mezcla = [];
  const estereo = 'aresample=48000,aformat=channel_layouts=stereo';
  lista.forEach((n) => {
    const i = entradas.length / 2 + 1, ms = Math.max(0, Math.round((n.inicio - desde) * 1000));
    entradas.push('-i', path.join(raiz, n.archivo));
    filtros.push(`[${i}:a]${estereo},adelay=${ms}:all=1${n.vol ? `,volume=${Number(n.vol).toFixed(2)}` : ''}[v${i}]`); mezcla.push(`[v${i}]`);
  });
  if (pistas.efectos) {
    const i = entradas.length / 2 + 1; entradas.push('-i', pistas.efectos);
    filtros.push(`[${i}:a]${estereo},volume=2.2[e]`); mezcla.push('[e]');
  }
  if (pistas.musica) {
    const i = entradas.length / 2 + 1; entradas.push('-i', pistas.musica);
    filtros.push(`[${i}:a]${estereo},volume=${(0.55 * volumenMusica).toFixed(3)}[m]`); mezcla.push('[m]');
  }
  if (!mezcla.length) return;
  const base = `${filtros.join(';')};${mezcla.join('')}amix=inputs=${mezcla.length}:normalize=0,apad,atrim=0:${largo.toFixed(3)}`;
  // Primera pasada: medir el volumen. Segunda: corregirlo parejo (sin "bombeo").
  const medida = spawnSync('ffmpeg', ['-hide_banner', '-i', archivo, ...entradas, '-filter_complex', `${base},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[s]`, '-map', '[s]', '-f', 'null', '-'], { encoding: 'utf8' });
  const json = JSON.parse((medida.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/) || ['{}'])[0]);
  const ln = json.input_i && isFinite(Number(json.input_i))
    ? `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`
    : 'loudnorm=I=-14:TP=-1.5:LRA=11';
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', archivo, ...entradas, '-filter_complex', `${base},${ln},aresample=48000[s]`,
    '-map', '0:v', '-map', '[s]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', temporal], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg no pudo agregar el sonido');
  fs.renameSync(temporal, archivo);
}
