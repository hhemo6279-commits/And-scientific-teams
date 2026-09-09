import db from './db.js';

// ======= إدارة الإعدادات المركزية + مفاتيح الميزات =======
// V1 Foundation: Configuration Management + Feature Flags

export function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function getSettingInt(key, fallback = 0) {
  const v = Number(getSetting(key, String(fallback)));
  return Number.isFinite(v) ? v : fallback;
}

export function setSettings(pairs) {
  db.exec('BEGIN');
  try {
    for (const [k, v] of Object.entries(pairs || {})) {
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        .run(k, String(v));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// جميع الإعدادات ككائن
export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ======= Feature Flags =======

export function isFeatureEnabled(key) {
  return db.prepare('SELECT enabled FROM feature_flags WHERE key = ?').get(key)?.enabled === 1;
}

export function getAllFlags() {
  return db.prepare('SELECT key, enabled, description FROM feature_flags ORDER BY key').all();
}

export function setFlags(flags) {
  db.exec('BEGIN');
  try {
    for (const f of flags || []) {
      db.prepare('INSERT INTO feature_flags (key, enabled, description) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, description = excluded.description')
        .run(f.key, f.enabled ? 1 : 0, f.description || '');
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// خريطة الميزات المفعلة لإرسالها للواجهة
export function flagsMap() {
  const rows = db.prepare('SELECT key, enabled FROM feature_flags').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.enabled === 1]));
}

// ======= سياسة كلمة المرور (من الإعدادات) =======

export function passwordPolicy() {
  return {
    minLength: getSettingInt('password_min_length', 6),
    requireUppercase: getSetting('password_require_uppercase') === '1',
    requireNumber: getSetting('password_require_number') === '1',
    requireSymbol: getSetting('password_require_symbol') === '1',
  };
}

export function checkPasswordPolicy(pw) {
  const p = String(pw || '');
  const pol = passwordPolicy();
  const errors = [];
  if (p.length < pol.minLength) errors.push(`كلمة المرور قصيرة (${pol.minLength}+ أحرف)`);
  if (pol.requireUppercase && !/[A-Z]/.test(p)) errors.push('يجب أن تحتوي على حرف كبير (A-Z)');
  if (pol.requireNumber && !/[0-9]/.test(p)) errors.push('يجب أن تحتوي على رقم');
  if (pol.requireSymbol && !/[^A-Za-z0-9]/.test(p)) errors.push('يجب أن تحتوي على رمز خاص (!@#$...)');
  return { ok: errors.length === 0, errors };
}

// مدير الصيانة: هل المنصة في وضع الصيانة؟
export function isMaintenanceMode() {
  return getSetting('maintenance_mode') === '1';
}

// هل التسجيل مفتوح؟
export function isRegistrationOpen() {
  return getSetting('registration_open') !== '0';
}