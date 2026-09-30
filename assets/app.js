/* Comparador de hardware — Red Vecinal LoRa.
   Sin dependencias ni construcción: lee datos/equipos.json y pinta.
   Convención de celdas (la misma del informe al IDEA del 4-sep-2026):
     null            -> ✕  dato no publicado por la fuente
     columna ajena   -> —  el dato no aplica a la capa de esa fila
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
    consumo_ma: { nombre: "Consumo publicado", unidad: "mA", dec: 1, desc: "Corriente tal como la publica el fabricante. Cada fabricante mide una cosa distinta (recepción, reposo activo, máximo con CPU y radio): la definición de cada cifra está en el detalle de la fila, en la tabla. Compare solo cifras con la misma definición." },
    autonomia_uso_h: { nombre: "Autonomía en uso", unidad: "h", dec: 0, desc: "Horas en uso declaradas por el fabricante. Casi nadie la publica, y quien lo hace no da las mismas condiciones (intervalo de posición, GPS, pantalla): son cifras de catálogo, no comparables entre sí sin leer sus condiciones en el detalle de la fila." },
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
    abiertos: new Set(),
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
  // Cada columna declara a qué capas aplica. Se muestran las columnas que aplican a alguna capa
  // visible; en una fila de otra capa la celda dice «—» (no aplica), que no es lo mismo que ✕
  // (la fuente no lo publica).
  const TODAS = Object.keys(CAPAS);
  const RADIO = ["fija", "portatil", "modulo"];
  const NA = `<span class="na" title="No aplica a esta capa">—</span>`;
  const corto = (fam, crudo) => (fam && !fam.startsWith("otro") ? fam : crudo);

  const COLUMNAS = [
    { clave: "modelo", titulo: "Equipo", orden: true, capas: TODAS, td: equipoTD },
    { clave: "precio_usd", titulo: "Precio USD", orden: true, num: true, capas: TODAS, td: precioTD },
    { clave: "disponibilidad", titulo: "Disponib.", capas: TODAS, td: (e) => celda(e.disponibilidad) },
    { clave: "cambio_pct", titulo: "Δ vs 4-sep", orden: true, num: true, capas: TODAS, td: cambioTD },
    { clave: "chip", titulo: "MCU + radio", capas: RADIO, td: (e) => {
        const m = corto(e.mcu_familia, e.mcu), r = corto(e.radio_familia, e.radio);
        return m || r ? `${m ? esc(m) : celda(null)} + ${r ? esc(r) : celda(null)}` : celda(null);
      } },
    { clave: "tx_dbm", titulo: "TX dBm", orden: true, num: true, capas: RADIO, td: (e) => celda(e.tx_dbm) },
    { clave: "meshtastic", titulo: "Meshtastic", capas: RADIO, td: (e) => {
        const mt = e.meshtastic;
        return mt && MESHTASTIC[mt] ? `<span class="mt mt-${mt}">${MESHTASTIC[mt]}</span>` : celda(mt);
      } },
    { clave: "colombia", titulo: "Colombia", capas: TODAS, td: (e) => {
        const co = e.colombia || { estado: "sin_dato" };
        if (co.estado === "si") return co.url ? `<a href="${esc(co.url)}" target="_blank" rel="noopener">sí</a>` : "sí";
        return co.estado === "no" ? "no" : `<span class="ausente">sin dato</span>`;
      } },
    { clave: "peso_g", titulo: "Peso g", orden: true, num: true, capas: TODAS, td: (e) => celda(e.peso_g) },
    { clave: "bateria_mah", titulo: "Batería mAh", orden: true, num: true, capas: ["fija", "portatil"], td: (e) => celda(e.bateria_mah) },
    { clave: "bateria_reemplazable", titulo: "Batería reempl.", capas: ["fija", "portatil"], td: (e) => celda(e.bateria_reemplazable, { max: 24 }) },
    { clave: "autonomia_uso_h", titulo: "Autonomía en uso h", orden: true, num: true, capas: ["portatil"], td: (e) => celda(e.autonomia_uso_h) },
    { clave: "panel_w", titulo: "Panel W", orden: true, num: true, capas: ["fija"], td: (e) => celda(e.panel_w) },
    { clave: "consumo_ma", titulo: "Consumo mA", orden: true, num: true, capas: ["fija", "modulo"], td: (e) => celda(e.consumo_ma, { dec: 1 }) },
    { clave: "recarga", titulo: "Recarga", capas: ["portatil"], td: (e) => celda(e.recarga, { max: 24 }) },
    { clave: "depende_celular", titulo: "Depende del celular", capas: ["portatil"], td: (e) => celda(e.depende_celular) },
    { clave: "grado_ip", titulo: "IP", capas: ["fija", "portatil", "antena", "accesorio"], td: (e) => celda(e.grado_ip, { max: 18 }) },
    { clave: "ganancia_dbi", titulo: "Ganancia dBi", orden: true, num: true, capas: ["fija", "antena"], td: (e) => celda(e.ganancia_dbi, { dec: 1 }) },
    { clave: "vswr", titulo: "ROE", capas: ["antena"], td: (e) => celda(e.vswr, { max: 18 }) },
  ];

  // Lo que va en el detalle desplegable de cada fila. `siempre` muestra ✕ si falta,
  // porque para esa capa el dato es un criterio de compra y su ausencia es información.
  const DETALLE = [
    { t: "Variante del precio", k: "variante_precio", capas: TODAS },
    { t: "Qué cambió", k: "cambio", capas: TODAS },
    { t: "Colombia", k: "colombia", capas: TODAS, f: (e) => {
        const co = e.colombia || {};
        const base = co.estado === "si" ? "Se vende" : co.estado === "no" ? "No se encontró" : "Sin dato";
        return `${base}${co.detalle ? `: ${esc(co.detalle)}` : ""}${co.url ? `. <a href="${esc(co.url)}" target="_blank" rel="noopener">Ficha colombiana</a>` : ""}`;
      } },
    { t: "Banda", k: "banda_mhz", capas: RADIO },
    { t: "MCU", k: "mcu", capas: RADIO },
    { t: "Radio", k: "radio", capas: RADIO },
    { t: "Dimensiones mm", k: "dimensiones_mm", capas: ["portatil", "accesorio"], siempre: ["portatil"] },
    { t: "Batería", k: "bateria_formato", capas: ["fija", "portatil"] },
    { t: "Autonomía según el fabricante", k: "autonomia_texto", capas: ["fija", "portatil"], siempre: ["portatil", "fija"] },
    { t: "Autonomía según la comunidad", k: "autonomia_comunidad", capas: ["portatil"] },
    { t: "Consumo, definición de la cifra", k: "consumo_texto", capas: RADIO },
    { t: "Sin celular queda", k: "sin_celular", capas: ["portatil"], siempre: ["portatil"] },
    { t: "Pantalla", k: "pantalla", capas: ["portatil"] },
    { t: "Entrada", k: "entrada", capas: ["portatil"] },
    { t: "GPS", k: "gps", capas: ["portatil"] },
    { t: "Resistencia a caídas", k: "resistencia_caida", capas: ["portatil"], siempre: ["portatil"] },
    { t: "ROE de la antena", k: "vswr", capas: ["fija"] },
    { t: "Complejidad de montaje", k: "complejidad", capas: TODAS },
    { t: "Equivalentes intercambiables", k: "equivalentes", capas: TODAS },
    { t: "Notas", k: "notas", capas: TODAS },
    { t: "Contradicción", k: "contradiccion", capas: TODAS, clase: "contra-bloque" },
    { t: "Procedencia", k: "procedencia", capas: TODAS },
  ];

  function columnasVisibles() {
    return COLUMNAS.filter((c) => c.capas.some((k) => estado.capas.has(k)));
  }

  function equipoTD(e) {
    const capa = CAPAS[e.capa];
    const abierto = estado.abiertos.has(e.id);
    const etiquetas = [
      capa.nombre + (e.subcapa_nombre ? `, ${e.subcapa_nombre}` : ""),
      e.familia === "a_etiqueta" ? "familia (a) etiqueta" : e.familia === "b_pantalla" ? "familia (b) pantalla" : "",
      e.linea_base ? "línea base" : "",
      e.nuevo ? "nuevo" : "",
    ].filter(Boolean).join(", ");
    return `<button class="abrir" type="button" aria-expanded="${abierto}" aria-controls="det-${esc(e.id)}"><span class="giro" aria-hidden="true">${abierto ? "−" : "+"}</span><span><b>${esc(e.fabricante)}</b> ${esc(e.modelo)}</span></button>${llamadas(e.refs)}` +
      `<span class="sub">${esc(etiquetas)}${e.contradiccion ? `, <span class="contra">contradicción</span>` : ""}</span>`;
  }

  function precioTD(e) {
    if (precioValido(e)) {
      const max = esNum(e.precio_max_usd) && e.precio_max_usd > e.precio_usd ? `–${fmt(e.precio_max_usd)}` : "";
      return `<a href="${esc(e.url)}" target="_blank" rel="noopener">${fmt(e.precio_usd)}${max}</a><span class="precio-fecha">${esc(e.fecha_consulta)}</span>`;
    }
    if (e.precio_espera) return `<span class="espera">aún en espera</span>`;
    if (e.url) return `${celda(null)} <a href="${esc(e.url)}" target="_blank" rel="noopener">ficha</a>`;
    return celda(null);
  }

  function cambioTD(e) {
    if (esNum(e.cambio_pct)) {
      const cl = e.cambio_pct > 0.5 ? "cambio-sube" : e.cambio_pct < -0.5 ? "cambio-baja" : "sin-cambio";
      return `<span class="${cl}">${e.cambio_pct > 0 ? "+" : ""}${fmt(e.cambio_pct, 1)} %</span>`;
    }
    if (e.correccion) return `<span class="correccion">corrección</span>`;
    return e.nuevo ? `<span class="ausente">nuevo</span>` : `<span class="ausente">—</span>`;
  }

  function detalleHTML(e, ncol) {
    const items = DETALLE.filter((d) => d.capas.includes(e.capa)).map((d) => {
      const v = d.f ? d.f(e) : e[d.k];
      const vacio = v === null || v === undefined || v === "";
      if (vacio && !(d.siempre || []).includes(e.capa)) return "";
      const val = d.f ? v : vacio ? celda(null) : v === ESPERA ? celda(v) : esc(v);
      return `<div class="${d.clase || ""}"><dt>${d.t}</dt><dd>${val}</dd></div>`;
    }).join("");
    const vend = e.url ? `<div><dt>Ficha del vendedor</dt><dd><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.vendedor || e.fabricante)}</a>${e.fecha_consulta ? `, consultada el ${esc(e.fecha_consulta)}` : ""}${e.precio_nota ? `. ${esc(e.precio_nota)}` : ""}</dd></div>` : "";
    const refs = e.refs && e.refs.length ? `<div><dt>Referencias</dt><dd>${llamadas(e.refs)}</dd></div>` : "";
    return `<tr class="detalle" id="det-${esc(e.id)}"><td colspan="${ncol}"><dl class="detalle-cuerpo" style="--franja-det:${CAPAS[e.capa].color}">${vend}${items}${refs}</dl></td></tr>`;
  }

  function pintarCabecera(cols) {
    $("#tabla thead tr").innerHTML = cols.map((c) => {
      const act = estado.orden.clave === c.clave;
      const fl = c.orden ? `<span class="flecha" aria-hidden="true">${act ? (estado.orden.dir > 0 ? "▲" : "▼") : "↕"}</span>` : "";
      return `<th class="${c.orden ? "ordenable" : ""}${c.num ? " n" : ""}" data-clave="${c.clave}" ${c.orden ? `aria-sort="${act ? (estado.orden.dir > 0 ? "ascending" : "descending") : "none"}" tabindex="0"` : ""}>${c.titulo}${fl}</th>`;
    }).join("");
  }

  function filaHTML(e, cols) {
    const tds = cols.map((c, i) => {
      const aplica = c.capas.includes(e.capa);
      const cls = [i === 0 ? "equipo" : "", c.num ? "num" : "", "c-" + c.clave].filter(Boolean).join(" ");
      const estilo = i === 0 ? ` style="--franja:${CAPAS[e.capa].color}"` : "";
      return `<td class="${cls}"${estilo}>${aplica ? c.td(e) : NA}</td>`;
    }).join("");
    return `<tr data-id="${esc(e.id)}">${tds}</tr>` + (estado.abiertos.has(e.id) ? detalleHTML(e, cols.length) : "");
  }

  function pintarTabla(lista) {
    const cols = columnasVisibles();
    pintarCabecera(cols);
    $("#tabla tbody").innerHTML = lista.map((e) => filaHTML(e, cols)).join("") ||
      `<tr><td colspan="${cols.length}" style="padding:12px">Ningún equipo cumple los filtros. <button class="atajo" type="button" data-limpiar>Limpiar filtros</button></td></tr>`;
    const env = $(".tabla-envoltura");
    env.style.setProperty("--ancho-visible", env.clientWidth + "px");
    const conPrecio = lista.filter(precioValido).length;
    const col = COLUMNAS.find((c) => c.clave === estado.orden.clave)?.titulo || "";
    $("#resumen-filtro").textContent =
      `${lista.length} de ${estado.datos.equipos.length} equipos, ${conPrecio} con precio verificable. Ordenado por ${col}, ${estado.orden.dir > 0 ? "de menor a mayor" : "de mayor a menor"}. ${cols.length} columnas para las capas elegidas.`;
    const n = filtrosActivos();
    $("#n-filtros").textContent = n ? `(${n} activo${n > 1 ? "s" : ""})` : "";
  }

  function filtrosActivos() {
    return ["mcu", "radio", "meshtastic", "colombia", "familia"].filter((k) => estado[k]).length +
      ["precioMin", "precioMax", "bateriaMin"].filter((k) => estado[k] !== null).length + (estado.soloConPrecio ? 1 : 0);
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
    const limpiar = () => {
      Object.assign(estado, { texto: "", mcu: "", radio: "", meshtastic: "", colombia: "", familia: "", precioMin: null, precioMax: null, bateriaMin: null, soloConPrecio: false });
      estado.capas = new Set(Object.keys(CAPAS));
      document.querySelectorAll(".controles input, .controles select").forEach((i) => (i.type === "checkbox" ? (i.checked = false) : (i.value = "")));
      chips.querySelectorAll("[data-capa]").forEach((x) => x.setAttribute("aria-pressed", "true"));
      actualizar();
    };
    $("#f-limpiar").addEventListener("click", limpiar);

    // Detalle desplegable de cada fila: botón nativo, así que funciona con clic, toque y Enter.
    $("#tabla tbody").addEventListener("click", (ev) => {
      if (ev.target.closest("[data-limpiar]")) { limpiar(); return; }
      const b = ev.target.closest("button.abrir");
      if (!b) return;
      const id = b.closest("tr").dataset.id;
      estado.abiertos.has(id) ? estado.abiertos.delete(id) : estado.abiertos.add(id);
      actualizar();
      const nb = document.querySelector(`#tabla tr[data-id="${CSS.escape(id)}"] button.abrir`);
      if (nb) nb.focus({ preventScroll: true });
    });
    window.addEventListener("resize", () => {
      const env = $(".tabla-envoltura");
      env.style.setProperty("--ancho-visible", env.clientWidth + "px");
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
