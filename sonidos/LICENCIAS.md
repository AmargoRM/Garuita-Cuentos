# Sonidos reales de animales

Grabaciones **reales** de animales (nunca una persona imitando al animal), todas con
licencia **CC0 (dominio público)**: se pueden usar en YouTube con ingresos, sin pedir
permiso y sin dar crédito. Igual dejamos anotado de dónde sale cada una.

Vienen de [Freesound](https://freesound.org), tomadas del conjunto FSD50K
(copia en Hugging Face: `Fhrozen/FSD50k`), que guarda la licencia de cada grabación.
Aquí están recortadas (el pedazo más fuerte), con volumen parejo, en `.ogg`.

| Archivo | Qué suena | Grabación original | Autor en Freesound | Licencia |
|---|---|---|---|---|
| `congos.ogg` | Monos congo (aulladores) en la Península de Osa, Costa Rica | freesound.org/s/332724 «Howler Monkeys - short clip» | sethlind | CC0 |
| `leon.ogg` | Rugido de leones (felino real, para el rugido de Tigre Bruno) | freesound.org/s/69571 «Lions two» | Bidone | CC0 |
| `gallo.ogg` | Un gallo cantando | freesound.org/s/268018 «Rooster - single cry» | luckylittleraven | CC0 |
| `gallina.ogg` | Gallinas cacareando | freesound.org/s/200330 «Chicken chatter» | jsbarrett | CC0 |
| `aleteo.ogg` | Aleteo de palomas que salen volando | freesound.org/s/415019 «antwerpen duiven vleugels» | NickPeeters | CC0 |
| `pajaros.ogg` | Pájaros cantando en la selva (Palenque, México) | freesound.org/s/151773 «Pájaros Palenque» | universildo | CC0 |

## Cómo se usan en un cuento

En cada escena: `"sonidos": [{ "id": "congos", "en": "inicio", "vol": 0.8 }]`.
`en` puede ser `inicio`, `golpe`, `rugido`, `vuelan`, `vuelven`, `rama`, `salida`,
`linea2` (cuando empieza la frase 2 del diálogo) o un número de segundos.

## Regla

Solo se agregan grabaciones reales de animales con licencia CC0 o CC BY (anotando el
crédito). Nunca sonidos con licencia "NC" (no comercial) ni imitaciones hechas con la voz.
