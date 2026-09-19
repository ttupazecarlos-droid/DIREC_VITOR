/* ========================================================
   DIRECT VITOR - PUBLICIDAD
   Datos de los negocios a publicitar (3 restaurantes) y
   generacion de la columna lateral de publicidad.
   Incluye la gestion desde el Panel de Administracion:
   cuenta regresiva de publicacion, pausar, reanudar,
   modificar, eliminar y agregar anuncios.
   ======================================================== */

const PUBLICIDAD_KEY = 'campo_publicidad_v1';

const RESTAURANTES_PUBLICIDAD = [
    {
        id: 1,
        nombre: 'La Casona del Valle',
        categoria: 'Restaurante de Comida Criolla',
        slogan: 'Sabores del campo en tu mesa',
        descripcion: 'Platos tipicos preparados con productos frescos cosechados en el Valle de Vitor.',
        especialidad: 'Chicharron de chancho / Cauche de queso',
        telefono: '+51 954 000 111',
        direccion: 'Anexo La Hoya, Valle de Vitor',
        horario: 'Lun a Dom / 8:00 a.m. - 8:00 p.m.',
        color: '#e76f51',
        icono: 'fa-utensils',
        duracionDias: 30
    },
    {
        id: 2,
        nombre: 'Picanteria El Fundo',
        categoria: 'Picanteria Arequipeña',
        slogan: 'Tradicion arequipeña al 100%',
        descripcion: 'Autentica comida arequipeña preparada con insumos de las chacras del distrito.',
        especialidad: 'Chaque de panza / Adobo de chancho',
        telefono: '+51 961 222 333',
        direccion: 'Anexo El Cruce, Valle de Vitor',
        horario: 'Mar a Dom / 12:00 p.m. - 9:00 p.m.',
        color: '#e9c46a',
        icono: 'fa-bowl-food',
        duracionDias: 30
    },
    {
        id: 3,
        nombre: 'Sabores de Vitor',
        categoria: 'Comida Casera y Organica',
        slogan: 'Del mercado a tu plato',
        descripcion: 'Menus economicos con verduras y frutas orgánicas cultivadas en el valle.',
        especialidad: 'Pollo a la brasa / Ensaladas frescas',
        telefono: '+51 973 444 555',
        direccion: 'Anexo Cural, Valle de Vitor',
        horario: 'Lun a Sab / 11:00 a.m. - 7:00 p.m.',
        color: '#52b788',
        icono: 'fa-plate-wheat',
        duracionDias: 30
    }
];

/* ═══════════════ PERSISTENCIA (localStorage) ═══════════════ */

function publicidadLeer() {
    try {
        const crudo = localStorage.getItem(PUBLICIDAD_KEY);
        if (crudo) {
            const lista = JSON.parse(crudo);
            if (Array.isArray(lista)) {
                return lista.map(function (a) {
                    return {
                        id: Number(a.id),
                        nombre: a.nombre || 'Anuncio',
                        categoria: a.categoria || '',
                        slogan: a.slogan || '',
                        descripcion: a.descripcion || '',
                        especialidad: a.especialidad || '',
                        telefono: a.telefono || '',
                        direccion: a.direccion || '',
                        horario: a.horario || '',
                        color: a.color || '#e76f51',
                        icono: a.icono || 'fa-utensils',
                        imagen: a.imagen || '',
                        estado: a.estado || 'activo',
                        fechaPublicacion: a.fechaPublicacion || new Date().toISOString(),
                        duracionDias: Number(a.duracionDias) || 30,
                        pausaInicio: a.pausaInicio || null
                    };
                });
            }
        }
    } catch (e) { }
    return publicidadSembrar();
}

function publicidadSembrar() {
    const ahora = new Date().toISOString();
    const base = RESTAURANTES_PUBLICIDAD.map(function (r) {
        return {
            id: r.id,
            nombre: r.nombre,
            categoria: r.categoria,
            slogan: r.slogan,
            descripcion: r.descripcion,
            especialidad: r.especialidad,
            telefono: r.telefono,
            direccion: r.direccion,
            horario: r.horario,
            color: r.color,
            icono: r.icono,
            imagen: '',
            estado: 'activo',
            fechaPublicacion: ahora,
            duracionDias: r.duracionDias || 30,
            pausaInicio: null
        };
    });
    publicidadGuardar(base);
    return base;
}

