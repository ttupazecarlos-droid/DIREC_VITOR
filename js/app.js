/* ========================================================
   DIRECT VITOR - APP.JS
   Helpers compartidos para las páginas HTML
   ======================================================== */

const API_URL = (function() {
    if (typeof window === 'undefined') return 'http://localhost:3000/api';
    if (window.location.protocol === 'file:') return 'http://localhost:3000/api';
    return '/api';
})();

/** Llamada genérica a la API (siempre POST multipart) */
async function api(action, params) {
    const fd = new FormData();
    fd.append('action', action);
    if (params) {
        for (const k in params) {
            const v = params[k];
            if (v === undefined || v === null || v === '') continue;
            fd.append(k, v);
        }
    }
    try {
        const resp = await fetch(API_URL, { 
            method: 'POST', 
            body: fd,
            credentials: 'include'
        });
        return await resp.json();
    } catch (e) {
        return { ok: false, error: 'Error de conexión con el servidor de base de datos. Asegúrate de ejecutar `node server.js`.' };
    }
}

/** Escapa HTML */
function esc(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** Formato de dinero S/ 1,80 */
function dinero(n) {
    n = Number(n);
    if (isNaN(n)) n = 0;
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formato de entero con separador de miles */
function numEntero(n) {
    return Number(n || 0).toLocaleString('es-PE');
}

/** Fecha YYYY-MM-DD -> DD/MM/YYYY */
function fmtFecha(f) {
    if (!f) return '';
    const s = String(f);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    return s;
}

/** Enlace de WhatsApp */
function wa(telefono, texto) {
    const limpio = String(telefono || '').replace(/[^0-9]/g, '');
    return 'https://wa.me/' + limpio + '?text=' + encodeURIComponent(texto);
}

function esOrganico(val) {
    return Number(val) === 1;
}

/* ════════════════════════════════════════════════════════════
   COMPONENTES MODULARES: ENCABEZADO Y PIE DE PÁGINA
   ════════════════════════════════════════════════════════════ */

function obtenerHTMLHeader() {
    return '<header class="app-header">' +
        '<a href="index.html" class="brand-logo">' +
            '<img src="images/CAMPO_DIRECTO.svg" alt="Direct Vitor">' +
        '</a>' +
        '<nav style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">' +
            '<a href="agricultores.html" id="nav-link-agricultores" style="font-weight: 600; color: var(--text-secondary); padding: 6px 12px; border-radius: 8px; transition: var(--transition);">' +
                '<i class="fa-solid fa-tractor" style="color: var(--accent-mint);"></i> Agricultor' +
            '</a>' +
            '<a href="compradores.html" id="nav-link-compradores" style="font-weight: 600; color: var(--text-secondary); padding: 6px 12px; border-radius: 8px; transition: var(--transition);">' +
                '<i class="fa-solid fa-store" style="color: var(--accent-gold);"></i> Compradores' +
            '</a>' +
            '<!-- TRANSPORTE: solo visible para usuarios con sesión iniciada -->' +
            '<div id="nav-transporte" style="display:none; align-items:center;">' +
                '<a href="transporte.html" id="nav-link-transporte" style="font-weight: 600; color: var(--text-secondary); padding: 6px 12px; border-radius: 8px; transition: var(--transition);">' +
                    '<i class="fa-solid fa-truck-fast" style="color: var(--accent-terracotta);"></i> Transporte' +
                '</a>' +
            '</div>' +
            '<div id="nav-admin" style="display:none; align-items:center;">' +
                '<a href="admin.html" id="nav-link-admin" style="background:#b5451b; color:#fff; font-weight:700; padding:8px 16px; border-radius:20px; font-size:0.85rem; display:flex; align-items:center; gap:6px; transition:var(--transition);">' +
                    '<i class="fa-solid fa-shield-halved"></i> Admin' +
                '</a>' +
            '</div>' +
            '<div id="nav-usuario" style="display:none; align-items:center; gap:15px; flex-wrap:wrap;">' +
                '<a href="perfil.html" id="nav-link-perfil" class="btn-perfil-header">' +
                    '<i class="fa-solid fa-user-check" style="color: var(--accent-gold);"></i> ' +
                    '<span id="perfil-nombre">Mi Perfil</span>' +
                '</a>' +
                '<a href="javascript:logout()" style="color: var(--accent-terracotta); font-weight: 600; font-size: 0.9rem; padding: 6px 12px; border: 1px solid rgba(231,111,81,0.3); border-radius: 20px; transition: var(--transition);">' +
                    '<i class="fa-solid fa-right-from-bracket"></i> Salir' +
                '</a>' +
            '</div>' +
            '<div id="nav-invitado" style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">' +
                '<a href="login.html" id="nav-link-login" style="color: var(--text-primary); font-weight: 600; padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-color);">' +
                    '<i class="fa-solid fa-right-to-bracket" style="color: var(--accent-mint);"></i> Iniciar Sesión' +
                '</a>' +
                '<a href="registro.html" id="nav-link-registro" class="btn-perfil-header" style="background: var(--accent-mint); color: var(--text-on-accent);">' +
                    '<i class="fa-solid fa-user-plus"></i> Registrarse' +
                '</a>' +
            '</div>' +
        '</nav>' +
    '</header>';
}

function obtenerHTMLFooter() {
    const anio = new Date().getFullYear();
    return '<footer class="app-footer">' +
        '<div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px; text-align: left; margin-bottom: 20px;">' +
            '<div>' +
                '<h4 style="font-family: \'Outfit\'; margin-bottom: 12px;">' +
                    '<a href="index.html" class="brand-logo">' +
                        '<img src="images/CAMPO_DIRECTO.svg" alt="Direct Vitor" style="height: 44px; width: auto;">' +
                    '</a>' +
                '</h4>' +
                '<p style="max-width: 320px;">Plataforma digital para la conexión directa de agricultores con mercados y empresas compradoras sin intermediarios.</p>' +
            '</div>' +
            '<div>' +
                '<h5 style="color: var(--text-primary); margin-bottom: 8px;">Navegación</h5>' +
                '<ul style="list-style: none; display: flex; flex-direction: column; gap: 6px;">' +
                    '<li><a href="index.html"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem; color:var(--accent-mint)"></i> Inicio</a></li>' +
                    '<li><a href="agricultores.html"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem; color:var(--accent-mint)"></i> Ofertas de Agricultores</a></li>' +
                    '<li><a href="compradores.html"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem; color:var(--accent-mint)"></i> Demandas de Compradores</a></li>' +
                    '<li><a href="perfil.html"><i class="fa-solid fa-chevron-right" style="font-size:0.7rem; color:var(--accent-mint)"></i> Mi Perfil Verificado</a></li>' +
                '</ul>' +
            '</div>' +
            '<div>' +
                '<h5 style="color: var(--text-primary); margin-bottom: 8px;">Garantía &amp; Seguridad</h5>' +
                '<p><i class="fa-solid fa-shield-halved" style="color:var(--accent-gold)"></i> Verificación con DNI/RUC</p>' +
                '<p><i class="fa-solid fa-handshake" style="color:var(--accent-mint)"></i> Trato directo 0% comisión</p>' +
            '</div>' +
        '</div>' +
        '<hr style="border: 0; border-top: 1px solid var(--border-color); margin-bottom: 15px;">' +
        '<p>&copy; <span id="anio">' + anio + '</span> Direct Vitor. Todos los derechos reservados.</p>' +
        '<div style="display: flex; align-items: center; gap: 15px; margin-top: 10px;">' +
            '<span style="font-size: 0.85rem; color: var(--text-muted);">Síguenos:</span>' +
            '<a href="https://www.instagram.com/direct.vitor?stkn=OTd4YzlzbHE1N3pt" target="_blank" rel="noopener noreferrer" style="color: var(--text-secondary); font-size: 1.3rem; transition: var(--transition);" title="Instagram"><i class="fa-brands fa-instagram"></i></a>' +
            '<a href="https://www.facebook.com/share/1ZLaJM4vSU/" target="_blank" rel="noopener noreferrer" style="color: var(--text-secondary); font-size: 1.3rem; transition: var(--transition);" title="Facebook"><i class="fa-brands fa-facebook"></i></a>' +
        '</div>' +
    '</footer>';
}

function aplicarResaltadoNav() {
    const paginaActual = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const mapaLinks = {
        'agricultores.html': 'nav-link-agricultores',
        'publicar-oferta.html': 'nav-link-agricultores',
        'compradores.html': 'nav-link-compradores',
        'publicar-demanda.html': 'nav-link-compradores',
        'transporte.html': 'nav-link-transporte',
        'admin.html': 'nav-link-admin',
        'perfil.html': 'nav-link-perfil',
        'login.html': 'nav-link-login',
        'registro.html': 'nav-link-registro'
    };

    const idActivo = mapaLinks[paginaActual];
    if (idActivo) {
        const linkEl = document.getElementById(idActivo);
        if (linkEl && !linkEl.classList.contains('btn-perfil-header')) {
            linkEl.style.background = 'rgba(255, 255, 255, 0.08)';
            linkEl.style.color = 'var(--text-primary)';
        }
    }
}

function renderHeader() {
    const elHeader = document.getElementById('app-header') || document.querySelector('header.app-header') || document.getElementById('header-container');
    if (!elHeader) return;

    // Inyección síncrona inmediata para evitar parpadeos o elementos nulos
    if (elHeader.tagName === 'HEADER') {
        elHeader.outerHTML = obtenerHTMLHeader();
    } else {
        elHeader.innerHTML = obtenerHTMLHeader();
    }

    aplicarResaltadoNav();
    renderNav();

    // Actualización asíncrona si componentes/header.html ha sido editado
    if (typeof fetch === 'function' && window.location.protocol !== 'file:') {
        fetch('componentes/header.html').then(r => r.ok ? r.text() : null).then(html => {
            if (html) {
                const cur = document.getElementById('app-header') || document.querySelector('header.app-header');
                if (cur) {
                    if (cur.tagName === 'HEADER') cur.outerHTML = html;
                    else cur.innerHTML = html;
                    aplicarResaltadoNav();
                    renderNav();
                }
            }
        }).catch(() => {});
    }
}

function renderFooter() {
    const elFooter = document.getElementById('app-footer') || document.querySelector('footer.app-footer') || document.getElementById('footer-container');
    if (!elFooter) return;

    // Inyección síncrona inmediata
    if (elFooter.tagName === 'FOOTER') {
        elFooter.outerHTML = obtenerHTMLFooter();
    } else {
        elFooter.innerHTML = obtenerHTMLFooter();
    }

    const anioEl = document.getElementById('anio');
    if (anioEl) anioEl.textContent = new Date().getFullYear();

    // Actualización asíncrona si componentes/footer.html ha sido editado
    if (typeof fetch === 'function' && window.location.protocol !== 'file:') {
        fetch('componentes/footer.html').then(r => r.ok ? r.text() : null).then(html => {
            if (html) {
                const cur = document.getElementById('app-footer') || document.querySelector('footer.app-footer');
                if (cur) {
                    if (cur.tagName === 'FOOTER') cur.outerHTML = html;
                    else cur.innerHTML = html;
                    const aEl = document.getElementById('anio');
                    if (aEl) aEl.textContent = new Date().getFullYear();
                }
            }
        }).catch(() => {});
    }
}

function renderLayout() {
    renderHeader();
    renderFooter();
}

// Auto-inicializar Header y Footer en el DOM
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderLayout);
    } else {
        renderLayout();
    }
}

