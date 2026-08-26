/**
 * API de datos de prueba. Node >= 18, sin dependencias.
 *
 *   node api.mjs            -> http://localhost:3000
 *   PORT=8080 node api.mjs
 *
 * Rutas:
 *   GET /                              índice de la API
 *   GET /:categoria/:tipo              un identificador
 *   GET /:categoria/:tipo/:n           n identificadores (1..1000)
 *   GET /:categoria/:tipo?n=5          equivalente al anterior
 *   GET /documentos/cif?tipo=B         fuerza la letra de tipo de entidad
 *   GET /:categoria/:tipo?detalle=1    añade el desglose y el cálculo del control
 *   GET /tipos                         catálogo de tipos por categoría, con las letras de CIF
 *
 * Categorías: documentos (nif, nie, cif, nss), financiero (iban, tarjeta),
 *             vehiculos (matricula), miscelanea (cups, imei)
 */

import { createServer } from "node:http";
import { GENERADORES, TIPOS_CIF, CATEGORIAS } from "./generadores.mjs";
import { validar, crearToken, listarTokens, revocarPorEmail, tokenAdminInicial } from "./tokens.mjs";

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

function extraerToken(req){
  const cabecera = req.headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(cabecera.trim());
  return m ? m[1].trim() : null;
}

/* ---------- administración de tokens ---------- */
function rutaAdmin(req, res, segmentos, url){
  if (segmentos[1] !== "tokens"){
    return error(res, 404, "Ruta de administración desconocida");
  }

  if (req.method === "GET"){
    return json(res, 200, { tokens: listarTokens() });
  }

  if (req.method === "POST"){
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      return error(res, 400, "Email no válido");
    }
    let dias;
    const diasParam = url.searchParams.get("dias");
    if (diasParam !== null){
      if (!/^\d+$/.test(diasParam) || Number(diasParam) < 1){
        return error(res, 400, "El parámetro días debe ser un entero positivo");
      }
      dias = Number(diasParam);
    }
    return json(res, 201, crearToken(email, dias));
  }

  if (req.method === "DELETE"){
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    if (!email) return error(res, 400, "Falta el parámetro email");
    const revocados = revocarPorEmail(email);
    if (revocados === 0){
      return error(res, 404, `No hay tokens activos para ${email}`);
    }
    return json(res, 200, { revocados, email });
  }

  return error(res, 405, "Método no admitido en /admin/tokens");
}

/* ---------- índice ---------- */
function indice(){
  return {
    nombre: "API de datos de prueba",
    aviso: "Los valores cumplen el algoritmo de control pero no corresponden a personas, entidades ni cuentas reales.",
    autenticacion: {
      cabecera: "Authorization: Bearer <token>",
      ayuda: "Todas las peticiones requieren un token válido. Solicítalo al administrador."
    },
    uso: {
      uno: "/documentos/nif",
      varios: "/documentos/nif/25  o  /documentos/nif?n=25",
      con_desglose: "/documentos/nif?detalle=1",
      cif_por_tipo: "/documentos/cif/10?tipo=B"
    },
    limite: `n entre 1 y ${MAX}`,
    categorias: Object.fromEntries(
      Object.entries(CATEGORIAS).map(([clave, descripcion]) => [
        clave,
        { descripcion, tipos: Object.keys(GENERADORES).filter(k => GENERADORES[k].categoria === clave) }
      ])
    )
  };
}

/* ---------- servidor ---------- */
const servidor = createServer((req, res) => {
  if (req.method === "OPTIONS"){
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    });
    return res.end();
  }

  const sesion = validar(extraerToken(req));
  if (!sesion){
    return error(res, 401, "Token inválido, ausente o caducado",
      "Cabecera requerida: Authorization: Bearer <token>");
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const segmentos = url.pathname.split("/").filter(Boolean);

  // rutas de administración de tokens
  if (segmentos[0] === "admin"){
    if (!sesion.esAdmin){
      return error(res, 403, "Se requiere token de administrador");
    }
    return rutaAdmin(req, res, segmentos, url);
  }

  if (req.method !== "GET"){
    return error(res, 405, "Solo se admite GET");
  }

  // GET /
  if (segmentos.length === 0) return json(res, 200, indice());

  // GET /tipos
  if (segmentos[0] === "tipos"){
    return json(res, 200, {
      categorias: Object.fromEntries(
        Object.entries(CATEGORIAS).map(([clave, descripcion]) => [
          clave,
          {
            descripcion,
            tipos: Object.entries(GENERADORES)
              .filter(([, v]) => v.categoria === clave)
              .map(([k, v]) => ({ clave: k, descripcion: v.descripcion, parametro: v.parametro ?? null }))
          }
        ])
      ),
      cif: TIPOS_CIF
    });
  }

  const categoria = segmentos[0].toLowerCase();
  if (!CATEGORIAS[categoria]){
    return error(res, 404, `Categoría desconocida: ${categoria}`,
      `Categorías válidas: ${Object.keys(CATEGORIAS).join(", ")}`);
  }

  const clave = (segmentos[1] || "").toLowerCase();
  const generador = GENERADORES[clave];
  if (!generador || generador.categoria !== categoria){
    const tiposCategoria = Object.keys(GENERADORES).filter(k => GENERADORES[k].categoria === categoria);
    return error(res, 404, `Tipo desconocido en /${categoria}: ${clave || "(ninguno)"}`,
      `Tipos válidos en ${categoria}: ${tiposCategoria.join(", ")}`);
  }

  // cantidad: /documentos/nif/25 tiene prioridad sobre /documentos/nif?n=25
  const bruto = segmentos[2] ?? url.searchParams.get("n");
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
  const admin = tokenAdminInicial();
  if (admin){
    console.log(`\nToken admin generado (guárdalo ahora, no se volverá a mostrar):\n${admin}\n`);
  }
});
