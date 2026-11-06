// Importa la narración que genera el cuaderno de Colab (voz/garuita-voz-chatterbox.ipynb).
//
//   npm run voz -- --cuento rio-limpio --zip ~/Descargas/rio-limpio-voz.zip
//       -> voz/rio-limpio/titulo.wav, escena-01.wav, ... y voz/rio-limpio/duraciones.json
//
// También sirve --carpeta ruta/ si los audios ya están descomprimidos.
// Después de importar, `npm run captura -- --cuento rio-limpio --video` sale con voz.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i < 0 ? null : args[i + 1]; };

const cuento = String(opt('cuento') || '').replace(/[^a-zA-Z0-9_-]/g, '');
const zip = opt('zip');
let carpeta = opt('carpeta');
if (!cuento || (!zip && !carpeta)) {
  console.error('Uso: npm run voz -- --cuento NOMBRE --zip archivo.zip   (o --carpeta ruta)');
  process.exit(1);
}
const archivoCuento = path.join(raiz, 'cuentos', `${cuento}.json`);
if (!fs.existsSync(archivoCuento)) { console.error(`No encontré cuentos/${cuento}.json`); process.exit(1); }
const historia = JSON.parse(fs.readFileSync(archivoCuento, 'utf8'));
const escenas = Array.isArray(historia.escenas) ? historia.escenas : [];

if (zip) {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'garuita-voz-'));
  execFileSync('unzip', ['-q', '-o', '-j', zip, '-d', carpeta]);
}

// Dura cuánto, en segundos, según FFmpeg.
const duracion = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

const destino = path.join(raiz, 'voz', cuento);
fs.mkdirSync(destino, { recursive: true });
// Pasa cada audio a WAV mono 24 kHz (así todos quedan iguales) y mide su duración.
function importar(nombre) {
  const origen = ['wav', 'mp3'].map((ext) => path.join(carpeta, `${nombre}.${ext}`)).find((f) => fs.existsSync(f));
  if (!origen) return null;
  const final = path.join(destino, `${nombre}.wav`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', origen, '-ac', '1', '-ar', '24000', final]);
  return Math.round(duracion(final) * 1000) / 1000;
}

const resultado = { titulo: importar('titulo'), escenas: escenas.map((_, i) => importar(`escena-${String(i + 1).padStart(2, '0')}`)) };
// Diálogos con voz propia (narrar.py --voces): escena-NN-<id>.wav -> { id: segundos } por escena.
resultado.dialogos = escenas.map((e, i) => {
  const d = {};
  (Array.isArray(e.personajes) ? e.personajes : []).forEach((c) => {
    const id = String((c && c.id) || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!id || !String((c && c.dice) || '').trim()) return;
    const s = importar(`escena-${String(i + 1).padStart(2, '0')}-${id}`);
    if (s != null) d[id] = s;
  });
  return d;
});
// Frases del campo "dialogo": escena-NN-dKK.wav -> [segundos, ...] por escena. Y el final (fin.wav).
resultado.lineas = escenas.map((e, i) => (Array.isArray(e.dialogo) ? e.dialogo : []).map((_, k) => importar(`escena-${String(i + 1).padStart(2, '0')}-d${String(k + 1).padStart(2, '0')}`)));
resultado.fin = importar('fin');
const frases = resultado.lineas.reduce((n, l) => n + l.filter((x) => x != null).length, 0);
const conVoz = resultado.dialogos.reduce((n, d) => n + Object.keys(d).length, 0);
const faltan = resultado.escenas.map((d, i) => (d == null && String(escenas[i].texto || '').trim() ? i + 1 : null)).filter(Boolean);
fs.writeFileSync(path.join(destino, 'duraciones.json'), JSON.stringify(resultado, null, 2) + '\n');

const total = (resultado.titulo || 0) + resultado.escenas.reduce((s, d) => s + (d || 0), 0)
  + resultado.dialogos.reduce((s, d) => s + Object.values(d).reduce((a, b) => a + b, 0), 0)
  + resultado.lineas.reduce((s, l) => s + l.reduce((a, b) => a + (b || 0), 0), 0) + (resultado.fin || 0);
console.log(`Narración de "${cuento}": ${resultado.escenas.filter((d) => d != null).length} de ${escenas.length} escenas, ${conVoz + frases} diálogos, ${total.toFixed(1)} s de voz.`);
console.log(`  -> ${path.relative(raiz, destino)}/duraciones.json`);
if (resultado.titulo == null) console.log('  Aviso: falta titulo.wav (el título queda sin voz).');
if (faltan.length) console.log(`  Aviso: faltan audios de las escenas ${faltan.join(', ')} (quedan sin voz).`);
