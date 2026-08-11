/**
 * Generadores de identificadores españoles con dígito de control.
 * Sin dependencias. Reutilizable desde la API, desde tests o desde el navegador.
 *
 * Cada generador devuelve:
 *   { valor, partes: [{texto, etiqueta, rol}], calculo }
 *
 * rol: "prefijo" | "cuerpo" | "control"
 */

/* ============ utilidades ============ */
const rnd  = n => Math.floor(Math.random() * n);
const pad  = (n, l) => String(n).padStart(l, "0");
const digs = l => Array.from({ length: l }, () => rnd(10)).join("");

/* ============ NIF ============ */
export const LETRAS_NIF = "TRWAGMYFPDXBNJZSQVHLCKE";

export function generarNIF(){
  const n = rnd(100000000);
  const cuerpo = pad(n, 8);
  const resto = n % 23;
  const letra = LETRAS_NIF[resto];
  return {
    valor: cuerpo + letra,
    partes: [
      { texto: cuerpo, etiqueta: "número",  rol: "cuerpo" },
      { texto: letra,  etiqueta: "control", rol: "control" }
    ],
    calculo: `${cuerpo} mod 23 = ${resto} -> posicion ${resto} de "${LETRAS_NIF}" -> ${letra}`
  };
}

/* ============ NIE ============ */
export function generarNIE(){
  const prefijo = ["X", "Y", "Z"][rnd(3)];
  const idx = "XYZ".indexOf(prefijo);
  const cuerpo = digs(7);
  const n = parseInt(idx + cuerpo, 10);
  const resto = n % 23;
  const letra = LETRAS_NIF[resto];
  return {
    valor: prefijo + cuerpo + letra,
    partes: [
      { texto: prefijo, etiqueta: "prefijo", rol: "prefijo" },
      { texto: cuerpo,  etiqueta: "número",  rol: "cuerpo" },
      { texto: letra,   etiqueta: "control", rol: "control" }
    ],
    calculo: `${prefijo} vale ${idx} -> ${idx}${cuerpo} mod 23 = ${resto} -> ${letra}`
  };
}

/* ============ CIF ============ */
// control: "letra" | "numero" | "ambos"
export const TIPOS_CIF = [
  { letra: "A", descripcion: "Sociedad anónima",                        control: "numero" },
  { letra: "B", descripcion: "Sociedad de responsabilidad limitada",    control: "numero" },
  { letra: "C", descripcion: "Sociedad colectiva",                      control: "ambos"  },
  { letra: "D", descripcion: "Sociedad comanditaria",                   control: "ambos"  },
  { letra: "E", descripcion: "Comunidad de bienes y herencia yacente",  control: "numero" },
  { letra: "F", descripcion: "Sociedad cooperativa",                    control: "ambos"  },
  { letra: "G", descripcion: "Asociación o fundación",                  control: "ambos"  },
  { letra: "H", descripcion: "Comunidad de propietarios",               control: "numero" },
  { letra: "J", descripcion: "Sociedad civil",                          control: "ambos"  },
  { letra: "N", descripcion: "Entidad extranjera",                      control: "letra"  },
  { letra: "P", descripcion: "Corporación local",                       control: "letra"  },
  { letra: "Q", descripcion: "Organismo público",                       control: "letra"  },
  { letra: "R", descripcion: "Congregación o institución religiosa",    control: "letra"  },
  { letra: "S", descripcion: "Órgano de la Administración",             control: "letra"  },
  { letra: "U", descripcion: "Unión temporal de empresas",              control: "ambos"  },
  { letra: "V", descripcion: "Otros tipos no definidos",                control: "ambos"  },
  { letra: "W", descripcion: "Establecimiento permanente no residente", control: "letra"  }
];

export const LETRAS_CIF = "JABCDEFGHI";

/**
 * @param {string} [letraTipo] letra de tipo de entidad; aleatoria si se omite
 */
export function generarCIF(letraTipo){
  const tipo = letraTipo
    ? TIPOS_CIF.find(t => t.letra === String(letraTipo).toUpperCase())
    : TIPOS_CIF[rnd(TIPOS_CIF.length)];

  if (!tipo) {
    const err = new Error(`Tipo de CIF no válido: ${letraTipo}`);
    err.codigo = 400;
    throw err;
  }

  const cuerpo = digs(7);
  let pares = 0, impares = 0;
  for (let i = 0; i < 7; i++){
    const d = +cuerpo[i];
    if (i % 2 === 0){                    // posiciones 1, 3, 5, 7
      let x = d * 2;
      if (x > 9) x -= 9;
      impares += x;
    } else {                             // posiciones 2, 4, 6
      pares += d;
    }
  }
  const total = pares + impares;
  const dc = (10 - total % 10) % 10;

  // "ambos" admite las dos formas: se elige al azar para que salgan ambas
  const usaLetra = tipo.control === "letra"
    || (tipo.control === "ambos" && rnd(2) === 1);
  const control = usaLetra ? LETRAS_CIF[dc] : String(dc);

  return {
    valor: tipo.letra + cuerpo + control,
    entidad: { letra: tipo.letra, descripcion: tipo.descripcion, control: tipo.control },
    partes: [
      { texto: tipo.letra, etiqueta: "tipo",    rol: "prefijo" },
      { texto: cuerpo,     etiqueta: "número",  rol: "cuerpo" },
      { texto: control,    etiqueta: "control", rol: "control" }
    ],
    calculo: `pares = ${pares}, impares x2 = ${impares}, suma ${total}`
           + ` -> (10 - ${total % 10}) mod 10 = ${dc}`
           + (usaLetra ? ` -> letra ${control}` : ` -> ${control}`)
  };
}

