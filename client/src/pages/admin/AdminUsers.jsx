import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/admin/users').then((d) => setUsers(d.users)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggle = async (u) => {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ active: u.active ? 0 : 1 }) });
      setMsg(`تم ${u.active ? 'تعطيل' : 'تفعيل'} حساب ${u.name}`);
      load();
    } catch (err) { setError(err.message); }
  };

  return (
    <AdminLayout>
      <h1 className="page-title">إدارة الطلاب</h1>
      <p className="page-sub">فعّل أو عطّل حسابات الطلاب</p>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg mb">{msg}</div>}
      <table className="table">
        <thead><tr><th>الاسم</th><th>البريد</th><th>تاريخ التسجيل</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td className="muted">{u.email}</td>
              <td className="muted">{u.created_at}</td>
              <td>{u.active ? <span className="chip chip-green">مفعل</span> : <span className="chip chip-red">معطل</span>}</td>
              <td>
                <div className="row">
                  <Link to={`/admin/users/${u.id}`} className="btn btn-sm">👁 متابعة</Link>
                  <button className="btn btn-secondary btn-sm" onClick={() => toggle(u)}>{u.active ? 'تعطيل' : 'تفعيل'}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
