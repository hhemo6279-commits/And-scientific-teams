import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { AdminLayout } from './AdminLayout.jsx';

const GENERAL_FIELDS = [
  ['site_name', 'اسم المنصة'],
  ['session_timeout_minutes', 'مدة الجلسة (دقائق)'],
];

const POLICY_FIELDS = [
  ['password_min_length', 'الحد الأدنى لطول كلمة المرور'],
];

const POLICY_TOGGLES = [
  ['password_require_uppercase', 'كلمة المرور تتطلب حرفاً كبيراً (A-Z)'],
  ['password_require_number', 'كلمة المرور تتطلب رقماً'],
  ['password_require_symbol', 'كلمة المرور تتطلب رمزاً خاصاً'],
  ['mfa_required_for_admins', 'إلزام الأدمن بالمصادقة الثنائية (MFA)'],
  ['registration_open', 'فتح باب التسجيل'],
  ['maintenance_mode', 'وضع الصيانة (حجب الواجهات عن الطلاب)'],
];

const FLAG_LIST = [
  ['challenges', 'التحديات (CTF)'],
  ['groups', 'المجموعات الدراسية'],
  ['live', 'البث المباشر'],
  ['bundles', 'الحقائب التعليمية'],
  ['academy', 'الأكاديمية الوطنية'],
  ['offline', 'الدروس دون اتصال'],
  ['messages', 'الرسائل الخاصة'],
  ['schedule', 'الجدول الزمني'],
  ['opportunities', 'الفرص (تدريب/وظائف/منح)'],
  ['events', 'الفعاليات والمؤتمرات'],
  ['resources', 'المرافق والقاعات والمعدات'],
  ['volunteers', 'العمل التطوعي'],
];

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    api('/admin/settings').then((d) => {
      setSettings(d.settings);
      setFlags(Object.fromEntries(d.flags.map((f) => [f.key, f.enabled === 1])));
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  };
  useEffect(load, []);

  const save = async () => {
    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings,
          flags: Object.entries(flags).map(([key, enabled]) => ({ key, enabled })),
        }),
      });
      setMsg('تم حفظ الإعدادات بنجاح ✅');
    } catch (e) { setMsg(e.message); }
  };

  if (loading) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;

  const setS = (k, v) => setSettings((s) => ({ ...s, [k]: String(v) }));

  return (
    <AdminLayout>
      <div className="row space-between mb">
        <h2>⚙️ إعدادات المنصة</h2>
        <button className="btn btn-success" onClick={save}>حفظ الإعدادات</button>
      </div>
      {msg && <div className="success-msg mb">{msg}</div>}

      <div className="card mb">
        <h3 className="mb">عام</h3>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {GENERAL_FIELDS.map(([k, label]) => (
            <div key={k} className="mb">
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>{label}</label>
              <input className="input" value={settings[k] || ''} onChange={(e) => setS(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="card mb">
        <h3 className="mb">سياسات كلمة المرور والحوكمة</h3>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {POLICY_FIELDS.map(([k, label]) => (
            <div key={k} className="mb">
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>{label}</label>
              <input type="number" className="input" value={settings[k] || '6'} onChange={(e) => setS(k, e.target.value)} />
            </div>
          ))}
        </div>
        {POLICY_TOGGLES.map(([k, label]) => (
          <label key={k} className="row" style={{ gap: 8, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
            <input type="checkbox" checked={settings[k] === '1'} onChange={(e) => setS(k, e.target.checked ? '1' : '0')} />
            {label}
          </label>
        ))}
      </div>

      <div className="card">
        <h3 className="mb">مفاتيح الميزات (Feature Flags)</h3>
        <p className="muted mb" style={{ lineHeight: 1.7 }}>
          عند إيقاف أي ميزة تُخفى عن الطلاب فوراً وتتوقف واجهاتها على الخادم عن إرجاع البيانات.
        </p>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {FLAG_LIST.map(([k, label]) => (
            <label key={k} className="row" style={{ gap: 8, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
              <input type="checkbox" checked={flags[k] !== false} onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}