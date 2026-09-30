# Hardware Red Vecinal LoRa: comparador

Herramienta **interna** de la comunidad AIThinkers para decidir la compra de
hardware de la Red Vecinal LoRa (Manizales, Caldas). La Red Vecinal es una capa
de entrega resiliente para las alertas que el SAT y el SISMAN-LISA ya calculan:
no detecta nada ni decide niveles de alerta.

Compara en una sola página estática las dos capas de la red:

- **Capa fija:** nodos solares en postes y azoteas, más la troncal entre cerros.
  Incluye módulos (placas sueltas), antenas y accesorios.
- **Capa portátil:** aparatos de bolsillo que llevan los vecinos. Hay dos familias:
  (a) etiqueta sin pantalla emparejada al celular y (b) aparato con pantalla propia.

Además del comparador, la página documenta el **límite de densidad del enjambre**
(cuántos aparatos en alcance mutuo aguanta el canal y con qué rol va cada uno), el
umbral de bajo costo calculado por capa, los cambios de precio, el mercado
colombiano y los vacíos de información.

## Verla

Es HTML, CSS y JS sin dependencias, sin construcción y sin `npm install`.

- **Publicada:** GitHub Pages sirve `index.html` desde la raíz de la rama `main`.
- **En local:** el navegador no deja leer `datos/equipos.json` desde `file://`,
  así que hay que servir la carpeta:

  ```bash
  python3 -m http.server 8000
  ```

  y abrir <http://localhost:8000>.

## Estructura

```
index.html            la página; el texto de análisis va aquí
datos/equipos.json    todos los datos: equipos, mercado colombiano, referencias
assets/estilo.css     estilos (tema claro y oscuro)
assets/app.js         filtros, orden, barras, umbrales y referencias numeradas
```

## De dónde salen los datos

| Qué | Origen | Fecha |
|---|---|---|
| 48 equipos base | `datos/equipos-2026-09-04b.json` del proyecto Red Vecinal LoRa (49 relevados; el WisBlock Starter Kit estaba duplicado y se fusionó) | 4-sep-2026 |
| Precios, disponibilidad y fichas | Reverificados en la ficha del fabricante o del distribuidor: JSON de variantes de la tienda, JSON-LD de la ficha o navegador | 29-sep-2026 |
| 16 portátiles y 1 nodo fijo nuevos, 6 antenas con URL | Investigación del 29-sep-2026 | 29-sep-2026 |
| Límite de densidad | Documentación y blog oficiales de Meshtastic, código de `meshtastic/firmware` (v2.7.26), un preprint y una simulación de comunidad. Ver la sección en la página | 29-sep-2026 |

TRM de referencia: COP 3.140,55/USD (Banco de la República, 3-sep-2026). Los
precios son de lista en USD, **sin** el 25–30 % de importación.

## Reglas de los datos

Son las mismas del informe al IDEA del 4-sep-2026 y no se negocian:

1. **Un precio sin URL de vendedor y sin fecha no entra en ninguna tabla.** La
   página lo hace cumplir: si falta `url` o `fecha_consulta`, muestra ✕ en vez del
   precio y lo excluye de las barras y de los umbrales.
2. **Dato no publicado:** `null` en el JSON, que se muestra como **✕**. Nunca se
   rellena con una estimación.
3. **Dato sin confirmar:** la cadena `"aún en espera"`.
4. **Dato que no aplica** a la capa de esa fila (la autonomía en uso de una antena,
   por ejemplo): la página muestra **—**. No va en el JSON: sale de la lista
   `capas` de cada columna en `assets/app.js`. No hay que confundirlo con ✕.
5. **Dato verificado:** lleva su llamada numerada a la lista de referencias
   (campo `refs`, con claves de `referencias`).
6. **Las contradicciones entre fuentes se reportan** (campo `contradiccion`), no
   se resuelven.
7. **No se añade a `referencias` ninguna fuente que no se haya abierto.**
8. **Los precios de buscadores o de su caché no valen.** En esta revisión, Exa
   sirvió copias viejas de varias tiendas. Hay que leer la ficha en vivo.

