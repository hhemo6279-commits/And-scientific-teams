import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken, getUser, setAuth } from '../api.js';

export default function Profile() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const user = getUser();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [sec, setSec] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState({ old: '', next: '' });
  const [secMsg, setSecMsg] = useState('');
  const [secErr, setSecErr] = useState('');
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    api('/me/profile').then(setData).catch((e) => setError(e.message));
    api('/auth/mfa/status').then((d) => setMfaEnabled(d.enabled)).catch(() => {});
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try { setSessions(await api('/me/sessions')); } catch {}
  };

  const revokeSession = async (sid) => {
    try {
      await api(`/me/sessions/${sid}/revoke`, { method: 'POST' });
      loadSessions();
      setSecMsg('تم إلغاء الجلسة المحددة، سيُطلب من هذا الجهاز تسجيل الدخول مجدداً.');
    } catch (e) { setSecErr(e.message); }
  };

  const startSetup = async () => {
    setSecErr('');
    try {
      const d = await api('/auth/mfa/setup', { method: 'POST' });
      setSec(d);
      setSecMsg('أضف هذا السرّ إلى تطبيق المصادقة (مثل Google Authenticator)، ثم أدخل الرمز للتفعيل.');
    } catch (e) { setSecErr(e.message); }
  };

  const enableMfa = async () => {
    setSecErr('');
    try {
      const d = await api('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) });
      setMfaEnabled(true);
      setRecovery(d.recoveryCodes);
      setSec(null);
      setCode('');
      setSecMsg('تم تفعيل المصادقة الثنائية بنجاح.');
    } catch (e) { setSecErr(e.message); }
  };

  const disableMfa = async () => {
    setSecErr('');
    if (!code) return setSecErr('أدخل رمز المصادقة الحالي للإلغاء');
    try {
      await api('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) });
      setMfaEnabled(false);
      setCode('');
      setRecovery(null);
      setSecMsg('تم إلغاء المصادقة الثنائية.');
    } catch (e) { setSecErr(e.message); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSecErr('');
    try {
      const d = await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: pwd.old, newPassword: pwd.next }) });
      setAuth(d.token, d.user, d.refreshToken);
      setPwd({ old: '', next: '' });
      setSecMsg('تم تغيير كلمة المرور. أُبطِلت الجلسات الأخرى على أجهزتك.');
    } catch (err) { setSecErr(err.message); }
  };

  const printCertificate = async (courseId) => {
    try {
      const token = getToken();
      const resp = await fetch(`/api/courses/${courseId}/certificate/print`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('خطأ');
      const html = await resp.text();
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    } catch {
      setError('تعذر فتح الشهادة');
    }
  };

  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  return (
    <div className="page">
      {error && <div className="error-msg">{error}</div>}
      <div className="card mb">
        <div className="row space-between">
          <div className="row">
            <span className="avatar" style={{ width: 56, height: 56, fontSize: 30 }}>{user.avatar || '🎓'}</span>
            <div>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{data.profile.name}</h1>
              <p className="muted">{data.profile.email}</p>
              {data.profile.section && (
                <span className="chip" style={{ marginTop: 6 }}>{data.profile.section.icon} قسم {data.profile.section.name}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value">{data.profile.points}</div>
            <div className="stat-label">XP</div>
          </div>
        </div>

        <div className="mt" style={{ background: 'rgba(108,123,255,0.12)', borderRadius: 12, padding: 14 }}>
          <div className="row space-between mb" style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 18 }}>{data.profile.level.icon} المستوى {data.profile.level.level}: {data.profile.level.title}</strong>
            <span className="chip chip-gold">{data.profile.level.xp} XP</span>
          </div>
          <div style={{ background: '#0e1024', borderRadius: 8, height: 10, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#6c7bff,#9f6cff)', height: '100%', width: data.profile.level.progress + '%' }} />
          </div>
          <div className="muted mt" style={{ marginTop: 6 }}>
            {data.profile.level.nextTitle
              ? `${data.profile.level.progress}% — ${data.profile.level.needed} XP متبقية للوصول إلى "${data.profile.level.nextTitle}"`
              : 'وصلت لأعلى مستوى! 🏆'}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{data.stats.coursesDone}</div><div className="stat-label">دورات مكتملة</div></div>
        <div className="stat-card"><div className="stat-value">{data.stats.certificates}</div><div className="stat-label">شهادات</div></div>
        <div className="stat-card"><div className="stat-value">{data.stats.challengesSolved}</div><div className="stat-label">تحديات محلولة</div></div>
        <div className="stat-card"><div className="stat-value">{data.enrollments.length}</div><div className="stat-label">دورات مسجل بها</div></div>
      </div>

      <h2 className="mb">دوراتي</h2>
      {data.enrollments.length === 0 ? (
        <p className="muted">لم تسجل في أي دورة بعد. <Link to="/">تصفح الأقسام</Link></p>
      ) : (
        <div className="grid mb">
          {data.enrollments.map((e) => (
            <Link key={e.id} to={`/course/${e.course_id}`} style={{ color: 'inherit' }}>
              <div className="card">
                <h3>{e.course_title}</h3>
                <p className="muted mb">{e.section_icon} {e.section_name}</p>
                <div style={{ background: '#0e1024', borderRadius: 8, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ background: '#6c7bff', height: '100%', width: e.progress + '%' }} />
                </div>
                <div className="row space-between">
                  <span className="muted">{e.progress}%</span>
                  {e.completed ? <span className="chip chip-green">مكتمل ✓</span> : <span className="chip">قيد التقدم</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid">
        <div className="card">
          <h3 className="mb">🎓 شهاداتي</h3>
          {data.certificates.length === 0 ? (
            <p className="muted">لا توجد شهادات بعد</p>
          ) : (
            data.certificates.map((c) => (
              <div key={c.id} className="chat-msg">
                <div className="row space-between">
                  <div>
                    <strong>{c.course_title}</strong>
                    <div className="muted" dir="ltr">{c.code}</div>
                  </div>
                  <a className="btn btn-secondary btn-sm" href="#" onClick={(e) => { e.preventDefault(); printCertificate(c.course_id); }}>🖨️ طباعة</a>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3 className="mb">🏆 التحديات المحلولة</h3>
          {data.solved.length === 0 ? (
            <p className="muted">لم تحل أي تحدي بعد. <Link to="/challenges">جرّب التحديات</Link></p>
          ) : (
            data.solved.map((s, i) => (
              <div key={i} className="chat-msg">
                <strong>{s.title}</strong>
                <span className="chip chip-gold">+{s.points}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <h2 className="mb mt">🏅 الشارات والإنجازات</h2>
      {data.badges.length === 0 ? (
        <p className="muted">لم تحصل على شارات بعد. أكمل الدورات وحل التحديات لكسب الشارات.</p>
      ) : (
        <div className="grid">
          {data.badges.map((b) => (
            <div key={b.id} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{b.icon}</div>
              <h3>{b.name}</h3>
              <p className="muted">{b.description}</p>
              <span className="chip chip-gold mt">حصلت عليها: {b.earned_at}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb mt">🔐 الأمان</h2>
      <div className="grid">
        <div className="card">
          <div className="row space-between" style={{ marginBottom: 0 }}>
            <h3 className="mb">المصادقة الثنائية (MFA)</h3>
            {mfaEnabled ? <span className="chip chip-green">مفعّلة ✓</span> : <span className="chip">غير مفعلة</span>}
          </div>
          <p className="muted mb">أضف طبقة حماية إضافية لطلب رمز من تطبيق المصادقة عند تسجيل الدخول.</p>

          {recovery && (
            <div className="card mb" style={{ border: '1px solid #27ae60' }}>
              <strong className="mb">💾 أكواد الاسترداد (احفظها في مكان آمن — تُعرض مرة واحدة فقط):</strong>
              <div className="row mt" style={{ flexWrap: 'wrap', gap: 8 }}>
                {recovery.map((c, i) => <span key={i} className="chip chip-gold" dir="ltr">{c}</span>)}
              </div>
            </div>
          )}

          {sec && !mfaEnabled && (
            <div className="card mb" style={{ background: 'rgba(108,123,255,0.08)' }}>
              <p className="muted mb">أضِف السرّ التالي يدوياً إلى تطبيق المصادقة، أو استخدم رابط otpauth:</p>
              <div className="chat-msg mb" dir="ltr" style={{ textAlign: 'left', wordBreak: 'break-all' }}>{sec.uri}</div>
              <div className="chat-msg" dir="ltr" style={{ textAlign: 'left', letterSpacing: 2 }}>السرّ: {sec.secret}</div>
            </div>
          )}

          {!mfaEnabled && (
            <div className="row" style={{ gap: 8 }}>
              {!sec ? (
                <button className="btn btn-success" onClick={startSetup}>تفعيل المصادقة الثنائية</button>
              ) : (
                <>
                  <input className="input" dir="ltr" placeholder="رمز التفعيل (6 أرقام)" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 160 }} />
                  <button className="btn" onClick={enableMfa}>تأكيد وتفعيل</button>
                </>
              )}
            </div>
          )}

          {mfaEnabled && (
            <div className="row" style={{ gap: 8 }}>
              <input className="input" dir="ltr" placeholder="رمز المصادقة للإلغاء" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 160 }} />
              <button className="btn btn-danger" onClick={disableMfa}>إلغاء المصادقة الثنائية</button>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="mb">تغيير كلمة المرور</h3>
          <form onSubmit={changePassword}>
            <div className="mb">
              <label className="label">كلمة المرور الحالية</label>
              <input className="input" type="password" value={pwd.old} onChange={(e) => setPwd((p) => ({ ...p, old: e.target.value }))} required />
            </div>
            <div className="mb">
              <label className="label">كلمة المرور الجديدة (6+ أحرف)</label>
              <input className="input" type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} required />
            </div>
            <button className="btn">حفظ كلمة المرور</button>
          </form>
        </div>
      </div>
      {secMsg && <div className="success-msg mt">{secMsg}</div>}
      {secErr && <div className="error-msg mt">{secErr}</div>}

      <h2 className="mb mt">🖥️ الجلسات النشطة</h2>
      <div className="card">
        {sessions.sessions && sessions.sessions.length === 0 ? (
          <p className="muted">لا جلسات نشطة.</p>
        ) : (
          (sessions.sessions || []).map((s) => (
            <div key={s.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
              <div>
                <strong dir="ltr" style={{ display: 'block', fontSize: 13 }}>{s.device || 'جهاز غير معروف'}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{s.ip || ''} • {s.created_at}</span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => revokeSession(s.id)}>قطع الجلسة</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
