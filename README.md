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

Grabar el video completo (todavía sin sonido; el sonido llega en la Fase 3):

```bash
npm run captura -- --cuento ejemplo --formato vertical --video
```

Los resultados quedan en `salida/`. Grabar tarda unas 3 veces la duración del cuento.

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