/* ════════════════════════════════════════════════════════════
   NAVEGACIÓN / SESIÓN
   ════════════════════════════════════════════════════════════ */

async function renderNav() {
    const navInvitado   = document.getElementById('nav-invitado');
    const navUsuario    = document.getElementById('nav-usuario');
    const navAdmin      = document.getElementById('nav-admin');
    const navTransporte = document.getElementById('nav-transporte');
    if (!navInvitado && !navUsuario) return;

    const res = await api('get_session');
    if (res.ok && res.usuario) {
        if (navInvitado) navInvitado.style.display = 'none';
        if (navUsuario) {
            navUsuario.style.display = 'flex';
            const nombre = res.usuario.nombre || 'Mi Perfil';
            const corto  = nombre.length > 16 ? nombre.slice(0, 16) + '...' : nombre;
            const pn = document.getElementById('perfil-nombre');
            if (pn) pn.textContent = corto;
        }
        if (navAdmin) navAdmin.style.display = res.usuario.is_admin ? 'flex' : 'none';
        if (navTransporte) navTransporte.style.display = 'flex';
    } else {
        if (navInvitado) navInvitado.style.display = 'flex';
        if (navUsuario) navUsuario.style.display = 'none';
        if (navAdmin) navAdmin.style.display = 'none';
        if (navTransporte) navTransporte.style.display = 'none';
    }
}

