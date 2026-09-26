/**
 * MI CONTABILIDAD <-> GOOGLE DRIVE
 * Guarda el estado completo en Mi Contabilidad/backup.json.
 * Si este script sigue vinculado a la planilla anterior, la primera ejecución
 * importa Movimientos y Config sin modificar ni borrar esas hojas.
 *
 * INSTALACION
 * 1. Abrí Apps Script y reemplazá todo el código por este archivo.
 * 2. Ejecutá setupDriveStorage() y aceptá el permiso de Google Drive.
 * 3. Implementar > Nueva implementación > Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 4. Pegá en la app la URL terminada en /exec.
 *
 * Si ya usabas el puente anterior, creá una nueva versión de la misma
 * implementación para conservar la URL /exec.
 */

const DRIVE_FOLDER_NAME = 'Mi Contabilidad';
const DRIVE_FILE_NAME = 'backup.json';
const PROP_FOLDER_ID = 'MC_DRIVE_FOLDER_ID';
const PROP_FILE_ID = 'MC_DRIVE_FILE_ID';
const SHEET_MOV = 'Movimientos';
const SHEET_CFG = 'Config';
const SCHEMA_VERSION = 3;
const STORAGE_BACKEND = 'drive-json-v1';
const MAX_JSON_BYTES = 8 * 1024 * 1024;

function doGet() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    return json_(readState_());
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: safeError_(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!e || !e.postData || typeof e.postData.contents !== 'string') throw new Error('Solicitud sin contenido.');
    const state = JSON.parse(e.postData.contents);
    validateState_(state);
    const stored = writeState_(state);
    return json_({ ok: true, schemaVersion: SCHEMA_VERSION, storageBackend: STORAGE_BACKEND, movimientos: stored.movs.length, guardadoEn: stored.lastSavedAt });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: safeError_(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeError_(err) {
  return err && err.message ? String(err.message) : 'No se pudo completar la operación.';
}

function validateState_(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('El estado recibido no es válido.');
  if (!Array.isArray(state.movs)) throw new Error('Falta el arreglo "movs".');
}

function scriptProps_() {
  return PropertiesService.getScriptProperties();
}

function storedFolder_() {
  const id = scriptProps_().getProperty(PROP_FOLDER_ID);
  if (!id) return null;
  try { const folder = DriveApp.getFolderById(id); return folder.isTrashed() ? null : folder; } catch (_) { return null; }
}

function driveFolder_(create) {
  let folder = storedFolder_();
  if (folder) return folder;
  const matches = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  const found = [];
  while (matches.hasNext()) { const item = matches.next(); if (!item.isTrashed()) found.push(item); }
  if (found.length > 1) throw new Error('Hay más de una carpeta "' + DRIVE_FOLDER_NAME + '" en Drive. Dejá una sola para continuar.');
  folder = found[0] || null;
  if (!folder && create) folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  if (folder) scriptProps_().setProperty(PROP_FOLDER_ID, folder.getId());
  return folder;
}

function storedFile_() {
  const id = scriptProps_().getProperty(PROP_FILE_ID);
  if (!id) return null;
  try { const file = DriveApp.getFileById(id); return file.isTrashed() ? null : file; } catch (_) { return null; }
}

function driveFile_(create) {
  let file = storedFile_();
  if (file) return file;
  const folder = driveFolder_(create);
  if (!folder) return null;
  const matches = folder.getFilesByName(DRIVE_FILE_NAME);
  const found = [];
  while (matches.hasNext()) { const item = matches.next(); if (!item.isTrashed()) found.push(item); }
  if (found.length > 1) throw new Error('Hay más de un archivo "' + DRIVE_FILE_NAME + '" en la carpeta. Dejá uno solo para continuar.');
  file = found[0] || null;
  if (!file && create) file = folder.createFile(DRIVE_FILE_NAME, '{}', MimeType.PLAIN_TEXT);
  if (file) scriptProps_().setProperty(PROP_FILE_ID, file.getId());
  return file;
}

function defaultState_() {
  return { movs: [], fijos: [], cats: [], goalMin: 0, goalMax: 0, useFiscal: false, schemaVersion: SCHEMA_VERSION, storageBackend: STORAGE_BACKEND };
}

function readState_() {
  const file = driveFile_(false);
  if (file) {
    const state = JSON.parse(file.getBlob().getDataAsString('UTF-8') || '{}');
    validateState_(state);
    return state;
  }
  const legacy = readLegacyState_();
  if (legacy) return writeState_(legacy);
  return defaultState_();
}

function writeState_(state) {
  validateState_(state);
  const stored = JSON.parse(JSON.stringify(state));
  stored.schemaVersion = SCHEMA_VERSION;
  stored.storageBackend = STORAGE_BACKEND;
  stored.lastSavedAt = new Date().toISOString();
  const text = JSON.stringify(stored);
  if (Utilities.newBlob(text).getBytes().length > MAX_JSON_BYTES) throw new Error('La copia supera el límite de 8 MB. Descargá una copia local antes de continuar.');
  const file = driveFile_(true);
  const previous = file.getBlob().getDataAsString('UTF-8');
  try {
    file.setContent(text);
    const verified = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    validateState_(verified);
  } catch (err) {
    try { file.setContent(previous); } catch (_) {}
    throw err;
  }
  return stored;
}

function setupDriveStorage() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const state = readState_();
    const stored = driveFile_(false) ? state : writeState_(state);
    const result = { ok: true, carpeta: DRIVE_FOLDER_NAME, archivo: DRIVE_FILE_NAME, movimientos: stored.movs.length, storageBackend: STORAGE_BACKEND };
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function readLegacyState_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (_) {}
  if (!ss) return null;
  const movSheet = ss.getSheetByName(SHEET_MOV);
  const cfgSheet = ss.getSheetByName(SHEET_CFG);
  if (!movSheet && !cfgSheet) return null;
  const state = readLegacyConfig_(cfgSheet);
  state.movs = readLegacyMovements_(movSheet);
  if (!Array.isArray(state.fijos)) state.fijos = [];
  if (!Array.isArray(state.cats)) state.cats = [];
  if (state.goalMin == null) state.goalMin = 0;
  if (state.goalMax == null) state.goalMax = 0;
  if (state.useFiscal === undefined) state.useFiscal = false;
  return state;
}

