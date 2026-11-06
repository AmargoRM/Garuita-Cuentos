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
# Quita el silencio del principio y del final de cada audio narrado.
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
    p.add_argument("--voces", default=None,
                   help='JSON con una voz por personaje, ej. {"tortuga": "ruta/voz-tula.ogg"}. '
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

    def limpiar(origen, nombre_ref):
        ref = os.path.join(temporal, f"{nombre_ref}.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", origen, "-af", LIMPIAR_REFERENCIA, "-ac", "1", "-ar", "24000", "-t", "15", ref], check=True)
        return ref

    referencia = limpiar(a.voz, "narrador")
    voces = {}
    if a.voces:
        with open(a.voces, encoding="utf-8") as f:
            voces = {re.sub(r"[^a-z0-9_-]", "", k.lower()): v for k, v in json.load(f).items()}
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
    for pid, ruta in [("narrador", None)] + sorted(voces.items()):
        modelo.prepare_conditionals(referencia if ruta is None else limpiar(ruta, pid), exaggeration=a.expresividad)
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
            wav = modelo.generate(t, language_id="es", exaggeration=a.expresividad, cfg_weight=a.ritmo)
            if i:
                partes.append(pausa)
            partes.append(wav.squeeze(0).numpy().astype(np.float32))
        sf.write(destino + ".tmp.wav", np.concatenate(partes), modelo.sr)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", destino + ".tmp.wav", "-af", RECORTAR, destino + ".rec.wav"], check=True)
        os.remove(destino + ".tmp.wav")
        os.replace(destino + ".rec.wav", destino)
    print(f"Listo: {os.path.relpath(carpeta, RAIZ)}")
    print(f"Siguiente: npm run voz -- --cuento {nombre} --carpeta {os.path.relpath(carpeta, RAIZ)}")


if __name__ == "__main__":
    sys.exit(main())