async function logout() {
    await api('logout');
    location.href = 'index.html?msg=sesion_cerrada';
}

/* ════════════════════════════════════════════════════════════
   ANEXOS (SELECTS)
   ════════════════════════════════════════════════════════════ */

function anexoOptions(anexos, seleccionado) {
    return (anexos || []).map(function (a) {
        return '<option value="' + esc(a) + '"' + (a === seleccionado ? ' selected' : '') + '>📍 Anexo ' + esc(a) + '</option>';
    }).join('');
}

async function llenarAnexos(idSelect, placeholder, seleccionado) {
    const res = await api('get_anexos');
    const sel = document.getElementById(idSelect);
    if (!sel) return;
    if (res.ok && res.anexos) {
        sel.innerHTML = '<option value="">' + esc(placeholder || '-- Seleccionar Anexo --') + '</option>' + anexoOptions(res.anexos, seleccionado);
    }
}

/* ════════════════════════════════════════════════════════════
   TARJETAS DE OFERTAS (VENDEDORES)
   ════════════════════════════════════════════════════════════ */

window.__pubCache = window.__pubCache || {};

function cachePublicacion(tipo, pub) {
    if (pub && pub.id) window.__pubCache[tipo + ':' + pub.id] = pub;
}

function tarjetaOferta(o, modo) {
    const org = esOrganico(o.es_organico)
        ? '<span style="background: rgba(82,183,136,0.2); color:var(--accent-mint); padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">Orgánico</span>'
        : '';

    const imgWrap =
        '<div class="card-image-wrapper">' +
            '<img src="' + esc(o.imagen) + '" alt="' + esc(o.producto) + '">' +
            '<span class="card-badge"><i class="fa-solid fa-location-dot"></i> Anexo ' + esc(o.anexo) + '</span>' +
        '</div>';

    const fechaPub = o.fecha_publicacion ? fmtFecha(String(o.fecha_publicacion).slice(0, 10)) : (o.creado_en ? fmtFecha(String(o.creado_en).slice(0, 10)) : '');
    const fechaCos = o.fecha_cosecha ? fmtFecha(String(o.fecha_cosecha).slice(0, 10)) : '';

    let medio = '';
    if (modo === 'completo') {
        medio =
            '<div class="card-meta"><span><i class="fa-solid fa-map-pin" style="color:var(--accent-gold)"></i> ' + esc(o.ubicacion_chacra) + ' (Vítor)</span></div>' +
            '<div class="card-meta" style="margin-bottom: 8px;">' +
                '<span style="color: var(--accent-gold);"><i class="fa-solid fa-user-shield"></i> ' + esc(o.productor) + '</span>' +
                '<span><i class="fa-solid fa-star" style="color: var(--accent-gold);"></i> ' + esc(o.calificacion) + '</span>' +
            '</div>' +
            '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; font-size: 0.82rem;">' +
                (fechaPub ? '<span style="background: var(--chip-bg-strong); padding: 5px 10px; border-radius: 6px; color: var(--text-secondary);"><i class="fa-regular fa-clock" style="color: var(--accent-gold);"></i> Publicado: <strong>' + fechaPub + '</strong></span>' : '') +
                (fechaCos ? '<span style="background: rgba(82,183,136,0.15); padding: 5px 10px; border-radius: 6px; color: var(--accent-mint);"><i class="fa-solid fa-calendar-day"></i> Cosecha: <strong>' + fechaCos + '</strong></span>' : '') +
            '</div>';
    } else {
        medio =
            '<div class="card-meta"><span><i class="fa-solid fa-user-check" style="color:var(--accent-mint)"></i> Publicado por: <strong>' + esc(o.productor) + '</strong></span></div>' +
            '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; font-size: 0.82rem;">' +
                (fechaPub ? '<span style="background: var(--chip-bg-strong); padding: 4px 8px; border-radius: 6px; color: var(--text-secondary);"><i class="fa-regular fa-clock" style="color: var(--accent-gold);"></i> ' + fechaPub + '</span>' : '') +
                (fechaCos ? '<span style="background: rgba(82,183,136,0.15); padding: 4px 8px; border-radius: 6px; color: var(--accent-mint);"><i class="fa-solid fa-calendar-day"></i> Cosecha: ' + fechaCos + '</span>' : '') +
            '</div>';
    }

    const textoWa = 'Hola ' + o.productor + ', estoy interesado en comprar ' + o.producto + ' en el Anexo ' + o.anexo + ' de Vítor (Direct Vitor)';
    const labelBtn = modo === 'completo' ? 'Trato Directo' : 'Contactar';
    const totalComentarios = Number(o.total_comentarios || 0);
    cachePublicacion('oferta', o);

    return '<div class="card-item" data-pub-tipo="oferta" data-pub-id="' + o.id + '" id="card-oferta-' + o.id + '">' + imgWrap +
        '<div class="card-body">' +
            '<div style="display: flex; justify-content: space-between; align-items: flex-start;">' +
                '<h3 class="card-title">' + esc(o.producto) + '</h3>' + org +
            '</div>' +
            medio +
            '<p class="card-desc">' + esc(o.descripcion) + '</p>' +
            '<div class="card-footer">' +
                '<div class="price-container">' +
                    '<span class="price-val">S/ ' + dinero(o.precio_kg) + '</span>' +
                    '<span class="price-unit">por kg / ' + esc(o.cantidad_ton) + ' Toneladas</span>' +
                '</div>' +
                '<a href="' + wa(o.telefono, textoWa) + '" target="_blank" class="btn-contact">' +
                    '<i class="fa-brands fa-whatsapp"></i> ' + labelBtn +
                '</a>' +
            '</div>' +
            '<div class="card-interactions">' +
                '<button type="button" class="btn-card-interaction" onclick="abrirModalComentarios(\'oferta\', ' + o.id + ', \'' + esc(o.producto) + '\')">' +
                    '<i class="fa-solid fa-comments"></i> <span id="badge-com-oferta-' + o.id + '">' + totalComentarios + '</span> Comentario' + (totalComentarios === 1 ? '' : 's') +
                '</button>' +
                '<button type="button" class="btn-card-interaction btn-report-trigger" onclick="abrirModalReporte(\'publicacion\', \'oferta\', ' + o.id + ', null, \'' + esc(o.producto) + '\')" title="Reportar esta publicación">' +
                    '<i class="fa-regular fa-flag"></i> Reportar' +
                '</button>' +
            '</div>' +
        '</div>' +
    '</div>';
}

