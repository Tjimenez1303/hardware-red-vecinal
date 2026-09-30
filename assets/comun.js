/* Base común de los prototipos: datos, rasgos normalizados, siluetas, íconos y tema.
   Todo se expone en window.RV. Sin dependencias. */
(function () {
  "use strict";

  const CAPAS = {
    portatil: { nombre: "Portátil", plural: "Portátiles", color: "var(--portatil)" },
    fija: { nombre: "Nodo fijo", plural: "Nodos fijos", color: "var(--fija)" },
    modulo: { nombre: "Placa", plural: "Placas", color: "var(--modulo)" },
    antena: { nombre: "Antena", plural: "Antenas", color: "var(--antena)" },
    accesorio: { nombre: "Accesorio", plural: "Accesorios", color: "var(--accesorio)" },
  };

  // ---------- utilidades ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const esNum = (v) => typeof v === "number" && isFinite(v);
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const fecha = (iso) => { if (!iso) return ""; const [a, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m - 1]} ${a}`; };
  const usd = (v, dec = 2) => esNum(v) ? "USD " + v.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "";
  const n = (v, dec = 0) => esNum(v) ? v.toLocaleString("es-CO", { maximumFractionDigits: dec }) : "";
  // Limpia texto de datos para pantalla: rangos con «a», sin guiones largos ni punto y coma.
  const limpiar = (t) => String(t ?? "")
    .replace(/(\d)\s*[–—~]\s*(\d)/g, "$1 a $2")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/;\s*/g, ". ")
    .replace(/\s+/g, " ").trim();
  const primeraFrase = (t, max = 60) => {
    const s = limpiar(t).split(/[.(]/)[0].trim();
    return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, "") + "…" : s;
  };

  // ---------- rasgos normalizados ----------
  function precioValido(e) { return esNum(e.precio_usd) && !!e.url && !!e.fecha_consulta; }

  // ¿Cubre la banda libre colombiana, 915 a 928 MHz? Revisa todos los rangos del texto.
  // «No» solo si hay un rango continuo ancho que se corta antes de 928 (p. ej. 868 a 923);
  // un texto como «868-915» suele nombrar dos bandas sueltas y queda como sin dato.
  function banda915(e) {
    const t = `${e.banda_mhz || ""} ${e.radio || ""}`;
    const rangos = [...t.matchAll(/(\d{3})\s*[-–~]\s*(\d{3})/g)].map((m) => [+m[1], +m[2]]);
    if (rangos.some(([lo, hi]) => lo <= 915 && hi >= 928)) return true;
    if (rangos.some(([lo, hi]) => hi - lo >= 50 && lo < 915 && hi > 900 && hi < 928)) return false;
    return null;
  }

  function rasgos(e) {
    const r = {};
    r.precio = precioValido(e) ? e.precio_usd : null;
    r.precioMax = esNum(e.precio_max_usd) && e.precio_max_usd > (e.precio_usd || 0) ? e.precio_max_usd : null;
    r.disponible = e.disponibilidad === "en stock" ? true : e.disponibilidad ? false : null;
    r.disponibleTexto = { "en stock": "En stock", agotado: "Agotado", backorder: "Por reponer", preventa: "Preventa", descontinuado: "Descontinuado" }[e.disponibilidad] || null;
    r.colombia = e.colombia?.estado === "si" ? true : e.colombia?.estado === "no" ? false : null;
    r.listo = e.meshtastic === "preflasheado" ? true : ["oficial", "comunidad"].includes(e.meshtastic) ? false : null;
    r.listoTexto = { preflasheado: "Llega con Meshtastic", oficial: "Se instala, soporte oficial", comunidad: "Se instala, soporte de la comunidad", no_corre: "No corre Meshtastic" }[e.meshtastic] || null;
    const pant = (e.pantalla || "").toLowerCase();
    r.pantalla = !pant ? null : /^ninguna/.test(pant) ? false : true;
    r.pantallaTexto = r.pantalla ? primeraFrase(e.pantalla, 34) : null;
    const ent = (e.entrada || "").toLowerCase();
    r.teclado = /teclado|minitecado/.test(ent) ? true : ent ? false : (r.pantalla === false ? false : null);
    const gps = (e.gps || "").toLowerCase();
    r.gps = /^s[ií]/.test(gps) ? true : /^(no|opcional)/.test(gps) ? false : null;
    r.sinCelular = { no: "total", parcial: "lee", "sí": "nada" }[e.depende_celular] || null;
    const ip = String(e.grado_ip || "").match(/IP\s?([0-9X])([0-9])/i);
    r.ip = ip ? ("IP" + ip[1] + ip[2]).toUpperCase() : null;
    r.agua = ip ? +ip[2] >= 5 : null;
    r.ipTexto = null;
    if (!ip && e.grado_ip) {
      const g = String(e.grado_ip).toLowerCase();
      if (/sin resistencia|no resistente|none|without waterproof|no es resistente|sin grado ip; no/.test(g)) { r.agua = false; r.ipTexto = "No resiste agua"; }
      else if (/exterior|outdoor|weatherproof|water resistant/.test(g)) { r.agua = true; r.ipTexto = "Para exterior, sin grado IP"; }
    }
    r.peso = esNum(e.peso_g) ? e.peso_g : null;
    r.bateria = esNum(e.bateria_mah) ? e.bateria_mah : null;
    r.autonomia = esNum(e.autonomia_uso_h) ? e.autonomia_uso_h : null;
    r.autonomiaFuente = e.autonomia_fuente === "comunidad" ? "medida por la comunidad" : "según el fabricante";
    r.panel = esNum(e.panel_w) ? e.panel_w : null;
    r.consumo = esNum(e.consumo_ma) ? e.consumo_ma : null;
    r.tx = esNum(e.tx_dbm) ? e.tx_dbm : null;
    r.txFcc = esNum(e.tx_fcc_dbm) ? e.tx_fcc_dbm : null;
    r.ganancia = esNum(e.ganancia_dbi) ? e.ganancia_dbi : null;
    r.roe = e.vswr ? primeraFrase(e.vswr, 28) : null;
    const rec = String(e.recarga || "");
    const formas = [];
    if (/USB-C/i.test(rec)) formas.push("USB-C");
    else if (/USB/i.test(rec) && !/magn/i.test(rec)) formas.push("USB");
    if (/magn/i.test(rec)) formas.push("cable magnético");
    if (/\bQi/i.test(rec)) formas.push("inalámbrica Qi2");
    if (/solar/i.test(rec) || (e.capa === "fija" && r.panel)) formas.push("solar");
    r.recarga = formas.length ? formas.join(", ").replace(/^./, (c) => c.toUpperCase()) : null;
    const br = String(e.bateria_reemplazable || "").toLowerCase();
    r.reemplazable = /^s[ií]/.test(br) ? true : /^(no|parcial|con herramientas)/.test(br) ? false : null;
    r.reemplazableTexto = /^s[ií]/.test(br) ? "Sí, celda estándar" : /^(con herramientas|parcial)/.test(br) ? "Con herramientas" : /^no/.test(br) ? "No" : null;
    r.banda = banda915(e);
    r.chip = [e.mcu_familia && !e.mcu_familia.startsWith("otro") ? e.mcu_familia : null, e.radio_familia && !e.radio_familia.startsWith("otro") ? e.radio_familia : null].filter(Boolean).join(" y ") || null;
    r.dimensiones = e.dimensiones_mm ? primeraFrase(e.dimensiones_mm, 30).replace(/\s*x\s*/gi, " × ") : null;
    return r;
  }

  // ---------- forma del aparato, para la silueta ----------
  function forma(e) {
    const m = `${e.fabricante} ${e.modelo}`;
    if (e.capa === "antena") return /yagi/i.test(m) ? "yagi" : /sector/i.test(m) ? "sectorial" : "omni";
    if (e.capa === "accesorio") return /arrest|descarg/i.test(m) ? "descargador" : "caja";
    if (e.capa === "modulo") return "placa";
    if (e.capa === "fija") return "nodo";
    if (/watch/i.test(m)) return "reloj";
    if (/TAP/.test(m)) return "tactil";
    if (/MeshPocket|ThinkNode M4/i.test(m)) return "bateria";
    if (/Deck|Pager|Cardputer|ThinkNode M9/i.test(m)) return "teclado";
    if (e.familia === "a_etiqueta") return /R1 Neo|MiniTrekker|Pocket Mini/i.test(m) ? "llavero" : "tarjeta";
    return "pantalla";
  }

  const SIL = {
    tarjeta: `<rect class="cuerpo" x="36" y="30" width="88" height="58" rx="9"/><circle class="acento" cx="52" cy="45" r="3.2"/><circle class="trazo" cx="104" cy="70" r="7"/><path class="trazo" d="M46 76h26"/>`,
    llavero: `<circle class="trazo" cx="70" cy="22" r="8"/><rect class="cuerpo" x="46" y="30" width="62" height="64" rx="16"/><path class="trazo" d="M100 34l14-24" stroke-width="5"/><circle class="acento" cx="62" cy="48" r="3.2"/><circle class="trazo" cx="77" cy="70" r="8"/>`,
    pantalla: `<rect class="cuerpo" x="54" y="16" width="52" height="92" rx="9"/><rect class="cuerpo" x="92" y="4" width="7" height="16" rx="3.5"/><rect class="pantalla" x="61" y="27" width="38" height="38" rx="2"/><path class="trazo" d="M66 38h22M66 46h16M66 54h19"/><circle class="trazo" cx="70" cy="85" r="5"/><circle class="trazo" cx="90" cy="85" r="5"/>`,
    teclado: `<rect class="cuerpo" x="22" y="22" width="116" height="80" rx="9"/><rect class="cuerpo" x="118" y="6" width="7" height="20" rx="3.5"/><rect class="brillo" x="32" y="31" width="64" height="30" rx="2"/>` +
      Array.from({ length: 27 }, (_, i) => `<rect class="tecla" x="${32 + (i % 9) * 11}" y="${68 + Math.floor(i / 9) * 10}" width="8.5" height="7" rx="1.5"/>`).join("") + `<circle class="trazo" cx="118" cy="46" r="8"/>`,
    tactil: `<rect class="cuerpo" x="38" y="14" width="84" height="96" rx="10"/><rect class="cuerpo" x="108" y="2" width="7" height="16" rx="3.5"/><rect class="brillo" x="46" y="23" width="68" height="68" rx="3"/><path class="trazo" d="M54 36h34M54 46h44M54 56h28"/><circle class="trazo" cx="80" cy="100" r="4"/>`,
    reloj: `<rect class="cuerpo" x="66" y="4" width="28" height="112" rx="7"/><rect class="cuerpo" x="50" y="28" width="60" height="64" rx="16"/><rect class="brillo" x="58" y="36" width="44" height="48" rx="10"/><path class="trazo" d="M110 52v14" stroke-width="3"/>`,
    bateria: `<rect class="cuerpo" x="30" y="26" width="100" height="66" rx="13"/><rect class="pantalla" x="42" y="38" width="46" height="24" rx="2"/><path class="trazo" d="M48 47h20M48 54h30"/><rect class="trazo" x="100" y="74" width="16" height="6" rx="3"/><circle class="acento" cx="108" cy="44" r="3"/><circle class="trazo" cx="108" cy="56" r="3"/>`,
    nodo: `<path class="trazo" d="M118 56V10" stroke-width="3.2"/><circle class="acento" cx="118" cy="9" r="3.4"/><polygon class="brillo" points="34,50 122,50 108,24 48,24"/><path class="trazo" d="M55 24l-7 26M70 24l-3 26M85 24v26M100 24l4 26M41 37h74"/><rect class="cuerpo" x="46" y="54" width="68" height="54" rx="5"/><path class="trazo" d="M58 70h28M58 80h20"/><circle class="acento" cx="100" cy="94" r="3"/>`,
    placa: `<rect class="cuerpo" x="26" y="34" width="108" height="54" rx="4"/><rect class="trazo" x="44" y="46" width="24" height="24" rx="2"/><rect class="trazo" x="78" y="48" width="18" height="18" rx="1.5"/><rect class="pantalla" x="100" y="44" width="26" height="16" rx="1"/>` +
      Array.from({ length: 12 }, (_, i) => `<circle class="trazo" cx="${34 + i * 8.4}" cy="82" r="1.6"/>`).join("") + `<circle class="trazo" cx="128" cy="76" r="3.2"/><path class="trazo" d="M128 73c8-10 14-16 18-30"/>`,
    yagi: `<path class="trazo" d="M16 62h128" stroke-width="3"/>` + [24, 42, 58, 72, 86, 100, 114, 128].map((x, i) => `<path class="trazo" d="M${x} ${62 - (26 - i * 1.8)}V${62 + (26 - i * 1.8)}" stroke-width="2.4"/>`).join("") + `<path class="trazo" d="M70 62v44M58 106h24" stroke-width="2.4"/>`,
    omni: `<rect class="cuerpo" x="74" y="6" width="12" height="96" rx="6"/><path class="trazo" d="M74 34h12M74 58h12M74 80h12"/><rect class="cuerpo" x="66" y="100" width="28" height="12" rx="3"/><circle class="acento" cx="80" cy="12" r="2.8"/>`,
    sectorial: `<rect class="cuerpo" x="60" y="6" width="40" height="104" rx="7"/><path class="trazo" d="M70 22v72M80 22v72M90 22v72"/><path class="trazo" d="M100 58h16M116 46v24" stroke-width="2.4"/>`,
    caja: `<rect class="brillo" x="40" y="26" width="80" height="14" rx="2"/><path class="trazo" d="M52 26v14M66 26v14M80 26v14M94 26v14M108 26v14"/><rect class="cuerpo" x="36" y="44" width="88" height="62" rx="6"/><path class="trazo" d="M36 58h88"/><circle class="trazo" cx="112" cy="92" r="4"/>`,
    descargador: `<rect class="cuerpo" x="44" y="46" width="72" height="30" rx="7"/><rect class="cuerpo" x="22" y="52" width="22" height="18" rx="3"/><rect class="cuerpo" x="116" y="52" width="22" height="18" rx="3"/><path class="trazo" d="M80 76v24M70 100h20M73 106h14" stroke-width="2.2"/><path class="trazo" d="M76 54l6 6-6 4 6 6" stroke-width="2"/>`,
  };
  function silueta(e, etiqueta) {
    const f = typeof e === "string" ? e : forma(e);
    const color = typeof e === "string" ? "var(--accent)" : CAPAS[e.capa].color;
    return `<svg class="silueta" viewBox="0 0 160 120" role="img" aria-label="${esc(etiqueta || "Silueta del aparato")}" style="--acento:${color}">${SIL[f] || SIL.placa}</svg>`;
  }

  // Foto real guardada en assets/img; si no hay, la silueta según la forma del aparato.
  function foto(e, alt) {
    return e.imagen
      ? `<img class="foto-img" src="${esc(e.imagen)}" alt="${esc(alt ?? e.modelo)}" loading="lazy" decoding="async">`
      : silueta(e, alt ?? e.modelo);
  }

  // ---------- íconos (trazo 1,75, estilo Tabler/Heroicons) ----------
  const ICONOS = {
    si: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`,
    no: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>`,
    medio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>`,
    externo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>`,
    cerrar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    mas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    antena: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="11" r="2"/><path d="M12 13v8M8.2 7.2a5.5 5.5 0 0 0 0 7.6M15.8 7.2a5.5 5.5 0 0 1 0 7.6M5.4 4.4a9.5 9.5 0 0 0 0 13.2M18.6 4.4a9.5 9.5 0 0 1 0 13.2"/></svg>`,
  };
  const siNo = (v, textoSi = "Sí", textoNo = "No") =>
    v === true ? `<span class="si">${ICONOS.si}${textoSi}</span>` :
    v === false ? `<span class="no">${ICONOS.no}${textoNo}</span>` :
    `<span class="sin-dato">Sin dato</span>`;
  const sinCel = (v) => ({
    total: `<span class="si">${ICONOS.si}Lee y responde sin celular</span>`,
    lee: `<span class="si" style="--ok:var(--ink-2)">${ICONOS.medio}Lee sin celular, no escribe</span>`,
    nada: `<span class="no">${ICONOS.no}Necesita el celular</span>`,
  }[v] || `<span class="sin-dato">Sin dato</span>`);

  // ---------- tema: sol y luna (web.dev, dos estados) ----------
  const CLAVE_TEMA = "rv-tema";
  function temaActual() {
    return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  const BOTON_TEMA = `<button class="tema" id="tema" type="button" title="Cambiar entre tema claro y oscuro" aria-label="Tema claro">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <mask id="luna-mascara" class="luna"><rect x="0" y="0" width="100%" height="100%" fill="white"/><circle cx="24" cy="10" r="6" fill="black"/></mask>
      <circle class="sol" cx="12" cy="12" r="6" mask="url(#luna-mascara)"/>
      <g class="rayos"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g>
    </svg></button>`;
  function montarTema() {
    const b = document.getElementById("tema");
    const reflejar = () => { const t = temaActual(); b.setAttribute("aria-label", t === "dark" ? "Tema oscuro" : "Tema claro"); };
    reflejar();
    b.addEventListener("click", () => {
      const nuevo = temaActual() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nuevo;
      try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch (_) { /* sin almacenamiento */ }
      reflejar();
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", reflejar);
  }

  // ---------- barra superior ----------
  const PAGINAS = [
    ["index.html", "Catálogo"],
    ["tabla.html", "Tabla"],
    ["comparar.html", "Comparar"],
    ["asistente.html", "Asistente"],
    ["graficas.html", "Gráficas"],
  ];
  function barra(activo, fechaDatos) {
    const el = document.getElementById("barra");
    el.className = "barra";
    el.innerHTML = `<a class="marca" href="index.html">${ICONOS.antena}<span>Red Vecinal</span></a>
      <nav aria-label="Secciones">${PAGINAS.map(([h, t]) => `<a href="${h}"${h === activo ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
      <span class="espacio"></span>
      ${fechaDatos ? `<span class="fecha">Precios del ${fecha(fechaDatos)}</span>` : ""}
      ${BOTON_TEMA}`;
    montarTema();
  }


  // ---------- atributos de comparación, agrupados por categoría (Baymard) ----------
  // Las filas con «det» solo salen en la comparación completa (comparar.html y la ficha de las
  // gráficas). La ventana del catálogo muestra lo esencial.
  const TODAS = Object.keys(CAPAS);
  const SD = `<span class="sin-dato">Sin dato</span>`;
  const precioHTML = (e) => e.r.precio === null ? SD :
    `<a class="precio" href="${esc(e.url)}" target="_blank" rel="noopener">${usd(e.r.precio)}</a>${e.r.precioMax ? `<span class="sub">hasta ${usd(e.r.precioMax)}</span>` : ""}`;
  const dato = (v, sufijo = "", dec = 0) => esNum(v) ? `<span class="num">${n(v, dec)}${sufijo}</span>` : SD;
  // Texto de datos listo para pantalla: sin comillas de cita, sin URLs, con mayúscula tras punto.
  function texto(t, max = 120) {
    if (!t) return SD;
    let s = limpiar(t).replace(/https?:\/\/\S+/g, "").replace(/['"«»]/g, "").replace(/\(\s*\)/g, "").replace(/\s+([.,])/g, "$1").trim();
    s = s.replace(/(^|\.\s+)([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase());
    if (!s) return SD;
    const corto = s.length > max ? s.slice(0, max).replace(/\s+\S*$/, "") + "…" : s;
    return `<span class="texto-dato"${corto !== s ? ` title="${esc(s)}"` : ""}>${esc(corto)}</span>`;
  }
  const puesto = (e, k, frase) => {
    const p = e.r.puesto?.[k];
    return p ? `<span class="num">${p.pos}.º ${frase}</span><span class="sub">de ${p.de} que publican el dato</span>` : SD;
  };
  const indice = (v, sufijo, dec = 1) => esNum(v) ? `<span class="num">${n(v, dec)}</span><span class="sub">${sufijo}</span>` : SD;
  const IDX = {
    mahUsd: (e) => (e.r.bateria && e.r.precio ? e.r.bateria / e.r.precio : null),
    hUsd: (e) => (e.r.autonomia && e.r.precio ? (e.r.autonomia / e.r.precio) * 10 : null),
    gMah: (e) => (e.r.peso && e.r.bateria ? (e.r.peso / e.r.bateria) * 1000 : null),
    wUsd: (e) => (e.r.panel && e.r.precio ? (e.r.panel / e.r.precio) * 100 : null),
    dbiUsd: (e) => (e.r.ganancia && e.r.precio ? (e.r.ganancia / e.r.precio) * 100 : null),
  };
  const GRUPOS = [
    { titulo: "Compra", capas: TODAS, filas: [
      { t: "Precio", v: precioHTML, mejor: (e) => (e.r.precio === null ? null : -e.r.precio) },
      { t: "Disponibilidad", mejor: (e) => (e.r.disponible === null ? null : +e.r.disponible), v: (e) => e.r.disponibleTexto ? siNo(e.r.disponible, e.r.disponibleTexto, e.r.disponibleTexto) : SD },
      { t: "Se vende en Colombia", mejor: (e) => (e.r.colombia === null ? null : +e.r.colombia), v: (e) => siNo(e.r.colombia) },
      { t: "Dónde se buscó en Colombia", det: true, v: (e) => texto(e.colombia?.detalle, 140) },
      { t: "Precio el 4 de septiembre", det: true, mejor: (e) => (esNum(e.cambio_pct) ? -e.cambio_pct : null), v: (e) => !esNum(e.precio_anterior_usd) ? SD :
        `<span class="num">${usd(e.precio_anterior_usd)}</span><span class="sub">${!esNum(e.cambio_pct) ? "no comparable" : e.cambio_pct === 0 ? "sin cambio" : e.cambio_pct < 0 ? `bajó ${n(-e.cambio_pct, 1)} %` : `subió ${n(e.cambio_pct, 1)} %`}</span>` },
      { t: "Vendedor", det: true, v: (e) => texto(e.vendedor, 60) },
    ] },
    { titulo: "Frente a su capa", capas: TODAS, filas: [
      { t: "Puesto por precio", det: true, mejor: (e) => (e.r.puesto?.precio ? -e.r.puesto.precio.pos / e.r.puesto.precio.de : null), v: (e) => puesto(e, "precio", "más barato") },
      { t: "Puesto por batería", det: true, capas: ["portatil", "fija"], mejor: (e) => (e.r.puesto?.bateria ? -e.r.puesto.bateria.pos / e.r.puesto.bateria.de : null), v: (e) => puesto(e, "bateria", "con más batería") },
      { t: "Puesto por peso", det: true, capas: ["portatil"], mejor: (e) => (e.r.puesto?.peso ? -e.r.puesto.peso.pos / e.r.puesto.peso.de : null), v: (e) => puesto(e, "peso", "más liviano") },
      { t: "Puesto por autonomía", det: true, capas: ["portatil"], mejor: (e) => (e.r.puesto?.autonomia ? -e.r.puesto.autonomia.pos / e.r.puesto.autonomia.de : null), v: (e) => puesto(e, "autonomia", "que más dura") },
      { t: "Puesto por ganancia", det: true, capas: ["antena"], mejor: (e) => (e.r.puesto?.ganancia ? -e.r.puesto.ganancia.pos / e.r.puesto.ganancia.de : null), v: (e) => puesto(e, "ganancia", "con más ganancia") },
    ] },
    { titulo: "Rendimiento por dólar", capas: ["portatil", "fija", "antena"], filas: [
      { t: "Batería por dólar", det: true, capas: ["portatil", "fija"], mejor: IDX.mahUsd, v: (e) => indice(IDX.mahUsd(e), "mAh por cada USD") },
      { t: "Horas de uso por cada USD 10", det: true, capas: ["portatil"], mejor: IDX.hUsd, v: (e) => indice(IDX.hUsd(e), "horas") },
      { t: "Peso por cada 1.000 mAh", det: true, capas: ["portatil"], mejor: (e) => (IDX.gMah(e) === null ? null : -IDX.gMah(e)), v: (e) => indice(IDX.gMah(e), "gramos, menos es mejor") },
      { t: "Panel por cada USD 100", det: true, capas: ["fija"], mejor: IDX.wUsd, v: (e) => indice(IDX.wUsd(e), "vatios") },
      { t: "Ganancia por cada USD 100", det: true, capas: ["antena"], mejor: IDX.dbiUsd, v: (e) => indice(IDX.dbiUsd(e), "dBi") },
    ] },
    { titulo: "Sin celular", capas: ["portatil"], filas: [
      { t: "Qué se puede hacer sin celular", mejor: (e) => ({ total: 2, lee: 1, nada: 0 }[e.r.sinCelular] ?? null), v: (e) => sinCel(e.r.sinCelular) },
      { t: "Cómo se usa sin celular", det: true, v: (e) => texto(e.sin_celular, 150) },
      { t: "Pantalla", mejor: (e) => (e.r.pantalla === null ? null : +e.r.pantalla), v: (e) => e.r.pantalla ? `<span class="si">${ICONOS.si}${esc(e.r.pantallaTexto)}</span>` : siNo(e.r.pantalla, "", "No tiene") },
      { t: "Teclado", mejor: (e) => (e.r.teclado === null ? null : +e.r.teclado), v: (e) => siNo(e.r.teclado, "Tiene", "No tiene") },
      { t: "Controles", det: true, v: (e) => texto(e.entrada, 90) },
      { t: "GPS", mejor: (e) => (e.r.gps === null ? null : +e.r.gps), v: (e) => siNo(e.r.gps, "Tiene", "No tiene") },
      { t: "Receptor GPS", det: true, v: (e) => texto(e.gps, 70) },
    ] },
    { titulo: "Tamaño y peso", capas: ["portatil", "fija", "antena", "modulo"], filas: [
      { t: "Peso", capas: ["portatil", "fija", "antena"], mejor: (e) => (e.r.peso === null || e.capa !== "portatil" ? null : -e.r.peso), v: (e) => dato(e.r.peso, " g") },
      { t: "Medidas", det: true, v: (e) => e.r.dimensiones ? `${esc(e.r.dimensiones)} mm` : SD },
    ] },
    { titulo: "Energía", capas: ["portatil", "fija"], filas: [
      { t: "Batería", mejor: (e) => e.r.bateria, v: (e) => dato(e.r.bateria, " mAh") },
      { t: "Tipo de batería", det: true, v: (e) => texto(e.bateria_formato, 90) },
      { t: "Autonomía en uso", mejor: (e) => e.r.autonomia, capas: ["portatil"], v: (e) => esNum(e.r.autonomia) ? `<span class="num">${n(e.r.autonomia)} h</span><span class="sub">${e.r.autonomiaFuente}</span>` : SD },
      { t: "Condiciones de esa autonomía", det: true, capas: ["portatil", "fija"], v: (e) => texto(e.autonomia_texto, 150) },
      { t: "Panel solar", mejor: (e) => e.r.panel, capas: ["fija"], v: (e) => dato(e.r.panel, " W") },
      { t: "Cómo se carga", capas: ["portatil"], v: (e) => e.r.recarga ? esc(e.r.recarga) : SD },
      { t: "Detalle de la carga", det: true, capas: ["portatil"], v: (e) => texto(e.recarga, 110) },
      { t: "Batería reemplazable", mejor: (e) => ({ "Sí, celda estándar": 2, "Con herramientas": 1, No: 0 }[e.r.reemplazableTexto] ?? null), v: (e) => e.r.reemplazableTexto === "Con herramientas" ? `<span class="si" style="--ok:var(--ink-2)">${ICONOS.medio}Con herramientas</span>` : siNo(e.r.reemplazable, e.r.reemplazableTexto || "Sí", "No") },
    ] },
    { titulo: "Resistencia", capas: ["portatil", "fija", "antena", "accesorio"], filas: [
      { t: "Agua y polvo", mejor: (e) => (e.r.ip ? +e.r.ip.slice(-1) : e.r.ipTexto ? (e.r.agua ? 4.5 : 0) : null), v: (e) => e.r.ip ? siNo(e.r.agua, e.r.ip, e.r.ip) : e.r.ipTexto ? siNo(e.r.agua, e.r.ipTexto, e.r.ipTexto) : SD },
      { t: "Caídas", det: true, capas: ["portatil"], v: (e) => texto(e.resistencia_caida, 90) },
    ] },
    { titulo: "Radio", capas: ["portatil", "fija", "modulo"], filas: [
      { t: "Meshtastic", mejor: (e) => (e.r.listo === null ? null : +e.r.listo), v: (e) => e.r.listoTexto ? siNo(e.r.listo, e.r.listoTexto, e.r.listoTexto) : SD },
      { t: "Cubre 915 a 928 MHz", mejor: (e) => (e.r.banda === null ? null : +e.r.banda), v: (e) => siNo(e.r.banda, "Toda la banda colombiana", "No la cubre entera") },
      { t: "Banda que declara", det: true, v: (e) => texto(e.banda_mhz, 80) },
      { t: "Potencia que declara el fabricante", mejor: (e) => e.r.tx, v: (e) => dato(e.r.tx, " dBm") },
      { t: "Potencia con la que se certificó ante la FCC", det: true, mejor: (e) => e.r.txFcc, v: (e) => esNum(e.r.txFcc) ? `<span class="num">${n(e.r.txFcc, 1)} dBm</span>${e.fcc_id ? `<span class="sub">${esc(e.fcc_id)}</span>` : ""}` : e.fcc_nota ? texto(e.fcc_nota, 90) : SD },
      { t: "Microcontrolador", det: true, v: (e) => texto(e.mcu, 60) },
      { t: "Chip de radio", det: true, v: (e) => texto(e.radio, 60) },
      { t: "Consumo publicado", mejor: (e) => (e.r.consumo === null ? null : -e.r.consumo), capas: ["fija", "modulo"], v: (e) => dato(e.r.consumo, " mA", 1) },
      { t: "Qué mide ese consumo", det: true, capas: ["fija", "modulo"], v: (e) => texto(e.consumo_texto, 130) },
    ] },
    { titulo: "Antena", capas: ["antena", "fija"], filas: [
      { t: "Ganancia", mejor: (e) => e.r.ganancia, v: (e) => dato(e.r.ganancia, " dBi", 2) },
      { t: "ROE publicada", det: true, capas: ["antena"], v: (e) => e.r.roe ? esc(e.r.roe) : SD },
    ] },
    { titulo: "Instalación y alternativas", capas: TODAS, filas: [
      { t: "Dificultad de instalación", det: true, capas: ["fija", "modulo", "antena", "accesorio"], mejor: (e) => ({ baja: 2, "baja-media": 1.5, media: 1, alta: 0 }[String(e.complejidad || "").split(/\s+-\s+|\s/)[0]] ?? null), v: (e) => texto(e.complejidad, 110) },
      { t: "Equipos parecidos", det: true, v: (e) => texto(e.equivalentes, 110) },
      { t: "Fuentes que no coinciden", det: true, v: (e) => e.contradiccion ? `<span class="contra">${texto(e.contradiccion, 220)}</span>` : `<span class="sin-dato">Ninguna</span>` },
    ] },
  ];
  // Índices de las celdas con el mejor valor de la fila. Si todos empatan o faltan datos, ninguno.
  function mejoresDe(f, g, lista) {
    if (!f.mejor || lista.length < 2) return [];
    const p = lista.map((e) => ((f.capas || g.capas).includes(e.capa) ? f.mejor(e) : null));
    const validos = p.filter((x) => typeof x === "number" && isFinite(x));
    if (validos.length < 2) return [];
    const max = Math.max(...validos);
    if (validos.every((x) => x === max) && validos.length === lista.length) return [];
    return p.map((x, i) => (x === max ? i : -1)).filter((i) => i >= 0);
  }
  // Filas que aplican a al menos uno de los equipos elegidos. En una celda de otra capa: «No aplica».
  // completo: incluye las filas de detalle.
  function filasPara(lista, { completo = false } = {}) {
    const capas = new Set(lista.map((e) => e.capa));
    return GRUPOS.filter((g) => g.capas.some((c) => capas.has(c))).map((g) => ({
      titulo: g.titulo,
      filas: g.filas.filter((f) => (completo || !f.det) && (f.capas || g.capas).some((c) => capas.has(c))).map((f) => ({
        t: f.t,
        det: !!f.det,
        celdas: lista.map((e) => ((f.capas || g.capas).includes(e.capa) ? f.v(e) : `<span class="sin-dato">No aplica</span>`)),
        mejores: mejoresDe(f, g, lista),
      })),
    })).filter((g) => g.filas.length);
  }
  // Datos clave de una línea para listas y tarjetas.
  function resumen(e) {
    const r = e.r, p = [];
    if (e.capa === "portatil") {
      if (r.peso) p.push(`${n(r.peso)} g`);
      if (r.bateria) p.push(`${n(r.bateria)} mAh`);
      p.push(r.pantalla ? "con pantalla" : r.pantalla === false ? "sin pantalla" : "");
      if (r.ip) p.push(r.ip);
    } else if (e.capa === "fija") {
      if (r.panel) p.push(`panel de ${n(r.panel)} W`);
      if (r.bateria) p.push(`${n(r.bateria)} mAh`);
      if (r.ip) p.push(r.ip);
    } else if (e.capa === "modulo") {
      if (r.chip) p.push(r.chip);
      if (r.tx) p.push(`${n(r.tx)} dBm`);
    } else if (e.capa === "antena") {
      if (r.ganancia) p.push(`${n(r.ganancia, 2)} dBi`);
    }
    return p.filter(Boolean).join(", ");
  }
  const nombre = (e) => limpiar(e.modelo).replace(/\s*\((?:[^)]*)\)\s*$/, "") || e.modelo;
  // Selección compartida entre prototipos (para «Comparar estos»).
  const CLAVE_SEL = "rv-comparar";
  const guardarSeleccion = (ids) => { try { localStorage.setItem(CLAVE_SEL, JSON.stringify(ids)); } catch (_) { /* sin almacenamiento */ } };
  const leerSeleccion = () => { try { return JSON.parse(localStorage.getItem(CLAVE_SEL) || "[]"); } catch (_) { return []; } };

  async function cargar() {
    const r = await fetch("datos/equipos.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    d.equipos.forEach((e) => { e.r = rasgos(e); e.forma = forma(e); e.r.puesto = {}; });
    // Puesto de cada equipo dentro de su capa, entre los que publican el dato. Empates comparten puesto.
    const CRIT = { precio: [(e) => e.r.precio, 1], bateria: [(e) => e.r.bateria, -1], peso: [(e) => e.r.peso, 1], autonomia: [(e) => e.r.autonomia, -1], ganancia: [(e) => e.r.ganancia, -1] };
    Object.keys(CAPAS).forEach((c) => {
      const de = d.equipos.filter((e) => e.capa === c);
      Object.entries(CRIT).forEach(([k, [f, dir]]) => {
        const con = de.filter((e) => esNum(f(e)));
        con.forEach((e) => { e.r.puesto[k] = { pos: 1 + con.filter((o) => (f(o) - f(e)) * dir < 0).length, de: con.length }; });
      });
    });
    return d;
  }

  window.RV = { texto, foto, PAGINAS, GRUPOS, filasPara, resumen, nombre, guardarSeleccion, leerSeleccion, CAPAS, esc, esNum, fecha, usd, n, limpiar, primeraFrase, precioValido, rasgos, forma, silueta, ICONOS, siNo, sinCel, barra, cargar };
})();
