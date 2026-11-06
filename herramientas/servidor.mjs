// Servidor local mínimo: muestra publico/ y cuentos/ en http://localhost:PUERTO
//   npm run servir            (puerto 8080)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

export function crearServidor() {
  return http.createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta === '/') ruta = '/index.html';
    const carpeta = ['/cuentos/', '/voz/'].find((c) => ruta.startsWith(c));
    const base = carpeta ? raiz : path.join(raiz, 'publico');
    const permitido = carpeta ? path.join(raiz, carpeta) : base; // no deja salir de esa carpeta con "../"
    const archivo = path.normalize(path.join(base, ruta));
    if (!archivo.startsWith(permitido) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404); return res.end('No encontrado');
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PUERTO || 8080);
  crearServidor().listen(puerto, () => console.log(`Abrí http://localhost:${puerto}/?cuento=ejemplo`));
}
