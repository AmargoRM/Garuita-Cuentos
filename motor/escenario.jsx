// escenario.jsx — reloj y escenario propios de Garuita Cuentos.
//
// Reemplaza las piezas de Claude Design que usa story-engine.jsx:
//   Easing, clamp, useComposition, useTimeline, CompositionStage.
// Todo lo que se dibuja depende solo del tiempo T, así que cualquier
// instante del cuento se puede dibujar exacto (lo necesita la captura de video).
//
// Control desde afuera (lo usa herramientas/captura.mjs):
//   window.__garuita.duracion      -> segundos totales del cuento
//   window.__garuita.ir(t)         -> dibuja el instante t de inmediato
//   window.__garuita.play() / pause()
import { flushSync } from 'react-dom';

const Easing = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 + Math.pow(t - 1, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 + 4 * Math.pow(t - 1, 3)),
  easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const Reloj = React.createContext({ T: 0, time: 0, duration: 0, playing: false, setTime: () => {} });
const useComposition = () => React.useContext(Reloj);
const useTimeline = () => React.useContext(Reloj);

function duracionTotal(scenes) {
  let lista = [];
  try { lista = typeof scenes === 'string' ? JSON.parse(scenes) : scenes || []; } catch (e) { lista = []; }
  return lista.reduce((s, e) => s + (Number(e.dur) || 0), 0);
}

// Escala el lienzo (width × height) para que quepa en la ventana sin deformarse.
function useEscala(ref, width, height) {
  const [k, setK] = React.useState(1);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setK(Math.min(el.clientWidth / width, el.clientHeight / height) || 1);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);
  return k;
}

function CompositionStage({ width, height, scenes, bg = '#000', children }) {
  const duration = React.useMemo(() => duracionTotal(scenes), [scenes]);
  const modoCaptura = new URLSearchParams(location.search).has('captura');
  const [time, setTimeState] = React.useState(0);
  const [playing, setPlaying] = React.useState(!modoCaptura);
  const tRef = React.useRef(0);
  const caja = React.useRef(null);
  const k = useEscala(caja, width, height);

  const setTime = React.useCallback((t) => {
    const v = clamp(Number(t) || 0, 0, duration);
    tRef.current = v;
    setTimeState(v);
  }, [duration]);

  // Avanza el reloj mientras se reproduce; al final vuelve a empezar.
  React.useEffect(() => {
    if (!playing) return;
    let ultimo = performance.now(), id;
    const paso = (ahora) => {
      let t = tRef.current + (ahora - ultimo) / 1000;
      ultimo = ahora;
      if (t >= duration) t = 0;
      tRef.current = t;
      setTimeState(t);
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [playing, duration]);

  React.useEffect(() => {
    window.__garuita = {
      duracion: duration, ancho: width, alto: height,
      ir: (t) => { flushSync(() => setTime(t)); },
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
    };
  }, [duration, width, height, setTime]);

  const ctx = React.useMemo(() => ({ T: time, time, duration, playing, setTime }), [time, duration, playing, setTime]);

  return (
    <Reloj.Provider value={ctx}>
      <div ref={caja} style={{ position: 'absolute', inset: 0, background: bg, overflow: 'hidden' }}>
        <div
          id="lienzo"
          onClick={() => !modoCaptura && setPlaying((p) => !p)}
          style={{
            position: 'absolute', width, height, left: '50%', top: '50%', overflow: 'hidden',
            transform: modoCaptura ? 'translate(-50%,-50%)' : `translate(-50%,-50%) scale(${k})`,
            transformOrigin: 'center', cursor: modoCaptura ? 'default' : 'pointer',
          }}
        >
          {children}
        </div>
        {!modoCaptura && <BarraTiempo time={time} duration={duration} playing={playing}
          onPlay={() => setPlaying((p) => !p)} onSeek={(t) => setTime(t)} />}
      </div>
    </Reloj.Provider>
  );
}

function BarraTiempo({ time, duration, playing, onPlay, onSeek }) {
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <div style={{ position: 'absolute', left: 12, right: 12, bottom: 10, display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.9)', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, color: '#2A1A12', zIndex: 10 }}>
      <button onClick={onPlay} style={{ border: '2px solid #2A1A12', borderRadius: 999, background: '#FFD23F', padding: '2px 12px', cursor: 'pointer', fontWeight: 700 }}>
        {playing ? 'Pausa' : 'Play'}
      </button>
      <input type="range" min={0} max={duration} step={0.01} value={time} onChange={(e) => onSeek(e.target.value)} style={{ flex: 1 }} />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{mmss(time)} / {mmss(duration)}</span>
    </div>
  );
}

Object.assign(window, { Easing, clamp, useComposition, useTimeline, CompositionStage });
