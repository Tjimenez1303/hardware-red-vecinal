"""Genera FUENTES.md desde datos/equipos.json. Las referencias no van en la web: viven aquí.

Uso, desde la raíz del repositorio:
    python3 herramientas/fuentes.py
"""
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(RAIZ, "datos", "equipos.json"), encoding="utf-8"))
CAPAS = {"portatil": "Portátiles", "fija": "Nodos fijos", "modulo": "Placas", "antena": "Antenas", "accesorio": "Accesorios"}
CAMPOS = {
    "peso_g": "Peso", "bateria_mah": "Batería", "autonomia_uso_h": "Autonomía en uso", "grado_ip": "Grado IP",
    "bateria_reemplazable": "Batería reemplazable", "tx_dbm": "Potencia declarada", "tx_fcc_dbm": "Potencia certificada ante la FCC",
    "consumo_ma": "Consumo", "panel_w": "Panel solar", "ganancia_dbi": "Ganancia", "dimensiones_mm": "Medidas",
    "pantalla": "Pantalla", "entrada": "Entrada", "grado_ip_oficial": "Grado IP oficial",
}


def celda(t):
    return str(t if t is not None else "").replace("|", "\\|").replace("\n", " ")


m = d["meta"]
out = [
    "# Fuentes",
    "",
    f"Generado desde `datos/equipos.json` con `herramientas/fuentes.py`. Precios y fichas al {m['fecha_datos']}.",
    "La página web no muestra referencias: este archivo es donde se comprueba cada dato.",
    "",
    "## Precios",
    "",
    "Cada precio sale de la ficha del vendedor en la fecha indicada. Sin URL o sin fecha, el precio no se muestra.",
    "",
]
for capa, nombre in CAPAS.items():
    eq = [e for e in d["equipos"] if e["capa"] == capa]
    out += [f"### {nombre}", "", "| Equipo | Precio USD | Vendedor | Consultado |", "|---|---|---|---|"]
    for e in eq:
        precio = f"{e['precio_usd']:.2f}" if isinstance(e.get("precio_usd"), (int, float)) else "Sin dato"
        out.append(f"| {celda(e['fabricante'])} {celda(e['modelo'])} | {precio} | [{celda(e.get('vendedor') or 'ficha')}]({e['url']}) | {celda(e.get('fecha_consulta'))} |")
    out.append("")

out += ["## Datos técnicos que se buscaron aparte", "",
        "Huecos de la ficha que se llenaron con otra fuente. La columna de condiciones dice qué mide exactamente la cifra.", "",
        "| Equipo | Dato | Valor | Fuente | Tipo | Condiciones |", "|---|---|---|---|---|---|"]
for e in d["equipos"]:
    for campo, f in (e.get("fuentes_campos") or {}).items():
        out.append(f"| {celda(e['modelo'])} | {CAMPOS.get(campo, campo)} | {celda(e.get(campo))} | [enlace]({f.get('url')}) | {celda(f.get('tipo_fuente'))} | {celda(f.get('condiciones'))} |")
out.append("")

ali = [e for e in d["equipos"] if e.get("aliexpress")]
if ali:
    info = m.get("aliexpress", {})
    out += ["## Precios en AliExpress", "", info.get("metodo", ""), "",
            "| Equipo | Tienda | Precio USD | Envío a Colombia | Variante | Ficha |", "|---|---|---|---|---|---|"]
    for e in ali:
        a = e["aliexpress"]
        envio = {"gratis": "gratis", "no se envía a Colombia": "no se envía"}.get(a.get("envio"), f"USD {a['envio_usd']:.2f}" if isinstance(a.get("envio_usd"), (int, float)) else "Sin dato")
        out.append(f"| {celda(e['modelo'])} | {celda(a.get('tienda'))}{'' if a.get('oficial', True) else ' (sin confirmar como oficial)'} | {a['precio_usd']:.2f} | {envio} | {celda(a.get('variante'))} | [{a['fecha']}]({a['url']}) |")
    out.append("")

contra = [e for e in d["equipos"] if e.get("contradiccion")]
out += ["## Contradicciones entre fuentes", "", "Se muestran tal cual. No se eligió una de las dos.", ""]
out += [f"- **{e['fabricante']} {e['modelo']}.** {e['contradiccion']}" for e in contra]
out.append("")

fcc = [e for e in d["equipos"] if e.get("fcc_nota")]
if fcc:
    out += ["## Registros FCC sin cifra de potencia", ""]
    out += [f"- **{e['fabricante']} {e['modelo']}** ({e['fcc_id']}). {e['fcc_nota']}" for e in fcc]
    out.append("")

out += ["## Mercado colombiano", "", "| Tienda | Qué vende | Precio COP | Consultado | Enlace |", "|---|---|---|---|---|"]
for t in d.get("mercado_colombia", []):
    cop = f"{t['precio_cop']:,.0f}".replace(",", ".") if isinstance(t.get("precio_cop"), (int, float)) else "Sin dato"
    out.append(f"| {celda(t.get('vendedor'))} | {celda(t.get('producto'))} | {cop} | {celda(t.get('fecha_consulta'))} | {t.get('url', '')} |")
out.append("")

out += ["## Referencias del estudio", "", "| Clave | Título | Entidad | Tipo | Consultada |", "|---|---|---|---|---|"]
for r in d["referencias"]:
    out.append(f"| {celda(r['clave'])} | [{celda(r['titulo'])}]({r['url']}) | {celda(r.get('entidad'))} | {celda(r.get('tipo'))} | {celda(r.get('fecha_consulta'))} |")
out.append("")

open(os.path.join(RAIZ, "FUENTES.md"), "w", encoding="utf-8").write("\n".join(out))
print("FUENTES.md:", len(out), "líneas")