## Cómo actualizar los precios

1. Abrir la ficha de cada equipo (`url`). En tiendas Shopify (RAK, LilyGO,
   Rokland, SpecFive, Atlavox, M5Stack), añadir `.js` a la URL del producto
   devuelve el JSON de variantes con precio y stock.
2. En `datos/equipos.json`, para cada equipo:
   - antes de tocar nada, copiar el precio viejo a `precio_anterior_usd`;
   - actualizar `precio_usd`, `precio_max_usd`, `variante_precio`, `disponibilidad`
     (`en stock` · `agotado` · `preventa` · `backorder` · `descontinuado` · `null`) y
     `fecha_consulta` (AAAA-MM-DD);
   - anotar en `cambio` lo que cambió.
3. Actualizar `meta.fecha_datos`.
4. Subir el sufijo `?v=` de `assets/estilo.css` y `assets/app.js` en
   `index.html`, para que GitHub Pages no sirva la versión en caché.
5. Las columnas de la tabla se definen en `COLUMNAS` (`assets/app.js`), cada una
   con las capas a las que aplica, y el detalle desplegable de cada fila en
   `DETALLE`. Para añadir un campo al comparador se añade ahí.
6. Los umbrales por capa, la tabla de cambios y las barras **se recalculan solos**
   desde el JSON. El texto de las secciones de densidad, capa portátil, cambios y
   vacíos está escrito a mano en `index.html`: si los datos cambian, hay que
   revisarlo.

### Campos de un equipo

| Campo | Contenido |
|---|---|
| `capa` | `fija` · `portatil` · `modulo` · `antena` · `accesorio` |
| `subcapa` | detalle (`nodo_desplegable`, `placa`, `energia_encapsulado`, …) |
| `familia` | solo portátiles: `a_etiqueta` · `b_pantalla` |
| `mcu`, `mcu_familia`, `radio`, `radio_familia` | texto de la ficha y familia normalizada para los filtros |
| `meshtastic` | `preflasheado` · `oficial` · `comunidad` · `no_corre` · `null` · `"aún en espera"` |
| `colombia` | `{estado: si \| no \| sin_dato, detalle, url}` |
| `peso_g`, `bateria_mah`, `consumo_ma`, `autonomia_uso_h`, `autonomia_dias`, `tx_dbm`, `ganancia_dbi` | números, o `null` si no están publicados |
| `autonomia_texto`, `consumo_texto` | condiciones textuales de la cifra; salen en el tooltip |
| `refs` | claves de `referencias` |

## Estilo: «Ancho de banda»

Si se edita la página, conviene mantener la dirección visual:

- **Una sola familia, Archivo, usando su eje de ancho.** Títulos expandidos
  (`wdth` 125) y muy pesados; tabla condensada (`wdth` 78) con cifras tabulares;
  texto corrido en ancho normal. La monoespaciada es solo para identificadores de
  configuración como `LONG_TURBO`.
- **Color de fondo:** papel niebla `#EEF1EF` con tinta pizarra `#1F2A2E`. En modo
  oscuro, la pizarra se vuelve el fondo.
- **Cada capa es una franja de color** que aparece en el selector, en el borde de
  cada fila y en las barras. Los colores (fija `#1F5FA8`, portátil `#EE7B00`,
  módulo `#159068`, antena `#7B4FB8`, accesorio `#A5782A`) se validaron para
  daltonismo en los dos modos. Si se añade una capa, hay que volver a validarlos.
- **El rojo `#B3312A` es solo para contradicciones.**
- **Se evita:** tarjetas con número grande, metadatos unidos con punto medio,
  etiquetas en mayúsculas, sombras y el mismo radio en todo.

## Publicar

El repositorio se creó sin remoto. Para publicarlo en GitHub Pages, el
responsable crea el repositorio en su cuenta, lo empuja y activa Pages desde
*Settings → Pages → Deploy from a branch → main / (root)*.
