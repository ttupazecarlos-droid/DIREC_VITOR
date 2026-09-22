/**
 * DIRECT VITOR - Servidor Node.js (reemplaza api/api.php + config/conexion.php)
 * Backend JSON para las páginas HTML base del sistema.
 * Todas las respuestas se devuelven en JSON y se consumen con fetch() desde js/app.js
 */

const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();

/* ═══════════════════ CONFIGURACIÓN ═══════════════════ */

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const DEMO_MODE = !IS_PROD && process.env.DEMO_MODE !== 'false';
const COOKIE_SECURE = IS_PROD ? process.env.COOKIE_SECURE !== 'false' : process.env.COOKIE_SECURE === 'true';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const SESSION_SECRET = process.env.SESSION_SECRET || 'campo_directo_vitor_2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'direc_vitor';
const DB_SSL = process.env.DB_SSL === 'true'
    || /\bsupabase\.co/.test(DATABASE_URL)
    || /\bsupabase\.co/.test(DB_HOST);

const CONEXION_BASE = DATABASE_URL
    ? { connectionString: DATABASE_URL }
    : { host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME };

CONEXION_BASE.connectionTimeoutMillis = 10000;
if (DB_SSL) CONEXION_BASE.ssl = { rejectUnauthorized: false };

const DB_CONFIG = { ...CONEXION_BASE, max: 10 };

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_BUCKET = (process.env.SUPABASE_BUCKET || 'media').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'media';
const USAR_SUPABASE_STORAGE = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

let supabaseAdmin = null;
function getSupabaseAdmin() {
    if (!supabaseAdmin && USAR_SUPABASE_STORAGE) {
        const { createClient } = require('@supabase/supabase-js');
        supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    }
    return supabaseAdmin;
}

async function asegurarBucketSupabase() {
    if (!USAR_SUPABASE_STORAGE) return;
    try {
        const cliente = getSupabaseAdmin();
        const { data, error } = await cliente.storage.getBucket(SUPABASE_BUCKET);
        if (error || !data) {
            await cliente.storage.createBucket(SUPABASE_BUCKET, { public: true });
        } else if (!data.public) {
            await cliente.storage.updateBucket(SUPABASE_BUCKET, { public: true });
        }
    } catch (e) {
        console.log('⚠️  No se pudo asegurar el bucket de Supabase Storage:', e.message);
    }
}

const ANEXOS_VITOR = [
    "Barrio Nuevo", "Cuesta de Gallinazos", "Huachipa", "La Caleta",
    "Las Palmeras", "Mocoro", "Pie de la Cuesta", "Pueblo Viejo",
    "San Luis", "Socabón", "Sotillo", "Tácar",
    "Tradicional Pueblo Nuevo", "Virgen de Chapi"
];

/* ═══════════════════ MIDDLEWARE ═══════════════════ */

app.disable('x-powered-by');
if (TRUST_PROXY) app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const ORIGIN_NULL = 'null';
function esOrigenPermitido(origin) {
    if (!origin) return true;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (origin === ORIGIN_NULL) return true; // acceso local via file://
    if (!IS_PROD) {
        if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
        if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
    }
    return false;
}

// CORS restringido: solo mismo origen (sin header) y dominios configurados en ALLOWED_ORIGINS
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && esOrigenPermitido(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Forzar UTF-8 en todas las respuestas de texto
app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (typeof body === 'string' && !res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        if (typeof body === 'object' && body !== null && !res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        return originalSend.call(this, body);
    };
    next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(session({
    name: 'direcvitor.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        secure: COOKIE_SECURE
    }
}));

// Bloquear acceso público a archivos sensibles del proyecto
const ARCHIVOS_BLOQUEADOS = /^\/(?:node_modules\/.*|data\/.*|server\.js|package\.json|package-lock\.json|\.env(?:\.\w+)?|AGENTS\.md)/i;
app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api')) {
        if (ARCHIVOS_BLOQUEADOS.test(req.path)) {
            return res.status(404).type('text/plain').send('Not Found');
        }
    }
    next();
});

// Archivos estáticos (HTML, CSS, JS, imágenes)
app.use(express.static(path.join(__dirname), {
    index: 'index.html',
    extensions: ['html']
}));

/* ═══════════════════ CONEXIÓN A BD ═══════════════════ */

let pgPool = null;
let usarDBReal = false;

// Wrapper que imita el comportamiento de mysql2 (pool.query con '?') sobre pg.
// - '?' se traduce a placeholders $1..$n
// - Devuelve [rows, fields] en SELECT y [{ insertId, affectedRows }, fields] en el resto
function prepararParametros(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

async function dbQuery(sql, params) {
    const res = await pgPool.query(prepararParametros(sql), params || []);
    const esSelect = /^\s*(select|with|show|values|explain)\b/i.test(sql);
    if (esSelect) {
        return [res.rows || [], res.fields];
    }
    const header = {
        affectedRows: res.rowCount || 0,
        insertId: (res.rows && res.rows[0] && typeof res.rows[0].id !== 'undefined') ? res.rows[0].id : 0
    };
    return [header, res.fields];
}

const pool = {
    query: (sql, params) => dbQuery(sql, params)
};

async function logAccion(usuarioId, accion, tabla, registroId, detalles, req) {
    if (!usarDBReal || !pool) return;
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '') : '';
        const ua = req ? (req.headers['user-agent'] || '').slice(0, 255) : '';
        await pool.query(
            'INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, registro_id, detalles, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [usuarioId, accion, tabla, registroId, detalles, ip, ua]
        );
    } catch (e) { /* no bloquear si falla el log */ }
}

async function ensureDatabaseExists() {
    // Con DATABASE_URL (Supabase) la BD ya está aprovisionada y CREATE DATABASE está prohibido.
    if (DATABASE_URL) return true;
    const { Client } = require('pg');
    const cliente = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: 'postgres',
        connectionTimeoutMillis: CONEXION_BASE.connectionTimeoutMillis,
        ssl: CONEXION_BASE.ssl
    });
    await cliente.connect();
    const { rows } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (rows.length === 0) {
        await cliente.query(`CREATE DATABASE "${DB_NAME}" ENCODING 'UTF8'`);
        console.log('🗄️ Base de datos ' + DB_NAME + ' creada (PostgreSQL).');
    }
    await cliente.end();
    return true;
}

async function importarDatabaseSQL() {
    const { Client } = require('pg');
    const cliente = new Client(CONEXION_BASE);
    await cliente.connect();
    const archivo = path.join(__dirname, 'database.pg.sql');
    const sql = fs.readFileSync(archivo, 'utf8');
    await cliente.query(sql);
    await cliente.end();
}

async function initDB() {
    try {
        try {
            await ensureDatabaseExists();
        } catch (e) {
            if (!DEMO_MODE) {
                console.error('FATAL: No se pudo conectar a PostgreSQL y el modo demo está deshabilitado.');
                console.error('  Revisa DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME o inicia con NODE_ENV=development para usar demo.');
                console.error('  Detalle:', e.message);
                process.exit(1);
            }
            console.log('⚠️  PostgreSQL no disponible, modo demo:', e.message);
            usarDBReal = false;
            return;
        }

        pgPool = new Pool(DB_CONFIG);
        await pgPool.query('SELECT 1');
        usarDBReal = true;
        console.log('✅ Conectado a PostgreSQL: ' + DB_CONFIG.database);

        // Importar datos iniciales automáticamente solo si la BD está vacía
        let necesitaImportar = false;
        try {
            const reg = await pgPool.query("SELECT to_regclass('public.usuarios') AS tabla");
            if (reg.rows[0] && !reg.rows[0].tabla) {
                necesitaImportar = true;
            } else {
                const cnt = await pgPool.query('SELECT COUNT(*)::int AS n FROM usuarios');
                necesitaImportar = cnt.rows[0].n === 0;
            }
        } catch (e) {
            necesitaImportar = true;
        }

        if (necesitaImportar) {
            try {
                await importarDatabaseSQL();
                console.log('📦 Base de datos inicial importada automáticamente desde database.pg.sql (PostgreSQL).');
            } catch (e) {
                console.log('⚠️  No se pudo importar database.pg.sql automáticamente:', e.message);
            }
        } else {
            console.log('✔ La base de datos ya contiene datos; no se reimporta para evitar pérdidas.');
        }

        // El esquema completo (tablas, enums, triggers e índices) se define
        // en database.pg.sql; las migraciones de columnas cubren BDs antiguas.

        // Auto-migración de columnas faltantes (PostgreSQL)
        const migraciones = [
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password VARCHAR(255) NOT NULL DEFAULT ''",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS anexo VARCHAR(80) NOT NULL DEFAULT 'Sotillo'",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS distrito VARCHAR(50) DEFAULT 'Valle de Vítor'",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_admin SMALLINT NOT NULL DEFAULT 0",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo SMALLINT DEFAULT 1",
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMP DEFAULT NULL",
            "ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS anexo VARCHAR(80) NOT NULL DEFAULT 'Sotillo'",
            "ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS vistas INT DEFAULT 0",
            "ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE demandas ADD COLUMN IF NOT EXISTS fecha_cosecha DATE DEFAULT NULL",
            "ALTER TABLE demandas ADD COLUMN IF NOT EXISTS vistas INT DEFAULT 0",
            "ALTER TABLE demandas ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE transportes ADD COLUMN IF NOT EXISTS vistas INT DEFAULT 0",
            "ALTER TABLE transportes ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE categorias ADD COLUMN IF NOT EXISTS activa SMALLINT DEFAULT 1"
        ];
        for (const sql of migraciones) {
            try { await pgPool.query(sql); } catch (e) { /* ya existe */ }
        }

        // Auto-crear admin; no se resetea la contraseña si el admin ya existe
        const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        const { rows: adminRows } = await pgPool.query("SELECT id, password FROM usuarios WHERE email = 'admin'");
        if (adminRows.length > 0) {
            await pgPool.query("UPDATE usuarios SET email = 'admin', is_admin = 1 WHERE id = $1", [adminRows[0].id]);
            if (!adminRows[0].password) {
                await pgPool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [adminHash, adminRows[0].id]);
                console.log('🔐 Password del admin inicializado con ADMIN_PASSWORD (estaba vacío).');
            }
        } else {
            await pgPool.query(
                "INSERT INTO usuarios (nombre, tipo, dni_ruc, telefono, email, password, anexo, distrito, ciudad, is_admin, verificado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
                ['Administrador Direct Vitor', 'productor', '00000000', '+51 999 000 000', 'admin', adminHash, 'Sotillo', 'Valle de Vítor', 'Arequipa', 1, 1]
            );
        }
    } catch (e) {
        if (!DEMO_MODE) {
            console.error('FATAL: Error al inicializar la base de datos en modo producción.');
            console.error('  Detalle:', e.message);
            process.exit(1);
        }
        console.log('⚠️  PostgreSQL no disponible, modo demo:', e.message);
        usarDBReal = false;
    }
}

/* ═══════════════════ HELPERS ═══════════════════ */

function jsonOk(res, data = {}) {
    res.json({ ok: true, ...data });
}

function jsonErr(res, msg) {
    res.json({ ok: false, error: msg });
}

function getLoggedUser(req) {
    if (!req.session || !req.session.usuario_id) return null;

    const uid = req.session.usuario_id;

    if (usarDBReal && pool) {
        return (async () => {
            try {
                const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [uid]);
                return rows.length > 0 ? rows[0] : null;
            } catch (e) { return null; }
        })();
    }

    return {
        id: uid,
        nombre: req.session.usuario_nombre || 'Fundo Don Mateo - Anexo Sotillo',
        tipo: req.session.usuario_tipo || 'productor',
        dni_ruc: '10458291034',
        telefono: '+51 984 512 301',
        email: 'donmateo@campodirecto.pe',
        anexo: 'Sotillo',
        distrito: 'Valle de Vítor',
        ciudad: 'Arequipa',
        verificado: 1,
        calificacion: 4.9
    };
}

/* ═══════════════════ DATOS DEMO ═══════════════════ */

