import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/audit').then((d) => setLogs(d.logs)).catch((e) => setError(e.message));
  }, []);

  return (
    <AdminLayout>
      <h1 className="page-title">سجل التدقيق</h1>
      <p className="page-sub">كل إجراء يقوم به الأدمن يُسجل هنا — الأدمن الفرعي يرى إجراءاته فقط</p>
      {error && <div className="error-msg">{error}</div>}
      <table className="table">
        <thead><tr><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th><th>الوقت</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.user_name || '—'}</td>
              <td>{l.action}</td>
              <td className="muted">{l.details}</td>
              <td className="muted">{l.created_at}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan="4" className="muted" style={{ textAlign: 'center' }}>لا يوجد نشاط</td></tr>}
        </tbody>
      </table>
    </AdminLayout>
  );
}
