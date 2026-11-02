# Garuita Cuentos — Plan del motor de videos

Objetivo: generar de forma continua cuentos nuevos de Tío Conejo y sus amigos, con una
enseñanza en cada uno y temas ambientales actuales, y convertirlos en video con voz natural:

- **Video largo**: 3 a 5 minutos, horizontal 1920×1080.
- **Short**: máximo 60 segundos, vertical 1080×1920.

## 1. Qué ya existe (carpeta `prototipo/`)

El prototipo hecho en Claude Design ya resuelve la parte más difícil, la animación:

| Archivo | Qué hace |
|---|---|
| `story-engine.jsx` | Convierte un cuento en formato JSON (escenas, lugar, personajes, acción, diálogo) en animación. Ya soporta horizontal y vertical. |
| `animations-v3.jsx` / `v2` | El "escenario": línea de tiempo, cámara, transiciones. |
| `village-scenes.jsx`, `comic-scene.jsx` | Fondos y escenas (pueblito, bosque, río, playa, mercado, casa, noche). |
| `Generador Tio Conejo.dc.html` | Pantalla donde pegás un cuento y la IA lo divide en escenas. |
| `support.js` | Código de Claude Design que hace funcionar todo lo anterior. |

Personajes disponibles: conejo, cucaracha, gallina, zorra, coyote, tigre, tortuga, mono,
danta, perezoso, tucán, vaca, perro, gato, mariposa.

Limitaciones actuales:
1. Solo funciona dentro de Claude Design (la IA y la exportación dependen de él).
2. El video exportado sale **sin sonido**.
3. Los diálogos son "bla-bla" sintético, no voz real.
4. Hay que pegar el cuento a mano; no inventa cuentos nuevos.

## 2. Cómo va a funcionar el motor (cadena de pasos)

```
[1 Idea] → [2 Guion] → [3 Revisión] → [4 Voces] → [5 Animación] → [6 Video final] → [7 Subida]
```

1. **Idea (semilla)**: el programa combina al azar personaje principal + lugar + valor
   (honestidad, compartir, paciencia…) + tema ambiental. Guarda un registro de lo ya hecho
   para no repetir. Esto es lo que lo hace "infinito".
2. **Guion**: una IA escribe el cuento con el estilo de Tía Panchita y lo entrega
   directamente en el formato JSON que el `story-engine` ya entiende, más el texto del
   narrador y de cada personaje por separado.
3. **Revisión automática**: una segunda pasada de IA revisa que sea apto para niños, que la
   enseñanza quede clara y que los datos ambientales sean correctos. Luego **revisión humana
   tuya** antes de publicar (ver sección 6).
4. **Voces**: cada línea del narrador y de cada personaje se convierte en audio con una voz
   distinta (sección 3). Se mide cuánto dura cada audio.
5. **Animación**: la duración de cada escena se ajusta a la duración real de su audio, y la
   boca del personaje se mueve cuando suena su voz.
6. **Video final**: un navegador automático (Playwright) reproduce la animación cuadro por
   cuadro, y FFmpeg une las imágenes con voces, música y efectos. Sale un MP4 con sonido,
   más subtítulos (.srt) y miniatura.
7. **Subida**: con la API oficial de YouTube se sube como borrador privado, con título,
   descripción, capítulos y la marca "contenido para niños".

## 3. Voz natural y gratuita

Opciones de código abierto con español, de mejor a peor para este caso.
**Verificar siempre la licencia antes de monetizar**: algunas prohíben uso comercial, y un
canal de YouTube monetizado es uso comercial.

| Opción | Calidad | Uso comercial | Necesita | Comentario |
|---|---|---|---|---|
| **Chatterbox Multilingual** (github.com/resemble-ai/chatterbox) | Muy natural, con control de emoción | Sí (licencia MIT) | Tarjeta gráfica o Google Colab gratis | **Recomendada.** Clona una voz a partir de ~10 s de grabación: ideal para darle voz propia a cada personaje. |
| **Piper** (github.com/OHF-Voice/piper1-gpl) | Buena, algo plana | Depende de cada voz | Cualquier computadora | Muy rápida. Útil para borradores y pruebas. |
| **Kokoro** (github.com/hexgrad/kokoro) | Buena en inglés, regular en español | Sí (Apache 2.0) | Cualquier computadora | Plan B. |
| **edge-tts** (github.com/rany2/edge-tts) | Excelente, tiene voces de Costa Rica (es-CR-MariaNeural, es-CR-JuanNeural) | Zona gris: usa un servicio de Microsoft sin acuerdo oficial | Internet | Puede dejar de funcionar sin aviso. No basar el canal en esto. |
| XTTS-v2, F5-TTS, Fish Speech | Muy buena | **No** (licencias no comerciales) | Tarjeta gráfica | Descartadas para un canal monetizado. |