/* ════════════════════════════════════════════════════════════
   TARJETAS DE DEMANDAS (COMPRADORES)
   ════════════════════════════════════════════════════════════ */

function tarjetaDemanda(d) {
    const textoWa = 'Hola ' + d.comprador + ', tengo cosecha disponible para tu demanda de ' + d.producto + ' en Direct Vitor';
    const totalComentarios = Number(d.total_comentarios || 0);
    const fechaPub = d.fecha_publicacion ? fmtFecha(String(d.fecha_publicacion).slice(0, 10)) : (d.creado_en ? fmtFecha(String(d.creado_en).slice(0, 10)) : '');
    const fechaCos = d.fecha_cosecha ? fmtFecha(String(d.fecha_cosecha).slice(0, 10)) : '';
    cachePublicacion('demanda', d);

    return '<div class="card-item" data-pub-tipo="demanda" data-pub-id="' + d.id + '" id="card-demanda-' + d.id + '" style="border-left: 5px solid var(--accent-gold);">' +
        '<div class="card-body">' +
            '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">' +
                '<span style="background: rgba(233,196,106,0.18); color: var(--accent-gold); padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 700;">' +
                    '<i class="fa-solid fa-building-wheat"></i> ' + esc(d.tipo_comprador) +
                '</span>' +
                '<span style="background: rgba(231,111,81,0.2); color: var(--accent-terracotta); padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">' +
                    '<i class="fa-solid fa-fire"></i> Urgencia: ' + esc(d.urgencia) +
                '</span>' +
            '</div>' +
            '<h3 class="card-title" style="font-size: 1.4rem; color: var(--text-primary);">' + esc(d.producto) + '</h3>' +
            '<div class="card-meta">' +
                '<span><i class="fa-solid fa-user-tie" style="color: var(--accent-gold);"></i> ' + esc(d.comprador) + '</span>' +
                '<span><i class="fa-solid fa-truck"></i> Destino: ' + esc(d.destino) + '</span>' +
            '</div>' +
            '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; font-size: 0.82rem;">' +
                (fechaPub ? '<span style="background: var(--chip-bg-strong); padding: 5px 10px; border-radius: 6px; color: var(--text-secondary);"><i class="fa-regular fa-clock" style="color: var(--accent-gold);"></i> Publicado: <strong>' + fechaPub + '</strong></span>' : '') +
                (fechaCos ? '<span style="background: rgba(233,196,106,0.18); padding: 5px 10px; border-radius: 6px; color: var(--accent-gold);"><i class="fa-solid fa-calendar-check"></i> Cosecha Requerida: <strong>' + fechaCos + '</strong></span>' : '') +
            '</div>' +
            '<p class="card-desc" style="background: var(--chip-bg); padding: 12px; border-radius: 10px; border-left: 2px solid var(--accent-gold);">"' + esc(d.descripcion) + '"</p>' +
            '<div class="card-footer">' +
                '<div class="price-container">' +
                    '<span class="price-val" style="color: var(--accent-mint);">S/ ' + dinero(d.precio_max_kg) + '</span>' +
                    '<span class="price-unit">Precio Max por kg / Requerido: ' + esc(d.cantidad_ton) + ' Ton.</span>' +
                '</div>' +
                '<a href="' + wa(d.telefono, textoWa) + '" target="_blank" class="btn-contact" style="background: var(--accent-gold); color: var(--text-on-accent);">' +
                    '<i class="fa-solid fa-handshake"></i> Ofrecer Cosecha' +
                '</a>' +
            '</div>' +
            '<div class="card-interactions">' +
                '<button type="button" class="btn-card-interaction" onclick="abrirModalComentarios(\'demanda\', ' + d.id + ', \'' + esc(d.producto) + '\')">' +
                    '<i class="fa-solid fa-comments"></i> <span id="badge-com-demanda-' + d.id + '">' + totalComentarios + '</span> Comentario' + (totalComentarios === 1 ? '' : 's') +
                '</button>' +
                '<button type="button" class="btn-card-interaction btn-report-trigger" onclick="abrirModalReporte(\'publicacion\', \'demanda\', ' + d.id + ', null, \'' + esc(d.producto) + '\')" title="Reportar esta demanda">' +
                    '<i class="fa-regular fa-flag"></i> Reportar' +
                '</button>' +
            '</div>' +
        '</div>' +
    '</div>';
}

/* ════════════════════════════════════════════════════════════
   TARJETAS DE TRANSPORTE (MOTORIZADO)
   ════════════════════════════════════════════════════════════ */

function infoTipoTransporte(tipo) {
    var tipos = {
        camioneta: { icono: 'fa-truck-pickup', etiqueta: 'Camioneta', color: 'var(--accent-mint)' },
        camion:    { icono: 'fa-truck',        etiqueta: 'Camión',    color: 'var(--accent-gold)' },
        motocarga: { icono: 'fa-motorcycle',  etiqueta: 'Motocarga', color: 'var(--accent-terracotta)' }
    };
    return tipos[tipo] || { icono: 'fa-truck', etiqueta: 'Transporte', color: 'var(--accent-mint)' };
}

