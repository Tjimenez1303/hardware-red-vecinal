# Hardware Red Vecinal LoRa

Herramienta **interna** de la comunidad AIThinkers para decidir la compra de
hardware de la Red Vecinal LoRa (Manizales, Caldas). La Red Vecinal es una capa
de entrega resiliente para las alertas que el SAT y el SISMAN-LISA ya calculan:
no detecta nada ni decide niveles de alerta.

Cubre las dos capas de la red:

- **Capa fija:** nodos solares en postes y azoteas, más la troncal entre cerros.
  Incluye placas sueltas, antenas y accesorios.
- **Capa portátil:** aparatos de bolsillo que llevan los vecinos. Hay dos familias:
  (a) etiqueta sin pantalla emparejada al celular y (b) aparato con pantalla propia.

## Las páginas

| Página | Para qué |
|---|---|
| `index.html` | **Catálogo.** Galería con foto, filtros rápidos y orden. El ícono de filtros junto al orden abre un panel por campos (rangos de precio, peso, batería, potencia, grado IP, rasgos de sí o no y fabricante); cada filtro queda como una ficha que se edita o se quita. El buscador entiende operadores: `precio<50 peso<100 ip>=6 tiene:pantalla fabricante:rak` y Enter. Se marcan hasta cuatro equipos y se comparan en una ventana con lo esencial. Al tocar la foto o el nombre, la ficha completa del equipo se abre a pantalla completa encima del catálogo; se pasa al anterior o al siguiente con las flechas y se cierra con la X o con Esc. |
| `tabla.html` | **Tabla de resultados.** Todas las cifras en una cuadrícula, con barras dentro de las celdas y un panel de detalle por equipo. |
| `comparar.html` | **Comparación completa** de dos a cuatro equipos: además de lo esencial, puesto dentro de su capa, rendimiento por dólar, textos de la ficha, radio, FCC, instalación y fuentes que no coinciden. En cada fila, el mejor valor va en negrilla, y cada columna dice en cuántas filas gana. |
| `asistente.html` | **Asistente de compra.** Preguntas que cambian según las respuestas (a un portátil le pregunta el tamaño, a un repetidor de cerro la exposición) y una recomendación con dos alternativas. |
| `graficas.html` | **Gráficas.** Mapa de compromisos con ejes a elegir, índices de valor por dólar, precios por capa con sus cuartiles, perfil de un equipo frente a su capa y las dos familias portátiles. Lo que se toque en cualquiera aparece a la derecha con su ficha completa. |

La selección para comparar se guarda en el navegador y pasa de una página a otra.
El tema claro u oscuro se cambia con el botón del sol y la luna.

## Verla

Es HTML, CSS y JS sin dependencias, sin construcción y sin `npm install`. La
única carga externa es la fuente IBM Plex Sans de Google Fonts.

- **Publicada:** GitHub Pages sirve `index.html` desde la raíz de la rama `main`.
- **En local:** el navegador no deja leer `datos/equipos.json` desde `file://`,
  así que hay que servir la carpeta:

  ```bash
  python3 -m http.server 8000
  ```

  y abrir <http://localhost:8000>.

## Estructura

```
index.html, tabla.html, comparar.html, asistente.html, graficas.html
assets/comun.js         carga de datos, rasgos derivados, filas del comparador, barra y tema
assets/comun.css        tokens de color (claro y oscuro), barra, botones, estados
assets/img/<id>.jpg     una foto por equipo, descargada de la ficha del fabricante
datos/equipos.json      todos los datos: equipos, mercado colombiano, referencias
FUENTES.md              de dónde sale cada precio y cada dato (se genera)
herramientas/fuentes.py genera FUENTES.md desde el JSON
docs/densidad.md        el límite de densidad del enjambre, roles y configuración para Manizales
docs/familias-portatiles.md   comparación de las dos familias portátiles
```

Las referencias no están en la web: viven en `FUENTES.md` y en los dos
documentos de `docs/`.

## De dónde salen los datos

| Qué | Origen | Fecha |
|---|---|---|
| 48 equipos base | `datos/equipos-2026-09-04b.json` del proyecto Red Vecinal LoRa (49 relevados; el WisBlock Starter Kit estaba duplicado y se fusionó) | 4-sep-2026 |
| Precios, disponibilidad y fichas | Reverificados en la ficha del fabricante o del distribuidor: JSON de variantes de la tienda, JSON-LD de la ficha o navegador | 29-sep-2026 |
| Equipos nuevos: 16 portátiles, 1 nodo fijo y 6 antenas | Investigación del 29-sep-2026 | 29-sep-2026 |
| Huecos de ficha llenados con otra fuente | Wikis, manuales y directorios; cada uno anotado en `fuentes_campos` con URL, cita y condiciones | 29 y 30-sep-2026 |
| Potencia certificada ante la FCC | Concesiones e informes de prueba en fccid.io, leídos con navegador | 30-sep-2026 |
| 99 equipos nuevos de fabricantes de China, Hong Kong y Taiwán | Tiendas oficiales de LilyGO, Heltec, RAK, Seeed, Elecrow, M5Stack, Ebyte, Waveshare, DFRobot, MinewSemi, Meshnology y ALFA, leídas en vivo | 30-sep-2026 |
| Precios en AliExpress | Tiendas oficiales de LilyGO, Heltec, RAK y Elecrow en AliExpress, con la variante de 902-928 MHz y el envío a Colombia, leídas con el navegador sin iniciar sesión | 30-sep-2026 |
| Fotos | `og:image` de la ficha o imagen de la variante en el JSON de la tienda, reducidas a 800 px | 29-sep-2026 |