function readLegacyConfig_(sheet) {
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  if (!values.length) return {};
  const first = values[0] && values[0][0];
  if (first && String(first).trim().charAt(0) === '{') return parseJson_(first, {});
  const map = {};
  for (let i = 1; i < values.length; i++) { const key = String(values[i][0] || '').trim(); if (key) map[key] = String(values[i][1] == null ? '' : values[i][1]); }
  const count = Number(map.stateChunks || 0);
  let text = '';
  for (let i = 1; i <= count; i++) text += map['state_' + i] || '';
  return parseJson_(text, {});
}

function readLegacyMovements_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const index = {}; headers.forEach(function (name, i) { if (name) index[name] = i; });
  const movs = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (row.every(function (value) { return value === '' || value === null; })) continue;
    let movement = index.json !== undefined ? parseJson_(row[index.json], {}) : {};
    ['id','tipo','desc','cat','estado','fijoId','fiscal'].forEach(function (key) { if (index[key] !== undefined && row[index[key]] !== '') movement[key] = String(row[index[key]]); });
    if (index.monto !== undefined) movement.monto = number_(row[index.monto]);
    if (index.fechaHora !== undefined && row[index.fechaHora]) movement.fecha = String(row[index.fechaHora]);
    else if (index.fecha !== undefined) movement.fecha = dateText_(row[index.fecha]) + (index.hora !== undefined && row[index.hora] ? ' ' + timeText_(row[index.hora]) : '');
    if (index.venc !== undefined) movement.venc = dateText_(row[index.venc]);
    ['fijo','cuota','autoExcedente','excedenteManual'].forEach(function (key) { if (index[key] !== undefined) movement[key] = bool_(row[index[key]]); });
    if (movement.id || movement.desc) movs.push(movement);
  }
  return movs;
}

function parseJson_(value, fallback) { try { return value ? JSON.parse(String(value)) : fallback; } catch (_) { return fallback; } }
function bool_(value) { return value === true || value === 1 || /^(true|1|si|sí)$/i.test(String(value || '').trim()); }
function number_(value) { const parsed = Number(String(value == null ? '' : value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); return isFinite(parsed) ? parsed : 0; }
function dateText_(value) { if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd'); const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/); return match ? match[0] : ''; }
function timeText_(value) { if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm:ss'); const match = String(value || '').match(/\b\d{2}:\d{2}(?::\d{2})?/); return match ? (match[0].length === 5 ? match[0] + ':00' : match[0]) : ''; }

function testPuenteContabilidad() {
  const before = readState_();
  const after = writeState_(before);
  const result = { ok: JSON.stringify(before.movs) === JSON.stringify(after.movs), movimientos: after.movs.length, storageBackend: STORAGE_BACKEND };
  Logger.log(JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error('La prueba de lectura y escritura no coincidió.');
  return result;
}
