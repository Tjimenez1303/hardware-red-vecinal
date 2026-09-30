# Capa portátil: las dos familias

Comparación del 29-sep-2026. Los precios son de lista en USD y caducan: los vigentes están en `datos/equipos.json` y en el comparador.

La capa portátil tiene hoy 26 aparatos: los 10 del 4-sep y 16 añadidos en esta revisión. Se comparan con criterios propios, no con los de la capa fija: la capa fija se juzga por su consumo dormido, y un portátil se juzga por lo que dura andando. En el sitio están en la pestaña Portátiles del catálogo y de la tabla.

| Criterio | (a) Etiqueta sin pantalla, emparejada al celular | (b) Aparato con pantalla propia |
|---|---|---|
| Ejemplos | SenseCAP T1000-E, MeshTracker X1, WisMesh Tag, ThinkNode M3, WisMesh Pocket Mini, ThinkNode M4, R1 Neo, MiniTrekker MKII | ThinkNode M1/M5/M9, T-Echo, MeshPocket, Wio Tracker L1 Pro, Nano G2 Ultra, Cardputer, T-Deck Plus/Pro, T-Lora Pager, WisMesh TAP, WisMesh Pocket V2 |
| Portabilidad (peso publicado) | 32 g (T1000-E), 38,7 g (M3), 45 g (X1), 84 g (R1 Neo). Tamaño de tarjeta o llavero. | 77 a 140 g: Cardputer 77, M1 y M5 81, M9 y Nano 123, MeshPocket 140. Cabe en un bolsillo, pero se nota. |
| Autonomía en uso | X1 «hasta 5 días» y M3 18 h, con un mensaje por minuto (la misma ficha dice también «al menos 12 h»). El Tag, 2 a 3 días según reportes de usuarios que cita RAK. T1000-E: Sin dato en la ficha. | M1 «más de 48 h» (la comunidad mide de 24 h con GPS a unos 4 días). Nano G2 Ultra, unos 5 días. El resto, Sin dato. **Casi nadie publica la autonomía en uso.** |
| Recarga | Varias usan **cable magnético propietario** (T1000-E, Tag, M3). Si el cable se pierde en un apagón, no hay cómo cargar. X1 y R1 Neo usan USB-C. | USB-C casi siempre. La MeshPocket carga por Qi2 y además es una batería externa de 5.000 o 10.000 mAh que **recarga celulares**. |
| Pilas comunes reemplazables | **Resultado negativo: ningún portátil usa pilas AA, AAA ni 18650 extraíble.** El más cercano es el Nano G2 Ultra: una LiPo con conector JST que se cambia quitando 4 tuercas. El ThinkNode M4 rotula «18650», pero no confirma que la celda se pueda sacar. Las 18650 sí se consiguen ya en Colombia (ver mercado colombiano) y alimentan los nodos fijos SenseCAP y Heltec. | Aplica a las dos familias. |
| Dependencia del celular | **Total para leer.** Sin teléfono, la etiqueta solo manda su posición o un SOS con un botón y **sigue retransmitiendo para los demás**. El vecino queda sordo, pero su aparato sigue sirviendo a la red. | Parcial o nula. Con pantalla y sin teclado (T-Echo, M1, M5, MeshPocket, L1 Pro) el vecino lee sin teléfono, pero no escribe texto libre. Con teclado (Cardputer, T-Deck, T-Lora Pager, M9, TAP) lee y responde solo. |
| Robustez | IP65 (T1000-E) e IP66 (X1, Tag, M3). La mejor protección publicada de la capa. | Casi todo Sin dato. La WisMesh TAP es IP65, y la MeshPocket declara que no es resistente al agua. |
| Resistencia a caídas | **Resultado negativo: ningún fabricante publica altura de caída ni ensayo MIL-STD.** | Aplica a las dos familias. |
| Llega funcionando | Todas preflasheadas o con soporte oficial. | La mayoría preflasheados. El T-Watch S3 exige flasheo manual, y el T-Lora Pager no confirma que traiga Meshtastic cargado. El Cardputer declara 868–923 MHz, **sin cubrir 923–928**. |
| Precio (USD, lista, 29-sep) | De 39,00 (Tag) a 89,00 (R1 Neo, agotado). T1000-E y M3 a 39,90; X1 a 49,90. | De 27,36 (T-Echo Lite) a 109,00 (TAP). L1 Pro a 47,90, MeshPocket a 49,00, M1 y M5 a 53,90, M9 a 74,90. |
| En Colombia | **Resultado negativo: ningún portátil autónomo a la venta con vendedor colombiano.** Se revisaron Electronilab, Sigma, Ardobot, DynamoElectronics y Didácticas. MercadoLibre no se pudo revisar porque exige iniciar sesión. | Aplica a las dos familias. |

### Qué papel cumple cada familia

- **Familia (a): reparto masivo.** Es la más barata, la más liviana y la mejor sellada. Va a los hogares que ya tienen un celular compatible. **Su punto débil, sin rodeos:** el vecino solo lee la alerta si su celular tiene la app de Meshtastic instalada, está emparejado y **tiene batería**. El escenario que justifica esta red es un apagón, y en un apagón largo el celular es lo primero que se muere. Lo que sí queda sin celular es valioso para la red, aunque no para su dueño: la etiqueta sigue retransmitiendo, y cada una suma caminos a la malla.
- **Familia (b): uno por cuadra.** Va a los líderes de cuadra, los brigadistas de la JAC y los hogares sin celular. Sobrevive mejor al apagón porque no necesita un segundo equipo. Los modelos con teclado (M9 a USD 74,90, Cardputer a 48) permiten además confirmar y responder. La **MeshPocket** (USD 49) resuelve de paso el punto débil de la familia (a): sus 5.000 mAh recargan los celulares de la cuadra.
- **Mezcla sugerida** (criterio propio, no dato): etiquetas para la mayoría de los hogares con celular, y al menos un aparato con pantalla por cuadra, dentro del tope de ~40 aparatos en `CLIENT` por dominio de colisión de la sección anterior.
