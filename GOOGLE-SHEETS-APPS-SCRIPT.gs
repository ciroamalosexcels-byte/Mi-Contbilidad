/**
 * PUENTE CONTABILIDAD <-> GOOGLE SHEETS · V9
 * Compatible con Ciro Contabilidad V9 y con estructuras anteriores.
 *
 * INSTALACIÓN
 * 1. Abrí la planilla > Extensiones > Apps Script.
 * 2. Reemplazá el código por este archivo.
 * 3. Implementar > Nueva implementación > Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 4. Copiá la URL terminada en /exec y pegala en la app.
 *
 * IMPORTANTE
 * - Guarda todas las propiedades conocidas del movimiento en columnas.
 * - También guarda el objeto completo en la columna "json" para no perder
 *   campos nuevos que se agreguen en futuras versiones.
 * - Guarda todas las propiedades generales del estado en Config, en fragmentos,
 *   evitando el límite de caracteres por celda.
 * - Mantiene compatibilidad con las estructuras viejas.
 */

const SHEET_MOV = 'Movimientos';
const SHEET_CFG = 'Config';
const SCHEMA_VERSION = 3;
const CFG_CHUNK_SIZE = 40000;

const COLS = [
  'id',
  'tipo',
  'monto',
  'desc',
  'cat',
  'fecha',
  'hora',
  'fechaHora',
  'venc',
  'estado',
  'fijo',
  'fijoId',
  'cuota',
  'fiscal',
  'autoExcedente',
  'excedenteManual',
  'json'
];

function doGet() {
  try {
    return json_(readState_());
  } catch (err) {
    return json_({ ok: false, error: String(err && err.stack ? err.stack : err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      throw new Error('Solicitud sin contenido.');
    }

    const body = JSON.parse(e.postData.contents);
    validateState_(body);
    writeState_(body);

    return json_({
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      movimientos: Array.isArray(body.movs) ? body.movs.length : 0,
      guardadoEn: new Date().toISOString()
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.stack ? err.stack : err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No se encontró una planilla activa.');
  return ss;
}

function sheet_(name) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function validateState_(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('El estado recibido no es un objeto válido.');
  }
  if (!Array.isArray(state.movs)) {
    throw new Error('Falta el arreglo "movs".');
  }
  state.movs.forEach(function (m, index) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      throw new Error('Movimiento inválido en la posición ' + index + '.');
    }
  });
}

function fmtFecha_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const txt = v === null || v === undefined ? '' : String(v).trim().replace('T', ' ');
  const match = txt.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function fmtHora_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm:ss');
  }
  const txt = v === null || v === undefined ? '' : String(v).trim();
  const match = txt.match(/\b\d{2}:\d{2}(?::\d{2})?\b/);
  if (!match) return '';
  return match[0].length === 5 ? match[0] + ':00' : match[0];
}

function separarFechaHora_(valor) {
  const txt = valor === null || valor === undefined
    ? ''
    : String(valor).trim().replace('T', ' ');
  return { fecha: fmtFecha_(txt), hora: fmtHora_(txt) };
}

function unirFechaHora_(fecha, hora) {
  const f = fmtFecha_(fecha);
  const h = fmtHora_(hora);
  if (f && h) return f + ' ' + h;
  return f || '';
}

function bool_(value) {
  if (value === true || value === 1) return true;
  const txt = String(value === undefined || value === null ? '' : value).toLowerCase().trim();
  return txt === 'true' || txt === '1' || txt === 'si' || txt === 'sí';
}

function num_(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  const normalized = String(value === undefined || value === null ? '' : value)
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(normalized);
  return isFinite(n) ? n : 0;
}

function safeJsonParse_(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try { return JSON.parse(String(raw)); } catch (_) { return fallback; }
}

function readState_() {
  const stateExtra = readConfigState_();
  const movs = readMovements_();
  const state = stateExtra && typeof stateExtra === 'object' && !Array.isArray(stateExtra)
    ? stateExtra
    : {};

  state.movs = movs;
  if (!Array.isArray(state.fijos)) state.fijos = [];
  if (!Array.isArray(state.cats)) state.cats = [];
  if (state.goalMin === undefined || state.goalMin === null) state.goalMin = 1200000;
  if (state.goalMax === undefined || state.goalMax === null) state.goalMax = 1600000;
  if (state.useFiscal === undefined) state.useFiscal = true;
  state.schemaVersion = SCHEMA_VERSION;

  return state;
}

