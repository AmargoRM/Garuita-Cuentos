"""Narra un cuento con Chatterbox, sin Colab (en la nube o en una computadora).

    python herramientas/narrar.py --cuento rio-limpio-short --voz ruta/mi_voz.ogg
        -> salida/narracion/rio-limpio-short/titulo.wav, escena-01.wav, ...
    npm run voz -- --cuento rio-limpio-short --carpeta salida/narracion/rio-limpio-short
        -> voz/rio-limpio-short/ + duraciones.json (lo usa el motor)

Necesita: pip install chatterbox-tts==0.1.7 "setuptools<81" (y quitar torchvision si choca),
acceso a huggingface.co para bajar el modelo, y FFmpeg.
Sin tarjeta gráfica funciona, pero lento (unos minutos por escena).
Ajustes por defecto (versión "E" que eligió Amargo): expresividad 0.6 y ritmo 0.5.
La grabación de referencia se limpia antes de usarla (sin silencio inicial, sin ruido,
volumen parejo sin saturar) y a cada audio se le quitan los silencios del principio y del final.
"""
import argparse, json, os, re, subprocess, sys, tempfile

import numpy as np
import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Las grabaciones de WhatsApp vienen saturadas y con ruido: el modelo copia eso y suena raro.
LIMPIAR_REFERENCIA = "silenceremove=start_periods=1:start_threshold=-40dB,highpass=f=70,afftdn=nf=-30,loudnorm=I=-20:TP=-3"
# "brillo": más agudos y menos graves (voz más clara y alegre; la aprobó Amargo para la voz femenina).
BRILLO = "highshelf=f=3500:g=4,equalizer=f=250:t=q:w=1:g=-2,alimiter=limit=0.9"
# Quita el silencio del principio y del final de cada audio narrado.
# "color": forma extra del sonido para dar carácter a cada personaje.
COLORES = {
    "nasal": "equalizer=f=1400:t=q:w=1.2:g=6,highpass=f=250",          # gallina: chillona y nasal
    "grave": "equalizer=f=160:t=q:w=1:g=5,lowpass=f=7000",              # tigre: grandote
    "suave": "equalizer=f=3000:t=q:w=1:g=-2,equalizer=f=300:t=q:w=1:g=2",  # tortuga: cálida
}
RECORTAR = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"


