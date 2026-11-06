// Punto de entrada: carga fuentes, motor y el cuento pedido en la dirección.
//   ?cuento=ejemplo        -> cuentos/ejemplo.json
//   ?formato=vertical      -> 1080×1920 (por defecto horizontal 1920×1080)
//   ?edad=ninos            -> ritmo para niños (por defecto 'bebes', más lento)
//   ?captura               -> sin controles, tamaño real, en pausa (para grabar)
//   ?narracion=no          -> ignora los audios de voz/<cuento>/ aunque existan
//
// Si existe voz/<cuento>/duraciones.json (lo crea `npm run voz`), cada escena dura lo
// mismo que su narración, y window.__garuitaNarracion dice qué audio suena y cuándo.
import './globales.js';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/luckiest-guy/400.css';
import './escenario.jsx';
import './story-engine.jsx';
import './musica.js';

const q = new URLSearchParams(location.search);
const nombre = (q.get('cuento') || 'ejemplo').replace(/[^a-zA-Z0-9_-]/g, '');
const formato = q.get('formato') === 'vertical' ? 'vertical' : 'horizontal';
const edad = q.get('edad') === 'ninos' ? 'ninos' : 'bebes';
const captura = q.has('captura');

async function cargarNarracion(cuento) {
  try {
    const r = await fetch(`voz/${cuento}/duraciones.json`);
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

// Lista de audios con el segundo exacto en que empieza cada uno dentro del video.
function anotarPlan(plan, narracion) {
  const lista = [];
  if (narracion) {
    plan.scenes.forEach((s) => {
      if (!s.narr) return;
      const archivo = s.kind === 'title' ? 'titulo.wav' : s.kind === 'fin' ? 'fin.wav' : `escena-${String(s.src + 1).padStart(2, '0')}.wav`;
      lista.push({ archivo: `voz/${nombre}/${archivo}`, inicio: Math.round((s.start + s.narr[0]) * 1000) / 1000 });
    });
    // Diálogos con la voz de cada personaje, en el momento en que aparece su globito.
    plan.scenes.forEach((s) => (s.dialogos || []).forEach((d) => {
      const archivo = `escena-${String(s.src + 1).padStart(2, '0')}-${d.id}.wav`;
      lista.push({ archivo: `voz/${nombre}/${archivo}`, inicio: Math.round((s.start + d.t) * 1000) / 1000 });
    }));
    // Frases del diálogo (campo "dialogo"): escena-NN-dKK.wav.
    plan.scenes.forEach((s) => (s.lines || []).forEach((l) => {
      if (!l.audio) return;
      const archivo = `escena-${String(s.src + 1).padStart(2, '0')}-d${String(l.k + 1).padStart(2, '0')}.wav`;
      lista.push({ archivo: `voz/${nombre}/${archivo}`, inicio: Math.round((s.start + l.t0) * 1000) / 1000 });
    }));
  }
  // Sonidos reales de animales (carpeta sonidos/), con su volumen.
  plan.scenes.forEach((s) => (s.sonidos || []).forEach((x) => {
    lista.push({ archivo: `sonidos/${x.id}.ogg`, inicio: Math.round((s.start + x.t) * 1000) / 1000, vol: x.vol });
  }));
  window.__garuitaNarracion = lista;
  window.__garuitaPlan = plan;
}

// Para grabar: arma la música y los efectos (motor/musica.js) y los entrega por pedazos
// en base64, porque un video largo tiene muchos datos de sonido.
window.__garuitaGrabarSonido = async (o) => {
  const r = await window.GaruitaMusica.grabarSonido(Object.assign({ plan: window.__garuitaPlan }, o));
  window.__garuitaSonido = r;
  return { musica: r.musica ? r.musica.length : 0, efectos: r.efectos ? r.efectos.length : 0, info: r.info };
};
window.__garuitaPedazo = (pista, desde, cantidad) => {
  const datos = window.__garuitaSonido[pista];
  const b = new Uint8Array(datos.buffer, datos.byteOffset + desde * 2, Math.min(cantidad, datos.length - desde) * 2);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};

async function iniciar() {
  const raiz = createRoot(document.getElementById('app'));
  try {
    const r = await fetch(`cuentos/${nombre}.json`);
    if (!r.ok) throw new Error(`No encontré cuentos/${nombre}.json`);
    const cuento = await r.json();
    const narracion = q.get('narracion') === 'no' ? null : await cargarNarracion(nombre);
    raiz.render(
      <window.StoryPlayer story={cuento} format={formato} age={edad}
        narracion={narracion} onPlan={(p) => anotarPlan(p, narracion)}
        sound={!captura} music={!captura} captions={q.get('subtitulos') !== 'no'} />
    );
    await document.fonts.ready;
    window.__garuitaListo = true;
  } catch (e) {
    raiz.render(<div style={{ color: '#fff', padding: 24, fontFamily: 'sans-serif' }}>{String(e.message || e)}</div>);
    window.__garuitaError = String(e.message || e);
  }
}
iniciar();
