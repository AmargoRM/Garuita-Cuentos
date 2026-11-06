"""Narra un episodio del canal de bebés (cuentos/<id>.json con "tipo": "bebes") con Chatterbox.

    python herramientas/narrar-bebes.py --episodio finca-tica \
        --voces /mnt/project-files/voz-privada/voces-bebes.json \
        --salida /mnt/project-files/voz-privada/finca-tica
        -> un audio por frase (p00-e01-f01.wav, ...) y duraciones.json

Luego se copian a voz/<id>/ (no se suben a GitHub) y el motor pone cada frase en su segundo.

- Una frase = el texto entre dos "(pausa)" del guion. Las pausas las pone el motor.
- Cada audio se revisa con Whisper (reconocimiento de voz): si no dice lo que tiene que decir
  (pasa con frases de una sola palabra), se vuelve a generar hasta 4 veces y queda la mejor.
- Se puede cortar y retomar: las frases ya narradas no se repiten.
- --solo apertura,clota narra solo esas partes (para una muestra).
"""
import argparse, difflib, json, os, re, subprocess, sys, tempfile, unicodedata

import numpy as np
import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "herramientas"))
LIMPIAR_REFERENCIA = "silenceremove=start_periods=1:start_threshold=-40dB,highpass=f=70,afftdn=nf=-30,loudnorm=I=-20:TP=-3"
BRILLO = "highshelf=f=3500:g=4,equalizer=f=250:t=q:w=1:g=-2,alimiter=limit=0.9"
COLORES = {
    "nasal": "equalizer=f=1400:t=q:w=1.2:g=6,highpass=f=250",
    "grave": "equalizer=f=160:t=q:w=1:g=5,lowpass=f=7000",
    "suave": "equalizer=f=3000:t=q:w=1:g=-2,equalizer=f=300:t=q:w=1:g=2",
    # Bebés: sin agudos que pinchen, cálida y cerquita.
    "cuna": "equalizer=f=4500:t=q:w=1:g=-3,equalizer=f=280:t=q:w=1:g=1.5,alimiter=limit=0.8",
}
RECORTAR = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"


def fid(pi, ei, fi):
    return f"p{pi:02d}-e{ei + 1:02d}-f{fi + 1:02d}"


def normal(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ ]+", " ", s).split()


