# DIREC-VITOR

## Contexto del proyecto

- **DIREC-VITOR** es un clon del proyecto **campo-directo** con modificaciones.
- **NO usa PHP.** Su backend es **Node.js/Express** (archivo `server.js`).
- El proyecto original **campo-directo** SÍ funciona con PHP (XAMPP/MySQL) pero vive en otra ubicación. **No mezclar ni copiar cambios entre ambos proyectos.**

## Stack y ejecución

- Backend: `server.js` con Express + **pg (PostgreSQL)** + express-session + multer + bcryptjs.
- Base de datos: PostgreSQL `direc_vitor` (esquema importable con `database.pg.sql`).
- Para levantar el proyecto: `npm start` o `node server.js` (puerto 3000) — sin pasos manuales de BD (auto-crea la BD y el esquema si están vacíos).
- **NO usar `python -m http.server`**: solo sirve archivos estáticos y no ejecuta la API.

## BD soportada (PostgreSQL)

- Requiere PostgreSQL instalado (p. ej. `winget install --id PostgreSQL.PostgreSQL.16`). Por defecto conecta a `localhost:5432` con usuario `postgres` / password `postgres` (configurable en `.env`).
- El `server.js` auto-crea la BD `direc_vitor`, la importa automáticamente desde `database.pg.sql` si está vacía (creación + tablas + seed), y migra columnas al iniciar.
- Si la BD ya tiene datos, **NO** se reimporta para no perder información; solo se migran columnas.
- El estilo de conexión emula a mysql2: placeholder `?`, SELECT devuelve `[rows, fields]`; INSERT/UPDATE devuelven `{ insertId, affectedRows }` (para insertId se usa `RETURNING id`).
- Admin por defecto: `admin` / `admin`.
- API: endpoint `POST /api` (multipart) consumido por `js/app.js`.

## Tablas de la base de datos

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | productores, compradores, transportistas y admin |
| `categorias` | categorías de productos |
| `ofertas` | cosechas publicadas |
| `demandas` | solicitudes de compra |
| `transportes` | servicios de transporte |
| `verificaciones` | códigos de verificación |
| `publicidad` | banners y publicidad |
| `mensajes` | mensajes entre usuarios |
| `logs_sistema` | auditoría de acciones |
| `configuracion` | configuración key-value |

## Recordatorios

- Run lint/typecheck si existen; acá lo aplicable es `node -c server.js` para sintaxis.
- Nunca importar cambios del proyecto PHP campo-directo a este clon.

## Despliegue: Supabase + Render

- **BD**: se conecta vía `DATABASE_URL` (connection string de Supabase). Si está definido,
  se ignora `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`, se omite el `CREATE DATABASE`
  (prohibido en Supabase) y se activa SSL automáticamente (`DB_SSL=true`).
- **Esquema**: `database.pg.sql` se importa automáticamente si la BD está vacía (o manualmente
  en el SQL editor de Supabase). No usa `CREATE DATABASE`/extensiones: es 100% compatible con Supabase.
- **Imágenes**: si `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` están definidos, las fotos subidas
  se guardan en el bucket público `SUPABASE_BUCKET` (por defecto `media`, se crea solo) y la BD
  guarda la URL pública. Sin esas claves, cae a disco local (`images/ofertas`, `images/publicidad`).
- **Publicidad**: el front lee `data/publicidad.json` como respaldo; si la BD está disponible,
  `guardar_publicidad` persiste el JSON en la tabla `configuracion` (clave `publicidad_json`),
  que es lo que sobrevive a los despliegues en Render.
- **Render**: blueprint en `render.yaml` (web service, `npm start`, healthcheck `/health`).
  Las variables secretas (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) se completan
  en el dashboard de Render, no se versionan.
- Sesiones en memoria (express-session por defecto): se reinician al reiniciar Render. OK para
  un solo instancia; para persistencia real considerar connect-pg-simple.