def trozos(texto, largo=250):
    """Corta en frases y las agrupa hasta ~250 letras (el modelo anda mejor con trozos cortos)."""
    frases = [f.strip() for f in re.split(r'(?<=[.!?…])\s+', texto.strip()) if f.strip()]
    lista, actual = [], ""
    for f in frases:
        if actual and len(actual) + len(f) > largo:
            lista.append(actual)
            actual = f
        else:
            actual = (actual + " " + f).strip()
    if actual:
        lista.append(actual)
    return lista


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--cuento", required=True)
    p.add_argument("--voz", required=True, help="grabación de 10 a 15 s (mp3, wav, ogg...)")
    p.add_argument("--expresividad", type=float, default=0.6)
    p.add_argument("--ritmo", type=float, default=0.5)
    p.add_argument("--salida", default=None)
    p.add_argument("--narrador-ajustes", default=None, help='JSON, ej. {"tono": 1, "brillo": true}')
    p.add_argument("--voces", default=None,
                   help='JSON con una voz por personaje, ej. {"tortuga": "ruta/voz-tula.ogg"} o '
                        '{"tortuga": {"archivo": "ruta.ogg", "expresividad": 0.8, "velocidad": 1.15, "brillo": true}}. '
                        'Cada "dice" de ese personaje sale como escena-NN-<id>.wav con su voz.')
    a = p.parse_args()

    nombre = re.sub(r"[^a-zA-Z0-9_-]", "", a.cuento)
    with open(os.path.join(RAIZ, "cuentos", f"{nombre}.json"), encoding="utf-8") as f:
        cuento = json.load(f)
    # Los mismos textos que muestra el motor (título hasta 40 letras, escenas hasta 140).
    lineas = [("titulo", str(cuento.get("titulo", ""))[:40])]
    lineas += [(f"escena-{i:02d}", str(e.get("texto", ""))[:140]) for i, e in enumerate(cuento.get("escenas", []), 1)]

    carpeta = a.salida or os.path.join(RAIZ, "salida", "narracion", nombre)
    os.makedirs(carpeta, exist_ok=True)
    temporal = tempfile.mkdtemp()

    def limpiar(origen, nombre_ref, tono_ref=0.0):
        ref = os.path.join(temporal, f"{nombre_ref}.wav")
        filtro = LIMPIAR_REFERENCIA
        if tono_ref:
            # Sube el tono de la grabación ANTES de clonar: el modelo aprende una voz más aguda
            # y la reproduce con naturalidad (subirlo después, mucho, suena robótico).
            r = 2 ** (float(tono_ref) / 12)
            filtro += f",aresample=48000,asetrate={48000 * r:.0f},aresample=24000,atempo={1 / r:.4f}"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", origen, "-af", filtro, "-ac", "1", "-ar", "24000", "-t", "15", ref], check=True)
        return ref

    referencia = limpiar(a.voz, "narrador")
    voces = {}
    if a.voces:
        with open(a.voces, encoding="utf-8") as f:
            for k, v in json.load(f).items():
                v = v if isinstance(v, dict) else {"archivo": v}
                if not os.path.isabs(v["archivo"]):
                    v["archivo"] = os.path.join(os.path.dirname(os.path.abspath(a.voces)), v["archivo"])
                voces[re.sub(r"[^a-z0-9_-]", "", k.lower())] = v
    ajustes = {"narrador": {"expresividad": a.expresividad, "velocidad": 1.0, "brillo": False, "tono": 0, "color": ""}}
    for pid, v in voces.items():
        ajustes[pid] = {"expresividad": float(v.get("expresividad", a.expresividad)),
                        "velocidad": float(v.get("velocidad", 1.0)), "brillo": bool(v.get("brillo", False)),
                        "tono": float(v.get("tono", 0)), "color": str(v.get("color", ""))}
    if a.narrador_ajustes:
        ajustes["narrador"].update(json.loads(a.narrador_ajustes))
    # Diálogos: (archivo, texto, personaje) para cada "dice" de un personaje con voz propia.
    for i, e in enumerate(cuento.get("escenas", []), 1):
        for c in e.get("personajes", []) or []:
            pid = re.sub(r"[^a-z0-9_-]", "", str(c.get("id", "")).lower())
            if pid in voces and str(c.get("dice", "")).strip():
                lineas.append((f"escena-{i:02d}-{pid}", str(c["dice"])[:60], pid))

    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Cargando Chatterbox en {dispositivo}...", flush=True)
    modelo = ChatterboxMultilingualTTS.from_pretrained(device=dispositivo)
    # Prepara cada voz una sola vez y la guarda para cambiar rápido entre narrador y personajes.
    condiciones = {}
    for pid, v in [("narrador", None)] + sorted(voces.items()):
        modelo.prepare_conditionals(referencia if v is None else limpiar(v["archivo"], pid, v.get("tono_referencia", 0)), exaggeration=ajustes[pid]["expresividad"])
        condiciones[pid] = modelo.conds
    pausa = np.zeros(int(modelo.sr * 0.35), dtype=np.float32)

    lineas = [l if len(l) == 3 else (*l, "narrador") for l in lineas]
    for n, (archivo, texto, quien) in enumerate(lineas, 1):
        destino = os.path.join(carpeta, f"{archivo}.wav")
        if not texto.strip() or os.path.exists(destino):
            continue  # vacío o ya narrado (se puede cortar y retomar)
        print(f"[{n}/{len(lineas)}] {archivo} ({quien}): {texto}", flush=True)
        modelo.conds = condiciones[quien]
        partes = []
        for i, t in enumerate(trozos(texto)):
            wav = modelo.generate(t, language_id="es", exaggeration=ajustes[quien]["expresividad"], cfg_weight=a.ritmo)
            if i:
                partes.append(pausa)
            partes.append(wav.squeeze(0).numpy().astype(np.float32))
        sf.write(destino + ".tmp.wav", np.concatenate(partes), modelo.sr)
        filtro = RECORTAR
        aj = ajustes[quien]
        if aj.get("tono"):
            # Sube o baja el tono en semitonos cambiando también el "tamaño" de la voz:
            # más agudo suena a niño o caricatura, más grave a personaje grandote.
            r = 2 ** (float(aj["tono"]) / 12)
            filtro += f",asetrate={modelo.sr * r:.0f},aresample={modelo.sr},atempo={1 / r:.4f}"
        if aj["velocidad"] != 1.0:
            filtro += f",atempo={aj['velocidad']:.3f}"
        if aj.get("color") in COLORES:
            filtro += "," + COLORES[aj["color"]]
        if ajustes[quien]["brillo"]:
            filtro += "," + BRILLO
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", destino + ".tmp.wav", "-af", filtro, destino + ".rec.wav"], check=True)
        os.remove(destino + ".tmp.wav")
        os.replace(destino + ".rec.wav", destino)
    print(f"Listo: {os.path.relpath(carpeta, RAIZ)}")
    print(f"Siguiente: npm run voz -- --cuento {nombre} --carpeta {os.path.relpath(carpeta, RAIZ)}")


if __name__ == "__main__":
    sys.exit(main())
