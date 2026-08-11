# API de datos de prueba

Genera identificadores españoles con dígito de control válido. Node ≥ 18, sin dependencias.

```bash
node api.mjs             # http://localhost:3000
PORT=8080 node api.mjs
```

## Rutas

| Ruta | Devuelve |
|---|---|
| `GET /` | Índice de la API |
| `GET /tipos` | Catálogo de tipos, con las 17 letras de CIF |
| `GET /:tipo` | Un identificador |
| `GET /:tipo/:n` | `n` identificadores (1–1000) |
| `GET /:tipo?n=5` | Igual que el anterior |

Tipos: `nif`, `nie`, `cif`, `iban`, `nss`, `tarjeta`.

## Parámetros

- `?n=` — cantidad. Equivale al segundo segmento de la ruta; si aparecen los dos, gana la ruta.
- `?detalle=1` — añade el desglose en partes y el cálculo del control.
- `?tipo=` — solo en `/cif`. Letra de tipo de entidad (A–W). Sin ella, se elige al azar.

## Ejemplos

```bash
curl localhost:3000/nif
# {"tipo":"nif","valor":"02554413X"}

curl localhost:3000/nie/3
# {"tipo":"nie","total":3,"datos":["Y2608924W","Y3754363H","Y9953446A"]}

curl "localhost:3000/cif/4?tipo=B"
curl "localhost:3000/cif?tipo=Q&detalle=1"
curl "localhost:3000/tarjeta?n=100"
```

Extraer solo los valores a un fichero:

```bash
curl -s "localhost:3000/nif/500" | jq -r '.datos[]' > nifs.txt
```

## Errores

Siempre JSON con `error`, y `ayuda` cuando procede.

| Situación | Código |
|---|---|
| Tipo desconocido | 404 |
| Cantidad no numérica o fuera de rango | 400 |
| Letra de CIF no válida | 400 |
| Método distinto de GET | 405 |

CORS abierto (`Access-Control-Allow-Origin: *`), así que la página estática puede consumirla directamente.

## Estructura

- `generadores.mjs` — los seis algoritmos. Sin nada de HTTP ni de navegador: se importa igual desde la API, desde tests o desde un script.
- `api.mjs` — capa HTTP. Rutas, validación y serialización.

Añadir un tipo nuevo es escribir la función generadora y una entrada en `GENERADORES`; la API la expone sola.

## Aviso

Los valores cumplen el algoritmo de control pero no corresponden a personas, entidades ni cuentas reales. No sirven para ningún trámite.

Los algoritmos de NIF, NIE, CIF, IBAN y Luhn están contrastados contra identificadores públicos conocidos. El del número de la Seguridad Social no ha podido verificarse contra ningún NAF real: usa `provincia + secuencia mod 97` y la secuencia se genera siempre ≥ 10.000.000 para evitar el caso especial de los números bajos.