function publicidadGuardar(lista) {
    publicidadGuardarLocal(lista);
    publicidadSubirServidor(lista);
}

function publicidadGuardarLocal(lista) {
    try { localStorage.setItem(PUBLICIDAD_KEY, JSON.stringify(lista)); } catch (e) { }
}

/** Envía la configuración completa de publicidad al servidor (solo admin) */
function publicidadSubirServidor(lista) {
    api('guardar_publicidad', { publicidad: JSON.stringify(lista) });
}

/** Descarga la publicidad del servidor para que se vea igual en todos los
    dispositivos (incluidas las imágenes) y actualiza el caché local. */
async function publicidadSincronizar() {
    try {
        const res = await api('get_publicidad');
        if (res.ok && Array.isArray(res.publicidad) && res.publicidad.length > 0) {
            publicidadGuardarLocal(res.publicidad);
            return res.publicidad;
        }
    } catch (e) { }
    // El servidor aún no tiene publicidad configurada: usar (o sembrar) la local
    const local = publicidadLeer();
    publicidadSubirServidor(local);
    return local;
}

/* ═══════════════ TIEMPO DE PUBLICACION ═══════════════ */

function publicidadFin(anuncio) {
    return new Date(anuncio.fechaPublicacion).getTime() + (anuncio.duracionDias || 30) * 86400000;
}

function publicidadRestanteSeg(anuncio, ahoraMs) {
    const ahora = ahoraMs || Date.now();
    const fin = publicidadFin(anuncio);
    if (anuncio.estado === 'pausado') {
        const congelado = anuncio.pausaInicio ? new Date(anuncio.pausaInicio).getTime() : ahora;
        return Math.max(0, Math.floor((fin - congelado) / 1000));
    }
    return Math.max(0, Math.floor((fin - ahora) / 1000));
}

function publicidadConTiempo(ahoraMs) {
    const ahora = ahoraMs || Date.now();
    return publicidadLeer().map(function (a) {
        return Object.assign({}, a, { restanteSeg: publicidadRestanteSeg(a, ahora) });
    });
}

function publicidadExpirados() {
    const lista = publicidadLeer();
    let cambio = false;
    const ahora = Date.now();
    lista.forEach(function (a, i) {
        if (a.estado === 'activo' && !a.pausaInicio && publicidadFin(a) <= ahora) {
            lista[i].estado = 'expirado';
            lista[i].pausaInicio = null;
            cambio = true;
        }
    });
    if (cambio) publicidadGuardar(lista);
    return lista;
}

/* ═══════════════ ACCIONES DE GESTION ═══════════════ */

function publicidadPausar(id) {
    const lista = publicidadLeer();
    const a = lista.find(function (x) { return Number(x.id) === Number(id); });
    if (a && a.estado === 'activo') {
        a.estado = 'pausado';
        if (!a.pausaInicio) a.pausaInicio = new Date().toISOString();
        publicidadGuardar(lista);
    }
}

function publicidadReanudar(id) {
    const lista = publicidadLeer();
    const a = lista.find(function (x) { return Number(x.id) === Number(id); });
    if (a && a.estado === 'pausado') {
        const ahora = Date.now();
        if (a.pausaInicio) {
            const pausadoMs = ahora - new Date(a.pausaInicio).getTime();
            a.fechaPublicacion = new Date(new Date(a.fechaPublicacion).getTime() + pausadoMs).toISOString();
        }
        a.pausaInicio = null;
        a.estado = 'activo';
        publicidadGuardar(lista);
    }
}

function publicidadEliminar(id) {
    const lista = publicidadLeer().filter(function (x) { return Number(x.id) !== Number(id); });
    publicidadGuardar(lista);
}

