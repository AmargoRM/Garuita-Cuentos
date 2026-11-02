"""Narra un cuento con Chatterbox, sin Colab (en la nube o en una computadora).

    python herramientas/narrar.py --cuento rio-limpio-short --voz ruta/mi_voz.ogg
        -> salida/narracion/rio-limpio-short/titulo.wav, escena-01.wav, ...
    npm run voz -- --cuento rio-limpio-short --carpeta salida/narracion/rio-limpio-short
        -> voz/rio-limpio-short/ + duraciones.json (lo usa el motor)

Necesita: pip install chatterbox-tts==0.1.7 (y quitar torchvision si choca),
acceso a huggingface.co para bajar el modelo, y FFmpeg.
Sin tarjeta gráfica funciona, pero lento (unos minutos por escena).
Ajustes por defecto: expresividad 1.0 y ritmo 0.35 (Amargo pidió narración más animada que su voz normal).
"""
import argparse, json, os, re, subprocess, sys, tempfile

import numpy as np
import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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
    p.add_argument("--expresividad", type=float, default=1.0)
    p.add_argument("--ritmo", type=float, default=0.35)
    p.add_argument("--salida", default=None)
    a = p.parse_args()

    nombre = re.sub(r"[^a-zA-Z0-9_-]", "", a.cuento)
    with open(os.path.join(RAIZ, "cuentos", f"{nombre}.json"), encoding="utf-8") as f:
        cuento = json.load(f)
    # Los mismos textos que muestra el motor (título hasta 40 letras, escenas hasta 140).
    lineas = [("titulo", str(cuento.get("titulo", ""))[:40])]
    lineas += [(f"escena-{i:02d}", str(e.get("texto", ""))[:140]) for i, e in enumerate(cuento.get("escenas", []), 1)]

    carpeta = a.salida or os.path.join(RAIZ, "salida", "narracion", nombre)
    os.makedirs(carpeta, exist_ok=True)
    referencia = os.path.join(tempfile.mkdtemp(), "voz.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.voz, "-ac", "1", "-ar", "24000", "-t", "15", referencia], check=True)

    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Cargando Chatterbox en {dispositivo}...", flush=True)
    modelo = ChatterboxMultilingualTTS.from_pretrained(device=dispositivo)
    modelo.prepare_conditionals(referencia, exaggeration=a.expresividad)
    pausa = np.zeros(int(modelo.sr * 0.35), dtype=np.float32)

    for n, (archivo, texto) in enumerate(lineas, 1):
        destino = os.path.join(carpeta, f"{archivo}.wav")
        if not texto.strip() or os.path.exists(destino):
            continue  # vacío o ya narrado (se puede cortar y retomar)
        print(f"[{n}/{len(lineas)}] {archivo}: {texto}", flush=True)
        partes = []
        for i, t in enumerate(trozos(texto)):
            wav = modelo.generate(t, language_id="es", exaggeration=a.expresividad, cfg_weight=a.ritmo)
            if i:
                partes.append(pausa)
            partes.append(wav.squeeze(0).numpy().astype(np.float32))
        sf.write(destino + ".tmp.wav", np.concatenate(partes), modelo.sr)
        os.replace(destino + ".tmp.wav", destino)
    print(f"Listo: {os.path.relpath(carpeta, RAIZ)}")
    print(f"Siguiente: npm run voz -- --cuento {nombre} --carpeta {os.path.relpath(carpeta, RAIZ)}")


if __name__ == "__main__":
    sys.exit(main())