const DEMO_OFERTAS = [
    {
        id: 1, producto: 'Cebolla Roja Arequipeña', variedad: 'Roja Camaneja Grano Grande',
        cantidad_ton: 20.00, precio_kg: 1.80, anexo: 'Sotillo',
        ubicacion_chacra: 'Anexo Sotillo, Sector 2', fecha_cosecha: '2026-08-05',
        fecha_publicacion: '2026-08-01 08:30:00',
        es_organico: 0, descripcion: 'Cebolla roja de excelente firmeza y color, cosechada directo en el Anexo Sotillo de Vítor. Lista para despacho a mercados.',
        imagen: 'images/automaticas/harvest_papa.jpg', productor: 'Fundo Don Mateo - Anexo Sotillo',
        telefono: '+51 984 512 301', calificacion: 4.9, verificado: 1
    },
    {
        id: 2, producto: 'Uva Italia pisco y mesa', variedad: 'Italia Aromática',
        cantidad_ton: 15.00, precio_kg: 3.50, anexo: 'Pueblo Viejo',
        ubicacion_chacra: 'Anexo Pueblo Viejo, Parcela 8', fecha_cosecha: '2026-08-12',
        fecha_publicacion: '2026-08-02 09:00:00',
        es_organico: 1, descripcion: 'Uva Italia aromática de alta graduación brix. Ideal para elaboración de pisco artesanal o consumo de mesa.',
        imagen: 'images/automaticas/harvest_palta.jpg', productor: 'Agrícola Vítor - José Quispe',
        telefono: '+51 947 182 940', calificacion: 4.8, verificado: 1
    },
    {
        id: 3, producto: 'Ají Paprika de Exportación', variedad: 'Paprika Mesa',
        cantidad_ton: 12.00, precio_kg: 5.20, anexo: 'San Luis',
        ubicacion_chacra: 'Anexo San Luis, Parcela 15', fecha_cosecha: '2026-08-08',
        fecha_publicacion: '2026-08-03 10:15:00',
        es_organico: 1, descripcion: 'Ají Paprika de gran intensidad de color ASTA. Secado natural en chacra del Anexo San Luis.',
        imagen: 'images/hero_farm_bg_1785427619599.jpg', productor: 'Asociación de Regantes San Luis',
        telefono: '+51 951 823 104', calificacion: 5.0, verificado: 1
    }
];

const DEMO_DEMANDAS = [
    {
        id: 1, tipo_comprador: 'Mercado Mayorista', producto: 'Cebolla Roja Arequipeña',
        cantidad_ton: 15.00, precio_max_kg: 2.00, destino: 'Arequipa - Río Seco',
        fecha_cosecha: '2026-08-20', fecha_publicacion: '2026-08-01 11:00:00',
        urgencia: 'Alta', descripcion: 'Requerimos cebolla roja proveniente del Valle de Vítor clasificada por tamaño.',
        comprador: 'Mercado Mayorista Río Seco Arequipa', telefono: '+51 998 123 456',
        calificacion: 4.9, verificado: 1
    },
    {
        id: 2, tipo_comprador: 'Exportadora Agrícola', producto: 'Uva Quebranta / Italia',
        cantidad_ton: 30.00, precio_max_kg: 3.80, destino: 'Arequipa - Planta de Procesamiento',
        fecha_cosecha: '2026-08-25', fecha_publicacion: '2026-08-02 14:30:00',
        urgencia: 'Media', descripcion: 'Compramos cosecha completa de viñedos de Vítor para pisco y exportación.',
        comprador: 'Exportadora Arequipa Agro', telefono: '+51 977 456 123',
        calificacion: 4.7, verificado: 1
    }
];

const DEMO_TRANSPORTES = [
    {
        id: 1, nombre: 'Transportes Don Mateo', tipo: 'camion', telefono: '+51 984 512 301',
        placa: 'A5B-123', anexo: 'Sotillo', cobertura: 'Vítor, Arequipa centro, mayoristas',
        descripcion: 'Camión frigorífico para traslado de cosechas, carga completa por tonelada.',
        usuario_nombre: 'Fundo Don Mateo - Anexo Sotillo'
    },
    {
        id: 2, nombre: 'MotoFletes José Quispe', tipo: 'motocarga', telefono: '+51 947 182 940',
        placa: 'M8-4567', anexo: 'Pueblo Viejo', cobertura: 'Anexos de Valle de Vítor',
        descripcion: 'Motocarga ágil para traslados cortos entre anexos y chacras.',
        usuario_nombre: 'Agrícola Vítor - José Quispe'
    },
    {
        id: 3, nombre: 'Camionetas San Luis', tipo: 'camioneta', telefono: '+51 951 823 104',
        placa: 'C1D-789', anexo: 'San Luis', cobertura: 'Arequipa y alrededores',
        descripcion: 'Camioneta pick up para carga liviana y media, servicios a domicilio.',
        usuario_nombre: 'Asociación de Regantes San Luis'
    }
];

const DEMO_COMENTARIOS = [
    {
        id: 1, publicacion_tipo: 'oferta', publicacion_id: 1, usuario_id: 4,
        autor_nombre: 'Mercado Mayorista Río Seco Arequipa', autor_tipo: 'comprador',
        autor_anexo: 'Sotillo', autor_foto: 'default_user.jpg', autor_calificacion: 4.9,
        comentario: '¿Tienen disponibilidad de envío directo al Mercado Río Seco este fin de semana?',
        estado: 'activo', creado_en: '2026-09-14 10:30:00'
    },
    {
        id: 2, publicacion_tipo: 'oferta', publicacion_id: 1, usuario_id: 1,
        autor_nombre: 'Fundo Don Mateo - Anexo Sotillo', autor_tipo: 'productor',
        autor_anexo: 'Sotillo', autor_foto: 'default_user.jpg', autor_calificacion: 4.9,
        comentario: 'Sí estimado, contamos con camión propio para despacho a Río Seco los sábados.',
        estado: 'activo', creado_en: '2026-09-14 11:15:00'
    },
    {
        id: 3, publicacion_tipo: 'oferta', publicacion_id: 2, usuario_id: 5,
        autor_nombre: 'Exportadora Arequipa Agro', autor_tipo: 'comprador',
        autor_anexo: 'Sotillo', autor_foto: 'default_user.jpg', autor_calificacion: 4.7,
        comentario: 'Excelente calidad de uva Italia en Pueblo Viejo. Nos contactaremos al WhatsApp.',
        estado: 'activo', creado_en: '2026-09-14 14:20:00'
    },
    {
        id: 4, publicacion_tipo: 'demanda', publicacion_id: 1, usuario_id: 1,
        autor_nombre: 'Fundo Don Mateo - Anexo Sotillo', autor_tipo: 'productor',
        autor_anexo: 'Sotillo', autor_foto: 'default_user.jpg', autor_calificacion: 4.9,
        comentario: 'Tengo disponible 15 toneladas en Sotillo listas para cargar.',
        estado: 'activo', creado_en: '2026-09-14 15:45:00'
    }
];

const DEMO_REPORTES = [
    {
        id: 1, tipo_objetivo: 'publicacion', publicacion_tipo: 'oferta', publicacion_id: 3, comentario_id: null,
        usuario_reportante_id: 4, reportante_nombre: 'Mercado Mayorista Río Seco Arequipa', reportante_email: 'compras@rioseco.pe',
        item_titulo: 'Ají Paprika de Exportación', item_autor: 'Asociación de Regantes San Luis',
        motivo: 'Verificación de precio', detalles: 'Consultar si el precio incluye selección o es al barrer en chacra.',
        estado: 'pendiente', resolucion_nota: null, admin_id: null, creado_en: '2026-09-15 08:20:00', resuelto_en: null
    }
];

/* ═══════════════════ QUERY HELPERS ═══════════════════ */

async function dbGetOfertas(filtros = {}) {
    if (!usarDBReal || !pool) {
        let result = DEMO_OFERTAS.map(o => ({
            ...o,
            total_comentarios: DEMO_COMENTARIOS.filter(c => c.publicacion_tipo === 'oferta' && c.publicacion_id === o.id && c.estado === 'activo').length
        }));
        if (filtros.anexo) result = result.filter(o => o.anexo === filtros.anexo);
        if (filtros.buscar) {
            const q = filtros.buscar.toLowerCase();
            result = result.filter(o => o.producto.toLowerCase().includes(q) || o.anexo.toLowerCase().includes(q));
        }
        if (filtros.orden === 'comentarios') {
            result.sort((a, b) => b.total_comentarios - a.total_comentarios);
        } else {
            result.sort((a, b) => new Date(b.fecha_publicacion) - new Date(a.fecha_publicacion));
        }
        if (filtros.limit) result = result.slice(0, filtros.limit);
        return result;
    }
    let sql = `SELECT o.*, u.nombre as productor, u.telefono, u.calificacion, u.verificado,
               (SELECT COUNT(*)::int FROM comentarios c WHERE c.publicacion_tipo = 'oferta' AND c.publicacion_id = o.id AND c.estado = 'activo') as total_comentarios
               FROM ofertas o JOIN usuarios u ON o.usuario_id = u.id
               WHERE o.estado = 'disponible'`;
    const params = [];
    if (filtros.anexo) { sql += ' AND o.anexo = ?'; params.push(filtros.anexo); }
    if (filtros.buscar) {
        sql += ' AND (o.producto LIKE ? OR o.variedad LIKE ? OR o.anexo LIKE ?)';
        const q = `%${filtros.buscar}%`;
        params.push(q, q, q);
    }
    if (filtros.orden === 'comentarios') {
        sql += ' ORDER BY total_comentarios DESC, o.fecha_publicacion DESC';
    } else {
        sql += ' ORDER BY o.fecha_publicacion DESC';
    }
    if (filtros.limit) {
        sql += ' LIMIT ?';
        params.push(filtros.limit);
    }
    const [rows] = await pool.query(sql, params);
    return rows;
}

async function dbGetDemandas(filtros = {}) {
    if (!usarDBReal || !pool) {
        let result = DEMO_DEMANDAS.map(d => ({
            ...d,
            total_comentarios: DEMO_COMENTARIOS.filter(c => c.publicacion_tipo === 'demanda' && c.publicacion_id === d.id && c.estado === 'activo').length
        }));
        if (filtros.orden === 'comentarios') {
            result.sort((a, b) => b.total_comentarios - a.total_comentarios);
        } else {
            result.sort((a, b) => new Date(b.fecha_publicacion) - new Date(a.fecha_publicacion));
        }
        if (filtros.limit) result = result.slice(0, filtros.limit);
        return result;
    }
    const [rows] = await pool.query(
        `SELECT d.*, u.nombre as comprador, u.telefono, u.calificacion, u.verificado,
         (SELECT COUNT(*)::int FROM comentarios c WHERE c.publicacion_tipo = 'demanda' AND c.publicacion_id = d.id AND c.estado = 'activo') as total_comentarios
         FROM demandas d JOIN usuarios u ON d.usuario_id = u.id
         WHERE d.estado = 'activa'` + (filtros.orden === 'comentarios' ? ' ORDER BY total_comentarios DESC, d.fecha_publicacion DESC' : ' ORDER BY d.fecha_publicacion DESC') + (filtros.limit ? ' LIMIT ?' : ''),
        filtros.limit ? [filtros.limit] : []
    );
    return rows;
}

async function dbGetTransportes(filtros = {}) {
    if (!usarDBReal || !pool) {
        let result = DEMO_TRANSPORTES.map(t => ({
            ...t,
            total_comentarios: DEMO_COMENTARIOS.filter(c => c.publicacion_tipo === 'transporte' && c.publicacion_id === t.id && c.estado === 'activo').length
        }));
        if (filtros.tipo) result = result.filter(t => t.tipo === filtros.tipo);
        if (filtros.anexo) result = result.filter(t => t.anexo === filtros.anexo);
        return result;
    }
    let sql = `SELECT t.*, u.nombre as usuario_nombre,
               (SELECT COUNT(*)::int FROM comentarios c WHERE c.publicacion_tipo = 'transporte' AND c.publicacion_id = t.id AND c.estado = 'activo') as total_comentarios
               FROM transportes t JOIN usuarios u ON t.usuario_id = u.id
               WHERE t.estado = 'activo'`;
    const params = [];
    if (filtros.tipo) { sql += ' AND t.tipo = ?'; params.push(filtros.tipo); }
    if (filtros.anexo) { sql += ' AND t.anexo = ?'; params.push(filtros.anexo); }
    sql += ' ORDER BY t.fecha_registro DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
}

/* ═══════════════════ UPLOAD ═══════════════════ */

