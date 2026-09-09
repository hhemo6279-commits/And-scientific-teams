import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api, getToken, getUser } from '../../api.js';

export default function AdminBackup() {
  const [backups, setBackups] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const isMain = getUser()?.role === 'main_admin';

  const load = () => api('/admin/backups').then((d) => setBackups(d.backups)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const createBackup = async () => {
    setBusy(true);
    setError('');
    try {
      const d = await api('/admin/backup', { method: 'POST' });
      setMsg(`تم إنشاء النسخة الاحتياطية: ${d.file}`);
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const download = (name) => {
    const token = getToken();
    fetch(`/api/admin/backup/${name}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError('تعذر تحميل النسخة'));
  };

  const restore = async (b) => {
    if (!confirm(`سيتم استبدال قاعدة البيانات الحالية بنسخة "${b.name}". هل أنت متأكد؟`)) return;
    setBusy(true);
    try {
      const d = await api(`/admin/backup/${b.name}/restore`, { method: 'POST' });
      setMsg(d.message);
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const fmtSize = (kb) => (kb < 1024 ? kb + ' KB' : (kb / 1024).toFixed(1) + ' MB');

  return (
    <AdminLayout>
      <h1 className="page-title">💾 النسخ الاحتياطي</h1>
      <p className="page-sub">إنشاء وتحميل واستعادة نسخ من قاعدة البيانات</p>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg mb">{msg}</div>}

      <div className="card mb">
        <h3 className="mb">إنشاء نسخة احتياطية جديدة</h3>
        <p className="muted mb">يتم إنشاء لقطة كاملة لقاعدة البيانات مع كل الطلاب والدورات والنشاطات.</p>
        <button className="btn btn-success" onClick={createBackup} disabled={busy}>
          {busy ? 'جارٍ العمل...' : '+ إنشاء نسخة الآن'}
        </button>
      </div>

      <h3 className="mb">النسخ المحفوظة ({backups.length})</h3>
      {backups.length === 0 && <p className="muted">لا توجد نسخ احتياطية بعد.</p>}
      <table className="table">
        <thead><tr><th>اسم الملف</th><th>الحجم</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr></thead>
        <tbody>
          {backups.map((b) => (
            <tr key={b.name}>
              <td dir="ltr" style={{ textAlign: 'right' }}>{b.name}</td>
              <td>{fmtSize(b.size)}</td>
              <td className="muted">{b.createdAt.replace('T', ' ').slice(0, 19)}</td>
              <td>
                <div className="row">
                  <button className="btn btn-secondary btn-sm" onClick={() => download(b.name)}>⬇ تحميل</button>
                  {isMain && <button className="btn btn-danger btn-sm" onClick={() => restore(b)}>↩ استعادة</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isMain && <p className="muted mt">الاستعادة متاحة للأدمن الرئيسي فقط.</p>}
    </AdminLayout>
  );
}
