// Punto de entrada: carga fuentes, motor y el cuento pedido en la dirección.
//   ?cuento=ejemplo        -> cuentos/ejemplo.json
//   ?formato=vertical      -> 1080×1920 (por defecto horizontal 1920×1080)
//   ?edad=ninos            -> ritmo para niños (por defecto 'bebes', más lento)
//   ?captura               -> sin controles, tamaño real, en pausa (para grabar)
import './globales.js';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/luckiest-guy/400.css';
import './escenario.jsx';
import './story-engine.jsx';

const q = new URLSearchParams(location.search);
const nombre = (q.get('cuento') || 'ejemplo').replace(/[^a-zA-Z0-9_-]/g, '');
const formato = q.get('formato') === 'vertical' ? 'vertical' : 'horizontal';
const edad = q.get('edad') === 'ninos' ? 'ninos' : 'bebes';
const captura = q.has('captura');

async function iniciar() {
  const raiz = createRoot(document.getElementById('app'));
  try {
    const r = await fetch(`cuentos/${nombre}.json`);
    if (!r.ok) throw new Error(`No encontré cuentos/${nombre}.json`);
    const cuento = await r.json();
    raiz.render(
      <window.StoryPlayer story={cuento} format={formato} age={edad}
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