function tarjetaTransporte(t) {
    var info = infoTipoTransporte(t.tipo);
    var placa = t.placa ? '<span><i class="fa-solid fa-car-side"></i> Placa: ' + esc(t.placa) + '</span>' : '';
    var textoWa = 'Hola ' + t.nombre + ', necesito tu servicio de ' + info.etiqueta + ' (' + esc(t.cobertura) + ') para traslado de cosecha en Direct Vitor';
    var totalComentarios = Number(t.total_comentarios || 0);
    var fechaPub = t.fecha_registro ? fmtFecha(String(t.fecha_registro).slice(0, 10)) : (t.fecha_publicacion ? fmtFecha(String(t.fecha_publicacion).slice(0, 10)) : '');
    cachePublicacion('transporte', t);

    return '<div class="card-item" data-pub-tipo="transporte" data-pub-id="' + t.id + '" id="card-transporte-' + t.id + '" style="border-left: 5px solid ' + info.color + ';">' +
        '<div class="card-body">' +
            '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">' +
                '<span style="background: rgba(233,196,106,0.18); color: ' + info.color + '; padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 700;">' +
                    '<i class="fa-solid ' + info.icono + '"></i> ' + info.etiqueta +
                '</span>' +
                '<span style="background: rgba(82,183,136,0.2); color: var(--accent-mint); padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">' +
                    '<i class="fa-solid fa-location-dot"></i> Anexo ' + esc(t.anexo) +
                '</span>' +
            '</div>' +
            '<h3 class="card-title" style="font-size: 1.4rem; color: var(--text-primary);">' + esc(t.nombre) + '</h3>' +
            '<div class="card-meta">' +
                '<span><i class="fa-solid fa-user-tie" style="color: ' + info.color + ';"></i> ' + esc(t.cobertura || 'Cobertura general') + '</span>' +
                (placa ? '<span>' + placa + '</span>' : '') +
            '</div>' +
            (fechaPub ? '<div style="margin-bottom: 10px; font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock" style="color: var(--accent-mint);"></i> Registrado: ' + fechaPub + '</div>' : '') +
            '<p class="card-desc" style="background: var(--chip-bg); padding: 12px; border-radius: 10px; border-left: 2px solid ' + info.color + ';">"' + esc(t.descripcion) + '"</p>' +
            '<div class="card-footer">' +
                '<div class="price-container">' +
                    '<span class="price-val" style="color: ' + info.color + '; font-size: 1rem;"><i class="fa-solid fa-phone"></i> ' + esc(t.telefono) + '</span>' +
                    '<span class="price-unit">Número de contacto</span>' +
                '</div>' +
                '<a href="' + wa(t.telefono, textoWa) + '" target="_blank" class="btn-contact" style="background: ' + info.color + '; color: var(--text-on-accent);">' +
                    '<i class="fa-brands fa-whatsapp"></i> Contactar Transportista' +
                '</a>' +
            '</div>' +
            '<div class="card-interactions">' +
                '<button type="button" class="btn-card-interaction" onclick="abrirModalComentarios(\'transporte\', ' + t.id + ', \'' + esc(t.nombre) + '\')">' +
                    '<i class="fa-solid fa-comments"></i> <span id="badge-com-transporte-' + t.id + '">' + totalComentarios + '</span> Comentario' + (totalComentarios === 1 ? '' : 's') +
                '</button>' +
                '<button type="button" class="btn-card-interaction btn-report-trigger" onclick="abrirModalReporte(\'publicacion\', \'transporte\', ' + t.id + ', null, \'' + esc(t.nombre) + '\')" title="Reportar este servicio">' +
                    '<i class="fa-regular fa-flag"></i> Reportar' +
                '</button>' +
            '</div>' +
        '</div>' +
    '</div>';
}

/* ════════════════════════════════════════════════════════════
   MENSAJES / BANNERS
   ════════════════════════════════════════════════════════════ */

function bannerError(mensaje) {
    return '<div style="background: rgba(231,111,81,0.2); border: 1px solid var(--accent-terracotta); color: var(--accent-terracotta); padding: 12px; border-radius: var(--radius-md); margin-bottom: 20px; font-size: 0.9rem;">' +
        '<i class="fa-solid fa-triangle-exclamation"></i> ' + esc(mensaje) + '</div>';
}

function bannerExito(mensaje) {
    return '<div style="background: rgba(82,183,136,0.2); border: 1px solid var(--accent-mint); color: var(--accent-mint); padding: 12px; border-radius: var(--radius-md); margin-bottom: 20px; font-size: 0.9rem;">' +
        '<i class="fa-solid fa-circle-check"></i> ' + esc(mensaje) + '</div>';
}

/* ════════════════════════════════════════════════════════════
   QUERY STRING
   ════════════════════════════════════════════════════════════ */

function getParam(name) {
    const url = new URLSearchParams(location.search);
    return url.get(name) || '';
}

/* ════════════════════════════════════════════════════════════
   TEMA OSCURO / CLARO
   ════════════════════════════════════════════════════════════ */

function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem('campo_tema', tema); } catch (e) {}
    const icono = document.getElementById('icono-tema');
    if (icono) icono.className = 'fa-solid ' + (tema === 'claro' ? 'fa-moon' : 'fa-sun');
}

