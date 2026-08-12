# API de datos de prueba

Genera identificadores españoles con dígito de control válido. Node ≥ 18, sin dependencias.

```bash
node api.mjs             # http://localhost:3000
PORT=8080 node api.mjs
```

## Estructura del proyecto

```
generador_nif/
├── public/              ← docroot del servidor web estático (Apache/nginx/Plesk)
│   ├── index.html
│   ├── generador.html
│   └── generador-datos-prueba.html
├── api.mjs              ← servidor Node, se ejecuta aparte (p. ej. Node.js app en Plesk)
├── generadores.mjs
├── tokens.mjs
└── tokens.json          ← se crea solo al arrancar; nunca dentro de public/
```

`public/` y `api.mjs` son independientes: los HTML no importan ni llaman a los `.mjs`, así que da igual en qué carpeta esté cada uno. La API se sirve en su propio puerto/proceso Node.

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
curl localhost:3000/nif -H "Authorization: Bearer $TOKEN"
# {"tipo":"nif","valor":"02554413X"}

curl localhost:3000/nie/3 -H "Authorization: Bearer $TOKEN"
# {"tipo":"nie","total":3,"datos":["Y2608924W","Y3754363H","Y9953446A"]}

curl "localhost:3000/cif/4?tipo=B" -H "Authorization: Bearer $TOKEN"
curl "localhost:3000/cif?tipo=Q&detalle=1" -H "Authorization: Bearer $TOKEN"
curl "localhost:3000/tarjeta?n=100" -H "Authorization: Bearer $TOKEN"
```

Extraer solo los valores a un fichero:

```bash
curl -s "localhost:3000/nif/500" -H "Authorization: Bearer $TOKEN" | jq -r '.datos[]' > nifs.txt
```

## Autenticación

Todas las rutas requieren un token válido en la cabecera:

```
Authorization: Bearer <token>
```

Sin cabecera, con token caducado o revocado → `401`.

En el primer arranque (si no existe `tokens.json` o no tiene ningún token admin activo) se genera un token administrador y se imprime una única vez por consola. Guárdalo entonces; no se puede recuperar después, solo revocar y regenerar borrando la entrada admin de `tokens.json`.

### Rutas de administración (`/admin/tokens`, requieren token admin)

| Ruta | Acción |
|---|---|
| `GET /admin/tokens` | Lista todos los tokens (valor enmascarado, no se vuelve a mostrar completo) |
| `POST /admin/tokens?email=x@y.com&dias=90` | Crea un token para ese email. Si ya tenía uno activo, se revoca antes. `dias` es opcional (por defecto 90, o `DIAS_EXPIRACION` si se define). Devuelve el token completo — solo se ve en este momento |
| `DELETE /admin/tokens?email=x@y.com` | Revoca los tokens activos de ese email |

```bash
curl -X POST "localhost:3000/admin/tokens?email=usuario@ejemplo.com" -H "Authorization: Bearer $TOKEN_ADMIN"
curl "localhost:3000/admin/tokens" -H "Authorization: Bearer $TOKEN_ADMIN"
curl -X DELETE "localhost:3000/admin/tokens?email=usuario@ejemplo.com" -H "Authorization: Bearer $TOKEN_ADMIN"
```

`tokens.json` contiene tokens y emails: está en `.gitignore` y no debe servirse nunca como fichero estático.

## Errores

Siempre JSON con `error`, y `ayuda` cuando procede.

| Situación | Código |
|---|---|
| Token ausente, inválido o caducado | 401 |
| Token válido pero sin permiso admin en `/admin/*` | 403 |
| Tipo desconocido | 404 |
| Cantidad no numérica o fuera de rango | 400 |
| Letra de CIF no válida | 400 |
| Método distinto de GET (fuera de `/admin/tokens`) | 405 |

CORS abierto (`Access-Control-Allow-Origin: *`). Ojo: un token incrustado en una página estática pública deja de ser secreto (cualquiera puede leerlo en el código fuente del navegador), así que esto solo es apto para clientes que guarden su propio token, no para llamadas directas desde una página abierta al público.

## Estructura

- `generadores.mjs` — los seis algoritmos. Sin nada de HTTP ni de navegador: se importa igual desde la API, desde tests o desde un script.
- `tokens.mjs` — almacén de tokens en `tokens.json` (crear, listar, revocar, validar).
- `api.mjs` — capa HTTP. Autenticación, rutas, validación y serialización.

Añadir un tipo nuevo es escribir la función generadora y una entrada en `GENERADORES`; la API la expone sola.

## Aviso

Los valores cumplen el algoritmo de control pero no corresponden a personas, entidades ni cuentas reales. No sirven para ningún trámite.

Los algoritmos de NIF, NIE, CIF, IBAN y Luhn están contrastados contra identificadores públicos conocidos. El del número de la Seguridad Social no ha podido verificarse contra ningún NAF real: usa `provincia + secuencia mod 97` y la secuencia se genera siempre ≥ 10.000.000 para evitar el caso especial de los números bajos.