const upload = multer({
    storage: USAR_SUPABASE_STORAGE
        ? multer.memoryStorage()
        : multer.diskStorage({
            destination: (req, file, cb) => {
                const tipo = (req.body && req.body.tipo) || 'ofertas';
                const dirMap = { ofertas: 'images/ofertas', publicidad: 'images/publicidad' };
                const dir = path.join(__dirname, dirMap[tipo] || 'images/ofertas');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                const tipo = (req.body && req.body.tipo) || 'ofertas';
                let ext = path.extname(file.originalname).toLowerCase();
                if (['.jfif', '.jpe', '.pjpeg'].includes(ext)) ext = '.jpg';
                const prefix = tipo === 'publicidad' ? 'pub_' : 'cosecha_';
                cb(null, prefix + Date.now() + '_' + require('crypto').randomBytes(4).toString('hex') + (ext || '.jpg'));
            }
        }),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        // .jfif es JPEG con otra extensión: los navegadores lo envían como
        // image/jpeg, image/pjpeg o image/jfif (a veces vacío). Se acepta igual.
        const allowed = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/jfif', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
        const ext = (file.originalname || '').toLowerCase();
        const esJfif = ext.endsWith('.jfif') || ext.endsWith('.jpe') || ext.endsWith('.jpg') || ext.endsWith('.jpeg');
        if (allowed.includes(file.mimetype) || !file.mimetype || esJfif) return cb(null, true);
        cb(null, false);
    }
});

// Multer solo declaraba el campo 'imagen', por eso al subir la foto de una publicación
// (campo 'foto_cosecha') respondía "Unexpected field". Se aceptan ambos nombres de
// archivo y se normalizan en req.file (comportamiento idéntico al single anterior).
const UPLOAD_CAMPOS_ARCHIVO = [
    { name: 'imagen', maxCount: 1 },
    { name: 'foto_cosecha', maxCount: 1 }
];

function parsearUpload(req, res, next) {
    upload.fields(UPLOAD_CAMPOS_ARCHIVO)(req, res, function (err) {
        if (err) return next(err);
        const archivos = req.files || {};
        const archivo =
            (archivos['imagen'] && archivos['imagen'][0]) ||
            (archivos['foto_cosecha'] && archivos['foto_cosecha'][0]) ||
            null;
        req.file = archivo;
        next();
    });
}

function nombreArchivoUnico(originalname) {
    let ext = path.extname(originalname || '').toLowerCase();
    // Normalizar: .jfif/.jpe/.pjpeg son JPEG; guardar como .jpg para que
    // navegadores y Supabase Storage los sirvan con el Content-Type correcto.
    if (['.jfif', '.jpe', '.pjpeg'].includes(ext)) ext = '.jpg';
    return Date.now() + '_' + require('crypto').randomBytes(4).toString('hex') + (ext || '.jpg');
}

// Guarda la imagen subida en Supabase Storage (si está configurado) o en disco local.
async function guardarImagenSubida(file, tipo) {
    const carpeta = tipo === 'publicidad' ? 'publicidad' : 'ofertas';
    if (USAR_SUPABASE_STORAGE && file && file.buffer) {
        const ruta = carpeta + '/' + nombreArchivoUnico(file.originalname);
        const cliente = getSupabaseAdmin();
        // Si el navegador mandó image/jfif o mimetype vacío, subir como image/jpeg.
        let contentType = file.mimetype || 'image/jpeg';
        if (['image/jfif', 'image/pjpeg', 'image/jpg'].includes(contentType)) contentType = 'image/jpeg';
        if (/\.jpe?g$|\.jfif$/i.test(file.originalname || '') && !contentType.startsWith('image/')) contentType = 'image/jpeg';
        const { error } = await cliente.storage.from(SUPABASE_BUCKET).upload(ruta, file.buffer, {
            contentType,
            upsert: false,
            cacheControl: '31536000'
        });
        if (error) throw new Error('Supabase Storage: ' + error.message);
        const { data } = cliente.storage.from(SUPABASE_BUCKET).getPublicUrl(ruta);
        return data.publicUrl;
    }
    return 'images/' + carpeta + '/' + (file && file.filename ? file.filename : nombreArchivoUnico(file.originalname));
}

/* ═══════════════════ RUTA API ═══════════════════ */

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Demasiadas peticiones. Por favor intenta de nuevo en unos minutos.' }
});

// Throttle de intentos de login por IP (protección contra fuerza bruta)
const loginThrottle = new Map();
const LOGIN_MAX = 20;
const LOGIN_WINDOW = 15 * 60 * 1000;
function loginPermitido(req) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    if (loginThrottle.size > 5000) {
        for (const [k, v] of loginThrottle) {
            if (now - v.t > LOGIN_WINDOW) loginThrottle.delete(k);
        }
    }
    const entry = loginThrottle.get(ip);
    if (!entry || now - entry.t > LOGIN_WINDOW) {
        loginThrottle.set(ip, { t: now, n: 1 });
        return true;
    }
    if (entry.n >= LOGIN_MAX) return false;
    entry.n += 1;
    return true;
}

