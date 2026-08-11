/**
 * API de datos de prueba. Node >= 18, sin dependencias.
 *
 *   node api.mjs            -> http://localhost:3000
 *   PORT=8080 node api.mjs
 *
 * Rutas:
 *   GET /                     índice de la API
 *   GET /:tipo                un identificador
 *   GET /:tipo/:n             n identificadores (1..1000)
 *   GET /:tipo?n=5            equivalente al anterior
 *   GET /cif?tipo=B           fuerza la letra de tipo de entidad
 *   GET /:tipo?detalle=1      añade el desglose y el cálculo del control
 *   GET /tipos                catálogo de tipos, incluidas las letras de CIF
 */

import { createServer } from "node:http";
import { GENERADORES, TIPOS_CIF } from "./generadores.mjs";

const PUERTO = Number(process.env.PORT) || 3000;
const MAX = 1000;

/* ---------- respuestas ---------- */
function json(res, codigo, cuerpo){
  const texto = JSON.stringify(cuerpo, null, 2);
  res.writeHead(codigo, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(texto),
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(texto);
}

const error = (res, codigo, mensaje, ayuda) =>
  json(res, codigo, ayuda ? { error: mensaje, ayuda } : { error: mensaje });

/* ---------- índice ---------- */
function indice(){
  return {
    nombre: "API de datos de prueba",
    aviso: "Los valores cumplen el algoritmo de control pero no corresponden a personas, entidades ni cuentas reales.",
    uso: {
      uno: "/nif",
      varios: "/nif/25  o  /nif?n=25",
      con_desglose: "/nif?detalle=1",
      cif_por_tipo: "/cif/10?tipo=B"
    },
    limite: `n entre 1 y ${MAX}`,
    tipos: Object.fromEntries(
      Object.entries(GENERADORES).map(([k, v]) => [k, v.descripcion])
    )
  };
}

/* ---------- servidor ---------- */
const servidor = createServer((req, res) => {
  if (req.method === "OPTIONS"){
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    });
    return res.end();
  }
  if (req.method !== "GET"){
    return error(res, 405, "Solo se admite GET");
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const segmentos = url.pathname.split("/").filter(Boolean);

  // GET /
  if (segmentos.length === 0) return json(res, 200, indice());

  // GET /tipos
  if (segmentos[0] === "tipos"){
    return json(res, 200, {
      identificadores: Object.entries(GENERADORES).map(([clave, v]) => ({
        clave, descripcion: v.descripcion, parametro: v.parametro ?? null
      })),
      cif: TIPOS_CIF
    });
  }

  const clave = segmentos[0].toLowerCase();
  const generador = GENERADORES[clave];
  if (!generador){
    return error(res, 404, `Tipo desconocido: ${clave}`,
      `Tipos válidos: ${Object.keys(GENERADORES).join(", ")}`);
  }

  // cantidad: /nif/25 tiene prioridad sobre /nif?n=25
  const bruto = segmentos[1] ?? url.searchParams.get("n");
  let n = 1;
  if (bruto !== null && bruto !== undefined){
    if (!/^\d+$/.test(bruto)){
      return error(res, 400, `La cantidad debe ser un número entero: ${bruto}`);
    }
    n = Number(bruto);
    if (n < 1 || n > MAX){
      return error(res, 400, `La cantidad debe estar entre 1 y ${MAX}`);
    }
  }

  const detalle = ["1", "true", "si", "sí"].includes(
    (url.searchParams.get("detalle") || "").toLowerCase()
  );
  const parametro = generador.parametro
    ? url.searchParams.get(generador.parametro)
    : null;

  try {
    const datos = Array.from({ length: n }, () => {
      const r = generador.generar(parametro ?? undefined);
      return detalle ? r : r.valor;
    });

    // sin cantidad explícita se devuelve el elemento suelto
    if (bruto === null || bruto === undefined){
      return json(res, 200, detalle
        ? { tipo: clave, ...datos[0] }
        : { tipo: clave, valor: datos[0] });
    }
    return json(res, 200, { tipo: clave, total: n, datos });

  } catch (e) {
    return error(res, e.codigo || 500, e.message);
  }
});

servidor.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`);
  console.log(`Tipos: ${Object.keys(GENERADORES).join(", ")}`);
});
