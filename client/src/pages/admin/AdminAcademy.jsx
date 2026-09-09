import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { AdminLayout } from './AdminLayout.jsx';

const blankTrack = { title: '', description: '', icon: '🎓', color: '#6c7bff', active: 1 };
const blankStage = { title: '', description: '', course_id: '', challenge_id: '' };

export default function AdminAcademy() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showTrack, setShowTrack] = useState(false);
  const [trackForm, setTrackForm] = useState(blankTrack);
  const [editTrackId, setEditTrackId] = useState(null);
  const [stageTrack, setStageTrack] = useState(null);
  const [stageForm, setStageForm] = useState(blankStage);
  const [editStageId, setEditStageId] = useState(null);

  const load = () => api('/admin/academy').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const saveTrack = async () => {
    try {
      if (!trackForm.title) throw new Error('العنوان مطلوب');
      if (editTrackId) await api(`/admin/academy/${editTrackId}`, { method: 'PUT', body: JSON.stringify(trackForm) });
      else await api('/admin/academy', { method: 'POST', body: JSON.stringify(trackForm) });
      setShowTrack(false); setTrackForm(blankTrack); setEditTrackId(null); load();
    } catch (e) { setMsg(e.message); }
  };

  const delTrack = async (id) => {
    if (!confirm('حذف المسار؟ سيتم حذف مراحله واشتراكاته وشهاداته')) return;
    await api(`/admin/academy/${id}`, { method: 'DELETE' });
    load();
  };

  const saveStage = async () => {
    try {
      if (!stageForm.title) throw new Error('عنوان المرحلة مطلوب');
      const body = JSON.stringify({ ...stageForm, course_id: stageForm.course_id || null, challenge_id: stageForm.challenge_id || null });
      if (editStageId) await api(`/admin/academy/stages/${editStageId}`, { method: 'PUT', body });
      else await api(`/admin/academy/${stageTrack}/stages`, { method: 'POST', body });
      setStageTrack(null); setStageForm(blankStage); setEditStageId(null); load();
    } catch (e) { setMsg(e.message); }
  };

  const delStage = async (id) => {
    if (!confirm('حذف المرحلة؟')) return;
    await api(`/admin/academy/stages/${id}`, { method: 'DELETE' });
    load();
  };

  const moveStage = async (trackId, stage, dir) => {
    const track = data.tracks.find((t) => t.id === trackId);
    const list = [...track.stages].sort((a, b) => a.order_no - b.order_no);
    const i = list.findIndex((s) => s.id === stage.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await api(`/admin/academy/${trackId}/order`, {
      method: 'PUT',
      body: JSON.stringify({ stages: list.map((s, k) => ({ id: s.id, order_no: k + 1 })) }),
    });
    load();
  };

  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const { tracks, courses, challenges } = data;

  return (
    <AdminLayout>
      <div className="row space-between mb">
        <h2>🛡️ الأكاديمية الوطنية</h2>
        <button className="btn" onClick={() => { setShowTrack(true); setEditTrackId(null); setTrackForm(blankTrack); }}>+ مسار جديد</button>
      </div>
      {msg && <div className="success-msg mb">{msg}</div>}

      {showTrack && (
        <div className="card mb">
          <h3 className="mb">{editTrackId ? 'تعديل المسار' : 'مسار جديد'}</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="العنوان *" value={trackForm.title}
              onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })} style={{ width: 220 }} />
            <input className="input" placeholder="أيقونة" value={trackForm.icon}
              onChange={(e) => setTrackForm({ ...trackForm, icon: e.target.value })} style={{ width: 90 }} />
            <input className="input" type="color" value={trackForm.color}
              onChange={(e) => setTrackForm({ ...trackForm, color: e.target.value })} style={{ width: 60, padding: 2 }} />
            <input className="input" placeholder="الوصف" value={trackForm.description}
              onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })} style={{ width: 320 }} />
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={!!trackForm.active}
                onChange={(e) => setTrackForm({ ...trackForm, active: e.target.checked ? 1 : 0 })} />
              نشط
            </label>
          </div>
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn btn-success" onClick={saveTrack}>حفظ</button>
            <button className="btn btn-secondary" onClick={() => setShowTrack(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {stageTrack !== null && (
        <div className="card mb">
          <h3 className="mb">{editStageId ? 'تعديل المرحلة' : `مرحلة جديدة في: ${tracks.find((t) => t.id === stageTrack)?.title}`}</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="عنوان المرحلة *" value={stageForm.title}
              onChange={(e) => setStageForm({ ...stageForm, title: e.target.value })} style={{ width: 220 }} />
            <input className="input" placeholder="الوصف" value={stageForm.description}
              onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })} style={{ width: 280 }} />
            <select className="input" value={stageForm.course_id} style={{ width: 200 }}
              onChange={(e) => setStageForm({ ...stageForm, course_id: e.target.value })}>
              <option value="">بدون دورة</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <select className="input" value={stageForm.challenge_id} style={{ width: 180 }}
              onChange={(e) => setStageForm({ ...stageForm, challenge_id: e.target.value })}>
              <option value="">بدون تحدي</option>
              {challenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn btn-success" onClick={saveStage}>حفظ</button>
            <button className="btn btn-secondary" onClick={() => { setStageTrack(null); setEditStageId(null); setStageForm(blankStage); }}>إلغاء</button>
          </div>
        </div>
      )}

      {tracks.length === 0 && <p className="muted">لا توجد مسارات بعد.</p>}

      <div className="grid">
        {tracks.map((t) => (
          <div key={t.id} className="card">
            <div className="row space-between" style={{ marginBottom: 6 }}>
              <h3 style={{ marginBottom: 0 }}>{t.icon} {t.title}</h3>
              <span className={t.active ? 'chip chip-green' : 'chip'}>{t.active ? 'نشط' : 'معطّل'}</span>
            </div>
            <p className="muted mb" style={{ lineHeight: 1.7 }}>{t.description}</p>
            <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
              <span className="chip">{t.stages.length} مراحل</span>
              <button className="btn btn-secondary btn-sm"
                onClick={() => { setStageTrack(t.id); setEditStageId(null); setStageForm(blankStage); }}>+ مرحلة</button>
              <button className="btn btn-secondary btn-sm"
                onClick={() => { setEditTrackId(t.id); setTrackForm({ title: t.title, description: t.description, icon: t.icon, color: t.color, active: t.active }); setShowTrack(true); }}>تعديل</button>
              <button className="btn btn-sm btn-danger" onClick={() => delTrack(t.id)}>حذف</button>
            </div>
            <div className="mb" style={{ borderRight: '2px solid var(--border)', paddingRight: 10 }}>
              {t.stages.sort((a, b) => a.order_no - b.order_no).map((s, i) => (
                <div key={s.id} className="row space-between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div>
                    <strong>{i + 1}. {s.title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.course_id ? `📚 ${s.course_title}` : ''}
                      {s.challenge_id ? ` 🏆 ${s.challenge_title} (+${s.challenge_points})` : ''}
                      {!s.course_id && !s.challenge_id ? ' — ' : ''}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => moveStage(t.id, s, -1)}>↑</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => moveStage(t.id, s, 1)}>↓</button>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditStageId(s.id); setStageTrack(t.id); setStageForm({ title: s.title, description: s.description, course_id: s.course_id || '', challenge_id: s.challenge_id || '' }); }}>تعديل</button>
                    <button className="btn btn-sm btn-danger" onClick={() => delStage(s.id)}>×</button>
                  </div>
                </div>
              ))}
              {t.stages.length === 0 && <p className="muted" style={{ fontSize: 13 }}>لا مراحل بعد.</p>}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}