function publicidadGuardarAnuncio(datos) {
    const lista = publicidadLeer();
    const idx = lista.findIndex(function (x) { return Number(x.id) === Number(datos.id); });
    if (idx >= 0) {
        const guardarEstado = (datos.estado !== undefined) ? datos.estado : lista[idx].estado;
        lista[idx] = Object.assign({}, lista[idx], datos, { estado: guardarEstado });
        if (datos.tiempoRenovado) {
            lista[idx].fechaPublicacion = new Date().toISOString();
            lista[idx].pausaInicio = null;
            lista[idx].estado = 'activo';
        }
    } else {
        const maxId = lista.reduce(function (mx, x) { return Math.max(mx, Number(x.id) || 0); }, 0);
        lista.push({
            id: maxId + 1,
            nombre: datos.nombre || 'Anuncio',
            categoria: datos.categoria || '',
            slogan: datos.slogan || '',
            descripcion: datos.descripcion || '',
            especialidad: datos.especialidad || '',
            telefono: datos.telefono || '',
            direccion: datos.direccion || '',
            horario: datos.horario || '',
            color: datos.color || '#e76f51',
            icono: datos.icono || 'fa-utensils',
            imagen: datos.imagen || '',
            estado: 'activo',
            fechaPublicacion: new Date().toISOString(),
            duracionDias: Number(datos.duracionDias) || 30,
            pausaInicio: null
        });
    }
    publicidadGuardar(lista);
}

/* ═══════════════ PANEL ADMIN: TABLA DE GESTION ═══════════════ */

function fmtCuenta(seg) {
    const d = Math.floor(seg / 86400);
    const h = Math.floor((seg % 86400) / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    const p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d > 0 ? d + 'd ' : '') + p(h) + ':' + p(m) + ':' + p(s);
}

function estadoPub(estado) {
    const mapa = {
        activo: { texto: 'Activo', color: 'var(--accent-mint)' },
        pausado: { texto: 'Pausado', color: 'var(--accent-gold)' },
        expirado: { texto: 'Expirado', color: 'var(--text-muted)' }
    };
    return mapa[estado] || { texto: estado, color: 'var(--text-muted)' };
}

function renderGestionPublicidad() {
    publicidadExpirados();
    const cont = document.getElementById('gestion-publicidad');
    if (!cont) return;
    if (window.__tidPub) { clearInterval(window.__tidPub); window.__tidPub = null; }

    const lista = publicidadConTiempo(Date.now());

    if (lista.length === 0) {
        cont.innerHTML = '<p style="padding:20px 24px; text-align:center; color:var(--text-muted); font-size:0.9rem;">No hay anuncios registrados. Usa el botón "Agregar Publicidad" para crear el primero.</p>';
        return;
    }

    let filas = '';
    lista.forEach(function (a) {
        const st = estadoPub(a.estado);
        const pausaBtn = (a.estado === 'activo')
            ? '<button type="button" onclick="togglePublicidad(' + a.id + ')" title="Pausar" style="font-family:inherit; background:rgba(233,196,106,0.15); color:var(--accent-gold); border:1px solid rgba(233,196,106,0.3); padding:6px 11px; border-radius:8px; cursor:pointer; font-size:0.8rem; transition:var(--transition);"><i class="fa-solid fa-pause"></i></button>'
            : '<button type="button" onclick="togglePublicidad(' + a.id + ')" title="Reanudar" style="font-family:inherit; background:rgba(82,183,136,0.15); color:var(--accent-mint); border:1px solid rgba(82,183,136,0.3); padding:6px 11px; border-radius:8px; cursor:pointer; font-size:0.8rem; transition:var(--transition);"><i class="fa-solid fa-play"></i></button>';
        const modBtn = '<button type="button" onclick="publicidadModal(' + a.id + ')" title="Modificar" style="font-family:inherit; background:rgba(233,196,106,0.12); color:var(--accent-gold); border:1px solid rgba(233,196,106,0.3); padding:6px 11px; border-radius:8px; cursor:pointer; font-size:0.8rem; transition:var(--transition);"><i class="fa-solid fa-pen"></i></button>';
        const delBtn = '<button type="button" onclick="borrarPublicidad(' + a.id + ')" title="Eliminar" style="font-family:inherit; background:rgba(231,111,81,0.15); color:var(--accent-terracotta); border:1px solid rgba(231,111,81,0.3); padding:6px 11px; border-radius:8px; cursor:pointer; font-size:0.8rem; transition:var(--transition);"><i class="fa-solid fa-trash"></i></button>';

        filas +=
            '<tr style="border-bottom:1px solid var(--border-color);">' +
                '<td style="padding:12px 16px; color:var(--text-muted);">#' + a.id + '</td>' +
                '<td style="padding:12px 16px;">' +
                    '<span style="display:inline-flex; width:34px; height:34px; border-radius:9px; align-items:center; justify-content:center; background:' + esc(a.color) + '22; color:' + esc(a.color) + '; margin-right:8px;"><i class="fa-solid ' + esc(a.icono) + '"></i></span>' +
                    '<strong style="color:var(--text-primary);">' + esc(a.nombre) + '</strong><br>' +
                    '<span style="color:var(--text-muted); font-size:0.8rem;">' + esc(a.categoria) + '</span>' +
                '</td>' +
                '<td style="padding:12px 16px; text-align:center;">' +
                    '<span class="pub-estado" data-estado-id="' + a.id + '" style="border:1px solid ' + st.color + '; color:' + st.color + '; padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:700;">' + st.texto + '</span>' +
                '</td>' +
                '<td style="padding:12px 16px; text-align:center; color:var(--accent-gold); font-family:\'Outfit\'; font-weight:700; font-size:0.88rem; white-space:nowrap;">' +
                    '<i class="fa-regular fa-hourglass-half"></i> <span class="pub-cd" data-cd-id="' + a.id + '">' + fmtCuenta(a.restanteSeg) + '</span>' +
                '</td>' +
                '<td style="padding:12px 16px; text-align:center;">' +
                    '<div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">' + pausaBtn + modBtn + delBtn + '</div>' +
                '</td>' +
            '</tr>';
    });

    cont.innerHTML =
        '<div style="overflow-x:auto;">' +
            '<table style="width:100%; border-collapse:collapse; font-size:0.88rem;">' +
                '<thead><tr style="background:var(--table-head-bg);">' +
                    '<th style="padding:12px 16px; text-align:left; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--border-color);">ID</th>' +
                    '<th style="padding:12px 16px; text-align:left; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--border-color);">Anuncio</th>' +
                    '<th style="padding:12px 16px; text-align:center; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--border-color);">Estado</th>' +
                    '<th style="padding:12px 16px; text-align:center; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--border-color);">Tiempo de Publicación</th>' +
                    '<th style="padding:12px 16px; text-align:center; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--border-color);">Acciones</th>' +
                '</tr></thead>' +
                '<tbody>' + filas + '</tbody>' +
            '</table>' +
        '</div>';

    window.__tidPub = setInterval(actualizarCuentasPublicidad, 1000);
}

