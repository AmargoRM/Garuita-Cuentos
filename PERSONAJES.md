# Garuita Cuentos — Elenco fijo y estilo

Este archivo es la "biblia" del canal. Todos los cuentos usan **estos nombres, estas
personalidades y este estilo**, sin excepción. Si un cuento necesita un personaje nuevo,
primero se agrega aquí.

## Reglas
1. El nombre se escribe siempre igual: **animal + apodo tico** (Conejo Chepe, Mono Chito).
   No se usan "Tío", "Tía", "Doña" ni "Don", para no sonar a otros cuentos.
2. Cada personaje mantiene su personalidad: puede aprender, pero no cambiar de carácter.
3. En el JSON del cuento se usa el `id`; en el texto y los diálogos, el **nombre**.
4. Todos los personajes son de diseño propio del motor. No se imitan personajes de
   Disney, Pocoyó, Peppa Pig ni de ninguna serie o libro.
5. No se usan nombres ni textos de Carmen Lyra ("Tía Panchita", "Tío Conejo", etc.) ni "Cocorí".

## Elenco principal

| id | Nombre | Cómo es | Su forma de hablar | Colores |
|---|---|---|---|---|
| `conejo` | **Conejo Chepe** | Protagonista. Listo, curioso y de buen corazón. Usa su ingenio para resolver problemas, nunca para hacer daño. | Rápido, alegre: "¡Ya sé! ¡Tengo una idea!" | Piel canela, overol azul, moño rojo |
| `tortuga` | **Tortuga Tula** | La sabia del río. Lenta, paciente, cariñosa. Explica la enseñanza. | Pausada, con frases cortas y claras. | Verde con caparazón amarillo |
| `mono` | **Mono Chito** | Juguetón e impulsivo. Se equivoca primero, pero reconoce y corrige. Desde "El río limpio" es el guardián del río. | Chistoso, ríe mucho: "¡Ja, ja!" | Café con barriga clara |
| `gallina` | **Gallina Clota** | Mamá del pueblo, ordenada y mandona con cariño. | "¡Co-co!", da órdenes: "¡Cada cosa en su lugar!" | Blanca con patas naranja |
| `tigre` | **Tigre Bruno** | Grandote y gruñón, pero noble. Se asusta fácil aunque no lo admita. | Voz grave, exagera: "¡Puaj!" | Naranja con rayas |
| `danta` | **Danta Lola** | La más fuerte y tranquila. Ayuda con las tareas pesadas. | Lenta y amable. | Gris violeta |
| `tucan` | **Tucán Pico** | El mensajero del pueblo. Lleva las noticias volando. | Gritón y emocionado: "¡Todos al río!" | Negro con pico amarillo y naranja |
| `mariposa` | **Mariposa Luz** | Aparece cuando la naturaleza está sana. Señal de que todo salió bien. | Dulce y corta. | Morada |

## Elenco secundario (para cuentos futuros)

| id | Nombre | Cómo es |
|---|---|---|
| `perezoso` | **Perezoso Mencho** | Dormilón y sabio a su manera; dice cosas importantes muy despacio. |
| `zorra` | **Zorra Fina** | Astuta y presumida; a veces engaña, y aprende. |
| `coyote` | **Coyote Lalo** | Hambriento y despistado; sus planes casi siempre fallan. |
| `vaca` | **Vaca Chela** | Vende frutas en el mercado. Generosa. |
| `perro` | **Canelo** | Perro fiel del pueblo, juega con todos. |
| `gato` | **Misifú** | Gato curioso y un poco miedoso del agua. |
| `cucaracha` | **Cuca** | Pequeñita y valiente; demuestra que el tamaño no importa. |

## Estilo visual fijo
- **Dibujo**: personajes redondos tipo "muñeco", contorno café oscuro grueso (`#2A1A12`),
  ojos grandes, mejillas rosadas. Todo dibujado por el motor (`motor/story-engine.jsx`).
- **Lugares**: pueblito, bosque, río, playa, mercado, casa y noche. Colores vivos y cielo con sol sonriente.
- **Letras**: títulos con *Luckiest Guy*, textos con *Fredoka* (ambas permiten uso comercial).
- **Texto en pantalla**: una palabra grande y colorida arriba (`palabra`) y la narración
  abajo en un cuadro blanco que resalta cada palabra al leerla.
- **Transición**: círculo que se abre entre escenas.
- **Estructura de cada cuento**: título → historia → enseñanza dicha por Tortuga Tula →
  pregunta final a los niños ("¿Y vos?") → ¡FIN! con todos bailando.

## Recursos ambientales del motor
Campos opcionales en cada escena (ver `README.md`):
- `basura`: 0 a 3 (nada, poca, bastante, mucha).
- `agua`: `"sucia"` para el río color lodo.
- `limpiar`: `true` para que la basura vaya desapareciendo.
- `botes`: `true` para mostrar los tres basureros de reciclaje.
- Acciones `recoger` y `tirar` (con `objeto`: botella, lata, bolsa o papel).

## Cuentos hechos
| Archivo | Título | Tema | Valor |
|---|---|---|---|
| `cuentos/rio-limpio.json` | Conejo Chepe y el río limpio | No tirar basura al río | Trabajo en equipo, reconocer errores |
| `cuentos/rio-limpio-short.json` | ¡El río no es basurero! (Short) | Igual, en 53 s | Igual |