def parecido(a, b):
    return difflib.SequenceMatcher(None, normal(a), normal(b)).ratio()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--episodio", required=True)
    p.add_argument("--voces", required=True, help="JSON: narrador y personajes con archivo y ajustes")
    p.add_argument("--salida", required=True)
    p.add_argument("--solo", default=None, help="ids de partes separados por coma")
    p.add_argument("--ritmo", type=float, default=0.5)
    p.add_argument("--intentos", type=int, default=4)
    a = p.parse_args()

    nombre = re.sub(r"[^a-zA-Z0-9_-]", "", a.episodio)
    with open(os.path.join(RAIZ, "cuentos", f"{nombre}.json"), encoding="utf-8") as f:
        ep = json.load(f)
    solo = set(a.solo.split(",")) if a.solo else None
    lineas = []
    for pi, parte in enumerate(ep.get("partes", [])):
        if solo and parte.get("id") not in solo:
            continue
        for ei, e in enumerate(parte.get("escenas", [])):
            for fi, fr in enumerate(e.get("frases", [])):
                fr = {"texto": fr} if isinstance(fr, str) else fr
                lineas.append((fid(pi, ei, fi), fr["texto"], fr.get("quien", "narrador"), fr.get("decir")))

    with open(a.voces, encoding="utf-8") as f:
        voces = json.load(f)
    base = os.path.dirname(os.path.abspath(a.voces))
    os.makedirs(a.salida, exist_ok=True)
    tmp = tempfile.mkdtemp()

    def limpiar(origen, quien, tono_ref=0.0):
        ref = os.path.join(tmp, f"{quien}.wav")
        filtro = LIMPIAR_REFERENCIA
        if tono_ref:
            r = 2 ** (float(tono_ref) / 12)
            filtro += f",aresample=48000,asetrate={48000 * r:.0f},aresample=24000,atempo={1 / r:.4f}"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", origen, "-af", filtro, "-ac", "1", "-ar", "24000", "-t", "15", ref], check=True)
        return ref

    disp = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Cargando Chatterbox en {disp}...", flush=True)
    modelo = ChatterboxMultilingualTTS.from_pretrained(device=disp)
    from faster_whisper import WhisperModel
    oido = WhisperModel("small", device="cpu", compute_type="int8")

    usados = sorted({l[2] for l in lineas})
    conds, ajustes = {}, {}
    for q in usados:
        v = voces[q]
        arch = v["archivo"] if os.path.isabs(v["archivo"]) else os.path.join(base, v["archivo"])
        ajustes[q] = v
        modelo.prepare_conditionals(limpiar(arch, q, v.get("tono_referencia", 0)), exaggeration=float(v.get("expresividad", 0.55)))
        conds[q] = modelo.conds

    def post(origen, destino, v):
        filtro = RECORTAR
        if v.get("tono"):
            r = 2 ** (float(v["tono"]) / 12)
            filtro += f",asetrate={modelo.sr * r:.0f},aresample={modelo.sr},atempo={1 / r:.4f}"
        if float(v.get("velocidad", 1.0)) != 1.0:
            filtro += f",atempo={float(v['velocidad']):.3f}"
        if v.get("color") in COLORES:
            filtro += "," + COLORES[v["color"]]
        if v.get("brillo"):
            filtro += "," + BRILLO
        filtro += ",afade=t=in:d=0.02,areverse,afade=t=in:d=0.08,areverse"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", origen, "-af", filtro, destino], check=True)

    def escuchar(f):
        audio, sr = sf.read(f, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != 16000:
            n = int(len(audio) * 16000 / sr)
            audio = np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio).astype(np.float32)
        segs, _ = oido.transcribe(audio, language="es", beam_size=3)
        return " ".join(s.text for s in segs).strip()

    def durac(f):
        return sf.info(f).duration

    for n, (ident, texto, quien, decir) in enumerate(lineas, 1):
        destino = os.path.join(a.salida, f"{ident}.wav")
        if os.path.exists(destino):
            continue
        v = ajustes[quien]
        modelo.conds = conds[quien]
        # Lo que se le pide al modelo (puede ser distinto del texto, para que pronuncie mejor).
        pedir = decir or texto
        esperado = 0.42 * len(normal(texto)) + 0.6
        mejor = None
        for intento in range(a.intentos):
            torch.manual_seed(1000 + intento * 17 + n)
            wav = modelo.generate(pedir, language_id="es", exaggeration=float(v.get("expresividad", 0.55)), cfg_weight=a.ritmo)
            crudo = os.path.join(tmp, f"{ident}.crudo.wav")
            sf.write(crudo, wav.squeeze(0).numpy().astype(np.float32), modelo.sr)
            prueba = os.path.join(tmp, f"{ident}.{intento}.wav")
            post(crudo, prueba, v)
            oyo = escuchar(prueba)
            d = durac(prueba)
            nota = parecido(oyo, texto) - (0.3 if d > esperado * 2.6 + 1.5 else 0)
            print(f"[{n}/{len(lineas)}] {ident} ({quien}) intento {intento + 1}: «{texto}» -> oí «{oyo}» ({d:.1f} s, nota {nota:.2f})", flush=True)
            if mejor is None or nota > mejor[0]:
                mejor = (nota, prueba)
            if nota >= 0.75:
                break
        os.replace(mejor[1], destino)

    # Duraciones de todas las frases que hay en la carpeta (también las de otras tandas).
    dur = {f[:-4]: round(durac(os.path.join(a.salida, f)), 3) for f in sorted(os.listdir(a.salida)) if re.match(r"p\d\d-e\d\d-f\d\d\.wav$", f)}
    with open(os.path.join(a.salida, "duraciones.json"), "w", encoding="utf-8") as f:
        json.dump({"frases": dur}, f, indent=1)
    print(f"Listo: {len(dur)} frases en {a.salida}")


if __name__ == "__main__":
    sys.exit(main())
