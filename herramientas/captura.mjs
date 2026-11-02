// Captura un cuento sin Claude Design.
//
//   npm run captura -- --cuento ejemplo --formato horizontal --fotos 6
//       -> salida/ejemplo-horizontal-01.png ... (fotos repartidas en el cuento)
//   npm run captura -- --cuento ejemplo --formato vertical --video
//       -> salida/ejemplo-vertical.mp4 (30 cuadros por segundo)
//
// Si el cuento tiene narración importada (npm run voz), el video sale con esa voz.
// Opciones: --edad ninos | --fps 30 | --desde 0 --hasta 10 (segundos, para pruebas)
//           --sin-voz (ignora la narración)
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
    if (usados.length) {
      process.stdout.write(`\n  agregando ${usados.length} audios de narración`);
      ponerVoz(archivo, usados, desde, hasta - desde);
    }
    console.log(`\n  video -> ${path.relative(raiz, archivo)}`);
  }
  if (errores.length) { console.error('Errores en la página:\n  ' + errores.join('\n  ')); process.exitCode = 1; }
} finally {
  await navegador.close();
  servidor.close();
}

// Junta el video mudo con cada audio de narración, puesto en su segundo exacto.
function ponerVoz(archivo, lista, desde, largo) {
  const temporal = archivo.replace(/\.mp4$/, '.con-voz.mp4');
  const entradas = lista.flatMap((n) => ['-i', path.join(raiz, n.archivo)]);
  const pistas = lista.map((n, i) => {
    const ms = Math.max(0, Math.round((n.inicio - desde) * 1000));
    return `[${i + 1}:a]aresample=48000,adelay=${ms}:all=1[a${i}]`;
  });
  const mezcla = `${pistas.join(';')};${lista.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lista.length}:normalize=0,apad,atrim=0:${largo.toFixed(3)}[voz]`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', archivo, ...entradas, '-filter_complex', mezcla,
    '-map', '0:v', '-map', '[voz]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', temporal], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg no pudo agregar la narración');
  fs.renameSync(temporal, archivo);
}