app.post('/api', apiLimiter, parsearUpload, async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const action = req.body.action || '';

    try {
        switch (action) {

            /* ═══════════ DATOS PÚBLICOS ═══════════ */

            case 'get_anexos':
                return jsonOk(res, { anexos: ANEXOS_VITOR });

            case 'get_stats': {
                let totalOfertas = 4, totalDemandas = 2, totalAgricultores = 3;
                if (usarDBReal && pool) {
                    try {
                        totalOfertas = (await pool.query("SELECT COUNT(*)::int AS cnt FROM ofertas WHERE estado = 'disponible'"))[0][0].cnt;
                        totalDemandas = (await pool.query("SELECT COUNT(*)::int AS cnt FROM demandas WHERE estado = 'activa'"))[0][0].cnt;
                        totalAgricultores = (await pool.query("SELECT COUNT(*)::int AS cnt FROM usuarios WHERE tipo = 'productor'"))[0][0].cnt;
                    } catch (e) {}
                }
                return jsonOk(res, { ofertas: totalOfertas, demandas: totalDemandas, agricultores: totalAgricultores });
            }

            case 'get_ofertas': {
                const filtros = {};
                if (req.body.anexo) filtros.anexo = req.body.anexo;
                if (req.body.buscar) filtros.buscar = req.body.buscar;
                if (req.body.limit) filtros.limit = parseInt(req.body.limit);
                if (req.body.orden) filtros.orden = req.body.orden;
                const ofertas = await dbGetOfertas(filtros);
                return jsonOk(res, { ofertas });
            }

            case 'get_demandas': {
                const filtros = {};
                if (req.body.limit) filtros.limit = parseInt(req.body.limit);
                if (req.body.orden) filtros.orden = req.body.orden;
                const demandas = await dbGetDemandas(filtros);
                return jsonOk(res, { demandas });
            }

            case 'get_transportes': {
                const filtros = {};
                if (req.body.tipo) filtros.tipo = req.body.tipo;
                if (req.body.anexo) filtros.anexo = req.body.anexo;
                const transportes = await dbGetTransportes(filtros);
                return jsonOk(res, { transportes });
            }

            case 'get_session': {
                let u;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        u = rows.length > 0 ? rows[0] : null;
                    } catch (e) { u = null; }
                } else {
                    u = getLoggedUser(req);
                }

                if (u && typeof u.then === 'function') u = await u;
                if (u) {
                    const isAdmin = u.is_admin ? 1 : (req.session && req.session.is_admin ? 1 : 0);
                    return jsonOk(res, {
                        usuario: {
                            id: u.id, nombre: u.nombre, tipo: u.tipo,
                            anexo: u.anexo || '', email: u.email || '',
                            telefono: u.telefono || '', dni_ruc: u.dni_ruc || '',
                            is_admin: isAdmin
                        }
                    });
                }
                return jsonOk(res, { usuario: null });
            }

            /* ═══════════ AUTENTICACIÓN ═══════════ */

            case 'login': {
                const email = (req.body.email || '').toLowerCase().trim();
                const password = req.body.password || '';

                if (!email || !password) {
                    return jsonErr(res, 'Por favor ingresa tu correo/usuario y contraseña.');
                }

                if (!loginPermitido(req)) {
                    return jsonErr(res, 'Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo.');
                }

                if (usarDBReal && pool) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
                        const usuario = rows[0];
                        if (usuario && await bcrypt.compare(password, usuario.password)) {
                            req.session.usuario_id = usuario.id;
                            req.session.usuario_nombre = usuario.nombre;
                            req.session.usuario_tipo = usuario.tipo;
                            req.session.is_admin = usuario.is_admin ? 1 : 0;
                            const dest = usuario.is_admin ? 'admin.html' : 'perfil.html';
                            return jsonOk(res, { redirect: dest });
                        }
                        return jsonErr(res, 'Correo electrónico o contraseña incorrectos.');
                    } catch (e) {
                        return jsonErr(res, 'Error al verificar credenciales: ' + e.message);
                    }
                }

                // Demo mode
                if (email && password) {
                    req.session.usuario_id = 1;
                    req.session.usuario_nombre = 'Agropecuaria Don Mateo';
                    req.session.usuario_tipo = 'productor';
                    const esAdmin = (email === 'admin' && password === 'admin');
                    req.session.is_admin = esAdmin ? 1 : 0;
                    return jsonOk(res, { redirect: esAdmin ? 'admin.html' : 'perfil.html' });
                }
                return jsonErr(res, 'Credenciales incorrectas.');
            }

            case 'logout': {
                if (req.session) req.session.destroy();
                return jsonOk(res);
            }

            /* ═══════════ REGISTRO + VERIFICACIÓN ═══════════ */

            case 'registro_iniciar': {
                const nombre = (req.body.nombre || '').trim();
                const tipo = req.body.tipo || 'productor';
                const dni_ruc = (req.body.dni_ruc || '').trim();
                const telefono = (req.body.telefono || '').trim();
                const email = (req.body.email || '').trim();
                const anexo = (req.body.anexo || '').trim();
                const password = req.body.password || '';
                const confirm_password = req.body.confirm_password || '';

                const telefonoLimpio = telefono.replace(/[^0-9]/g, '');

                if (!nombre || !email || !password || !dni_ruc || !anexo) {
                    return jsonErr(res, 'Por favor selecciona tu Anexo y completa los datos obligatorios.');
                }
                if (!ANEXOS_VITOR.includes(anexo)) {
                    return jsonErr(res, 'El anexo seleccionado no es válido. Por favor elige uno de los 14 Anexos del Distrito de Valle de Vítor.');
                }
                if (telefonoLimpio.length !== 9) {
                    return jsonErr(res, 'El número de teléfono celular debe tener exactamente 9 dígitos numéricos (ej: 984512301).');
                }
                if (password !== confirm_password) {
                    return jsonErr(res, 'Las contraseñas ingresadas no coinciden.');
                }
                if (password.length < 6) {
                    return jsonErr(res, 'La contraseña debe tener al menos 6 caracteres.');
                }

                if (usarDBReal && pool) {
                    try {
                        const [check] = await pool.query('SELECT COUNT(*)::int AS cnt FROM usuarios WHERE email = ?', [email]);
                        if (check[0].cnt > 0) return jsonErr(res, 'El correo electrónico ya se encuentra registrado.');
                    } catch (e) {
                        return jsonErr(res, 'Error al verificar la base de datos: ' + e.message);
                    }
                }

                const codigo = String(Math.floor(100000 + Math.random() * 900000));
                req.session.registro_pendiente = {
                    nombre, tipo, dni_ruc, telefono: telefonoLimpio,
                    email, password, anexo,
                    codigo_verificacion: codigo,
                    expires_at: Date.now() + 600000
                };

                return jsonOk(res, { redirect: 'verificar-email.html' });
            }

            case 'get_registro_pendiente': {
                const r = req.session.registro_pendiente;
                if (!r) return jsonErr(res, 'No hay un registro pendiente de verificación.');
                return jsonOk(res, { email: r.email, codigo: r.codigo_verificacion, expira_en: Math.max(0, Math.floor((r.expires_at - Date.now()) / 1000)) });
            }

            case 'reenviar_codigo': {
                const r = req.session.registro_pendiente;
                if (!r) return jsonErr(res, 'No hay un registro pendiente de verificación.');
                const nuevo = String(Math.floor(100000 + Math.random() * 900000));
                r.codigo_verificacion = nuevo;
                r.expires_at = Date.now() + 600000;
                return jsonOk(res, { codigo: nuevo, email: r.email });
            }

            case 'verificar_codigo': {
                const r = req.session.registro_pendiente;
                if (!r) return jsonErr(res, 'No hay un registro pendiente de verificación.');
                const codigo = (req.body.codigo || '').trim();
                if (Date.now() > r.expires_at) return jsonErr(res, 'El código ha expirado. Por favor solicita uno nuevo.');
                if (codigo !== r.codigo_verificacion) return jsonErr(res, 'El código ingresado es incorrecto. Inténtalo de nuevo.');

                let nuevoId = Math.floor(100 + Math.random() * 900);
                if (usarDBReal && pool) {
                    try {
                        const hash = await bcrypt.hash(r.password, 10);
                        const [result] = await pool.query(
                            `INSERT INTO usuarios (nombre, tipo, dni_ruc, telefono, email, password, anexo, distrito, ciudad, verificado)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'Valle de Vítor', 'Arequipa', 1) RETURNING id`,
                            [r.nombre, r.tipo, r.dni_ruc, r.telefono, r.email, hash, r.anexo]
                        );
                        nuevoId = result.insertId;
                    } catch (e) {
                        return jsonErr(res, 'Error al guardar en la base de datos: ' + e.message);
                    }
                }

                delete req.session.registro_pendiente;
                req.session.usuario_id = nuevoId;
                req.session.usuario_nombre = r.nombre;
                req.session.usuario_tipo = r.tipo;

                return jsonOk(res, { redirect: 'perfil.html?msg=bienvenido' });
            }

            /* ═══════════ PERFIL ═══════════ */

            case 'get_perfil': {
                let usuario = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario) return jsonErr(res, 'No has iniciado sesión.');

                let misOfertas = [], misDemandas = [], misComentarios = [], comentariosRecibidos = [];
                if (usarDBReal && pool) {
                    try {
                        const [of] = await pool.query(
                            'SELECT o.*, u.nombre as productor, u.telefono FROM ofertas o JOIN usuarios u ON o.usuario_id = u.id WHERE o.usuario_id = ? ORDER BY o.fecha_publicacion DESC',
                            [usuario.id]
                        );
                        misOfertas = of;
                        const [dm] = await pool.query(
                            'SELECT d.*, u.nombre as comprador, u.telefono FROM demandas d JOIN usuarios u ON d.usuario_id = u.id WHERE d.usuario_id = ? ORDER BY d.fecha_publicacion DESC',
                            [usuario.id]
                        );
                        misDemandas = dm;

                        // Comentarios realizados por el usuario
                        const [mc] = await pool.query(
                            `SELECT c.*, 
                             CASE 
                                WHEN c.publicacion_tipo = 'oferta' THEN (SELECT producto FROM ofertas WHERE id = c.publicacion_id)
                                WHEN c.publicacion_tipo = 'demanda' THEN (SELECT producto FROM demandas WHERE id = c.publicacion_id)
                                WHEN c.publicacion_tipo = 'transporte' THEN (SELECT nombre FROM transportes WHERE id = c.publicacion_id)
                             END as publicacion_titulo
                             FROM comentarios c WHERE c.usuario_id = ? AND c.estado = 'activo' ORDER BY c.creado_en DESC`,
                            [usuario.id]
                        );
                        misComentarios = mc;

                        // Comentarios recibidos en publicaciones del usuario
                        const [cr] = await pool.query(
                            `SELECT c.*, u.nombre as autor_nombre, u.tipo as autor_tipo, u.anexo as autor_anexo,
                             CASE 
                                WHEN c.publicacion_tipo = 'oferta' THEN (SELECT producto FROM ofertas WHERE id = c.publicacion_id)
                                WHEN c.publicacion_tipo = 'demanda' THEN (SELECT producto FROM demandas WHERE id = c.publicacion_id)
                                WHEN c.publicacion_tipo = 'transporte' THEN (SELECT nombre FROM transportes WHERE id = c.publicacion_id)
                             END as publicacion_titulo
                             FROM comentarios c 
                             JOIN usuarios u ON c.usuario_id = u.id 
                             WHERE c.estado = 'activo' 
                               AND c.usuario_id != ?
                               AND (
                                 (c.publicacion_tipo = 'oferta' AND c.publicacion_id IN (SELECT id FROM ofertas WHERE usuario_id = ?))
                                 OR (c.publicacion_tipo = 'demanda' AND c.publicacion_id IN (SELECT id FROM demandas WHERE usuario_id = ?))
                                 OR (c.publicacion_tipo = 'transporte' AND c.publicacion_id IN (SELECT id FROM transportes WHERE usuario_id = ?))
                               )
                             ORDER BY c.creado_en DESC`,
                            [usuario.id, usuario.id, usuario.id, usuario.id]
                        );
                        comentariosRecibidos = cr;
                    } catch (e) {}
                } else {
                    misOfertas = DEMO_OFERTAS;
                    misDemandas = DEMO_DEMANDAS;
                    misComentarios = DEMO_COMENTARIOS.filter(c => c.usuario_id === usuario.id && c.estado === 'activo').map(c => ({
                        ...c,
                        publicacion_titulo: c.publicacion_tipo === 'oferta' ? (DEMO_OFERTAS.find(o => o.id === c.publicacion_id)?.producto || 'Oferta') : (DEMO_DEMANDAS.find(d => d.id === c.publicacion_id)?.producto || 'Demanda')
                    }));
                    comentariosRecibidos = DEMO_COMENTARIOS.filter(c => c.usuario_id !== usuario.id && c.estado === 'activo' && c.publicacion_id === 1).map(c => ({
                        ...c,
                        publicacion_titulo: c.publicacion_tipo === 'oferta' ? (DEMO_OFERTAS.find(o => o.id === c.publicacion_id)?.producto || 'Oferta') : (DEMO_DEMANDAS.find(d => d.id === c.publicacion_id)?.producto || 'Demanda')
                    }));
                }
                return jsonOk(res, { usuario, ofertas: misOfertas, demandas: misDemandas, mis_comentarios: misComentarios, comentarios_recibidos: comentariosRecibidos });
            }

            /* ═══════════ PUBLICAR OFERTA ═══════════ */

            case 'publicar_oferta': {
                let usuarioActual = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuarioActual = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuarioActual = getLoggedUser(req);
                    if (typeof usuarioActual?.then === 'function') usuarioActual = await usuarioActual;
                }
                if (!usuarioActual) return jsonErr(res, 'Debes iniciar sesión para publicar una oferta.');

                const producto = (req.body.producto || '').trim();
                const variedad = (req.body.variedad || '').trim();
                const cantidad_ton = parseFloat(req.body.cantidad_ton) || 0;
                const precio_kg = parseFloat(req.body.precio_kg) || 0;
                const anexo = (req.body.anexo || '').trim();
                const ubicacion = (req.body.ubicacion || '').trim();
                const fecha_cosecha = req.body.fecha_cosecha || new Date().toISOString().slice(0, 10);
                const es_organico = req.body.es_organico ? 1 : 0;
                const descripcion = (req.body.descripcion || '').trim();

                if (!producto || cantidad_ton <= 0 || precio_kg <= 0 || !anexo) {
                    return jsonErr(res, 'Por favor selecciona el Anexo de Valle de Vítor y completa los datos requeridos.');
                }
                if (!ANEXOS_VITOR.includes(anexo)) {
                    return jsonErr(res, 'Por favor selecciona un Anexo válido de Valle de Vítor.');
                }

                const imagenKeywords = {
                    'camote': 'images/automaticas/harvest_camote.jpg', 'batata': 'images/automaticas/harvest_camote.jpg',
                    'cebolla': 'images/automaticas/harvest_cebolla.jpg',
                    'sandia': 'images/automaticas/harvest_sandia.jpg', 'sandía': 'images/automaticas/harvest_sandia.jpg',
                    'melon': 'images/automaticas/harvest_melon.jpg', 'melón': 'images/automaticas/harvest_melon.jpg',
                    'aji': 'images/automaticas/harvest_aji_panca.jpg', 'ají': 'images/automaticas/harvest_aji_panca.jpg',
                    'panca': 'images/automaticas/harvest_aji_panca.jpg', 'paprika': 'images/automaticas/harvest_aji_panca.jpg',
                    'tomate': 'images/automaticas/harvest_tomate.jpg',
                    'choclo': 'images/automaticas/harvest_choclo.jpg', 'maiz': 'images/automaticas/harvest_choclo.jpg',
                    'maíz': 'images/automaticas/harvest_choclo.jpg', 'mazorca': 'images/automaticas/harvest_choclo.jpg',
                    'papa': 'images/automaticas/harvest_papa.jpg', 'patata': 'images/automaticas/harvest_papa.jpg',
                    'palta': 'images/automaticas/harvest_palta.jpg', 'aguacate': 'images/automaticas/harvest_palta.jpg',
                    'avocado': 'images/automaticas/harvest_palta.jpg',
                    'uva': 'images/automaticas/harvest_uva.jpg',
                };

                const poolDefault = Object.values(imagenKeywords);
                let imagenPath = poolDefault[Math.floor(Math.random() * poolDefault.length)];
                const productoLower = producto.toLowerCase();
                for (const [kw, img] of Object.entries(imagenKeywords)) {
                    if (productoLower.includes(kw)) { imagenPath = img; break; }
                }

                // Procesar foto adjunta (.jfif/.jpe se tratan como JPG)
                if (req.file) {
                    const ext = path.extname(req.file.originalname).toLowerCase();
                    const allowed = ['jpg', 'jpeg', 'jfif', 'jpe', 'png', 'webp', 'gif', 'heic', 'heif'];
                    if (!allowed.includes(ext.slice(1))) return jsonErr(res, 'Formato de imagen no permitido. Usa JPG, PNG o WEBP.');
                    if (req.file.size > 8 * 1024 * 1024) return jsonErr(res, 'La foto no puede superar los 8 MB.');
                    try {
                        imagenPath = await guardarImagenSubida(req.file, 'ofertas');
                    } catch (e) {
                        return jsonErr(res, 'No se pudo subir la imagen: ' + e.message);
                    }
                }

                if (usarDBReal && pool) {
                    try {
                        await pool.query(
                            `INSERT INTO ofertas (usuario_id, categoria_id, producto, variedad, cantidad_ton, precio_kg, anexo, ubicacion_chacra, fecha_cosecha, es_organico, descripcion, imagen, estado)
                             VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponible')`,
                            [usuarioActual.id, producto, variedad, cantidad_ton, precio_kg, anexo, ubicacion, fecha_cosecha, es_organico, descripcion, imagenPath]
                        );
                        return jsonOk(res, { redirect: 'agricultores.html', mensaje: `¡Cosecha publicada con éxito en el Anexo ${anexo} (Valle de Vítor)!` });
                    } catch (e) {
                        return jsonErr(res, 'Error al guardar en base de datos: ' + e.message);
                    }
                }

                // Fallback demo
                DEMO_OFERTAS.unshift({
                    id: Date.now(),
                    producto, variedad, cantidad_ton, precio_kg, anexo,
                    ubicacion_chacra: ubicacion, fecha_cosecha,
                    fecha_publicacion: new Date().toISOString().replace('T', ' ').slice(0, 19),
                    es_organico, descripcion, imagen: imagenPath,
                    productor: usuarioActual.nombre, telefono: usuarioActual.telefono || '+51 984 512 301',
                    calificacion: 5.0, verificado: 1
                });
                return jsonOk(res, { redirect: 'agricultores.html', mensaje: `¡Formulario validado! Cosecha de "${producto}" en Anexo ${anexo} lista para venta.` });
            }

            /* ═══════════ PUBLICAR DEMANDA ═══════════ */

            case 'publicar_demanda': {
                let usuarioActual = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuarioActual = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuarioActual = getLoggedUser(req);
                    if (typeof usuarioActual?.then === 'function') usuarioActual = await usuarioActual;
                }
                if (!usuarioActual) return jsonErr(res, 'Debes iniciar sesión para publicar una demanda.');

                const tipo_comprador = (req.body.tipo_comprador || '').trim();
                const producto = (req.body.producto || '').trim();
                const cantidad_ton = parseFloat(req.body.cantidad_ton) || 0;
                const precio_max_kg = parseFloat(req.body.precio_max_kg) || 0;
                const destino = (req.body.destino || '').trim();
                const fecha_cosecha = req.body.fecha_cosecha || new Date().toISOString().slice(0, 10);
                const urgencia = req.body.urgencia || 'Media';
                const descripcion = (req.body.descripcion || '').trim();

                if (!producto || cantidad_ton <= 0) return jsonErr(res, 'Por favor completa la información obligatoria.');

                if (usarDBReal && pool) {
                    try {
                        await pool.query(
                            `INSERT INTO demandas (usuario_id, tipo_comprador, producto, cantidad_ton, precio_max_kg, destino, fecha_cosecha, urgencia, descripcion, estado)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa')`,
                            [usuarioActual.id, tipo_comprador, producto, cantidad_ton, precio_max_kg, destino, fecha_cosecha, urgencia, descripcion]
                        );
                        return jsonOk(res, { redirect: 'compradores.html', mensaje: `¡Demanda publicada con éxito a nombre de ${usuarioActual.nombre}!` });
                    } catch (e) {
                        return jsonErr(res, 'Error al insertar en SQL: ' + e.message);
                    }
                }

                // Fallback demo
                DEMO_DEMANDAS.unshift({
                    id: Date.now(),
                    tipo_comprador, producto, cantidad_ton, precio_max_kg, destino,
                    fecha_cosecha,
                    fecha_publicacion: new Date().toISOString().replace('T', ' ').slice(0, 19),
                    urgencia, descripcion, comprador: usuarioActual.nombre,
                    telefono: usuarioActual.telefono || '+51 998 123 456',
                    calificacion: 4.9, verificado: 1
                });
                return jsonOk(res, { redirect: 'compradores.html', mensaje: `¡Demanda para "${producto}" registrada exitosamente!` });
            }

            /* ═══════════ EDITAR MIS PUBLICACIONES ═══════════ */

            case 'get_mi_publicacion': {
                let usuario = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario) return jsonErr(res, 'No has iniciado sesión.');

                const tipo = (req.body.tipo || '').trim();
                const id = parseInt(req.body.id) || 0;
                if (id <= 0) return jsonErr(res, 'Publicación inválida.');

                if (usarDBReal && pool) {
                    try {
                        if (tipo === 'oferta') {
                            const [rows] = await pool.query('SELECT o.* FROM ofertas o WHERE o.id = ? AND o.usuario_id = ?', [id, usuario.id]);
                            if (rows.length === 0) return jsonErr(res, 'No encontraste esta publicación o no te pertenece.');
                            return jsonOk(res, { tipo: 'oferta', publicacion: rows[0] });
                        } else if (tipo === 'demanda') {
                            const [rows] = await pool.query('SELECT d.* FROM demandas d WHERE d.id = ? AND d.usuario_id = ?', [id, usuario.id]);
                            if (rows.length === 0) return jsonErr(res, 'No encontraste esta publicación o no te pertenece.');
                            return jsonOk(res, { tipo: 'demanda', publicacion: rows[0] });
                        }
                    } catch (e) {
                        return jsonErr(res, 'Error al cargar la publicación: ' + e.message);
                    }
                } else {
                    if (tipo === 'oferta') {
                        const pub = DEMO_OFERTAS.find(o => o.id === id);
                        if (pub) return jsonOk(res, { tipo: 'oferta', publicacion: pub });
                    } else if (tipo === 'demanda') {
                        const pub = DEMO_DEMANDAS.find(d => d.id === id);
                        if (pub) return jsonOk(res, { tipo: 'demanda', publicacion: pub });
                    }
                }
                return jsonErr(res, 'Tipo de publicación no válido.');
            }

            case 'actualizar_oferta': {
                let usuarioActual = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuarioActual = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuarioActual = getLoggedUser(req);
                    if (typeof usuarioActual?.then === 'function') usuarioActual = await usuarioActual;
                }
                if (!usuarioActual) return jsonErr(res, 'Debes iniciar sesión para modificar una oferta.');

                const id = parseInt(req.body.id) || 0;
                if (id <= 0) return jsonErr(res, 'Oferta inválida.');

                const producto = (req.body.producto || '').trim();
                const variedad = (req.body.variedad || '').trim();
                const cantidad_ton = parseFloat(req.body.cantidad_ton) || 0;
                const precio_kg = parseFloat(req.body.precio_kg) || 0;
                const anexo = (req.body.anexo || '').trim();
                const ubicacion = (req.body.ubicacion || '').trim();
                const fecha_cosecha = req.body.fecha_cosecha || new Date().toISOString().slice(0, 10);
                const es_organico = req.body.es_organico ? 1 : 0;
                const descripcion = (req.body.descripcion || '').trim();

                if (!producto || cantidad_ton <= 0 || precio_kg <= 0 || !anexo) {
                    return jsonErr(res, 'Por favor selecciona el Anexo de Valle de Vítor y completa los datos requeridos.');
                }
                if (!ANEXOS_VITOR.includes(anexo)) {
                    return jsonErr(res, 'Por favor selecciona un Anexo válido de Valle de Vítor.');
                }

                if (usarDBReal && pool) {
                    const [chk] = await pool.query('SELECT * FROM ofertas WHERE id = ? AND usuario_id = ?', [id, usuarioActual.id]);
                    if (chk.length === 0) return jsonErr(res, 'No encontraste esta publicación o no te pertenece.');

                    let imagenPath = chk[0].imagen;
                    if (req.file) {
                        const ext = path.extname(req.file.originalname).toLowerCase();
                        const allowed = ['jpg', 'jpeg', 'jfif', 'jpe', 'png', 'webp', 'gif', 'heic', 'heif'];
                        if (!allowed.includes(ext.slice(1))) return jsonErr(res, 'Formato de imagen no permitido. Usa JPG, PNG o WEBP.');
                        if (req.file.size > 8 * 1024 * 1024) return jsonErr(res, 'La foto no puede superar los 8 MB.');
                        try {
                            imagenPath = await guardarImagenSubida(req.file, 'ofertas');
                        } catch (e) {
                            return jsonErr(res, 'No se pudo subir la imagen: ' + e.message);
                        }
                    }

                    try {
                        await pool.query(
                            `UPDATE ofertas SET categoria_id = 1, producto = ?, variedad = ?, cantidad_ton = ?, precio_kg = ?, anexo = ?,
                             ubicacion_chacra = ?, fecha_cosecha = ?, es_organico = ?, descripcion = ?, imagen = ?, estado = 'disponible'
                             WHERE id = ? AND usuario_id = ?`,
                            [producto, variedad, cantidad_ton, precio_kg, anexo, ubicacion, fecha_cosecha, es_organico, descripcion, imagenPath, id, usuarioActual.id]
                        );
                        return jsonOk(res, { redirect: 'perfil.html?msg=publicacion_actualizada', mensaje: '¡Tu cosecha fue actualizada con éxito!' });
                    } catch (e) {
                        return jsonErr(res, 'Error al actualizar la oferta: ' + e.message);
                    }
                } else {
                    const idx = DEMO_OFERTAS.findIndex(o => o.id === id);
                    if (idx !== -1) {
                        DEMO_OFERTAS[idx] = {
                            ...DEMO_OFERTAS[idx],
                            producto, variedad, cantidad_ton, precio_kg, anexo,
                            ubicacion_chacra: ubicacion, fecha_cosecha, es_organico, descripcion
                        };
                    }
                    return jsonOk(res, { redirect: 'perfil.html?msg=publicacion_actualizada', mensaje: '¡Tu cosecha fue actualizada con éxito!' });
                }
            }

            case 'actualizar_demanda': {
                let usuarioActual = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuarioActual = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuarioActual = getLoggedUser(req);
                    if (typeof usuarioActual?.then === 'function') usuarioActual = await usuarioActual;
                }
                if (!usuarioActual) return jsonErr(res, 'Debes iniciar sesión para modificar una demanda.');

                const id = parseInt(req.body.id) || 0;
                if (id <= 0) return jsonErr(res, 'Demanda inválida.');

                const tipo_comprador = (req.body.tipo_comprador || '').trim();
                const producto = (req.body.producto || '').trim();
                const cantidad_ton = parseFloat(req.body.cantidad_ton) || 0;
                const precio_max_kg = parseFloat(req.body.precio_max_kg) || 0;
                const destino = (req.body.destino || '').trim();
                const fecha_cosecha = req.body.fecha_cosecha || new Date().toISOString().slice(0, 10);
                const urgencia = req.body.urgencia || 'Media';
                const descripcion = (req.body.descripcion || '').trim();

                if (!producto || cantidad_ton <= 0) return jsonErr(res, 'Por favor completa la información obligatoria.');

                if (usarDBReal && pool) {
                    const [chk] = await pool.query('SELECT * FROM demandas WHERE id = ? AND usuario_id = ?', [id, usuarioActual.id]);
                    if (chk.length === 0) return jsonErr(res, 'No encontraste esta publicación o no te pertenece.');

                    try {
                        await pool.query(
                            `UPDATE demandas SET tipo_comprador = ?, producto = ?, cantidad_ton = ?, precio_max_kg = ?, destino = ?,
                             fecha_cosecha = ?, urgencia = ?, descripcion = ?, estado = 'activa' WHERE id = ? AND usuario_id = ?`,
                            [tipo_comprador, producto, cantidad_ton, precio_max_kg, destino, fecha_cosecha, urgencia, descripcion, id, usuarioActual.id]
                        );
                        return jsonOk(res, { redirect: 'perfil.html?msg=publicacion_actualizada', mensaje: '¡Tu demanda fue actualizada con éxito!' });
                    } catch (e) {
                        return jsonErr(res, 'Error al actualizar la demanda: ' + e.message);
                    }
                } else {
                    const idx = DEMO_DEMANDAS.findIndex(d => d.id === id);
                    if (idx !== -1) {
                        DEMO_DEMANDAS[idx] = {
                            ...DEMO_DEMANDAS[idx],
                            tipo_comprador, producto, cantidad_ton, precio_max_kg, destino,
                            fecha_cosecha, urgencia, descripcion
                        };
                    }
                    return jsonOk(res, { redirect: 'perfil.html?msg=publicacion_actualizada', mensaje: '¡Tu demanda fue actualizada con éxito!' });
                }
            }

            /* ═══════════ PUBLICAR TRANSPORTE ═══════════ */

            case 'publicar_transporte': {
                let usuarioActual = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuarioActual = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuarioActual = getLoggedUser(req);
                    if (typeof usuarioActual?.then === 'function') usuarioActual = await usuarioActual;
                }
                if (!usuarioActual) return jsonErr(res, 'Debes iniciar sesión para publicar un servicio de transporte.');

                const nombre = (req.body.nombre || '').trim();
                const tipo = req.body.tipo || 'camioneta';
                const telefono = (req.body.telefono || '').trim();
                const placa = (req.body.placa || '').trim();
                const anexo = (req.body.anexo || '').trim();
                const cobertura = (req.body.cobertura || '').trim();
                const descripcion = (req.body.descripcion || '').trim();

                const tiposValidos = ['camioneta', 'camion', 'motocarga'];
                const telefonoLimpio = telefono.replace(/[^0-9]/g, '');

                if (!nombre || !telefono) return jsonErr(res, 'Por favor completa el nombre del servicio y el número de contacto.');
                if (!tiposValidos.includes(tipo)) return jsonErr(res, 'El tipo de transporte seleccionado no es válido.');
                if (!anexo || !ANEXOS_VITOR.includes(anexo)) return jsonErr(res, 'Por favor selecciona un Anexo válido de Valle de Vítor.');

                if (usarDBReal && pool) {
                    try {
                        await pool.query(
                            `INSERT INTO transportes (usuario_id, nombre, tipo, telefono, placa, anexo, cobertura, descripcion, estado)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo')`,
                            [usuarioActual.id, nombre, tipo, telefonoLimpio, placa, anexo, cobertura, descripcion]
                        );
                        return jsonOk(res, { redirect: 'transporte.html?msg=publicado', mensaje: '¡Servicio de transporte publicado con éxito!' });
                    } catch (e) {
                        return jsonErr(res, 'Error al guardar en base de datos: ' + e.message);
                    }
                }
                return jsonOk(res, { redirect: 'transporte.html?msg=publicado', mensaje: `¡Formulario validado! Servicio de "${tipo}" registrado exitosamente.` });
            }

            /* ═══════════ SUBIR IMAGEN ═══════════ */

            case 'subir_imagen': {
                let usuarioActual = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuarioActual = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuarioActual = getLoggedUser(req);
                    if (typeof usuarioActual?.then === 'function') usuarioActual = await usuarioActual;
                }
                if (!usuarioActual) return jsonErr(res, 'Debes iniciar sesión para subir una imagen.');

                if (!req.file) return jsonErr(res, 'No se recibió ninguna imagen.');
                const tipo = req.body.tipo || 'ofertas';
                if (!['ofertas', 'publicidad'].includes(tipo)) return jsonErr(res, 'Carpeta de destino no válida.');
                try {
                    const imagen = await guardarImagenSubida(req.file, tipo);
                    return jsonOk(res, { imagen });
                } catch (e) {
                    return jsonErr(res, 'No se pudo subir la imagen: ' + e.message);
                }
            }

            /* ═══════════ PUBLICIDAD ═══════════ */

            case 'get_publicidad': {
                // Prioridad: configuración persistida en la BD (Supabase).
                if (usarDBReal && pool) {
                    try {
                        const [rows] = await pool.query("SELECT valor FROM configuracion WHERE clave = 'publicidad_json'");
                        if (rows.length > 0) {
                            const lista = JSON.parse(rows[0].valor);
                            if (Array.isArray(lista)) return jsonOk(res, { publicidad: lista });
                        }
                    } catch (e) {}
                }
                // Respaldo: archivo local (seed del proyecto / modo demo).
                const archivo = path.join(__dirname, 'data', 'publicidad.json');
                if (fs.existsSync(archivo)) {
                    try {
                        const contenido = fs.readFileSync(archivo, 'utf8');
                        const lista = JSON.parse(contenido);
                        if (Array.isArray(lista)) return jsonOk(res, { publicidad: lista });
                    } catch (e) {}
                }
                return jsonOk(res, { publicidad: [] });
            }

            case 'guardar_publicidad': {
                let usuario = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado. Solo el administrador puede configurar la publicidad.');

                const json = req.body.publicidad || '';
                let lista;
                try { lista = JSON.parse(json); } catch (e) { return jsonErr(res, 'Datos de publicidad inválidos.'); }
                if (!Array.isArray(lista)) return jsonErr(res, 'Datos de publicidad inválidos.');

                const dir = path.join(__dirname, 'data');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                try {
                    fs.writeFileSync(path.join(dir, 'publicidad.json'), JSON.stringify(lista, null, 4), 'utf8');
                } catch (e) {
                    return jsonErr(res, 'No se pudo guardar la publicidad en el servidor.');
                }
                // Persistir también en Supabase (configuracion) para sobrevivir a despliegues.
                if (usarDBReal && pool) {
                    try {
                        await pool.query(
                            `INSERT INTO configuracion (clave, valor, descripcion)
                             VALUES ('publicidad_json', ?, 'Publicidad de la plataforma (JSON)')
                             ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
                            [JSON.stringify(lista)]
                        );
                    } catch (e) {
                        return jsonErr(res, 'Publicidad guardada en disco pero no en la base de datos: ' + e.message);
                    }
                }
                return jsonOk(res, { mensaje: 'Publicidad sincronizada con el servidor.' });
            }

            /* ═══════════ COMENTARIOS ═══════════ */

            case 'get_comentarios': {
                const tipo = (req.body.publicacion_tipo || 'oferta').trim();
                const pubId = parseInt(req.body.publicacion_id) || 0;
                if (!pubId) return jsonErr(res, 'ID de publicación no proporcionado.');

                let comentarios = [];
                if (usarDBReal && pool) {
                    try {
                        const [rows] = await pool.query(
                            `SELECT c.*, u.nombre as autor_nombre, u.tipo as autor_tipo, u.anexo as autor_anexo,
                             u.foto as autor_foto, u.calificacion as autor_calificacion, u.is_admin as autor_is_admin
                             FROM comentarios c
                             JOIN usuarios u ON c.usuario_id = u.id
                             WHERE c.publicacion_tipo = ? AND c.publicacion_id = ? AND c.estado = 'activo'
                             ORDER BY c.creado_en ASC`,
                            [tipo, pubId]
                        );
                        comentarios = rows;
                    } catch (e) {
                        return jsonErr(res, 'Error al obtener comentarios: ' + e.message);
                    }
                } else {
                    comentarios = DEMO_COMENTARIOS.filter(c => c.publicacion_tipo === tipo && c.publicacion_id === pubId && c.estado === 'activo');
                }
                return jsonOk(res, { comentarios, total: comentarios.length });
            }

            case 'agregar_comentario': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario) return jsonErr(res, 'Debes iniciar sesión para publicar un comentario.');

                const tipo = (req.body.publicacion_tipo || 'oferta').trim();
                const pubId = parseInt(req.body.publicacion_id) || 0;
                const texto = (req.body.comentario || '').trim();

                if (!pubId) return jsonErr(res, 'ID de publicación no válido.');
                if (!texto || texto.length < 2) return jsonErr(res, 'El comentario no puede estar vacío.');
                if (texto.length > 1000) return jsonErr(res, 'El comentario excede el límite de 1000 caracteres.');

                let nuevoComentario = null;
                if (usarDBReal && pool) {
                    try {
                        const [resIns] = await pool.query(
                            'INSERT INTO comentarios (publicacion_tipo, publicacion_id, usuario_id, comentario, estado) VALUES (?, ?, ?, ?, \'activo\') RETURNING id',
                            [tipo, pubId, usuario.id, texto]
                        );
                        await logAccion(usuario.id, 'crear_comentario', 'comentarios', resIns.insertId, `Comentario en ${tipo} #${pubId}`, req);
                        nuevoComentario = {
                            id: resIns.insertId,
                            publicacion_tipo: tipo,
                            publicacion_id: pubId,
                            usuario_id: usuario.id,
                            autor_nombre: usuario.nombre,
                            autor_tipo: usuario.tipo,
                            autor_anexo: usuario.anexo,
                            comentario: texto,
                            creado_en: new Date().toISOString()
                        };
                    } catch (e) {
                        return jsonErr(res, 'Error al guardar comentario: ' + e.message);
                    }
                } else {
                    const nextId = DEMO_COMENTARIOS.length ? Math.max(...DEMO_COMENTARIOS.map(c => c.id)) + 1 : 1;
                    nuevoComentario = {
                        id: nextId,
                        publicacion_tipo: tipo,
                        publicacion_id: pubId,
                        usuario_id: usuario.id,
                        autor_nombre: usuario.nombre,
                        autor_tipo: usuario.tipo,
                        autor_anexo: usuario.anexo || 'Sotillo',
                        comentario: texto,
                        estado: 'activo',
                        creado_en: new Date().toISOString().replace('T', ' ').slice(0, 19)
                    };
                    DEMO_COMENTARIOS.push(nuevoComentario);
                }

                return jsonOk(res, { msg: 'Comentario publicado con éxito.', comentario: nuevoComentario });
            }

            case 'eliminar_comentario': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario) return jsonErr(res, 'Debes iniciar sesión.');

                const id = parseInt(req.body.id) || 0;
                if (!id) return jsonErr(res, 'ID de comentario inválido.');

                if (usarDBReal && pool) {
                    try {
                        const [chk] = await pool.query('SELECT * FROM comentarios WHERE id = ?', [id]);
                        if (chk.length === 0) return jsonErr(res, 'Comentario no encontrado.');
                        if (chk[0].usuario_id !== usuario.id && !usuario.is_admin) {
                            return jsonErr(res, 'No tienes permiso para eliminar este comentario.');
                        }
                        await pool.query('DELETE FROM comentarios WHERE id = ?', [id]);
                        await logAccion(usuario.id, 'eliminar_comentario', 'comentarios', id, `Comentario #${id} eliminado`, req);
                    } catch (e) {
                        return jsonErr(res, 'Error al eliminar comentario: ' + e.message);
                    }
                } else {
                    const idx = DEMO_COMENTARIOS.findIndex(c => c.id === id);
                    if (idx !== -1) {
                        if (DEMO_COMENTARIOS[idx].usuario_id !== usuario.id && !usuario.is_admin) {
                            return jsonErr(res, 'No tienes permiso para eliminar este comentario.');
                        }
                        DEMO_COMENTARIOS.splice(idx, 1);
                    }
                }

                return jsonOk(res, { msg: 'Comentario eliminado correctamente.' });
            }

            case 'get_mis_comentarios': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario) return jsonErr(res, 'Debes iniciar sesión.');

                let misComentarios = [], comentariosRecibidos = [];
                if (usarDBReal && pool) {
                    try {
                        const [mc] = await pool.query(
                            `SELECT c.*, 
                             CASE 
                                WHEN c.publicacion_tipo = 'oferta' THEN (SELECT producto FROM ofertas WHERE id = c.publicacion_id)
                                WHEN c.publicacion_tipo = 'demanda' THEN (SELECT producto FROM demandas WHERE id = c.publicacion_id)
                                WHEN c.publicacion_tipo = 'transporte' THEN (SELECT nombre FROM transportes WHERE id = c.publicacion_id)
                             END as publicacion_titulo
                             FROM comentarios c WHERE c.usuario_id = ? AND c.estado = 'activo' ORDER BY c.creado_en DESC`,
                            [usuario.id]
                        );
                        misComentarios = mc;

                        const [cr] = await pool.query(
                            `SELECT c.*, u.nombre as autor_nombre, u.tipo as autor_tipo, u.anexo as autor_anexo,
                             CASE 
                                WHEN c.publicacion_tipo = 'oferta' THEN (SELECT producto FROM ofertas WHERE id = c.publicacion_id)
                                WHEN c.publicacion_tipo = 'demanda' THEN (SELECT producto FROM demandas WHERE id = c.publicacion_id)
                                WHEN c.publicacion_tipo = 'transporte' THEN (SELECT nombre FROM transportes WHERE id = c.publicacion_id)
                             END as publicacion_titulo
                             FROM comentarios c 
                             JOIN usuarios u ON c.usuario_id = u.id 
                             WHERE c.estado = 'activo' 
                               AND c.usuario_id != ?
                               AND (
                                 (c.publicacion_tipo = 'oferta' AND c.publicacion_id IN (SELECT id FROM ofertas WHERE usuario_id = ?))
                                 OR (c.publicacion_tipo = 'demanda' AND c.publicacion_id IN (SELECT id FROM demandas WHERE usuario_id = ?))
                                 OR (c.publicacion_tipo = 'transporte' AND c.publicacion_id IN (SELECT id FROM transportes WHERE usuario_id = ?))
                               )
                             ORDER BY c.creado_en DESC`,
                            [usuario.id, usuario.id, usuario.id, usuario.id]
                        );
                        comentariosRecibidos = cr;
                    } catch (e) {}
                } else {
                    misComentarios = DEMO_COMENTARIOS.filter(c => c.usuario_id === usuario.id && c.estado === 'activo');
                    comentariosRecibidos = DEMO_COMENTARIOS.filter(c => c.usuario_id !== usuario.id && c.estado === 'activo');
                }

                return jsonOk(res, { mis_comentarios: misComentarios, comentarios_recibidos: comentariosRecibidos });
            }

            /* ═══════════ REPORTES ═══════════ */

            case 'crear_reporte': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario) return jsonErr(res, 'Debes iniciar sesión para reportar un contenido.');

                const tipoObjetivo = (req.body.tipo_objetivo || 'publicacion').trim();
                const pubTipo = (req.body.publicacion_tipo || 'oferta').trim();
                const pubId = parseInt(req.body.publicacion_id) || null;
                const comId = parseInt(req.body.comentario_id) || null;
                const motivo = (req.body.motivo || '').trim();
                const detalles = (req.body.detalles || '').trim();

                if (!motivo) return jsonErr(res, 'Debes seleccionar un motivo para el reporte.');
                if (tipoObjetivo === 'publicacion' && !pubId) return jsonErr(res, 'ID de publicación no especificado.');
                if (tipoObjetivo === 'comentario' && !comId) return jsonErr(res, 'ID de comentario no especificado.');

                if (usarDBReal && pool) {
                    try {
                        const [resIns] = await pool.query(
                            `INSERT INTO reportes (tipo_objetivo, publicacion_tipo, publicacion_id, comentario_id, usuario_reportante_id, motivo, detalles, estado)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente') RETURNING id`,
                            [tipoObjetivo, pubTipo, pubId, comId, usuario.id, motivo, detalles]
                        );
                        await logAccion(usuario.id, 'crear_reporte', 'reportes', resIns.insertId, `Reporte ${tipoObjetivo} motivo: ${motivo}`, req);
                    } catch (e) {
                        return jsonErr(res, 'Error al registrar reporte: ' + e.message);
                    }
                } else {
                    const nextId = DEMO_REPORTES.length ? Math.max(...DEMO_REPORTES.map(r => r.id)) + 1 : 1;
                    DEMO_REPORTES.push({
                        id: nextId,
                        tipo_objetivo: tipoObjetivo,
                        publicacion_tipo: pubTipo,
                        publicacion_id: pubId,
                        comentario_id: comId,
                        usuario_reportante_id: usuario.id,
                        reportante_nombre: usuario.nombre,
                        reportante_email: usuario.email,
                        motivo,
                        detalles,
                        estado: 'pendiente',
                        creado_en: new Date().toISOString().replace('T', ' ').slice(0, 19)
                    });
                }

                return jsonOk(res, { msg: 'Reporte enviado al Administrador con éxito. Revisaremos el caso a la brevedad.' });
            }

            /* ═══════════ ADMINISTRACIÓN ═══════════ */

            case 'admin_stats': {
                let usuario = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');

                const stats = {};
                try {
                    stats.usuarios = (await pool.query("SELECT COUNT(*)::int AS cnt FROM usuarios WHERE is_admin = 0"))[0][0].cnt;
                    stats.productores = (await pool.query("SELECT COUNT(*)::int AS cnt FROM usuarios WHERE tipo = 'productor' AND is_admin = 0"))[0][0].cnt;
                    stats.compradores = (await pool.query("SELECT COUNT(*)::int AS cnt FROM usuarios WHERE tipo = 'comprador'"))[0][0].cnt;
                    stats.transportistas = (await pool.query("SELECT COUNT(*)::int AS cnt FROM usuarios WHERE tipo = 'transportista'"))[0][0].cnt;
                    stats.ofertas = (await pool.query("SELECT COUNT(*)::int AS cnt FROM ofertas"))[0][0].cnt;
                    stats.demandas = (await pool.query("SELECT COUNT(*)::int AS cnt FROM demandas"))[0][0].cnt;
                    stats.ofertas_act = (await pool.query("SELECT COUNT(*)::int AS cnt FROM ofertas WHERE estado = 'disponible'"))[0][0].cnt;
                    stats.demandas_act = (await pool.query("SELECT COUNT(*)::int AS cnt FROM demandas WHERE estado = 'activa'"))[0][0].cnt;
                    stats.transportes = (await pool.query("SELECT COUNT(*)::int AS cnt FROM transportes"))[0][0].cnt;
                    stats.transportes_act = (await pool.query("SELECT COUNT(*)::int AS cnt FROM transportes WHERE estado = 'activo'"))[0][0].cnt;
                    stats.categorias = (await pool.query("SELECT COUNT(*)::int AS cnt FROM categorias"))[0][0].cnt;
                    stats.mensajes = (await pool.query("SELECT COUNT(*)::int AS cnt FROM mensajes"))[0][0].cnt;
                    stats.logs = (await pool.query("SELECT COUNT(*)::int AS cnt FROM logs_sistema"))[0][0].cnt;
                    stats.publicidad = (await pool.query("SELECT COUNT(*)::int AS cnt FROM publicidad WHERE activa = 1"))[0][0].cnt;
                    stats.verificaciones = (await pool.query("SELECT COUNT(*)::int AS cnt FROM verificaciones WHERE usado = 0 AND expira_en > NOW()"))[0][0].cnt;
                    stats.reportes_pendientes = (await pool.query("SELECT COUNT(*)::int AS cnt FROM reportes WHERE estado = 'pendiente'"))[0][0].cnt;
                    stats.comentarios = (await pool.query("SELECT COUNT(*)::int AS cnt FROM comentarios WHERE estado = 'activo'"))[0][0].cnt;
                } catch (e) {
                    return jsonErr(res, 'Error al cargar datos: ' + e.message);
                }
                return jsonOk(res, { stats });
            }

            case 'admin_reportes': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');

                let reportes = [];
                if (usarDBReal && pool) {
                    try {
                        const [rows] = await pool.query(`
                            SELECT r.*, 
                                   u.nombre as reportante_nombre, u.email as reportante_email, u.telefono as reportante_telefono,
                                   c.comentario as comentario_texto, c.usuario_id as comentario_autor_id,
                                   cu.nombre as comentario_autor_nombre,
                                   CASE 
                                      WHEN r.publicacion_tipo = 'oferta' THEN (SELECT producto FROM ofertas WHERE id = r.publicacion_id)
                                      WHEN r.publicacion_tipo = 'demanda' THEN (SELECT producto FROM demandas WHERE id = r.publicacion_id)
                                      WHEN r.publicacion_tipo = 'transporte' THEN (SELECT nombre FROM transportes WHERE id = r.publicacion_id)
                                   END as item_titulo,
                                   CASE 
                                      WHEN r.publicacion_tipo = 'oferta' THEN (SELECT u2.nombre FROM ofertas o2 JOIN usuarios u2 ON o2.usuario_id = u2.id WHERE o2.id = r.publicacion_id)
                                      WHEN r.publicacion_tipo = 'demanda' THEN (SELECT u3.nombre FROM demandas d3 JOIN usuarios u3 ON d3.usuario_id = u3.id WHERE d3.id = r.publicacion_id)
                                      WHEN r.publicacion_tipo = 'transporte' THEN (SELECT u4.nombre FROM transportes t4 JOIN usuarios u4 ON t4.usuario_id = u4.id WHERE t4.id = r.publicacion_id)
                                   END as item_autor
                            FROM reportes r
                            JOIN usuarios u ON r.usuario_reportante_id = u.id
                            LEFT JOIN comentarios c ON r.comentario_id = c.id
                            LEFT JOIN usuarios cu ON c.usuario_id = cu.id
                            ORDER BY (r.estado = 'pendiente') DESC, r.creado_en DESC
                        `);
                        reportes = rows;
                    } catch (e) {
                        return jsonErr(res, 'Error al obtener reportes: ' + e.message);
                    }
                } else {
                    reportes = [...DEMO_REPORTES];
                }

                return jsonOk(res, { reportes });
            }

            case 'admin_resolver_reporte': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');

                const id = parseInt(req.body.id) || 0;
                const accion = (req.body.accion || '').trim(); // 'validar' | 'descartar'
                const nota = (req.body.nota || '').trim();
                const accionAdicional = (req.body.accion_adicional || 'ninguna').trim(); // 'eliminar_elemento', 'desactivar_usuario'

                if (!id) return jsonErr(res, 'ID de reporte inválido.');
                if (accion !== 'validar' && accion !== 'descartar') return jsonErr(res, 'Acción no válida.');

                const nuevoEstado = accion === 'validar' ? 'validado' : 'descartado';

                if (usarDBReal && pool) {
                    try {
                        const [repRows] = await pool.query('SELECT * FROM reportes WHERE id = ?', [id]);
                        if (repRows.length === 0) return jsonErr(res, 'Reporte no encontrado.');
                        const rep = repRows[0];

                        await pool.query(
                            'UPDATE reportes SET estado = ?, resolucion_nota = ?, admin_id = ?, resuelto_en = NOW() WHERE id = ?',
                            [nuevoEstado, nota, usuario.id, id]
                        );

                        // Si valida el reporte y solicita eliminar el elemento reportado
                        if (accion === 'validar') {
                            if (accionAdicional === 'eliminar_elemento' || accionAdicional === 'ambas') {
                                if (rep.tipo_objetivo === 'comentario' && rep.comentario_id) {
                                    await pool.query('DELETE FROM comentarios WHERE id = ?', [rep.comentario_id]);
                                    await logAccion(usuario.id, 'eliminar_comentario_reporte', 'comentarios', rep.comentario_id, `Eliminado por reporte #${id}`, req);
                                } else if (rep.tipo_objetivo === 'publicacion' && rep.publicacion_id) {
                                    if (rep.publicacion_tipo === 'oferta') {
                                        await pool.query('DELETE FROM ofertas WHERE id = ?', [rep.publicacion_id]);
                                    } else if (rep.publicacion_tipo === 'demanda') {
                                        await pool.query('DELETE FROM demandas WHERE id = ?', [rep.publicacion_id]);
                                    } else if (rep.publicacion_tipo === 'transporte') {
                                        await pool.query('DELETE FROM transportes WHERE id = ?', [rep.publicacion_id]);
                                    }
                                    await logAccion(usuario.id, 'eliminar_publicacion_reporte', rep.publicacion_tipo + 's', rep.publicacion_id, `Eliminado por reporte #${id}`, req);
                                }
                            }
                        }

                        await logAccion(usuario.id, 'resolver_reporte', 'reportes', id, `Reporte #${id} marcado como ${nuevoEstado}`, req);
                    } catch (e) {
                        return jsonErr(res, 'Error al resolver reporte: ' + e.message);
                    }
                } else {
                    const r = DEMO_REPORTES.find(item => item.id === id);
                    if (r) {
                        r.estado = nuevoEstado;
                        r.resolucion_nota = nota;
                        r.admin_id = usuario.id;
                        r.resuelto_en = new Date().toISOString();

                        if (accion === 'validar' && accionAdicional === 'eliminar_elemento') {
                            if (r.tipo_objetivo === 'comentario' && r.comentario_id) {
                                const cIdx = DEMO_COMENTARIOS.findIndex(c => c.id === r.comentario_id);
                                if (cIdx !== -1) DEMO_COMENTARIOS.splice(cIdx, 1);
                            }
                        }
                    }
                }

                return jsonOk(res, { msg: `Reporte #${id} ${nuevoEstado === 'validado' ? 'validado' : 'descartado'} con éxito.` });
            }

            case 'admin_usuarios': {
                let usuario = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [users] = await pool.query("SELECT id, nombre, tipo, email, telefono, anexo, is_admin, verificado, fecha_registro FROM usuarios ORDER BY is_admin DESC, id ASC");
                return jsonOk(res, { usuarios: users });
            }

            case 'admin_ofertas': {
                let usuario = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [ofertas] = await pool.query(
                    `SELECT o.id, o.producto, o.variedad, o.cantidad_ton, o.precio_kg, o.anexo, o.estado, o.fecha_publicacion, u.nombre as productor
                     FROM ofertas o JOIN usuarios u ON o.usuario_id = u.id ORDER BY o.fecha_publicacion DESC`
                );
                return jsonOk(res, { ofertas });
            }

            case 'admin_demandas': {
                let usuario = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [demandas] = await pool.query(
                    `SELECT d.id, d.tipo_comprador, d.producto, d.cantidad_ton, d.precio_max_kg, d.urgencia, d.estado, d.fecha_publicacion, u.nombre as comprador
                     FROM demandas d JOIN usuarios u ON d.usuario_id = u.id ORDER BY d.fecha_publicacion DESC`
                );
                return jsonOk(res, { demandas });
            }

            case 'admin_transportes': {
                let usuario = null;
                if (usarDBReal && pool && req.session && req.session.usuario_id) {
                    try {
                        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                        usuario = rows.length > 0 ? rows[0] : null;
                    } catch (e) {}
                } else {
                    usuario = getLoggedUser(req);
                    if (typeof usuario?.then === 'function') usuario = await usuario;
                }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [transportes] = await pool.query(
                    `SELECT t.id, t.nombre, t.tipo, t.telefono, t.placa, t.anexo, t.cobertura, t.estado, t.fecha_registro, u.nombre as usuario_nombre
                     FROM transportes t JOIN usuarios u ON t.usuario_id = u.id ORDER BY t.fecha_registro DESC`
                );
                return jsonOk(res, { transportes });
            }

            /* ═══════════ PUBLICIDAD (BD) ═══════════ */

            case 'get_publicidad_bd': {
                if (!usarDBReal || !pool) {
                    const archivo = path.join(__dirname, 'data', 'publicidad.json');
                    if (fs.existsSync(archivo)) {
                        try {
                            const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
                            if (Array.isArray(lista)) return jsonOk(res, { publicidad: lista });
                        } catch (e) {}
                    }
                    return jsonOk(res, { publicidad: [] });
                }
                const [pubs] = await pool.query('SELECT * FROM publicidad WHERE activa = 1 ORDER BY orden ASC');
                return jsonOk(res, { publicidad: pubs });
            }

            case 'admin_publicidad': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [pubs] = await pool.query('SELECT * FROM publicidad ORDER BY orden ASC, id ASC');
                return jsonOk(res, { publicidad: pubs });
            }

            case 'admin_guardar_publicidad': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const id = parseInt(req.body.id) || 0;
                const titulo = (req.body.titulo || '').trim();
                const descripcion = (req.body.descripcion || '').trim();
                const imagen = (req.body.imagen || '').trim();
                const enlace = (req.body.enlace || '').trim();
                const ubicacion = req.body.ubicacion || 'inicio';
                const activa = req.body.activa !== undefined ? (req.body.activa ? 1 : 0) : 1;
                const orden = parseInt(req.body.orden) || 0;
                if (!titulo || !imagen) return jsonErr(res, 'Título e imagen son obligatorios.');
                if (id > 0) {
                    await pool.query('UPDATE publicidad SET titulo=?, descripcion=?, imagen=?, enlace=?, ubicacion=?, activa=?, orden=? WHERE id=?',
                        [titulo, descripcion, imagen, enlace, ubicacion, activa, orden, id]);
                } else {
                    await pool.query('INSERT INTO publicidad (titulo, descripcion, imagen, enlace, ubicacion, activa, orden) VALUES (?,?,?,?,?,?,?)',
                        [titulo, descripcion, imagen, enlace, ubicacion, activa, orden]);
                }
                await logAccion(usuario.id, id > 0 ? 'editar_publicidad' : 'crear_publicidad', 'publicidad', id || null, titulo, req);
                return jsonOk(res, { msg: 'Publicidad guardada correctamente.' });
            }

            case 'admin_eliminar_publicidad': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const id = parseInt(req.body.id) || 0;
                if (id <= 0) return jsonErr(res, 'ID inválido.');
                await pool.query('DELETE FROM publicidad WHERE id = ?', [id]);
                await logAccion(usuario.id, 'eliminar_publicidad', 'publicidad', id, null, req);
                return jsonOk(res, { msg: 'Publicidad eliminada.' });
            }

            /* ═══════════ MENSAJES ═══════════ */

            case 'admin_mensajes': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [msgs] = await pool.query(
                    `SELECT m.*, e.nombre as emisor_nombre, r.nombre as receptor_nombre
                     FROM mensajes m
                     LEFT JOIN usuarios e ON m.emisor_id = e.id
                     LEFT JOIN usuarios r ON m.receptor_id = r.id
                     ORDER BY m.creado_en DESC LIMIT 200`
                );
                return jsonOk(res, { mensajes: msgs });
            }

            case 'enviar_mensaje': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario) return jsonErr(res, 'Debes iniciar sesión.');
                const asunto = (req.body.asunto || '').trim();
                const mensaje = (req.body.mensaje || '').trim();
                const receptorId = parseInt(req.body.receptor_id) || null;
                if (!asunto || !mensaje) return jsonErr(res, 'Asunto y mensaje son obligatorios.');
                await pool.query(
                    'INSERT INTO mensajes (emisor_id, receptor_id, asunto, mensaje, tipo) VALUES (?,?,?,?,?)',
                    [usuario.id, receptorId, asunto, mensaje, req.body.tipo || 'contacto']
                );
                return jsonOk(res, { msg: 'Mensaje enviado.' });
            }

            case 'admin_eliminar_mensaje': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const id = parseInt(req.body.id) || 0;
                if (id <= 0) return jsonErr(res, 'ID inválido.');
                await pool.query('DELETE FROM mensajes WHERE id = ?', [id]);
                return jsonOk(res, { msg: 'Mensaje eliminado.' });
            }

            /* ═══════════ LOGS / AUDITORÍA ═══════════ */

            case 'admin_logs': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const limit = parseInt(req.body.limit) || 100;
                const [logs] = await pool.query(
                    `SELECT l.*, u.nombre as usuario_nombre
                     FROM logs_sistema l LEFT JOIN usuarios u ON l.usuario_id = u.id
                     ORDER BY l.creado_en DESC LIMIT ?`, [limit]
                );
                return jsonOk(res, { logs });
            }

            case 'admin_limpiar_logs': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                await pool.query('TRUNCATE TABLE logs_sistema');
                return jsonOk(res, { msg: 'Logs del sistema limpiados.' });
            }

            /* ═══════════ CONFIGURACIÓN ═══════════ */

            case 'admin_configuracion': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [configs] = await pool.query('SELECT * FROM configuracion ORDER BY id ASC');
                return jsonOk(res, { configuracion: configs });
            }

            case 'admin_guardar_configuracion': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const clave = (req.body.clave || '').trim();
                const valor = (req.body.valor || '').trim();
                const descripcion = (req.body.descripcion || '').trim();
                if (!clave || !valor) return jsonErr(res, 'Clave y valor son obligatorios.');
                const [existe] = await pool.query('SELECT id FROM configuracion WHERE clave = ?', [clave]);
                if (existe.length > 0) {
                    await pool.query('UPDATE configuracion SET valor=?, descripcion=? WHERE clave=?', [valor, descripcion, clave]);
                } else {
                    await pool.query('INSERT INTO configuracion (clave, valor, descripcion) VALUES (?,?,?)', [clave, valor, descripcion]);
                }
                await logAccion(usuario.id, 'editar_configuracion', 'configuracion', null, `${clave}=${valor}`, req);
                return jsonOk(res, { msg: 'Configuración guardada.' });
            }

            /* ═══════════ VERIFICACIONES ═══════════ */

            case 'admin_verificaciones': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [vers] = await pool.query(
                    `SELECT v.*, u.nombre as usuario_nombre FROM verificaciones v
                     LEFT JOIN usuarios u ON v.usuario_id = u.id
                     ORDER BY v.creado_en DESC LIMIT 100`
                );
                return jsonOk(res, { verificaciones: vers });
            }

            /* ═══════════ CATEGORÍAS CRUD ═══════════ */

            case 'admin_categorias': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const [cats] = await pool.query('SELECT * FROM categorias ORDER BY id ASC');
                return jsonOk(res, { categorias: cats });
            }

            case 'admin_guardar_categoria': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const id = parseInt(req.body.id) || 0;
                const nombre = (req.body.nombre || '').trim();
                const icono = (req.body.icono || '').trim();
                if (!nombre || !icono) return jsonErr(res, 'Nombre e ícono son obligatorios.');
                if (id > 0) {
                    await pool.query('UPDATE categorias SET nombre=?, icono=? WHERE id=?', [nombre, icono, id]);
                } else {
                    await pool.query('INSERT INTO categorias (nombre, icono) VALUES (?,?)', [nombre, icono]);
                }
                return jsonOk(res, { msg: 'Categoría guardada.' });
            }

            case 'admin_eliminar_categoria': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');
                const id = parseInt(req.body.id) || 0;
                if (id <= 0) return jsonErr(res, 'ID inválido.');
                const [enUso] = await pool.query('SELECT COUNT(*)::int AS cnt FROM ofertas WHERE categoria_id = ?', [id]);
                if (enUso[0].cnt > 0) return jsonErr(res, 'No se puede eliminar: hay ofertas usando esta categoría.');
                await pool.query('DELETE FROM categorias WHERE id = ?', [id]);
                return jsonOk(res, { msg: 'Categoría eliminada.' });
            }

            /* ═══════════ ACCIONES ADMIN ADICIONALES ═══════════ */

            case 'admin_accion': {
                let usuario = null;
                if (usarDBReal && pool && req.session?.usuario_id) {
                    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario_id]);
                    usuario = rows.length > 0 ? rows[0] : null;
                } else { usuario = getLoggedUser(req); if (typeof usuario?.then === 'function') usuario = await usuario; }
                if (!usuario || !usuario.is_admin) return jsonErr(res, 'Acceso denegado.');
                if (!usarDBReal || !pool) return jsonErr(res, 'Base de datos no disponible.');

                const accion = (req.body.accion || '').trim();
                const id = parseInt(req.body.id) || 0;

                try {
                    // === USUARIOS ===
                    if (accion === 'delete_usuario' && id > 0) {
                        const [chk] = await pool.query('SELECT is_admin, nombre FROM usuarios WHERE id = ?', [id]);
                        if (chk.length > 0 && chk[0].is_admin === 1) return jsonErr(res, 'No se puede eliminar al Administrador.');
                        await pool.query('DELETE FROM usuarios WHERE id = ? AND is_admin = 0', [id]);
                        await logAccion(usuario.id, 'eliminar_usuario', 'usuarios', id, chk[0]?.nombre, req);
                        return jsonOk(res, { msg: `Usuario #${id} eliminado.` });
                    } else if (accion === 'toggle_usuario' && id > 0) {
                        await pool.query("UPDATE usuarios SET activo = CASE WHEN activo = 1 THEN 0 ELSE 1 END WHERE id = ? AND is_admin = 0", [id]);
                        return jsonOk(res, { msg: `Usuario #${id} activado/desactivado.` });
                    } else if (accion === 'toggle_verificado' && id > 0) {
                        await pool.query("UPDATE usuarios SET verificado = CASE WHEN verificado = 1 THEN 0 ELSE 1 END WHERE id = ? AND is_admin = 0", [id]);
                        return jsonOk(res, { msg: `Verificación de usuario #${id} cambiada.` });
                    }
                    // === OFERTAS ===
                    else if (accion === 'delete_oferta' && id > 0) {
                        await pool.query('DELETE FROM ofertas WHERE id = ?', [id]);
                        await logAccion(usuario.id, 'eliminar_oferta', 'ofertas', id, null, req);
                        return jsonOk(res, { msg: `Oferta #${id} eliminada.` });
                    } else if (accion === 'pausar_oferta' && id > 0) {
                        await pool.query("UPDATE ofertas SET estado = 'pausado' WHERE id = ?", [id]);
                        return jsonOk(res, { msg: `Oferta #${id} pausada.` });
                    } else if (accion === 'activar_oferta' && id > 0) {
                        await pool.query("UPDATE ofertas SET estado = 'disponible' WHERE id = ?", [id]);
                        return jsonOk(res, { msg: `Oferta #${id} activada.` });
                    } else if (accion === 'vendida_oferta' && id > 0) {
                        await pool.query("UPDATE ofertas SET estado = 'vendido' WHERE id = ?", [id]);
                        return jsonOk(res, { msg: `Oferta #${id} marcada como vendida.` });
                    }
                    // === DEMANDAS ===
                    else if (accion === 'delete_demanda' && id > 0) {
                        await pool.query('DELETE FROM demandas WHERE id = ?', [id]);
                        await logAccion(usuario.id, 'eliminar_demanda', 'demandas', id, null, req);
                        return jsonOk(res, { msg: `Demanda #${id} eliminada.` });
                    } else if (accion === 'cancelar_demanda' && id > 0) {
                        await pool.query("UPDATE demandas SET estado = 'cancelada' WHERE id = ?", [id]);
                        return jsonOk(res, { msg: `Demanda #${id} cancelada.` });
                    } else if (accion === 'activar_demanda' && id > 0) {
                        await pool.query("UPDATE demandas SET estado = 'activa' WHERE id = ?", [id]);
                        return jsonOk(res, { msg: `Demanda #${id} activada.` });
                    } else if (accion === 'completar_demanda' && id > 0) {
                        await pool.query("UPDATE demandas SET estado = 'completada' WHERE id = ?", [id]);
                        return jsonOk(res, { msg: `Demanda #${id} completada.` });
                    }
                    // === TRANSPORTES ===
                    else if (accion === 'delete_transporte' && id > 0) {
                        await pool.query('DELETE FROM transportes WHERE id = ?', [id]);
                        await logAccion(usuario.id, 'eliminar_transporte', 'transportes', id, null, req);
                        return jsonOk(res, { msg: `Transporte #${id} eliminado.` });
                    } else if (accion === 'pausar_transporte' && id > 0) {
                        await pool.query("UPDATE transportes SET estado = 'inactivo' WHERE id = ?", [id]);
                        return jsonOk(res, { msg: `Transporte #${id} pausado.` });
                    } else if (accion === 'activar_transporte' && id > 0) {
                        await pool.query("UPDATE transportes SET estado = 'activo' WHERE id = ?", [id]);
                        return jsonOk(res, { msg: `Transporte #${id} reactivado.` });
                    }
                } catch (e) {
                    return jsonErr(res, 'Error en la operación: ' + e.message);
                }
                return jsonErr(res, 'Acción no válida.');
            }

            default:
                return jsonErr(res, 'Acción no reconocida.');
        }
    } catch (e) {
        console.error('Error API:', e);
        return jsonErr(res, 'Error interno del servidor.');
    }
});