function readMovements_() {
  const sh = sheet_(SHEET_MOV);
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const headers = values[0].map(function (h) { return String(h || '').trim(); });
  const idx = {};
  headers.forEach(function (h, i) { if (h) idx[h] = i; });

  const hasNamedHeaders = idx.id !== undefined || idx.tipo !== undefined || idx.json !== undefined;
  const movs = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (row.every(function (v) { return v === '' || v === null; })) continue;

    let movement = {};

    if (hasNamedHeaders && idx.json !== undefined) {
      const parsed = safeJsonParse_(row[idx.json], null);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        movement = parsed;
      }
    }

    if (hasNamedHeaders) {
      overlayKnownFields_(movement, row, idx);
    } else {
      // Compatibilidad extrema con una hoja sin encabezados reconocibles.
      overlayLegacyByPosition_(movement, row, headers);
    }

    if (!movement.id && !movement.desc) continue;
    normalizeMovement_(movement);
    movs.push(movement);
  }

  return movs;
}

function overlayKnownFields_(m, row, idx) {
  function has(name) { return idx[name] !== undefined; }
  function value(name) { return has(name) ? row[idx[name]] : undefined; }

  if (has('id')) m.id = String(value('id') || '');
  if (has('tipo')) m.tipo = String(value('tipo') || '');
  if (has('monto')) m.monto = num_(value('monto'));
  if (has('desc')) m.desc = String(value('desc') || '');
  if (has('cat')) m.cat = String(value('cat') || '');

  if (has('fechaHora') || has('hora')) {
    const fechaHora = has('fechaHora') ? String(value('fechaHora') || '').trim() : '';
    const fecha = has('fecha') ? fmtFecha_(value('fecha')) : '';
    const hora = has('hora') ? fmtHora_(value('hora')) : '';
    m.fecha = fechaHora || unirFechaHora_(fecha, hora);
  } else if (has('fecha')) {
    m.fecha = value('fecha') instanceof Date
      ? unirFechaHora_(value('fecha'), value('fecha'))
      : String(value('fecha') || '').trim();
  }

  if (has('venc')) m.venc = fmtFecha_(value('venc'));
  if (has('estado')) m.estado = String(value('estado') || 'pago');
  if (has('fijo')) m.fijo = bool_(value('fijo'));
  if (has('fijoId')) m.fijoId = String(value('fijoId') || '');
  if (has('cuota')) m.cuota = bool_(value('cuota'));
  if (has('fiscal')) m.fiscal = String(value('fiscal') || 'negro');
  if (has('autoExcedente')) m.autoExcedente = bool_(value('autoExcedente'));
  if (has('excedenteManual')) m.excedenteManual = bool_(value('excedenteManual'));
}

function overlayLegacyByPosition_(m, row, headers) {
  const hasNewCols = headers.indexOf('hora') !== -1 && headers.indexOf('fechaHora') !== -1;
  if (hasNewCols) {
    m.id = String(row[0] || '');
    m.tipo = row[1] || '';
    m.monto = num_(row[2]);
    m.desc = row[3] || '';
    m.cat = row[4] || '';
    m.fecha = String(row[7] || '').trim() || unirFechaHora_(row[5], row[6]);
    m.venc = fmtFecha_(row[8]);
    m.estado = row[9] || 'pago';
    m.fijo = bool_(row[10]);
  } else {
    m.id = String(row[0] || '');
    m.tipo = row[1] || '';
    m.monto = num_(row[2]);
    m.desc = row[3] || '';
    m.cat = row[4] || '';
    m.fecha = String(row[5] || '').trim();
    m.venc = fmtFecha_(row[6]);
    m.estado = row[7] || 'pago';
    m.fijo = bool_(row[8]);
  }
}

function normalizeMovement_(m) {
  m.id = String(m.id || '');
  m.tipo = String(m.tipo || 'gasto');
  m.monto = num_(m.monto);
  m.desc = String(m.desc || '');
  m.cat = String(m.cat || 'Otro');
  m.fecha = String(m.fecha || '');
  m.venc = fmtFecha_(m.venc);
  m.estado = String(m.estado || ((m.tipo === 'deuda' || m.tipo === 'medeben') ? 'impago' : 'pago'));
  m.fijo = bool_(m.fijo);
  if (m.fijoId !== undefined) m.fijoId = String(m.fijoId || '');
  if (m.cuota !== undefined) m.cuota = bool_(m.cuota);
  m.fiscal = m.fiscal === 'blanco' ? 'blanco' : 'negro';
  if (m.autoExcedente !== undefined) m.autoExcedente = bool_(m.autoExcedente);
  if (m.excedenteManual !== undefined) m.excedenteManual = bool_(m.excedenteManual);
}

function writeState_(state) {
  writeMovements_(state.movs || []);

  const stateExtra = {};
  Object.keys(state).forEach(function (key) {
    if (key !== 'movs') stateExtra[key] = state[key];
  });
  stateExtra.schemaVersion = SCHEMA_VERSION;
  stateExtra.lastSavedAt = new Date().toISOString();

  writeConfigState_(stateExtra);
  SpreadsheetApp.flush();
}