Propuesta concreta:
- Grabar vos (o familia/amigos **con su permiso**) unos 10–20 segundos por personaje
  haciendo la voz: Tío Conejo pícaro, Tío Tigre grave, Tía Tortuga lenta, una narradora
  tipo abuela. Chatterbox clona esas voces y las usa en todos los cuentos.
- Nunca clonar la voz de alguien sin su consentimiento (ni de actores ni famosos).
- Guardar las grabaciones de referencia en `voces/` dentro del repositorio.

## 4. Cuentos: personajes, valores y temas ambientales

Tío Conejo original es un pícaro que engaña. Para que haya enseñanza sin perder la gracia:
- Usa su astucia **para resolver un problema ambiental** (engaña al que contamina).
- O hace una trampa y **aprende de las consecuencias**.

Nota de derechos: los cuentos de Carmen Lyra (fallecida en 1949) están en dominio público
en Costa Rica, y Tío Conejo es un personaje del folclor. Los cuentos nuevos son originales.

Temas ambientales actuales con sabor costarricense:
- Plástico en la playa y tortugas que confunden bolsas con medusas.
- Anidación de tortugas y la luz artificial que desorienta a las crías (escena "noche").
- Sequía y cuidado del agua del río.
- Abejas y polinizadores; uso de venenos en los cultivos.
- Quemas e incendios forestales.
- Deforestación y corredores biológicos (la danta y el perezoso necesitan árboles).
- Reciclaje y compostaje en el mercado.
- Corales blanqueados por el calor del mar.
- Fauna atropellada en carreteras; pasos de fauna.
- No alimentar animales silvestres (el mono y la comida chatarra de los turistas).
- Ruido y animales asustados; pesca responsable; humedales.

Valores: honestidad, compartir, paciencia, pedir perdón, trabajo en equipo, escuchar,
respetar al diferente, cumplir la palabra, no burlarse.

## 5. Fases de trabajo

| Fase | Resultado | Esfuerzo |
|---|---|---|
| **0. Base** | Sacar el motor de Claude Design para que corra solo en una computadora o en GitHub. | Medio |
| **1. Guion automático** | Comando que genera un cuento JSON nuevo a partir de una semilla. | Bajo |
| **2. Voces** | Comando que crea los audios por personaje con Chatterbox (o Piper para pruebas). | Medio |
| **3. Render con sonido** | MP4 horizontal y vertical con voces, música y subtítulos. | Alto |
| **4. Shorts** | Cortar un momento del cuento largo o generar mini cuentos de 45–60 s. | Bajo |
| **5. Subida** | Subida a YouTube como borrador privado. | Medio |
| **6. Panel** | Página simple para ver la cola de cuentos, aprobar o rechazar. | Medio |

## 6. Riesgos importantes de YouTube

1. **Contenido masivo repetitivo**: desde 2025 YouTube no monetiza canales con videos
   "producidos en masa" o casi iguales entre sí. Publicar sin límite videos generados por IA
   es exactamente lo que penaliza. Recomendación: 2–4 videos largos por semana, con
   revisión humana, variedad real de escenas y tu toque personal (tu voz, tu edición).
2. **Contenido para niños (COPPA)**: hay que marcar los videos como "para niños". Eso
   desactiva comentarios y anuncios personalizados, y la ganancia por vista es menor.
   Es obligatorio por ley; no marcarlo puede traer multas.
3. **Divulgación de IA**: YouTube pide marcar el contenido sintético realista. Las voces
   clonadas pueden requerirlo. Marcarlo no penaliza; ocultarlo sí.
4. **Costo de la IA del guion**: la API de Claude cuesta centavos de dólar por cuento.
   Alternativa gratuita: un modelo local con Ollama, con menor calidad en español.

## 7. Más ideas

- **Narradora fija "Tía Panchita"** que abre y cierra cada cuento: da identidad al canal.
- **Pregunta final** para los niños ("¿Qué hubieras hecho vos?") para que los papás conversen.
- **Palabra tica del día**: "fanega", "chiverre", "tranquera", con su explicación.
- **Canción corta** al final con la enseñanza (se puede generar música libre de derechos).
- **Datos reales "¿Sabías que…?"** como Shorts independientes, enlazando al cuento largo.
- **Temporadas temáticas**: mes de las tortugas, mes del agua, etc., alineadas con fechas
  ambientales (Día de la Tierra, Día de los Océanos).
- **Miniaturas automáticas** con el mismo motor de dibujo, para que todas tengan un estilo.
- **Versión en inglés** del mismo cuento para otro canal, reutilizando todo.
- **Libro para colorear en PDF** con escenas del cuento, como recurso descargable.
- **Lista de reproducción por valor y por tema** para que YouTube recomiende en cadena.