/* ═══════════════════ HEALTHCHECK ═══════════════════ */

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        db: usarDBReal && pool ? 'postgresql' : 'demo',
        entorno: NODE_ENV,
        uptime: Math.round(process.uptime())
    });
});

/* ═══════════════════ ERROR HANDLER ═══════════════════ */

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    if (status >= 500 && !req.path.startsWith('/api')) {
        console.error('Error no manejado:', err);
    }
    res.status(status).json({ ok: false, error: err.message || 'Error interno del servidor.' });
});

/* ═══════════════════ INICIAR ═══════════════════ */

(async () => {
    await initDB();
    await asegurarBucketSupabase();
    app.listen(PORT, () => {
        console.log(`\n🌾 Direct Vitor corriendo en http://localhost:${PORT}`);
        console.log(`   Modo BD: ${usarDBReal ? 'PostgreSQL (' + DB_NAME + ')' : 'Demo (sin PostgreSQL)'}`);
        console.log(`   Entorno: ${NODE_ENV} | Demo permitida: ${DEMO_MODE ? 'SÍ' : 'NO'}`);
        console.log(`   Imágenes: ${USAR_SUPABASE_STORAGE ? 'Supabase Storage (' + SUPABASE_BUCKET + ')' : 'Disco local'}`);
        if (IS_PROD && SESSION_SECRET === 'campo_directo_vitor_2026') {
            console.warn('  ⚠️  SESSION_SECRET usa el valor por defecto. Cámbialo en .env (producción).');
        }
        if (IS_PROD && ADMIN_PASSWORD === 'admin') {
            console.warn('  ⚠️  ADMIN_PASSWORD usa el valor por defecto. Cámbialo en .env (producción).');
        }
        console.log(`   La BD y sus datos iniciales se crean automáticamente desde database.pg.sql si están vacíos.\n`);
    });
})();
