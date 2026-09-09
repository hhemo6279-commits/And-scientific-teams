import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { AdminLayout } from './AdminLayout.jsx';

export default function AdminSecurity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/admin/security').then(setData).catch((e) => setError(e.message));
  useEffect(load, []);

  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const { failedLogins24h, failedLoginsCount, adminsWithoutMfa, mfaAdoption, activeSessions, failedByUser, recentAdminActions, rateStats, passwordPolicy } = data;

  const card = (title, value, sub) => (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3 className="muted" style={{ fontWeight: 400 }}>{title}</h3>
      <div style={{ fontSize: 34, fontWeight: 800, margin: '6px 0' }}>{value}</div>
      <div className="muted" style={{ fontSize: 13 }}>{sub}</div>
    </div>
  );

  return (
    <AdminLayout>
      <h2 className="mb">🛡️ مركز الأمان</h2>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {card('محاولات دخول فاشلة (24 ساعة)', failedLoginsCount, 'أعلى من 10 = يُنصح بالتحقيق')}
        {card('الجلسات النشطة', activeSessions, 'عبر توكنات التحديث')}
        {card('اعتماد المصادقة الثنائية', `${mfaAdoption.mfaOn}/${mfaAdoption.total}`, `${mfaAdoption.adminsMfaOn} ادمن مفعّلاً`)}
        {card('طلبات محجوبة بـ Rate Limit', rateStats.blocked, 'حسب عدد IPs المحجوبة')}
      </div>

      <div className="card mb" style={{ marginTop: 16 }}>
        <h3 className="mb">التحقق من سياسة كلمة المرور الحالية</h3>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="chip">الحد الأدنى: {passwordPolicy.minLength}</span>
          <span className="chip">{passwordPolicy.requireUppercase ? 'حرف كبير مطلوب ✓' : 'بدون حرف كبير'}</span>
          <span className="chip">{passwordPolicy.requireNumber ? 'رقم مطلوب ✓' : 'بدون رقم'}</span>
          <span className="chip">{passwordPolicy.requireSymbol ? 'رمز مطلوب ✓' : 'بدون رمز'}</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3 className="mb">اعتماد المصادقة الثنائية</h3>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            أدمن بدون MFA ({adminsWithoutMfa.length}):
          </p>
          {adminsWithoutMfa.map((a) => (
            <div key={a.id} className="row space-between mb" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
              <strong>{a.name}</strong>
              <span className="chip chip-red">بدون MFA</span>
            </div>
          ))}
          {adminsWithoutMfa.length === 0 && <span className="chip chip-green">جميع الأدمن مفعّلون للمصادقة الثنائية ✓</span>}
        </div>

        <div className="card">
          <h3 className="mb">الحسابات الأكثر تكراراً في فشل الدخول</h3>
          {failedByUser.map((f) => (
            <div key={f.details} className="row space-between mb" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
              <span dir="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>{f.details}</span>
              <span className="chip chip-red">{f.n} محاولة</span>
            </div>
          ))}
          {failedByUser.length === 0 && <span className="chip chip-green">لا محاولات فاشلة خلال 24 ساعة</span>}
        </div>
      </div>

      <div className="card mb" style={{ marginTop: 16 }}>
        <h3 className="mb">آخر محاولات فاشلة (24 ساعة)</h3>
        {failedLogins24h.slice(0, 20).map((f) => (
          <div key={f.id} className="row space-between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)', fontSize: 13 }}>
            <span dir="ltr">{f.details}</span>
            <span className="muted">{f.created_at}</span>
          </div>
        ))}
        {failedLogins24h.length === 0 && <span className="chip chip-green">خالٍ من المحاولات</span>}
      </div>

      <div className="card">
        <h3 className="mb">آخر إجراءات الأدمن</h3>
        {recentAdminActions.map((a) => (
          <div key={a.id} className="row space-between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)', fontSize: 13 }}>
            <span><strong>{a.name}</strong> — {a.action}</span>
            <span className="muted">{a.created_at}</span>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}