function initTema() {
    let guardado = null;
    try { guardado = localStorage.getItem('campo_tema'); } catch (e) {}
    const tema = (guardado === 'claro' || guardado === 'oscuro') ? guardado : 'oscuro';

    aplicarTema(tema);

    if (document.getElementById('btn-tema')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-tema';
    btn.id = 'btn-tema';
    btn.setAttribute('aria-label', 'Cambiar entre modo oscuro y claro');
    btn.setAttribute('title', 'Cambiar tema (oscuro/claro)');
    btn.innerHTML = '<i id="icono-tema" class="fa-solid"></i>';
    btn.addEventListener('click', function () {
        const actual = document.documentElement.getAttribute('data-theme');
        aplicarTema(actual === 'claro' ? 'oscuro' : 'claro');
    });
    document.body.appendChild(btn);

    const icono = document.getElementById('icono-tema');
    if (icono) icono.className = 'fa-solid ' + (tema === 'claro' ? 'fa-moon' : 'fa-sun');
}

initTema();

/* ════════════════════════════════════════════════════════════
   BOTÓN FLOTANTE: VOLVER AL ENCABEZADO
   ════════════════════════════════════════════════════════════ */

function initBtnTop() {
    if (document.getElementById('btn-top')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-top';
    btn.id = 'btn-top';
    btn.setAttribute('aria-label', 'Volver al encabezado');
    btn.setAttribute('title', 'Volver arriba');
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);

    function onScroll() {
        const top = window.pageYOffset || document.documentElement.scrollTop || 0;
        btn.classList.toggle('visible', top > 350);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

initBtnTop();

/* ════════════════════════════════════════════════════════════
   SISTEMA DE COMENTARIOS (MODAL DINÁMICO)
   ════════════════════════════════════════════════════════════ */

let usuarioActualSesion = null;

async function obtenerUsuarioSesion() {
    if (usuarioActualSesion) return usuarioActualSesion;
    const res = await api('get_session');
    if (res.ok && res.usuario) {
        usuarioActualSesion = res.usuario;
    }
    return usuarioActualSesion;
}

function cerrarModalComentarios() {
    const m = document.getElementById('modal-comentarios');
    if (m) m.remove();
}

function chipInfo(texto, color, icono) {
    return '<span style="background: var(--chip-bg); border: 1px solid var(--border-color); color: ' + (color || 'var(--text-secondary)') + '; padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 5px;">' +
        (icono ? '<i class="fa-solid ' + icono + '"></i>' : '') + esc(texto) +
    '</span>';
}

function resumenPublicacionHTML(pub, pubTipo) {
    if (!pub) return '';
    var etiqueta = '', titulo = pub.producto || pub.nombre || '', imagen = pub.imagen || '', chips = [], descripcion = pub.descripcion || '';

    if (pubTipo === 'oferta') {
        etiqueta = 'Oferta · Cosecha Disponible';
        chips = [
            chipInfo('S/ ' + dinero(pub.precio_kg) + ' / kg', 'var(--accent-mint)', 'fa-tag'),
            chipInfo(String(pub.cantidad_ton) + ' toneladas', 'var(--accent-gold)', 'fa-weight-hanging'),
            chipInfo('Anexo ' + (pub.anexo || ''), 'var(--accent-terracotta)', 'fa-location-dot')
        ];
    } else if (pubTipo === 'demanda') {
        etiqueta = 'Demanda · ' + (pub.tipo_comprador || 'Comprador');
        chips = [
            chipInfo('Hasta S/ ' + dinero(pub.precio_max_kg) + ' / kg', 'var(--accent-gold)', 'fa-tag'),
            chipInfo('Requiere ' + String(pub.cantidad_ton) + ' toneladas', 'var(--accent-mint)', 'fa-weight-hanging'),
            chipInfo('Urgencia: ' + (pub.urgencia || '-'), 'var(--accent-terracotta)', 'fa-fire')
        ];
    } else {
        var infoT = infoTipoTransporte(pub.tipo);
        etiqueta = 'Transporte · ' + infoT.etiqueta;
        chips = [
            chipInfo(pub.telefono || 'Sin teléfono', 'var(--accent-mint)', 'fa-phone'),
            chipInfo('Anexo ' + (pub.anexo || ''), 'var(--accent-terracotta)', 'fa-location-dot')
        ];
        if (pub.placa) chips.push(chipInfo('Placa ' + pub.placa, 'var(--accent-gold)', 'fa-car-side'));
    }

    return '<div style="display: flex; gap: 14px; align-items: flex-start; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 16px;">' +
        (imagen
            ? '<img src="' + esc(imagen) + '" alt="' + esc(titulo) + '" style="width: 72px; height: 72px; object-fit: cover; border-radius: 10px; flex-shrink: 0;">'
            : '') +
        '<div style="flex: 1; min-width: 0;">' +
            '<div style="font-size: 0.75rem; color: var(--accent-mint); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">' + esc(etiqueta) + '</div>' +
            '<div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; margin-bottom: 6px;">' + esc(titulo) + '</div>' +
            (chips.length ? '<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">' + chips.join('') + '</div>' : '') +
            (descripcion ? '<p style="font-size: 0.84rem; color: var(--text-secondary); margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">' + esc(descripcion) + '</p>' : '') +
        '</div>' +
    '</div>';
}

async function abrirModalComentarios(pubTipo, pubId, tituloPub) {
    cerrarModalComentarios();
    const user = await obtenerUsuarioSesion();
    const resumenHTML = resumenPublicacionHTML(window.__pubCache[pubTipo + ':' + pubId], pubTipo);

    const overlay = document.createElement('div');
    overlay.id = 'modal-comentarios';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML =
        '<div class="modal-card" style="max-width: 620px; width: 92%; max-height: 85vh; display: flex; flex-direction: column;">' +
            '<div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px;">' +
                '<div>' +
                    '<h3 style="font-family: \'Outfit\'; font-size: 1.3rem; margin: 0; color: var(--text-primary);">' +
                        '<i class="fa-solid fa-comments" style="color: var(--accent-mint);"></i> Comentarios de la Publicación' +
                    '</h3>' +
                    '<p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; margin-bottom: 0;">' + esc(tituloPub) + '</p>' +
                '</div>' +
                '<button type="button" onclick="cerrarModalComentarios()" class="modal-close-btn" style="background: none; border: none; font-size: 1.3rem; color: var(--text-muted); cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +

            resumenHTML +

            '<div id="lista-comentarios-body" style="flex: 1; overflow-y: auto; padding-right: 6px; margin-bottom: 16px; min-height: 180px;">' +
                '<div style="text-align: center; padding: 30px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--accent-mint);"></i><p style="margin-top: 8px;">Cargando comentarios...</p></div>' +
            '</div>' +

            '<div style="border-top: 1px solid var(--border-color); padding-top: 14px;">' +
                (user
                    ? '<form id="form-nuevo-comentario" onsubmit="enviarComentario(event, \'' + pubTipo + '\', ' + pubId + ', \'' + esc(tituloPub) + '\')">' +
                          '<div style="display: flex; gap: 10px; align-items: flex-start;">' +
                              '<div style="width: 38px; height: 38px; border-radius: 50%; background: var(--accent-mint); display: flex; align-items: center; justify-content: center; color: var(--text-on-accent); font-weight: 700; flex-shrink: 0;">' +
                                  (user.nombre ? esc(user.nombre.charAt(0).toUpperCase()) : 'U') +
                              '</div>' +
                              '<div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">' +
                                  '<textarea id="input-comentario-texto" required rows="2" placeholder="Escribe una pregunta o comentario sobre esta cosecha/publicación..." style="width: 100%; border-radius: var(--radius-md); background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-primary); padding: 10px 12px; font-family: inherit; font-size: 0.9rem; resize: vertical;"></textarea>' +
                                  '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                                      '<span style="font-size: 0.78rem; color: var(--text-muted);">Comentando como <strong>' + esc(user.nombre) + '</strong></span>' +
                                      '<button type="submit" id="btn-enviar-comentario" class="btn-contact" style="border: none; cursor: pointer; padding: 7px 18px; font-size: 0.85rem;">' +
                                          '<i class="fa-solid fa-paper-plane"></i> Publicar' +
                                      '</button>' +
                                  '</div>' +
                              '</div>' +
                          '</div>' +
                      '</form>'
                    : '<div style="background: var(--chip-bg); padding: 12px 16px; border-radius: var(--radius-md); text-align: center; border: 1px dashed var(--border-color); font-size: 0.88rem;">' +
                          '<p style="color: var(--text-muted); margin-bottom: 8px;"><i class="fa-solid fa-lock" style="color: var(--accent-gold);"></i> Inicia sesión para dejar un comentario en esta publicación.</p>' +
                          '<a href="login.html" class="btn-contact" style="display: inline-flex; padding: 6px 16px; font-size: 0.85rem;"><i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión</a>' +
                      '</div>'
                ) +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cerrarModalComentarios();
    });

    await cargarListaComentarios(pubTipo, pubId, tituloPub);
}

async function cargarListaComentarios(pubTipo, pubId, tituloPub) {
    const contenedor = document.getElementById('lista-comentarios-body');
    if (!contenedor) return;

    const user = await obtenerUsuarioSesion();
    const res = await api('get_comentarios', { publicacion_tipo: pubTipo, publicacion_id: pubId });

    if (!res.ok) {
        contenedor.innerHTML = '<div style="text-align: center; padding: 25px; color: var(--accent-terracotta);"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(res.error || 'Error al cargar comentarios.') + '</div>';
        return;
    }

    const badge = document.getElementById('badge-com-' + pubTipo + '-' + pubId);
    if (badge) badge.textContent = res.comentarios.length;

    if (res.comentarios.length === 0) {
        contenedor.innerHTML =
            '<div style="text-align: center; padding: 35px 20px; color: var(--text-muted);">' +
                '<i class="fa-regular fa-comment-dots" style="font-size: 2.5rem; margin-bottom: 10px; color: var(--accent-mint); opacity: 0.6;"></i>' +
                '<p style="margin: 0; font-size: 0.95rem;">Aún no hay comentarios en esta publicación.</p>' +
                '<p style="margin-top: 4px; font-size: 0.8rem; color: var(--text-muted);">¡Sé el primero en hacer una consulta o trato directo!</p>' +
            '</div>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    res.comentarios.forEach(function (c) {
        const esMio = user && (Number(user.id) === Number(c.usuario_id) || Number(user.is_admin) === 1);
        const inicial = c.autor_nombre ? esc(c.autor_nombre.charAt(0).toUpperCase()) : 'U';
        const tipoLabel = c.autor_tipo === 'productor' ? 'Productor' : (c.autor_tipo === 'transportista' ? 'Transportista' : 'Comprador');
        const tipoColor = c.autor_tipo === 'productor' ? 'var(--accent-mint)' : (c.autor_tipo === 'transportista' ? 'var(--accent-terracotta)' : 'var(--accent-gold)');

        html +=
            '<div class="comentario-item" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px;">' +
                '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">' +
                    '<div style="display: flex; align-items: center; gap: 10px;">' +
                        '<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--chip-bg-strong); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: 700; color: ' + tipoColor + '; font-size: 0.85rem;">' +
                            inicial +
                        '</div>' +
                        '<div>' +
                            '<div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">' + esc(c.autor_nombre) + '</div>' +
                            '<div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 6px; align-items: center;">' +
                                '<span style="color: ' + tipoColor + '; font-weight: 600;">' + tipoLabel + '</span> &bull; ' +
                                '<span><i class="fa-solid fa-location-dot" style="font-size: 0.7rem;"></i> ' + esc(c.autor_anexo || 'Vítor') + '</span> &bull; ' +
                                '<span>' + fmtFecha(String(c.creado_en).slice(0, 10)) + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="display: flex; gap: 8px; align-items: center;">' +
                        '<button type="button" onclick="abrirModalReporte(\'comentario\', \'' + pubTipo + '\', ' + pubId + ', ' + c.id + ', \'Comentario de ' + esc(c.autor_nombre) + '\')" title="Reportar comentario" style="background: none; border: none; color: var(--text-muted); font-size: 0.8rem; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: var(--transition);" onmouseover="this.style.color=\'var(--accent-terracotta)\'" onmouseout="this.style.color=\'var(--text-muted)\'">' +
                            '<i class="fa-regular fa-flag"></i>' +
                        '</button>' +
                        (esMio
                            ? '<button type="button" onclick="eliminarComentario(' + c.id + ', \'' + pubTipo + '\', ' + pubId + ', \'' + esc(tituloPub) + '\')" title="Eliminar comentario" style="background: none; border: none; color: var(--accent-terracotta); font-size: 0.8rem; cursor: pointer; padding: 4px 6px; border-radius: 4px;"><i class="fa-solid fa-trash"></i></button>'
                            : ''
                        ) +
                    '</div>' +
                '</div>' +
                '<p style="font-size: 0.88rem; color: var(--text-secondary); margin: 0; line-height: 1.45; white-space: pre-wrap;">' + esc(c.comentario) + '</p>' +
            '</div>';
    });
    html += '</div>';

    contenedor.innerHTML = html;
}