TRM de referencia: COP 3.140,55/USD (Banco de la República, 3-sep-2026). Los
precios son de lista en USD, **sin** el costo de importación.

## Reglas de los datos

Son las mismas del informe al IDEA del 4-sep-2026 y no se negocian:

1. **Un precio sin URL de vendedor y sin fecha no entra.** La página lo hace
   cumplir: si falta `url` o `fecha_consulta`, muestra «Sin dato» y deja el equipo
   fuera de las barras, los umbrales y las gráficas de precio.
2. **Dato no publicado:** `null` en el JSON, que la página muestra como «Sin dato».
   Nunca se rellena con una estimación. Antes de dejar un hueco se busca la
   referencia exacta en la ficha, el manual, la wiki del fabricante y, si existe,
   el registro FCC.
3. **Dato que no aplica** a la capa (la autonomía en uso de una antena, por
   ejemplo): la página muestra «No aplica». Sale de la lista `capas` de cada fila
   en `assets/comun.js`, no del JSON.
4. **Dato llenado con otra fuente:** va en `fuentes_campos.<campo>` con `url`,
   `cita`, `tipo_fuente` (oficial, comercial o comunidad) y `condiciones`. La
   autonomía dice además si la dio el fabricante o la midió la comunidad.
5. **Las contradicciones entre fuentes se reportan** en el campo `contradiccion`,
   no se resuelven.
6. **La potencia declarada y la certificada son dos datos distintos.** `tx_dbm` es
   lo que publica el fabricante (casi siempre el máximo del chip). `tx_fcc_dbm` es
   la potencia conducida con la que se certificó el equipo ante la FCC. Varios
   equipos LilyGO y Heltec se certificaron por debajo de 8 dBm. Tres Elecrow (M1,
   M5 y M9) se certificaron por intensidad de campo y no tienen cifra.
7. **No se añade a `referencias` ninguna fuente que no se haya abierto.**
8. **Los precios de buscadores o de su caché no valen.** Exa sirvió copias viejas
   de varias tiendas. Hay que leer la ficha en vivo.

## Cómo actualizar

### Precios

1. Abrir la ficha de cada equipo (`url`). En tiendas Shopify (RAK, LilyGO,
   Rokland, SpecFive, Atlavox, M5Stack), añadir `.js` a la URL del producto
   devuelve el JSON de variantes con precio y stock.
2. En `datos/equipos.json`, para cada equipo:
   - antes de tocar nada, copiar el precio viejo a `precio_anterior_usd`;
   - actualizar `precio_usd`, `precio_max_usd`, `variante_precio`, `disponibilidad`
     (`en stock`, `agotado`, `preventa`, `backorder`, `descontinuado` o `null`) y
     `fecha_consulta` (AAAA-MM-DD);
   - anotar en `cambio` lo que cambió.
3. Actualizar `meta.fecha_datos` y regenerar las fuentes:

   ```bash
   python3 herramientas/fuentes.py
   ```

### Un equipo nuevo

1. Añadirlo a `datos/equipos.json` con un `id` único en minúsculas y guiones.
2. Guardar su foto en `assets/img/<id>.jpg` y poner esa ruta en `imagen`, con la
   URL de donde salió en `imagen_fuente`. En macOS, para dejarla como las demás:

   ```bash
   sips -s format jpeg -s formatOptions 82 -Z 800 original.png --out assets/img/<id>.jpg
   ```

   Sin foto, la página dibuja una silueta según el tipo de equipo.
3. Regenerar `FUENTES.md`.

### Una fila o una columna

- Las filas del comparador y de la ventana de comparación están en `GRUPOS`
  (`assets/comun.js`). Cada fila tiene un título, una función que pinta la celda,
  las capas a las que aplica y, si tiene sentido, una función `mejor` que decide
  cuál va en negrilla. Las filas con `det: true` solo salen en la comparación
  completa y en la ficha de las gráficas, no en la ventana del catálogo.
- Los campos del panel de filtros y sus palabras para el buscador están en `NUM`
  y `BOOL` (`index.html`).
- Las columnas de la tabla están en `COL` y `PORCAPA` (`tabla.html`).
- Los ejes del mapa de compromisos y los índices de valor están en `MAG` e
  `INDICES` (`graficas.html`).
- Las preguntas del asistente están en `PREGUNTAS` (`asistente.html`). Cada una
  tiene una condición `cuando` que decide si aparece según las respuestas previas.

### Caché de GitHub Pages

Si después de publicar se sigue viendo la versión vieja, añadir o subir un sufijo
`?v=` a `assets/comun.css` y `assets/comun.js` en las cinco páginas.

## Estilo

- **Una sola familia, IBM Plex Sans**, con cifras tabulares en las tablas.
- **Cada capa tiene su color**: fija azul, portátil naranja, placa verde, antena
  violeta y accesorio ocre. Se usan igual en las cinco páginas y en las gráficas.
- **El mejor valor de una fila va en negrilla.** No se usa color para eso.
- **Se evita:** cajas alrededor de cada bloque, etiquetas en mayúsculas, metadatos
  unidos con punto medio, guiones largos como separador y llamadas numeradas en
  el texto.

## Publicar

El repositorio se creó sin remoto. Para publicarlo en GitHub Pages, el
responsable crea el repositorio en su cuenta, lo empuja y activa Pages desde
*Settings → Pages → Deploy from a branch → main / (root)*.
