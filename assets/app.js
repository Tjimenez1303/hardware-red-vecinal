/* Comparador de hardware — Red Vecinal LoRa.
   Sin dependencias ni construcción: lee datos/equipos.json y pinta.
   Convención de celdas (la misma del informe al IDEA del 4-sep-2026):
     null            -> ✕  dato no publicado por la fuente
     "aún en espera" -> dato sin confirmar
     valor           -> verificado, con llamada numerada a la lista de referencias */

(function () {
  "use strict";

  const ESPERA = "aún en espera";
  const CAPAS = {
    fija: { nombre: "Fija", color: "var(--capa-fija)" },
    portatil: { nombre: "Portátil", color: "var(--capa-portatil)" },
    modulo: { nombre: "Módulo", color: "var(--capa-modulo)" },
    antena: { nombre: "Antena", color: "var(--capa-antena)" },
    accesorio: { nombre: "Accesorio", color: "var(--capa-accesorio)" },
  };
  const MESHTASTIC = {
    preflasheado: "Preflasheado",
    oficial: "Oficial",
    comunidad: "Comunidad",
    no_corre: "No corre",
  };
  const COLOMBIA = { si: "Se vende en CO", no: "No encontrado en CO", sin_dato: "Sin dato" };
  const METRICAS = {
    precio_usd: { nombre: "Precio", unidad: "USD", dec: 2, desc: "Precio mínimo de lista de la variante indicada, en USD, sin importación." },
    consumo_ma: { nombre: "Consumo publicado", unidad: "mA", dec: 1, desc: "Corriente tal como la publica el fabricante. OJO: cada fabricante mide una cosa distinta (recepción, reposo activo, máximo con CPU y radio); la definición de cada cifra está en el tooltip de la tabla. Compare solo cifras con la misma definición." },
    autonomia_uso_h: { nombre: "Autonomía en uso", unidad: "h", dec: 0, desc: "Horas en uso declaradas por el fabricante. Casi nadie la publica, y quien lo hace no da las mismas condiciones (intervalo de posición, GPS, pantalla): son cifras de catálogo, no comparables entre sí sin leer el tooltip." },
    bateria_mah: { nombre: "Batería", unidad: "mAh", dec: 0, desc: "Capacidad nominal de la batería incluida. Ningún fabricante de nodos fijos publica autonomía sin sol en días: la capacidad es el único indicador comparable de reserva." },
    peso_g: { nombre: "Peso", unidad: "g", dec: 0, desc: "Peso del aparato según el fabricante." },
  };

  const estado = {
    datos: null,
    refIndice: new Map(), // clave -> número
    texto: "",
    capas: new Set(["fija", "portatil", "modulo", "antena", "accesorio"]),
    mcu: "", radio: "", meshtastic: "", colombia: "", familia: "",
    precioMin: null, precioMax: null, bateriaMin: null,
    soloConPrecio: false,
    orden: { clave: "precio_usd", dir: 1 },
    metrica: "precio_usd",
    escala: "lineal",
  };

  // ---------- utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const esNum = (v) => typeof v === "number" && isFinite(v);
  const fmt = (v, dec = 2) => esNum(v) ? v.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "";
  const fmtCorto = (v) => {
    if (!esNum(v)) return "";
    const a = Math.abs(v);
    const dec = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
    return v.toLocaleString("es-CO", { maximumFractionDigits: dec });
  };

  function llamadas(refs) {
    if (!refs || !refs.length) return "";
    const partes = refs
      .map((k) => estado.refIndice.get(k))
      .filter(Boolean)
      .sort((a, b) => a - b)
      .map((n) => `<a href="#ref-${n}" title="Referencia ${n}">${n}</a>`);
    return partes.length ? `<span class="llamada">[${partes.join(",")}]</span>` : "";
  }

  function celda(v, opts = {}) {
    if (v === null || v === undefined || v === "") return `<span class="ausente" title="Dato no publicado por la fuente">✕</span>`;
    if (v === ESPERA) return `<span class="espera" title="Dato sin confirmar">aún en espera</span>`;
    if (esNum(v)) return fmt(v, opts.dec ?? 0);
    if (typeof v === "boolean") return v ? "sí" : "no";
    const t = String(v);
    return t.length > (opts.max ?? 36) ? `<span class="recorte" title="${esc(t)}">${esc(t)}</span>` : esc(t);
  }

  // Un precio sin URL de vendedor y sin fecha no entra en ninguna tabla (modes/_shared.md §3).
  function precioValido(e) {
    return esNum(e.precio_usd) && !!e.url && !!e.fecha_consulta;
  }
  function valorMetrica(e, m) {
    if (m === "precio_usd") return precioValido(e) ? e.precio_usd : null;
    return esNum(e[m]) ? e[m] : null;
  }

  function percentil(ordenados, p) {
    // Interpolación lineal entre rangos (tipo 7, la de numpy por defecto).
    if (!ordenados.length) return null;
    const h = (ordenados.length - 1) * p;
    const lo = Math.floor(h), hi = Math.ceil(h);
    return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (h - lo);
  }

  // ---------- filtrado y orden ----------
  function filtrar() {
    const t = estado.texto.trim().toLowerCase();
    return estado.datos.equipos.filter((e) => {
      if (!estado.capas.has(e.capa)) return false;
      if (t) {
        const heno = [e.fabricante, e.modelo, e.mcu, e.mcu_familia, e.radio, e.radio_familia, e.subcapa_nombre].join(" ").toLowerCase();
        if (!t.split(/\s+/).every((p) => heno.includes(p))) return false;
      }
      if (estado.mcu && e.mcu_familia !== estado.mcu) return false;
      if (estado.radio && e.radio_familia !== estado.radio) return false;
      if (estado.familia && e.familia !== estado.familia) return false;
      if (estado.meshtastic) {
        const m = e.meshtastic === null || e.meshtastic === undefined || e.meshtastic === ESPERA ? "sin_dato" : e.meshtastic;
        if (m !== estado.meshtastic) return false;
      }
      if (estado.colombia && (e.colombia?.estado || "sin_dato") !== estado.colombia) return false;
      const p = precioValido(e) ? e.precio_usd : null;
      if (estado.soloConPrecio && p === null) return false;
      if (estado.precioMin !== null && (p === null || p < estado.precioMin)) return false;
      if (estado.precioMax !== null && (p === null || p > estado.precioMax)) return false;
      if (estado.bateriaMin !== null && !(esNum(e.bateria_mah) && e.bateria_mah >= estado.bateriaMin)) return false;
      return true;
    });
  }

  function ordenar(lista) {
    const { clave, dir } = estado.orden;
    const val = (e) => {
      if (clave === "precio_usd") return precioValido(e) ? e.precio_usd : null;
      if (clave === "modelo") return (e.fabricante + " " + e.modelo).toLowerCase();
      if (clave === "capa") return Object.keys(CAPAS).indexOf(e.capa);
      return e[clave];
    };
    return lista.slice().sort((a, b) => {
      const va = val(a), vb = val(b);
      const aus = (v) => v === null || v === undefined || v === ESPERA || v === "";
      if (aus(va) && aus(vb)) return 0;
      if (aus(va)) return 1; // los ausentes siempre al final, en ambos sentidos
      if (aus(vb)) return -1;
      if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb), "es") * dir;
      return (va - vb) * dir;
    });
  }

  // ---------- tabla ----------
  const COLUMNAS = [
    { clave: "capa", titulo: "Capa", orden: true },
    { clave: "modelo", titulo: "Equipo", orden: true },
    { clave: "precio_usd", titulo: "Precio USD", orden: true, num: true },
    { clave: "disponibilidad", titulo: "Disponib." },
    { clave: "cambio_pct", titulo: "Δ vs 4-sep", orden: true, num: true },
    { clave: "mcu", titulo: "MCU" },
    { clave: "radio", titulo: "Radio" },
    { clave: "tx_dbm", titulo: "TX dBm", orden: true, num: true },
    { clave: "meshtastic", titulo: "Meshtastic" },
    { clave: "colombia", titulo: "Colombia" },
    { clave: "peso_g", titulo: "Peso g", orden: true, num: true },
    { clave: "dimensiones_mm", titulo: "Dimensiones mm" },
    { clave: "bateria_mah", titulo: "Batería mAh", orden: true, num: true },
    { clave: "bateria_reemplazable", titulo: "Pila reempl." },
    { clave: "autonomia_uso_h", titulo: "Autonomía en uso h", orden: true, num: true },
    { clave: "autonomia_dias", titulo: "Sin sol días", orden: true, num: true },
    { clave: "consumo_ma", titulo: "Consumo mA", orden: true, num: true },
    { clave: "recarga", titulo: "Recarga" },
    { clave: "depende_celular", titulo: "Depende del celular" },
    { clave: "grado_ip", titulo: "IP" },
    { clave: "ganancia_dbi", titulo: "Ganancia dBi", orden: true, num: true },
    { clave: "notas", titulo: "Notas" },
  ];

  function pintarCabecera() {
    const tr = $("#tabla thead tr");
    tr.innerHTML = COLUMNAS.map((c) => {
      const act = estado.orden.clave === c.clave;
      const fl = c.orden ? `<span class="flecha">${act ? (estado.orden.dir > 0 ? "▲" : "▼") : "↕"}</span>` : "";
      return `<th class="${c.orden ? "ordenable" : ""}" data-clave="${c.clave}" ${c.orden ? `aria-sort="${act ? (estado.orden.dir > 0 ? "ascending" : "descending") : "none"}" tabindex="0"` : ""}>${c.titulo}${fl}</th>`;
    }).join("");
  }

  function filaHTML(e) {
    const capa = CAPAS[e.capa];
    const tds = [];
    tds.push(`<td style="--franja:${capa.color}">${capa.nombre}${e.subcapa_nombre ? `<span class="sub">${esc(e.subcapa_nombre)}</span>` : ""}</td>`);
    const fam = e.familia === "a_etiqueta" ? "familia (a): etiqueta" : e.familia === "b_pantalla" ? "familia (b): pantalla propia" : "";
    tds.push(`<td class="modelo"><b>${esc(e.fabricante)}</b> ${esc(e.modelo)}${llamadas(e.refs)}${e.linea_base ? `<span class="sub">línea base del proyecto</span>` : ""}${fam ? `<span class="sub">${fam}</span>` : ""}</td>`);
    // precio
    if (precioValido(e)) {
      const max = esNum(e.precio_max_usd) && e.precio_max_usd > e.precio_usd ? `–${fmt(e.precio_max_usd)}` : "";
      tds.push(`<td class="num"><a href="${esc(e.url)}" target="_blank" rel="noopener" title="${esc(e.variante_precio || "Abrir ficha del vendedor")}">${fmt(e.precio_usd)}${max}</a><span class="precio-fecha" title="${esc((e.vendedor || "") + ", consultado el " + e.fecha_consulta)}">${esc(e.fecha_consulta)}</span></td>`);
    } else if (e.precio_espera) {
      tds.push(`<td class="num"><span class="espera">aún en espera</span><span class="precio-fecha recorte" title="${esc(e.precio_nota || "")}">${esc(e.precio_nota || "")}</span></td>`);
    } else if (e.url) {
      tds.push(`<td class="num sin-precio"><span class="ausente">✕</span> <a href="${esc(e.url)}" target="_blank" rel="noopener">ficha</a><span class="precio-fecha recorte" title="${esc(e.precio_nota || "precio no legible")}">${esc(e.precio_nota || "precio no legible")}${e.fecha_consulta ? ", " + esc(e.fecha_consulta) : ""}</span></td>`);
    } else {
      tds.push(`<td class="num">${celda(null)}</td>`);
    }
    tds.push(`<td>${celda(e.disponibilidad)}</td>`);
    if (esNum(e.cambio_pct)) {
      const cl = e.cambio_pct > 0.5 ? "cambio-sube" : e.cambio_pct < -0.5 ? "cambio-baja" : "";
      const s = e.cambio_pct > 0 ? "+" : "";
      tds.push(`<td class="num ${cl}" title="Antes: USD ${fmt(e.precio_anterior_usd)}">${s}${fmt(e.cambio_pct, 1)} %</td>`);
    } else if (e.correccion) {
      tds.push(`<td class="num" title="${esc(e.correccion)}"><span class="espera">corrección</span></td>`);
    } else {
      tds.push(`<td class="num">${e.nuevo ? `<span class="ausente">nuevo</span>` : `<span class="ausente">—</span>`}</td>`);
    }
    tds.push(`<td>${celda(e.mcu)}</td>`);
    tds.push(`<td>${celda(e.radio)}</td>`);
    tds.push(`<td class="num">${celda(e.tx_dbm)}</td>`);
    const mt = e.meshtastic;
    tds.push(`<td class="mt ${mt ? "mt-" + mt : ""}">${mt && MESHTASTIC[mt] ? MESHTASTIC[mt] : celda(mt)}</td>`);
    const co = e.colombia || { estado: "sin_dato" };
    const coTxt = co.estado === "si"
      ? `${co.url ? `<a href="${esc(co.url)}" target="_blank" rel="noopener">sí</a>` : "sí"}${co.detalle ? ` <span class="recorte ausente" style="font-size:11px" title="${esc(co.detalle)}">${esc(co.detalle)}</span>` : ""}`
      : co.estado === "no" ? `<span title="${esc(co.detalle || "")}" style="cursor:help">no <span class="ausente" style="font-size:10px">(ver)</span></span>` : `<span class="ausente">sin dato</span>`;
    tds.push(`<td>${coTxt}</td>`);
    tds.push(`<td class="num">${celda(e.peso_g)}</td>`);
    tds.push(`<td>${celda(e.dimensiones_mm)}</td>`);
    tds.push(`<td class="num">${celda(e.bateria_mah)}</td>`);
    tds.push(`<td>${celda(e.bateria_reemplazable)}</td>`);
    tds.push(`<td class="num" title="${esc([e.autonomia_texto, e.autonomia_comunidad ? "Comunidad (no del fabricante): " + e.autonomia_comunidad : ""].filter(Boolean).join(". "))}">${celda(e.autonomia_uso_h)}${!esNum(e.autonomia_uso_h) && (e.autonomia_texto || e.autonomia_comunidad) ? ` <span class="ausente" style="font-size:10px">(ver)</span>` : ""}</td>`);
    tds.push(`<td class="num" title="${esc(e.autonomia_texto || "")}">${celda(e.autonomia_dias, { dec: 0 })}</td>`);
    tds.push(`<td class="num" title="${esc(e.consumo_texto || "")}">${celda(e.consumo_ma, { dec: 1 })}</td>`);
    tds.push(`<td>${celda(e.recarga)}</td>`);
    tds.push(`<td title="${esc(e.sin_celular ? "Sin teléfono queda: " + e.sin_celular : "")}">${celda(e.depende_celular)}${e.sin_celular ? ` <span class="ausente" style="font-size:10px">(ver)</span>` : ""}</td>`);
    tds.push(`<td>${celda(e.grado_ip)}</td>`);
    tds.push(`<td class="num">${celda(e.ganancia_dbi, { dec: 1 })}</td>`);
    const notaTxt = [e.notas, e.contradiccion ? "Contradicción: " + e.contradiccion : "", e.variante_precio ? "Variante de precio: " + e.variante_precio : ""].filter(Boolean).join(". ");
    tds.push(`<td class="notas">${notaTxt ? `<span class="recorte r3" title="${esc(notaTxt)}">${e.contradiccion ? `<b class="contra">Contradicción.</b> ` : ""}${esc(e.notas || e.contradiccion || e.variante_precio || "")}</span>` : ""}</td>`);
    return `<tr>${tds.join("")}</tr>`;
  }

  function pintarTabla(lista) {
    pintarCabecera();
    $("#tabla tbody").innerHTML = lista.map(filaHTML).join("") ||
      `<tr><td colspan="${COLUMNAS.length}" style="padding:12px">Ningún equipo cumple los filtros.</td></tr>`;
    const conPrecio = lista.filter(precioValido).length;
    const col = COLUMNAS.find((c) => c.clave === estado.orden.clave)?.titulo || "";
    $("#resumen-filtro").textContent =
      `${lista.length} de ${estado.datos.equipos.length} equipos, ${conPrecio} con precio verificable. Ordenado por ${col.replace(/ ↕| ▲| ▼/g, "")}, ${estado.orden.dir > 0 ? "de menor a mayor" : "de mayor a menor"}.`;
  }

  // ---------- barras ----------
  function ticksLineales(max) {
    const paso0 = max / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(paso0)));
    const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0) || 10 * mag;
    const tope = Math.ceil(max / paso) * paso;
    const t = [];
    for (let v = 0; v <= tope + 1e-9; v += paso) t.push(+v.toFixed(10));
    return { tope, t };
  }
  function ticksLog(min, max) {
    // Dominio ajustado a los datos (no a décadas completas) para no desperdiciar ancho.
    const lo = min / 1.6, hi = max * 1.12;
    const t = [];
    for (let d = Math.floor(Math.log10(lo)); d <= Math.ceil(Math.log10(hi)); d++) for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, d);
      if (v >= lo && v <= hi) t.push(v);
    }
    return { lo, hi, t };
  }

  function pintarBarras(lista) {
    const m = estado.metrica, def = METRICAS[m];
    const conValor = lista.map((e) => ({ e, v: valorMetrica(e, m) })).filter((x) => esNum(x.v) && x.v > 0);
    const sinValor = lista.length - conValor.length;
    conValor.sort((a, b) => a.v - b.v);

    const cont = $("#barras");
    const nota = $("#nota-escala");
    $("#titulo-fig").textContent = `${def.nombre} (${def.unidad}) — ${conValor.length} equipos de los ${lista.length} filtrados`;
    $("#desc-fig").textContent = def.desc + (sinValor ? ` ${sinValor} equipo(s) del filtro no tienen el dato publicado y no aparecen (✕ en la tabla).` : "");

    // Leyenda: solo capas presentes.
    const capasPresentes = [...new Set(conValor.map((x) => x.e.capa))];
    const unaCapa = capasPresentes.length === 1;
    let p50 = null;
    if (unaCapa && conValor.length >= 3) p50 = percentil(conValor.map((x) => x.v), 0.5);
    $("#leyenda-fig").innerHTML = capasPresentes.map((c) => `<span><span class="punto" style="background:${CAPAS[c].color}"></span>${CAPAS[c].nombre}</span>`).join("") +
      (p50 !== null ? `<span><span class="linea-p50"></span>mediana de lo mostrado: ${fmtCorto(p50)} ${def.unidad}</span>` : "");

    if (!conValor.length) {
      cont.innerHTML = `<div class="barras-vacio">Ningún equipo del filtro publica este dato.</div>`;
      $("#eje").innerHTML = "";
      nota.className = "nota-escala";
      nota.textContent = "";
      return;
    }

    const vmin = conValor[0].v, vmax = conValor[conValor.length - 1].v;
    const razon = vmax / vmin;
    let pos, ticks;
    if (estado.escala === "log") {
      const { lo, hi, t } = ticksLog(vmin, vmax);
      const L = Math.log10(lo), H = Math.log10(hi);
      pos = (v) => ((Math.log10(v) - L) / (H - L)) * 100;
      ticks = t;
      nota.className = "nota-escala alerta";
      nota.innerHTML = `<b>Escala logarítmica.</b> Cada división multiplica el valor; la longitud de la barra <b>no</b> es proporcional al valor, y una barra el doble de larga no vale el doble. El eje va de ${fmtCorto(lo)} a ${fmtCorto(hi)} ${def.unidad}: no empieza en cero. Úsela para ver a la vez magnitudes muy dispares (aquí, de ${fmtCorto(vmin)} a ${fmtCorto(vmax)}: ×${fmtCorto(razon)}).`;
    } else {
      const { tope, t } = ticksLineales(vmax);
      pos = (v) => (v / tope) * 100;
      ticks = t;
      nota.className = razon > 15 ? "nota-escala alerta" : "nota-escala";
      nota.innerHTML = `<b>Escala lineal desde cero:</b> la longitud es proporcional al valor.` +
        (razon > 15 ? ` El rango va de ${fmtCorto(vmin)} a ${fmtCorto(vmax)} ${def.unidad} (×${fmtCorto(razon)}): las barras cortas quedan casi invisibles y las diferencias pequeñas entre ellas no se leen. Filtre por capa o cambie a escala logarítmica, que lo declara.` : "");
    }

    cont.innerHTML = conValor.map(({ e, v }) => {
      const w = Math.max(0.4, pos(v));
      const izq = w > 78;
      const etiquetaValor = `${fmt(v, def.dec)}`;
      const info = `${e.fabricante} ${e.modelo} — ${fmt(v, def.dec)} ${def.unidad}` +
        (m === "precio_usd" ? `, ${e.vendedor || ""}, consultado el ${e.fecha_consulta}` : "") +
        (m.startsWith("autonomia") && e.autonomia_texto ? `. ${e.autonomia_texto}` : "");
      return `<div class="etq" title="${esc(e.fabricante + " " + e.modelo)}">${esc(e.fabricante)} ${esc(e.modelo)}</div>` +
        `<div class="pista" data-info="${esc(info)}">` +
        `<div class="barra" style="width:${w}%;background:${CAPAS[e.capa].color}"></div>` +
        `<span class="valor" style="${izq ? `right:${100 - w + 1}%;color:var(--superficie)` : `left:calc(${w}% + 4px)`}">${etiquetaValor}</span>` +
        (p50 !== null ? `<div class="marca-p50" style="left:${pos(p50)}%"></div>` : "") +
        `</div>`;
    }).join("");
    $("#eje").innerHTML = ticks.map((t) => `<span style="left:${pos(t)}%">${fmtCorto(t)}</span>`).join("");
  }

  // ---------- umbrales por capa (se recalculan con los precios del JSON) ----------
  function pintarUmbrales() {
    const grupos = [
      { nombre: "Módulo / placa desnuda", f: (e) => e.capa === "modulo" },
      { nombre: "Nodo fijo desplegable", f: (e) => e.capa === "fija" && e.subcapa === "nodo_desplegable" },
      { nombre: "Portátil (bolsillo / mano)", f: (e) => e.capa === "portatil" },
      { nombre: "Portátil — familia (a) etiqueta", f: (e) => e.capa === "portatil" && e.familia === "a_etiqueta" },
      { nombre: "Portátil — familia (b) pantalla", f: (e) => e.capa === "portatil" && e.familia === "b_pantalla" },
    ];
    const filas = grupos.map((g) => {
      const v = estado.datos.equipos.filter((e) => g.f(e) && precioValido(e)).map((e) => e.precio_usd).sort((a, b) => a - b);
      if (!v.length) return `<tr><td>${g.nombre}</td><td class="num">0</td><td colspan="5">sin precios verificables</td></tr>`;
      const c = (p) => `<td class="num">${fmt(percentil(v, p))}</td>`;
      return `<tr><td>${g.nombre}</td><td class="num">${v.length}</td><td class="num">${fmt(v[0])}</td>${c(0.25)}<td class="num"><b>${fmt(percentil(v, 0.5))}</b></td>${c(0.75)}<td class="num">${fmt(v[v.length - 1])}</td></tr>`;
    });
    const tb = $("#umbrales tbody");
    if (tb) tb.innerHTML = filas.join("");
  }

  // ---------- cambios de precio ----------
  function pintarCambios() {
    const tb = $("#cambios tbody");
    if (!tb) return;
    const l = estado.datos.equipos
      .filter((e) => esNum(e.precio_anterior_usd))
      .map((e) => ({ e, antes: e.precio_anterior_usd, ahora: precioValido(e) ? e.precio_usd : null }))
      .filter((x) => x.ahora === null || Math.abs(x.ahora - x.antes) > 0.005 || x.e.disponibilidad === "agotado" || x.e.disponibilidad === "backorder" || x.e.disponibilidad === "descontinuado");
    l.sort((a, b) => (a.ahora === null) - (b.ahora === null) || ((b.ahora ?? 0) - b.antes) - ((a.ahora ?? 0) - a.antes));
    tb.innerHTML = l.map(({ e, antes, ahora }) => {
      const d = ahora === null ? "" : ((ahora - antes) / antes) * 100;
      return `<tr><td>${CAPAS[e.capa].nombre}</td><td>${esc(e.fabricante)} ${esc(e.modelo)}</td><td class="num">${fmt(antes)}</td><td class="num">${ahora === null ? celda(null) : fmt(ahora)}</td><td class="num ${d > 0.5 ? "cambio-sube" : d < -0.5 ? "cambio-baja" : ""}">${ahora === null ? "" : (d > 0 ? "+" : "") + fmt(d, 1) + " %"}</td><td>${celda(e.disponibilidad)}</td><td>${e.cambio ? esc(e.cambio) : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="7">Sin cambios registrados.</td></tr>`;
    const n = estado.datos.equipos.filter((e) => e.nuevo);
    const nl = $("#nuevos-lista");
    if (nl) nl.innerHTML = n.map((e) => `<li><b>${esc(e.fabricante)} ${esc(e.modelo)}</b> — ${CAPAS[e.capa].nombre}${precioValido(e) ? `, USD ${fmt(e.precio_usd)}` : ", sin precio verificable"}${llamadas(e.refs)}${e.notas ? `. ${esc(e.notas)}` : ""}</li>`).join("") || "<li>Ninguno.</li>";
  }

  // ---------- mercado colombiano ----------
  function pintarMercado() {
    const tb = $("#mercado-co tbody");
    if (!tb) return;
    const l = estado.datos.mercado_colombia.slice().sort((a, b) => a.tipo.localeCompare(b.tipo, "es") || (a.precio_cop ?? 1e12) - (b.precio_cop ?? 1e12));
    tb.innerHTML = l.map((m) => `<tr><td>${esc(m.tipo)}</td><td>${esc(m.producto)}${llamadas([m.ref])}</td><td>${esc(m.vendedor)}</td><td class="num">${esNum(m.precio_cop) ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${m.precio_cop.toLocaleString("es-CO", { maximumFractionDigits: 0 })}</a>` : celda(null)}</td><td>${celda(m.stock)}</td><td>${m.cambio ? esc(m.cambio) : ""}${m.notas ? `<div class="ausente" style="font-size:11.5px">${esc(m.notas)}</div>` : ""}</td></tr>`).join("");
  }

  // ---------- referencias y llamadas en la prosa ----------
  function pintarReferencias() {
    const ol = $("#lista-referencias");
    ol.innerHTML = estado.datos.referencias.map((r, i) => {
      const n = i + 1;
      return `<li id="ref-${n}" value="${n}">${esc(r.entidad)}. ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.titulo)}</a>` : esc(r.titulo)}. <span class="fecha">${r.tipo ? esc(r.tipo) + ", " : ""}consultado el ${esc(r.fecha_consulta)}</span></li>`;
    }).join("");
    document.querySelectorAll("[data-ref]").forEach((el) => {
      el.outerHTML = llamadas(el.getAttribute("data-ref").split(/[\s,]+/));
    });
  }

  // ---------- controles ----------
  function opcionesSelect(sel, valores, etiquetas) {
    const actual = sel.value;
    sel.innerHTML = `<option value="">Todas</option>` + valores.map((v) => `<option value="${esc(v)}">${esc(etiquetas ? etiquetas[v] || v : v)}</option>`).join("");
    sel.value = actual;
  }

  function montarControles() {
    const eq = estado.datos.equipos;
    const cuenta = (k) => eq.reduce((m, e) => (m[e[k]] = (m[e[k]] || 0) + 1, m), {});
    const ord = (o) => Object.keys(o).filter((k) => k && k !== "null" && k !== "undefined").sort((a, b) => o[b] - o[a]);
    opcionesSelect($("#f-mcu"), ord(cuenta("mcu_familia")));
    opcionesSelect($("#f-radio"), ord(cuenta("radio_familia")));
    opcionesSelect($("#f-meshtastic"), ["preflasheado", "oficial", "comunidad", "no_corre", "sin_dato"], { ...MESHTASTIC, sin_dato: "✕ sin dato" });
    opcionesSelect($("#f-colombia"), ["si", "no", "sin_dato"], COLOMBIA);
    opcionesSelect($("#f-familia"), ["a_etiqueta", "b_pantalla"], { a_etiqueta: "(a) etiqueta sin pantalla", b_pantalla: "(b) con pantalla propia" });

    const chips = $("#f-capas");
    chips.innerHTML = `<button class="capa-btn" type="button" data-capa="__todas" aria-pressed="false">Todas</button>` +
      Object.entries(CAPAS).map(([k, c]) => `<button class="capa-btn" type="button" data-capa="${k}" aria-pressed="true"><span class="franja" style="background:${c.color}"></span>${c.nombre} <span class="n">${eq.filter((e) => e.capa === k).length}</span></button>`).join("");
    chips.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-capa]");
      if (!b) return;
      const k = b.dataset.capa;
      if (k === "__todas") Object.keys(CAPAS).forEach((c) => estado.capas.add(c));
      else if (ev.altKey || ev.metaKey) { estado.capas = new Set([k]); }
      else if (estado.capas.has(k)) { estado.capas.delete(k); if (!estado.capas.size) estado.capas.add(k); }
      else estado.capas.add(k);
      chips.querySelectorAll("[data-capa]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.capa === "__todas" ? String(estado.capas.size === Object.keys(CAPAS).length) : String(estado.capas.has(x.dataset.capa))));
      actualizar();
    });
    document.querySelectorAll("[data-solo]").forEach((b) => b.addEventListener("click", () => {
      estado.capas = new Set(b.dataset.solo.split(","));
      chips.querySelectorAll("[data-capa]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.capa === "__todas" ? "false" : String(estado.capas.has(x.dataset.capa))));
      actualizar();
    }));
    chips.querySelector('[data-capa="__todas"]').setAttribute("aria-pressed", "true");

    const num = (v) => (v === "" ? null : Number(v));
    $("#f-texto").addEventListener("input", (e) => { estado.texto = e.target.value; actualizar(); });
    $("#f-mcu").addEventListener("change", (e) => { estado.mcu = e.target.value; actualizar(); });
    $("#f-radio").addEventListener("change", (e) => { estado.radio = e.target.value; actualizar(); });
    $("#f-meshtastic").addEventListener("change", (e) => { estado.meshtastic = e.target.value; actualizar(); });
    $("#f-colombia").addEventListener("change", (e) => { estado.colombia = e.target.value; actualizar(); });
    $("#f-familia").addEventListener("change", (e) => { estado.familia = e.target.value; actualizar(); });
    $("#f-pmin").addEventListener("input", (e) => { estado.precioMin = num(e.target.value); actualizar(); });
    $("#f-pmax").addEventListener("input", (e) => { estado.precioMax = num(e.target.value); actualizar(); });
    $("#f-bat").addEventListener("input", (e) => { estado.bateriaMin = num(e.target.value); actualizar(); });
    $("#f-conprecio").addEventListener("change", (e) => { estado.soloConPrecio = e.target.checked; actualizar(); });
    $("#f-limpiar").addEventListener("click", () => {
      Object.assign(estado, { texto: "", mcu: "", radio: "", meshtastic: "", colombia: "", familia: "", precioMin: null, precioMax: null, bateriaMin: null, soloConPrecio: false });
      estado.capas = new Set(Object.keys(CAPAS));
      document.querySelectorAll(".controles input, .controles select").forEach((i) => (i.type === "checkbox" ? (i.checked = false) : (i.value = "")));
      chips.querySelectorAll("[data-capa]").forEach((x) => x.setAttribute("aria-pressed", "true"));
      actualizar();
    });

    $("#tabla thead").addEventListener("click", (ev) => {
      const th = ev.target.closest("th.ordenable");
      if (!th) return;
      const k = th.dataset.clave;
      estado.orden = estado.orden.clave === k ? { clave: k, dir: -estado.orden.dir } : { clave: k, dir: 1 };
      actualizar();
    });
    $("#tabla thead").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.matches("th.ordenable")) ev.target.click(); });

    const metSel = $("#b-metrica");
    metSel.innerHTML = Object.entries(METRICAS).map(([k, d]) => `<option value="${k}">${d.nombre} (${d.unidad})</option>`).join("");
    metSel.addEventListener("change", (e) => { estado.metrica = e.target.value; actualizar(); });
    document.querySelectorAll("[data-escala]").forEach((b) => b.addEventListener("click", () => {
      estado.escala = b.dataset.escala;
      document.querySelectorAll("[data-escala]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      actualizar();
    }));

    // Tooltip de las barras
    const tip = $("#tooltip");
    $("#barras").addEventListener("mousemove", (ev) => {
      const p = ev.target.closest(".pista");
      if (!p) { tip.style.display = "none"; return; }
      tip.textContent = p.dataset.info;
      tip.style.display = "block";
      const x = Math.min(ev.clientX + 12, window.innerWidth - tip.offsetWidth - 8);
      tip.style.left = x + "px";
      tip.style.top = ev.clientY + 14 + "px";
    });
    $("#barras").addEventListener("mouseleave", () => (tip.style.display = "none"));

    // Tema
    const btn = $("#tema");
    btn.addEventListener("click", () => {
      const oscuro = document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = oscuro ? "light" : "dark";
      try { localStorage.setItem("tema", document.documentElement.dataset.theme); } catch (_) { /* sin almacenamiento */ }
    });

    // Sección activa en la navegación
    const enlaces = [...document.querySelectorAll("nav.secciones a[href^='#']")];
    const obs = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) enlaces.forEach((a) => a.classList.toggle("activa", a.getAttribute("href") === "#" + en.target.id)); });
    }, { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll("section.bloque[id]").forEach((s) => obs.observe(s));
  }

  function actualizar() {
    const lista = ordenar(filtrar());
    pintarTabla(lista);
    pintarBarras(lista);
  }

  function arrancar(d) {
    estado.datos = d;
    d.referencias.forEach((r, i) => estado.refIndice.set(r.clave, i + 1));
    const m = d.meta;
    $("#meta-fecha").textContent = m.fecha_datos;
    $("#meta-base").textContent = m.fecha_levantamiento_base;
    $("#meta-trm").textContent = m.trm;
    $("#meta-n").textContent = d.equipos.length;
    montarControles();
    pintarReferencias();
    pintarUmbrales();
    pintarCambios();
    pintarMercado();
    actualizar();
    // La tabla se pinta después de cargar el JSON y desplaza las secciones: rehacer el salto al ancla.
    if (location.hash) { const d = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (d) d.scrollIntoView(); }
  }

  try { const t = localStorage.getItem("tema"); if (t) document.documentElement.dataset.theme = t; } catch (_) { /* sin almacenamiento */ }

  fetch("datos/equipos.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(arrancar)
    .catch((err) => {
      $("#carga-error").style.display = "block";
      $("#carga-error").innerHTML = `<b>No se pudieron cargar los datos</b> (${esc(err.message)}). Si abrió el archivo con doble clic, el navegador bloquea la lectura de <code>datos/equipos.json</code> desde <code>file://</code>. Sírvalo con <code>python3 -m http.server</code> en la carpeta del repositorio y abra <code>http://localhost:8000</code>, o use la versión publicada en GitHub Pages.`;
    });
})();