function actualizarCuentasPublicidad() {
    const lista = publicidadConTiempo(Date.now());
    const mapa = {};
    lista.forEach(function (a) { mapa[a.id] = a; });

    document.querySelectorAll('.pub-cd').forEach(function (el) {
        const id = Number(el.getAttribute('data-cd-id'));
        const a = mapa[id];
        if (!a) return;
        el.textContent = (a.restanteSeg > 0) ? fmtCuenta(a.restanteSeg) : 'Finalizado';
    });

    document.querySelectorAll('.pub-estado').forEach(function (el) {
        const id = Number(el.getAttribute('data-estado-id'));
        const a = mapa[id];
        if (!a) return;
        const st = estadoPub(a.estado);
        el.textContent = st.texto;
        el.style.color = st.color;
        el.style.borderColor = st.color;
    });
}

function togglePublicidad(id) {
    const lista = publicidadLeer();
    const a = lista.find(function (x) { return Number(x.id) === Number(id); });
    if (!a) return;
    if (a.estado === 'activo') {
        publicidadPausar(id);
    } else {
        publicidadReanudar(id);
    }
    renderGestionPublicidad();
}

function borrarPublicidad(id) {
    if (!confirm('¿Eliminar este anuncio de publicidad?')) return;
    publicidadEliminar(id);
    renderGestionPublicidad();
}

/* ═══════════════ PANEL ADMIN: MODAL AGREGAR / MODIFICAR ═══════════════ */