async function enviarComentario(e, pubTipo, pubId, tituloPub) {
    if (e && e.preventDefault) e.preventDefault();
    const txtArea = document.getElementById('input-comentario-texto');
    const btn = document.getElementById('btn-enviar-comentario');
    if (!txtArea) return;
    const texto = txtArea.value.trim();
    if (!texto) return;

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

    const res = await api('agregar_comentario', {
        publicacion_tipo: pubTipo,
        publicacion_id: pubId,
        comentario: texto
    });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar'; }

    if (res.ok) {
        txtArea.value = '';
        await cargarListaComentarios(pubTipo, pubId, tituloPub);
    } else {
        alert(res.error || 'No se pudo publicar el comentario.');
    }
}

async function eliminarComentario(id, pubTipo, pubId, tituloPub) {
    if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;
    const res = await api('eliminar_comentario', { id: id });
    if (res.ok) {
        await cargarListaComentarios(pubTipo, pubId, tituloPub);
    } else {
        alert(res.error || 'Error al eliminar el comentario.');
    }
}

/* Al hacer clic en una tarjeta de publicación (fuera de botones/enlaces)
   se abre el modal que muestra la publicación y sus comentarios. */
document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('a') || e.target.closest('button')) return;
    var card = e.target.closest('.card-item[data-pub-id]');
    if (!card) return;
    var tipo = card.getAttribute('data-pub-tipo');
    var id = parseInt(card.getAttribute('data-pub-id')) || 0;
    if (!tipo || !id) return;
    var pub = window.__pubCache[tipo + ':' + id];
    if (!pub) return;
    abrirModalComentarios(tipo, id, pub.producto || pub.nombre || 'Publicación');
});

