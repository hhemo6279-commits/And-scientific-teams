import { api } from './api.js';

// ======= خريطة ميزات المنصة (Feature Flags) للواجهة =======
// تُحمَّل مرة واحدة بعد تسجيل الدخول وتُخزَّن محلياً؛ عند تعطيل ميزة من لوحة الإعدادات
// تُحدَّث بعد تحديث الصفحة. واجهات الخادم نفسها تمنع البيانات عند التعطيل.

let cache = null;

export async function loadFlags() {
  try {
    const d = await api('/me/settings');
    cache = d.featureFlags || {};
    if (d.site_name) document.title = d.site_name;
    return cache;
  } catch {
    cache = {};
    return cache;
  }
}

export function isFlagOn(key) {
  if (cache && key in cache) return cache[key] === true;
  return true;
}

export function flushFlags() {
  cache = null;
}