function writeMovements_(movs) {
  const sh = sheet_(SHEET_MOV);
  const rows = [COLS];

  movs.forEach(function (original) {
    const m = Object.assign({}, original || {});
    normalizeMovement_(m);

    const partes = separarFechaHora_(m.fecha || '');
    const fecha = partes.fecha;
    const hora = partes.hora;
    const fechaHora = unirFechaHora_(fecha, hora);

    rows.push([
      m.id || '',
      m.tipo || '',
      num_(m.monto),
      m.desc || '',
      m.cat || '',
      fecha,
      hora,
      fechaHora,
      fmtFecha_(m.venc),
      m.estado || 'pago',
      bool_(m.fijo),
      m.fijoId || '',
      bool_(m.cuota),
      m.fiscal === 'blanco' ? 'blanco' : 'negro',
      bool_(m.autoExcedente),
      bool_(m.excedenteManual),
      JSON.stringify(original || {})
    ]);
  });

  sh.clearContents();
  sh.getRange(1, 1, rows.length, COLS.length).setValues(rows);
  sh.setFrozenRows(1);

  if (rows.length > 1) {
    // Fechas y horas quedan como texto para que Sheets no cambie la zona horaria.
    sh.getRange(2, 6, rows.length - 1, 4).setNumberFormat('@');
    sh.getRange(2, 3, rows.length - 1, 1).setNumberFormat('#,##0');
    sh.getRange(2, 11, rows.length - 1, 2).setNumberFormat('@');
    sh.getRange(2, 13, rows.length - 1, 4).setNumberFormat('@');
  }

  try {
    sh.autoResizeColumns(1, Math.min(COLS.length, 16));
    sh.setColumnWidth(COLS.length, 320);
  } catch (_) {}
}

function readConfigState_() {
  const sh = sheet_(SHEET_CFG);
  const values = sh.getDataRange().getValues();
  if (!values || !values.length) return {};

  // Compatibilidad con el formato viejo: Config!A1 contiene el JSON completo.
  const a1 = values[0] && values[0][0];
  if (a1 && String(a1).trim().charAt(0) === '{') {
    return safeJsonParse_(a1, {});
  }

  const map = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    if (!key) continue;
    map[key] = String(values[i][1] === undefined || values[i][1] === null ? '' : values[i][1]);
  }

  const count = Number(map.stateChunks || 0);
  if (!count) return {};

  let json = '';
  for (let n = 1; n <= count; n++) json += map['state_' + n] || '';
  return safeJsonParse_(json, {});
}

function writeConfigState_(stateExtra) {
  const sh = sheet_(SHEET_CFG);
  const json = JSON.stringify(stateExtra || {});
  const chunks = [];

  for (let i = 0; i < json.length; i += CFG_CHUNK_SIZE) {
    chunks.push(json.slice(i, i + CFG_CHUNK_SIZE));
  }
  if (!chunks.length) chunks.push('{}');

  const rows = [
    ['clave', 'valor'],
    ['schemaVersion', String(SCHEMA_VERSION)],
    ['stateChunks', String(chunks.length)]
  ];
  chunks.forEach(function (chunk, index) {
    rows.push(['state_' + (index + 1), chunk]);
  });

  sh.clearContents();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, rows.length, 2).setNumberFormat('@');
  sh.setFrozenRows(1);
  try {
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(2, 600);
  } catch (_) {}
}

/**
 * Ejecutá esta función manualmente desde Apps Script para verificar la planilla.
 * No borra datos: escribe el estado actual y lo vuelve a leer.
 */
function testPuenteContabilidad() {
  const before = readState_();
  validateState_(before);
  writeState_(before);
  const after = readState_();

  const beforeJson = canonicalJson_(before);
  const afterJson = canonicalJson_(after);
  const ok = beforeJson === afterJson;

  const result = {
    ok: ok,
    movimientosAntes: before.movs.length,
    movimientosDespues: after.movs.length,
    schemaVersion: SCHEMA_VERSION,
    detalle: ok
      ? 'Lectura y escritura verificadas sin pérdida de datos.'
      : 'Se detectaron diferencias. Revisá el registro de ejecución.'
  };

  Logger.log(JSON.stringify(result, null, 2));
  if (!ok) {
    Logger.log('ANTES: ' + beforeJson);
    Logger.log('DESPUÉS: ' + afterJson);
    throw new Error(result.detalle);
  }
  return result;
}

function canonicalJson_(value) {
  return JSON.stringify(sortDeep_(value));
}

function sortDeep_(value) {
  if (Array.isArray(value)) return value.map(sortDeep_);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    Object.keys(value).sort().forEach(function (key) {
      // Estos metadatos cambian en cada guardado y no deben invalidar el test.
      if (key === 'lastSavedAt' || key === 'schemaVersion') return;
      out[key] = sortDeep_(value[key]);
    });
    return out;
  }
  return value;
}