/* ════════════════════════════════════════════════════════════
   SISTEMA DE REPORTES (MODAL DINÁMICO)
   ════════════════════════════════════════════════════════════ */

function cerrarModalReporte() {
    const m = document.getElementById('modal-reporte');
    if (m) m.remove();
}

async function abrirModalReporte(tipoObjetivo, pubTipo, pubId, comId, itemTitulo) {
    cerrarModalReporte();
    const user = await obtenerUsuarioSesion();

    if (!user) {
        alert('Debes iniciar sesión para reportar una publicación o comentario.');
        location.href = 'login.html?msg=debes_iniciar_sesion';
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'modal-reporte';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML =
        '<div class="modal-card" style="max-width: 520px; width: 92%;">' +
            '<div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 16px;">' +
                '<div>' +
                    '<h3 style="font-family: \'Outfit\'; font-size: 1.25rem; margin: 0; color: var(--accent-terracotta);">' +
                        '<i class="fa-solid fa-triangle-exclamation"></i> Reportar ' + (tipoObjetivo === 'comentario' ? 'Comentario' : 'Publicación') +
                    '</h3>' +
                    '<p style="font-size: 0.83rem; color: var(--text-muted); margin-top: 4px; margin-bottom: 0;">' + esc(itemTitulo || 'Elemento seleccionado') + '</p>' +
                '</div>' +
                '<button type="button" onclick="cerrarModalReporte()" class="modal-close-btn" style="background: none; border: none; font-size: 1.3rem; color: var(--text-muted); cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +

            '<form id="form-reporte" onsubmit="enviarReporte(event, \'' + tipoObjetivo + '\', \'' + (pubTipo || '') + '\', ' + (pubId || 0) + ', ' + (comId || 0) + ')">' +
                '<div style="margin-bottom: 14px;">' +
                    '<label style="display: block; font-size: 0.88rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">' +
                        'Motivo del Reporte <span style="color: var(--accent-terracotta);">*</span>' +
                    '</label>' +
                    '<select id="reporte-motivo" required style="width: 100%; padding: 10px 12px; border-radius: var(--radius-md); background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-primary); font-family: inherit; font-size: 0.9rem;">' +
                        '<option value="">-- Selecciona el motivo del reporte --</option>' +
                        '<option value="Información falsa o engañosa">Información falsa o engañosa</option>' +
                        '<option value="Precio irreal o posible estafa">Precio irreal o posible estafa</option>' +
                        '<option value="Spam o publicidad no deseada">Spam o publicidad no deseada</option>' +
                        '<option value="Lenguaje ofensivo o inapropiado">Lenguaje ofensivo o inapropiado</option>' +
                        '<option value="Producto o servicio inexistente">Producto o servicio inexistente</option>' +
                        '<option value="Otro motivo">Otro motivo</option>' +
                    '</select>' +
                '</div>' +

                '<div style="margin-bottom: 18px;">' +
                    '<label style="display: block; font-size: 0.88rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">' +
                        'Detalles o Explicación Adicional (opcional)' +
                    '</label>' +
                    '<textarea id="reporte-detalles" rows="3" placeholder="Describe brevemente el problema para que el Administrador de Direct Vitor pueda validar o descartar el reporte..." style="width: 100%; border-radius: var(--radius-md); background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-primary); padding: 10px 12px; font-family: inherit; font-size: 0.88rem; resize: vertical;"></textarea>' +
                '</div>' +

                '<div style="background: var(--chip-bg); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 18px; font-size: 0.8rem; color: var(--text-muted); border-left: 3px solid var(--accent-gold);">' +
                    '<i class="fa-solid fa-shield-halved" style="color: var(--accent-gold);"></i> Este reporte será enviado de forma confidencial al panel del Administrador para su validación.' +
                '</div>' +

                '<div style="display: flex; justify-content: flex-end; gap: 10px;">' +
                    '<button type="button" onclick="cerrarModalReporte()" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 8px 16px; border-radius: 20px; cursor: pointer; font-family: inherit; font-size: 0.85rem;">Cancelar</button>' +
                    '<button type="submit" id="btn-submit-reporte" class="btn-contact" style="background: var(--accent-terracotta); border: none; cursor: pointer; padding: 8px 20px; font-size: 0.85rem; color: #fff;">' +
                        '<i class="fa-solid fa-flag"></i> Enviar Reporte' +
                    '</button>' +
                '</div>' +
            '</form>' +
        '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cerrarModalReporte();
    });
}

async function enviarReporte(e, tipoObjetivo, pubTipo, pubId, comId) {
    if (e && e.preventDefault) e.preventDefault();
    const motivo = document.getElementById('reporte-motivo').value;
    const detalles = document.getElementById('reporte-detalles').value;
    const btn = document.getElementById('btn-submit-reporte');

    if (!motivo) return;

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'; }

    const res = await api('crear_reporte', {
        tipo_objetivo: tipoObjetivo,
        publicacion_tipo: pubTipo,
        publicacion_id: pubId,
        comentario_id: comId,
        motivo: motivo,
        detalles: detalles
    });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-flag"></i> Enviar Reporte'; }

    if (res.ok) {
        cerrarModalReporte();
        alert('✅ ' + (res.msg || 'Reporte enviado al administrador.'));
    } else {
        alert('❌ ' + (res.error || 'No se pudo enviar el reporte.'));
    }
}