function publicidadModal(anuncioId) {
    const lista = publicidadLeer();
    const editar = (anuncioId !== undefined && anuncioId !== null)
        ? lista.find(function (x) { return Number(x.id) === Number(anuncioId); })
        : null;
    const f = editar || {};

    const campo = function (label, extra) {
        return '<label style="display:block; font-size:0.82rem; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">' + label + '</label>' + extra;
    };
    const input = function (name, val, tipo) {
        return '<input type="' + (tipo || 'text') + '" name="' + name + '" value="' + esc(val) + '" style="width:100%; box-sizing:border-box; background:var(--bg-input,var(--bg-base)); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:9px 12px; color:var(--text-primary); font-family:inherit; font-size:0.88rem;">';
    };

    const iconos = {
        'fa-utensils': 'Restaurante / Cocina',
        'fa-bowl-food': 'Comida en tazón',
        'fa-plate-wheat': 'Plato de trigo',
        'fa-burger': 'Hamburguesa',
        'fa-pizza-slice': 'Pizza',
        'fa-mug-hot': 'Café / Bebida caliente',
        'fa-martini-glass-citrus': 'Cóctel / Bar',
        'fa-store': 'Tienda / Local',
        'fa-cake-candles': 'Pastelería',
        'fa-spray-can': 'Agroquímico / Fumigación',
        'fa-flask': 'Agroquímico / Químico',
        'fa-vial': 'Fertilizante líquido',
        'fa-droplet': 'Líquido / Riego',
        'fa-seedling': 'Cultivo / Fertilizante',
        'fa-leaf': 'Fertilizante orgánico'
    };
    const selectIconos = '<select name="icono" style="width:100%; box-sizing:border-box; background:var(--input-bg); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:9px 12px; color:var(--text-primary); font-family:inherit; font-size:0.88rem; cursor:pointer;">' +
        Object.keys(iconos).map(function (ic) {
            return '<option value="' + ic + '" style="color:var(--text-primary); background:var(--input-bg);"' + ((editar && f.icono === ic) ? ' selected' : '') + '>' + iconos[ic] + '</option>';
        }).join('') +
        '</select>';

    const overlay = document.createElement('div');
    overlay.id = 'modal-publicidad';
    overlay.setAttribute('style', 'position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;');

    overlay.innerHTML =
        '<div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); width:100%; max-width:640px; max-height:92vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
            '<div style="padding:20px 24px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; background:var(--bg-surface);">' +
                '<h3 style="font-family:\'Outfit\'; font-size:1.15rem; font-weight:800; color:var(--text-primary); margin:0;"><i class="fa-solid fa-bullhorn" style="color:var(--accent-gold);"></i> ' + (editar ? 'Modificar Publicidad' : 'Agregar Publicidad') + '</h3>' +
                '<button type="button" class="pub-modal-cerrar" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:4px 8px;"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div style="padding:20px 24px; display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px;">' +
                '<div>' + campo('Nombre del negocio *', input('nombre', f.nombre)) + '</div>' +
                '<div>' + campo('Categoría', input('categoria', f.categoria)) + '</div>' +
                '<div>' + campo('Slogan', input('slogan', f.slogan)) + '</div>' +
                '<div>' + campo('Teléfono / WhatsApp', input('telefono', f.telefono)) + '</div>' +
                '<div>' + campo('Dirección', input('direccion', f.direccion)) + '</div>' +
                '<div>' + campo('Horario', input('horario', f.horario)) + '</div>' +
                '<div>' + campo('Duración (días) *', input('duracionDias', f.duracionDias || 30, 'number')) + '</div>' +
                '<div>' + campo('Color', input('color', f.color, 'color')) + '</div>' +
                '<div>' + campo('Ícono', selectIconos) + '</div>' +
                '<div style="grid-column:1/-1;">' + campo('Foto / Imagen del negocio', '' +
                    '<div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">' +
                        '<input type="file" name="foto" accept="image/*" style="font-size:0.82rem; color:var(--text-secondary);">' +
                        '<input type="hidden" name="imagen" value="' + esc(f.imagen || '') + '">' +
                        '<img class="pub-foto-preview" alt="Previsualización" style="' + (f.imagen ? 'display:block;' : 'display:none;') + ' width:160px; height:110px; flex-shrink:0; object-fit:cover; object-position:center; border-radius:10px; border:1px solid var(--border-color);">' +
                        '<button type="button" class="pub-foto-quitar" style="' + (f.imagen ? 'display:inline-flex;' : 'display:none;') + ' font-family:inherit; background:rgba(231,111,81,0.12); color:var(--accent-terracotta); border:1px solid rgba(231,111,81,0.3); padding:6px 12px; border-radius:8px; cursor:pointer; font-size:0.8rem; align-items:center;"><i class="fa-solid fa-trash"></i> Quitar foto</button>' +
                        '<span id="pub-foto-hint" style="font-size:0.75rem; color:var(--text-muted);">Máx. 1.5 MB (JPG/PNG/WebP/GIF)</span>' +
                    '</div>') +
                '</div>' +
                '<div style="grid-column:1/-1;">' + campo('Descripción', '<textarea name="descripcion" rows="2" style="width:100%; box-sizing:border-box; background:var(--bg-input,var(--bg-base)); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:9px 12px; color:var(--text-primary); font-family:inherit; font-size:0.88rem; resize:vertical;">' + esc(f.descripcion) + '</textarea>') + '</div>' +
                '<div style="grid-column:1/-1;">' + campo('Especialidad', '<textarea name="especialidad" rows="2" style="width:100%; box-sizing:border-box; background:var(--bg-input,var(--bg-base)); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:9px 12px; color:var(--text-primary); font-family:inherit; font-size:0.88rem; resize:vertical;">' + esc(f.especialidad) + '</textarea>') + '</div>' +
            '</div>' +
            '<div style="padding:16px 24px; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; position:sticky; bottom:0; background:var(--bg-surface);">' +
                (editar ? '<label style="font-size:0.82rem; color:var(--text-secondary); display:flex; align-items:center; gap:8px; cursor:pointer;"><input type="checkbox" name="renovar" style="accent-color:var(--accent-mint);"> Volver a publicar desde hoy (reinicia la cuenta regresiva)</label>' : '<span></span>') +
                '<div style="display:flex; gap:10px;">' +
                    '<button type="button" class="pub-modal-cerrar" style="font-family:inherit; background:rgba(231,111,81,0.12); color:var(--accent-terracotta); border:1px solid rgba(231,111,81,0.3); padding:9px 18px; border-radius:20px; cursor:pointer; font-weight:700; font-size:0.85rem;">Cancelar</button>' +
                    '<button type="button" class="pub-modal-guardar" style="font-family:inherit; background:var(--accent-mint); color:var(--text-on-accent); border:none; padding:9px 20px; border-radius:20px; cursor:pointer; font-weight:800; font-size:0.85rem;"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    function cerrar() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function leerCampos() {
        const q = function (name) {
            const el = overlay.querySelector('[name="' + name + '"]');
            return el ? el.value : '';
        };
        return {
            nombre: q('nombre').trim(),
            categoria: q('categoria').trim(),
            slogan: q('slogan').trim(),
            telefono: q('telefono').trim(),
            direccion: q('direccion').trim(),
            horario: q('horario').trim(),
            descripcion: q('descripcion').trim(),
            especialidad: q('especialidad').trim(),
            duracionDias: Number(q('duracionDias')) || 30,
            color: q('color') || '#e76f51',
            icono: q('icono') || 'fa-utensils',
            imagen: q('imagen')
        };
    }

    overlay.querySelectorAll('.pub-modal-cerrar').forEach(function (b) {
        b.addEventListener('click', cerrar);
    });
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cerrar();
    });

    var inputFoto = overlay.querySelector('[name="foto"]');
    var hiddenImagen = overlay.querySelector('[name="imagen"]');
    var preview = overlay.querySelector('.pub-foto-preview');
    var btnQuitar = overlay.querySelector('.pub-foto-quitar');

    if (inputFoto) {
        var hint = overlay.querySelector('#pub-foto-hint');
        inputFoto.addEventListener('change', async function () {
            var archivo = inputFoto.files && inputFoto.files[0];
            if (!archivo) return;
            if (!/^image\/(jpeg|png|webp|gif)$/.test(archivo.type)) {
                alert('Solo se permiten imágenes JPG, PNG, WebP o GIF.');
                inputFoto.value = '';
                return;
            }
            if (archivo.size > 1536 * 1024) {
                alert('La imagen es demasiado grande. Elige una de máximo 1.5 MB.');
                inputFoto.value = '';
                return;
            }
            inputFoto.disabled = true;
            if (hint) hint.textContent = 'Subiendo imagen...';
            var res = await api('subir_imagen', { tipo: 'publicidad', imagen: archivo });
            inputFoto.disabled = false;
            if (hint) hint.textContent = 'Guardada en images/publicidad/ (JPG/PNG/WebP/GIF, máx. 1.5 MB)';
            if (res.ok) {
                hiddenImagen.value = res.imagen;
                preview.src = res.imagen;
                preview.style.display = 'block';
                btnQuitar.style.display = 'inline-flex';
            } else {
                alert(res.error || 'No se pudo guardar la imagen. Intenta de nuevo.');
                inputFoto.value = '';
            }
        });
        btnQuitar.addEventListener('click', function () {
            hiddenImagen.value = '';
            preview.removeAttribute('src');
            preview.style.display = 'none';
            btnQuitar.style.display = 'none';
            inputFoto.value = '';
        });
    }

    overlay.querySelector('.pub-modal-guardar').addEventListener('click', function () {
        const datos = leerCampos();
        if (!datos.nombre) {
            alert('El nombre del negocio es obligatorio.');
            return;
        }
        if (editar) {
            const renovar = overlay.querySelector('[name="renovar"]');
            publicidadGuardarAnuncio(Object.assign(
                { id: editar.id },
                datos,
                (renovar && renovar.checked) ? { tiempoRenovado: true, estado: 'activo' } : {}
            ));
        } else {
            publicidadGuardarAnuncio(datos);
        }
        cerrar();
        renderGestionPublicidad();
    });
}

