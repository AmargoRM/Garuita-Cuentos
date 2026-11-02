# Garuita Cuentos

Motor para generar cuentos animados de Tío Conejo con enseñanzas y temas ambientales,
para YouTube: videos largos horizontales (1920×1080) y Shorts verticales (1080×1920).

- `PLAN.md`: plan completo, opciones de voz, derechos de autor y riesgos.
- `motor/`: la animación, ya independiente de Claude Design.
  - `story-engine.jsx`: dibuja personajes, lugares y escenas a partir de un cuento en JSON.
  - `escenario.jsx`: reloj, reproducción y control cuadro por cuadro (código propio).
  - `main.jsx`: arranca todo y carga el cuento pedido.
- `cuentos/`: un archivo `.json` por cuento (ver `cuentos/ejemplo.json`).
- `herramientas/`: servidor local y captura de fotos y video.
- `prototipo/`: el prototipo original de Claude Design, solo como referencia.

## Instalar (una sola vez)

Requiere Node.js 20 o más nuevo, FFmpeg y Playwright.

```bash
npm install
```

```bash
npm install --no-save playwright && npx playwright install chromium
```

## Usar

Preparar el motor (después de cada cambio en `motor/`):

```bash
npm run build
```

Ver un cuento en el navegador, en http://localhost:8080/?cuento=ejemplo
(agregar `&formato=vertical` para ver el Short):

```bash
npm run servir
```

Sacar 6 fotos repartidas a lo largo del cuento, para revisar rápido:

```bash
npm run captura -- --cuento ejemplo --formato horizontal --fotos 6
```

Grabar el video completo (sale con voz si el cuento tiene narración importada, ver abajo):

```bash
npm run captura -- --cuento ejemplo --formato vertical --video
```

Los resultados quedan en `salida/`. Grabar tarda unas 3 veces la duración del cuento.

## Voz del narrador (Chatterbox en Google Colab)

La voz se genera fuera de esta computadora, en Google Colab (gratis, con GPU), con el
cuaderno `voz/garuita-voz-chatterbox.ipynb`. Chatterbox clona una voz a partir de una
grabación de 10 a 15 segundos (licencia MIT, sirve para YouTube con ingresos).

1. Abrir el cuaderno en Colab, elegir GPU T4 y correr los pasos 1, 2 y 3 (subir la voz).
2. Paso 5: subir el cuento (`cuentos/NOMBRE.json`). Descarga `NOMBRE-voz.zip`
   con `titulo.wav`, `escena-01.wav`, `escena-02.wav`...
3. Importarlo al motor:

```bash
npm run voz -- --cuento NOMBRE --zip NOMBRE-voz.zip
```

Esto deja los audios en `voz/NOMBRE/` con `duraciones.json`. Desde ahí, cada escena dura
lo que dura su narración (nunca menos) y `npm run captura -- --video` sale con la voz.
Para grabar sin voz: `--sin-voz`.

Sin Colab (por ejemplo en la nube de Claude, si permite bajar de huggingface.co):

```bash
pip install chatterbox-tts==0.1.7 && pip uninstall -y torchvision
python herramientas/narrar.py --cuento NOMBRE --voz ruta/mi_voz.ogg
npm run voz -- --cuento NOMBRE --carpeta salida/narracion/NOMBRE
``` Los audios no se suben a GitHub (el repositorio es público).

## Música de fondo y efectos de sonido

Todo video grabado con `--video` sale con:

- **Música de fondo original**, compuesta por el motor (`motor/musica.js`): alegre, para
  niños, distinta en cada cuento y sin derechos de autor de terceros (ver `musica/LICENCIAS.md`).
  Baja sola mientras habla el narrador y sube en las pausas. De noche suena una cajita de música.
- **Los efectos de sonido** del motor (saltos, risas, "boing", soniditos de los animales).
- Volumen general parejo al nivel que usa YouTube.

Opciones: `--sin-musica`, `--sin-efectos`, `--volumen-musica 0.7` (más bajo) o `1.4` (más alto).
La música y los efectos quedan también por separado en `salida/` (`.musica.wav`, `.efectos.wav`).

## Formato de un cuento

```json
{
  "id": "ejemplo",
  "titulo": "Tío Conejo y sus amigos",
  "escenas": [
    {
      "lugar": "rio",
      "texto": "En el río está la Tortuga. Va despacito.",
      "palabra": "TORTUGA",
      "personajes": [
        { "id": "tortuga", "accion": "caminar", "entrada": "derecha", "dice": "Voy despacito..." },
        { "id": "conejo", "accion": "saludar", "entrada": "ya" }
      ]
    }
  ]
}
```

- `lugar`: pueblito, bosque, rio, playa, mercado, casa, noche.
- `id` de personaje: conejo, cucaracha, gallina, zorra, coyote, tigre, tortuga, mono,
  danta, perezoso, tucan, vaca, perro, gato, mariposa.
- `accion`: quieto, saltar, caminar, tocar, saludar, hablar, bailar, comer, dormir, reir,
  correr, abrazar, regalo, asustarse.
- `entrada`: ya, izquierda, derecha, aparece, puerta.
- Acciones extra: `recoger` (levanta basura) y `tirar` (lanza basura; con `objeto`: botella, lata, bolsa, papel).
- Opcionales por escena: `basura` (0 a 3), `agua: "sucia"`, `limpiar: true`, `botes: true`.

Nombres, personalidades y estilo fijos de los personajes: ver `PERSONAJES.md`.
