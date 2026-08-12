/**
 * Almacén de tokens de acceso. JSON en disco, sin dependencias.
 *
 * Cada entrada: { token, email, esAdmin, creado, expira, revocado, revocadoEn? }
 * - El token admin se genera solo, la primera vez que arranca la API
 *   (si no hay ninguno activo en el fichero) y no caduca.
 * - Los tokens de usuario van asociados a un email; si se crea uno nuevo
 *   para un email que ya tenía token activo, el anterior se revoca.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RUTA = fileURLToPath(new URL("./tokens.json", import.meta.url));
const RUTA_TMP = `${RUTA}.tmp`;
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_EXPIRACION_DEFECTO = Number(process.env.DIAS_EXPIRACION) || 90;

/* ---------- persistencia ---------- */
function cargar(){
  if (!existsSync(RUTA)) return { tokens: [] };
  return JSON.parse(readFileSync(RUTA, "utf8"));
}

function guardar(){
  writeFileSync(RUTA_TMP, JSON.stringify(estado, null, 2));
  renameSync(RUTA_TMP, RUTA);
}

function generarToken(){
  return randomBytes(24).toString("base64url");
}

const estado = cargar();

/* ---------- arranque: garantizar token admin ---------- */
let tokenAdminNuevo = null;
if (!estado.tokens.some(t => t.esAdmin && !t.revocado)){
  const token = generarToken();
  estado.tokens.push({
    token,
    email: null,
    esAdmin: true,
    creado: new Date().toISOString(),
    expira: null,
    revocado: false
  });
  guardar();
  tokenAdminNuevo = token;
}

/** Devuelve el token admin recién generado en este arranque, o null si ya existía. */
export function tokenAdminInicial(){
  return tokenAdminNuevo;
}

/* ---------- validación ---------- */
/** Devuelve la entrada si el token es válido, activo y no caducado; si no, null. */
export function validar(token){
  const entrada = estado.tokens.find(t => t.token === token);
  if (!entrada || entrada.revocado) return null;
  if (entrada.expira && new Date(entrada.expira) < new Date()) return null;
  return entrada;
}

/* ---------- gestión (admin) ---------- */
function revocarActivosPorEmail(email){
  let n = 0;
  const ahora = new Date().toISOString();
  for (const t of estado.tokens){
    if (t.email === email && !t.esAdmin && !t.revocado){
      t.revocado = true;
      t.revocadoEn = ahora;
      n++;
    }
  }
  return n;
}

/** Crea un token para el email dado. Si ya tenía uno activo, lo revoca antes. */
export function crearToken(email, dias = DIAS_EXPIRACION_DEFECTO){
  revocarActivosPorEmail(email);
  const ahora = new Date();
  const entrada = {
    token: generarToken(),
    email,
    esAdmin: false,
    creado: ahora.toISOString(),
    expira: new Date(ahora.getTime() + dias * DIA_MS).toISOString(),
    revocado: false
  };
  estado.tokens.push(entrada);
  guardar();
  return entrada;
}

/** Revoca los tokens activos de un email. Devuelve cuántos se revocaron. */
export function revocarPorEmail(email){
  const n = revocarActivosPorEmail(email);
  if (n > 0) guardar();
  return n;
}

/** Lista todos los tokens con el valor enmascarado (no se vuelve a mostrar completo). */
export function listarTokens(){
  return estado.tokens.map(({ token, ...resto }) => ({
    ...resto,
    token: `${token.slice(0, 4)}…${token.slice(-4)}`
  }));
}