/* ═══════════════ BLOQUE PUBLICO (columna lateral) ═══════════════ */

/** Genera el HTML con las tarjetas de publicidad de los anuncios activos */
function columnaPublicidad() {
    publicidadExpirados();
    const activos = publicidadConTiempo().filter(function (a) {
        return a.estado === 'activo' && a.restanteSeg > 0;
    });

    if (activos.length === 0) {
        return '<p class="pub-nota" style="border:0;">No hay publicidad activa en este momento.<br>Vuelve pronto.</p>' +
            '<p class="pub-nota">¿Eres Emprendedor y quieres anunciarte? ' +
            '<a href="https://wa.me/51993706366?text=Hola, quiero publicitar mi negocio en Direct Vitor" target="_blank">Escríbenos</a></p>';
    }

    const items = activos.map(function (r) {
        const telefonoLimpio = String(r.telefono || '').replace(/[^0-9]/g, '');
        const textoWa = 'Hola ' + r.nombre + ', me interesa informarme sobre sus platos y reservas (Direct Vitor)';
        const enlaceWa = 'https://wa.me/' + telefonoLimpio + '?text=' + encodeURIComponent(textoWa);
        const banner = r.imagen
            ? '<div class="pub-banner pub-foto"><img src="' + esc(r.imagen) + '" alt="' + esc(r.nombre) + '" loading="lazy"></div>'
            : '<div class="pub-banner"><i class="fa-solid ' + esc(r.icono) + '"></i></div>';

        return '<div class="pub-item" style="--pub-color:' + esc(r.color) + ';">' +
                banner +
                '<div class="pub-cuerpo">' +
                    '<span class="pub-categoria">' + esc(r.categoria) + '</span>' +
                    '<h3 class="pub-nombre">' + esc(r.nombre) + '</h3>' +
                    '<p class="pub-slogan">"' + esc(r.slogan) + '"</p>' +
                    '<p class="pub-desc">' + esc(r.descripcion) + '</p>' +
                    '<p class="pub-especialidad"><i class="fa-solid fa-star"></i> ' + esc(r.especialidad) + '</p>' +
                    '<div class="pub-info">' +
                        '<span><i class="fa-solid fa-location-dot"></i> ' + esc(r.direccion) + '</span>' +
                        '<span><i class="fa-solid fa-clock"></i> ' + esc(r.horario) + '</span>' +
                        '<span><i class="fa-solid fa-phone"></i> ' + esc(r.telefono) + '</span>' +
                    '</div>' +
                    '<a href="' + enlaceWa + '" target="_blank" class="pub-btn">' +
                        '<i class="fa-brands fa-whatsapp"></i> Reservar / Contactar' +
                    '</a>' +
                '</div>' +
            '</div>';
    }).join('');

    return items +
        '<p class="pub-nota">¿Eres Emprendedor y quieres anunciarte? ' +
        '<a href="https://wa.me/51993706366?text=Hola, quiero publicitar mi negocio en Direct Vitor" target="_blank">Escríbenos</a></p>';
}

/** Inserta la publicidad dentro del contenedor indicado */
async function montarPublicidad(idContenedor) {
    const cont = document.getElementById(idContenedor || 'pub-lista');
    if (!cont) return;
    await publicidadSincronizar();
    cont.innerHTML = columnaPublicidad();
}