/* ============ IBAN ============ */
const PESOS = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];

function dcBanco(str10){
  let s = 0;
  for (let i = 0; i < 10; i++) s += (+str10[i]) * PESOS[i];
  let r = 11 - (s % 11);
  if (r === 10) r = 1;
  if (r === 11) r = 0;
  return r;
}

export function mod97(str){
  let r = 0;
  for (const ch of str) r = (r * 10 + (+ch)) % 97;
  return r;
}

export function generarIBAN(){
  const entidad = digs(4), oficina = digs(4), cuenta = digs(10);
  const d1 = dcBanco("00" + entidad + oficina);
  const d2 = dcBanco(cuenta);
  const bban = entidad + oficina + d1 + d2 + cuenta;
  const resto = mod97(bban + "142800");        // E=14, S=28, más "00"
  const control = pad(98 - resto, 2);
  return {
    valor: "ES" + control + bban,
    partes: [
      { texto: "ES",         etiqueta: "país",    rol: "prefijo" },
      { texto: control,      etiqueta: "control", rol: "control" },
      { texto: entidad,      etiqueta: "entidad", rol: "cuerpo" },
      { texto: oficina,      etiqueta: "oficina", rol: "cuerpo" },
      { texto: `${d1}${d2}`, etiqueta: "dc ccc",  rol: "control" },
      { texto: cuenta,       etiqueta: "cuenta",  rol: "cuerpo" }
    ],
    calculo: `DC del CCC: ${d1} sobre entidad+oficina, ${d2} sobre la cuenta (pesos ${PESOS.join(",")} mod 11)`
           + ` | IBAN: 98 - (mod 97 = ${resto}) -> ${control}`
  };
}

/* ============ Número de la Seguridad Social ============ */
export function generarNSS(){
  const provincia = pad(1 + rnd(53), 2);
  const secuencia = String(10000000 + rnd(90000000));
  const resto = mod97(provincia + secuencia);
  const control = pad(resto, 2);
  return {
    valor: provincia + secuencia + control,
    partes: [
      { texto: provincia, etiqueta: "provincia", rol: "prefijo" },
      { texto: secuencia, etiqueta: "secuencia", rol: "cuerpo" },
      { texto: control,   etiqueta: "control",   rol: "control" }
    ],
    calculo: `${provincia}${secuencia} mod 97 = ${resto} -> ${control}`
  };
}

/* ============ Tarjeta (Luhn) ============ */
const MARCAS = [
  { nombre: "Visa",       bin: () => "4" + digs(5),                 longitud: 16 },
  { nombre: "Mastercard", bin: () => String(51 + rnd(5)) + digs(4), longitud: 16 }
];

export function digitoLuhn(parcial){
  let suma = 0, doblar = true;
  for (let i = parcial.length - 1; i >= 0; i--){
    let d = +parcial[i];
    if (doblar){ d *= 2; if (d > 9) d -= 9; }
    suma += d;
    doblar = !doblar;
  }
  return { digito: (10 - suma % 10) % 10, suma };
}

export function generarTarjeta(){
  const m = MARCAS[rnd(MARCAS.length)];
  const bin = m.bin();
  const resto = digs(m.longitud - 1 - bin.length);
  const parcial = bin + resto;
  const { digito, suma } = digitoLuhn(parcial);
  return {
    valor: parcial + String(digito),
    marca: m.nombre,
    partes: [
      { texto: bin,            etiqueta: m.nombre, rol: "prefijo" },
      { texto: resto,          etiqueta: "número", rol: "cuerpo" },
      { texto: String(digito), etiqueta: "control", rol: "control" }
    ],
    calculo: `Luhn sobre ${m.longitud - 1} dígitos, suma ${suma} -> (10 - ${suma % 10}) mod 10 = ${digito}`
  };
}

/* ============ registro de tipos ============ */
export const GENERADORES = {
  nif:     { generar: generarNIF,     descripcion: "NIF español: 8 dígitos + letra de control" },
  nie:     { generar: generarNIE,     descripcion: "NIE: prefijo X/Y/Z + 7 dígitos + letra" },
  cif:     { generar: generarCIF,     descripcion: "CIF: letra de tipo + 7 dígitos + control", parametro: "tipo" },
  iban:    { generar: generarIBAN,    descripcion: "IBAN español de 24 caracteres" },
  nss:     { generar: generarNSS,     descripcion: "Número de la Seguridad Social: 12 dígitos" },
  tarjeta: { generar: generarTarjeta, descripcion: "Tarjeta de prueba válida según Luhn" }
};
