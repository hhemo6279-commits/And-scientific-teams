import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getToken, getUser } from '../api.js';
import QuizView from './QuizView.jsx';
import LabView from './LabView.jsx';
import ExamView from './ExamView.jsx';
import { saveLessonOffline, isLessonOffline, removeLessonOffline } from '../offline.js';

export default function CourseView() {
  const { id } = useParams();
  const nav = useNavigate();
  const user = getUser();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [activeLesson, setActiveLesson] = useState(null);
  const [tab, setTab] = useState('lessons');
  const [msg, setMsg] = useState('');
  const [enrolled, setEnrolled] = useState(false);
  const [qa, setQa] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [answers, setAnswers] = useState({});
  const [reviews, setReviews] = useState({ reviews: [], avg: null, count: 0, mine: null });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [examPassed, setExamPassed] = useState(false);

  useEffect(() => {
    api(`/courses/${id}`).then((d) => {
      setCourse(d.course);
      setLessons(d.lessons);
      setProgressMap(d.progressMap);
      setActiveLesson(d.lessons[0] || null);
      setExamPassed(!!d.examPassed);
      if (d.lessons.some((l) => d.progressMap[l.id] === 1)) setEnrolled(true);
    }).catch((e) => setMsg(e.message));
  }, [id]);

  const loadQA = () => api(`/courses/${id}/qa`).then((d) => setQa(d.posts)).catch(() => {});
  const loadReviews = () => api(`/courses/${id}/reviews`).then(setReviews).catch(() => {});
  useEffect(() => {
    if (tab === 'community') loadQA();
    if (tab === 'reviews') loadReviews();
  }, [tab]);

  const enroll = async () => {
    try {
      const d = await api(`/courses/${id}/enroll`, { method: 'POST' });
      setEnrolled(true);
      setMsg(d.message);
    } catch (e) { setMsg(e.message); }
  };

  const completeLesson = async (lesson) => {
    try {
      const d = await api(`/courses/${id}/lessons/${lesson.id}/complete`, { method: 'POST' });
      setProgressMap((p) => ({ ...p, [lesson.id]: 1 }));
      setMsg(d.completed ? '🎉 أكملت الدورة! يمكنك الحصول على شهادتك' : 'أحسنت! تقدمك: ' + d.progress + '%');
    } catch (e) { setMsg(e.message); }
  };

  const getCertificate = async () => {
    try {
      const d = await api(`/courses/${id}/certificate`, { method: 'POST' });
      setMsg(`🎓 شهادة صادرة: ${d.certificate.code}`);
    } catch (e) { setMsg(e.message); }
  };

  const printCertificate = async () => {
    try {
      const token = getToken();
      const resp = await fetch(`/api/courses/${id}/certificate/print`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('خطأ');
      const html = await resp.text();
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    } catch {
      setMsg('تعذر فتح الشهادة');
    }
  };

  const ask = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    try {
      await api(`/courses/${id}/qa`, { method: 'POST', body: JSON.stringify({ question: newQuestion }) });
      setNewQuestion('');
      loadQA();
    } catch (err) { setMsg(err.message); }
  };

  const answer = async (postId) => {
    if (!answers[postId]?.trim()) return;
    try {
      await api(`/courses/qa/${postId}/answers`, { method: 'POST', body: JSON.stringify({ answer: answers[postId] }) });
      setAnswers((a) => ({ ...a, [postId]: '' }));
      loadQA();
    } catch (err) { setMsg(err.message); }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api(`/courses/${id}/reviews`, { method: 'POST', body: JSON.stringify({ rating, comment }) });
      setComment('');
      loadReviews();
      setMsg('شكراً لتقييمك! ⭐');
    } catch (err) { setMsg(err.message); }
  };

  if (!course) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const doneCount = lessons.filter((l) => progressMap[l.id] === 1).length;
  const progress = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
  const canCertify = enrolled && lessons.length > 0 && (doneCount === lessons.length || examPassed);

  return (
    <div className="page">
      <button className="btn btn-secondary btn-sm mb" onClick={() => nav('/')}>↩ رجوع</button>
      <div className="space-between">
        <div>
          <h1 className="page-title">{course.title}</h1>
          <p className="page-sub">{course.description}</p>
          <div className="row">
            <span className="chip">{course.section_name}</span>
            <span className="chip">{course.level}</span>
            {course.price > 0 ? <span className="chip chip-gold">{course.price}$</span> : <span className="chip chip-green">مجاني</span>}
            {course.duration_hours > 0 && <span className="chip">⏱ {course.duration_hours} ساعة</span>}
            {course.language && <span className="chip">🌐 {course.language}</span>}
            {course.instructor && <span className="chip chip-gold">👨‍🏫 {course.instructor}</span>}
          </div>
        </div>
        <div style={{ width: 200, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#7c8cff' }}>{progress}%</div>
          <div className="muted">مكتمل</div>
        </div>
      </div>

      {(course.outcomes || course.prerequisites) && (
        <div className="grid-2 mb">
          {course.outcomes && (
            <div className="card">
              <h3 className="mb">🎯 مخرجات التعلم</h3>
              {course.outcomes.split('\n').filter(Boolean).map((o, i) => (
                <div key={i} className="chat-msg">✅ {o}</div>
              ))}
            </div>
          )}
          {course.prerequisites && (
            <div className="card">
              <h3 className="mb">📌 المتطلبات المسبقة</h3>
              <p className="muted">{course.prerequisites}</p>
            </div>
          )}
        </div>
      )}

      {msg && <div className="success-msg mb">{msg}</div>}
      {!enrolled && <button className="btn mb" onClick={enroll}>التسجيل في الدورة</button>}
      {canCertify && (
        <div className="row mb" style={{ gap: 8 }}>
          <button className="btn btn-success" onClick={getCertificate}>🎓 الحصول على الشهادة</button>
          <button className="btn btn-secondary" onClick={printCertificate}>🖨️ طباعة الشهادة</button>
        </div>
      )}

      {/* التبويبات */}
      <div className="row mb" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button className={tab === 'lessons' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('lessons')}>📚 الدروس</button>
        <button className={tab === 'exam' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('exam')}>📝 الامتحان النهائي</button>
        <button className={tab === 'community' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('community')}>💬 الأسئلة والأجوبة</button>
        <button className={tab === 'reviews' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('reviews')}>⭐ التقييمات {reviews.count > 0 && `(${reviews.avg})`}</button>
      </div>

      {tab === 'exam' && enrolled && <ExamView courseId={id} />}

      {tab === 'lessons' && (
        <div className="grid" style={{ gridTemplateColumns: '280px 1fr' }}>
          <div>
            <h3 className="mb">الدروس</h3>
            {lessons.map((l, i) => (
              <button key={l.id} onClick={() => setActiveLesson(l)}
                className="card" style={{ display: 'block', width: '100%', textAlign: 'right', marginBottom: 8, padding: 12 }}>
                <div className="row space-between" style={{ marginBottom: 0 }}>
                  <span>{i + 1}. {l.title}</span>
                  {progressMap[l.id] === 1 ? <span style={{ color: '#27ae60' }}>✓</span> : <span className="chip">{l.type === 'quiz' ? 'اختبار' : l.type}</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="card">
            {activeLesson ? (
              <>
                {activeLesson.type === 'quiz' ? (
                  <QuizView courseId={id} lesson={activeLesson}
                    onPassed={() => setProgressMap((p) => ({ ...p, [activeLesson.id]: 1 }))} />
                ) : activeLesson.type === 'lab' ? (
                  <LabView courseId={id} lesson={activeLesson}
                    onPassed={() => setProgressMap((p) => ({ ...p, [activeLesson.id]: 1 }))} />
                ) : (
                  <>
                    <h2>{activeLesson.title}</h2>
                    <div className="muted mb">النوع: {activeLesson.type === 'lab' ? 'غرفة تطبيقية' : 'درس نظري'}</div>
                    <p className="mb" style={{ whiteSpace: 'pre-wrap', lineHeight: 2 }}>{activeLesson.content}</p>
                    <div className="row" style={{ gap: 8 }}>
                      {isLessonOffline(id, activeLesson.id) ? (
                        <button className="btn btn-secondary" onClick={() => { removeLessonOffline(id, activeLesson.id); setOfflineSaved(false); }}>↩ إزالة من وضع عدم الاتصال</button>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => { saveLessonOffline(course, activeLesson); setOfflineSaved(true); }}>⬇ حفظ للقراءة دون اتصال</button>
                      )}
                      {progressMap[activeLesson.id] !== 1 ? (
                        <button className="btn btn-success" onClick={() => completeLesson(activeLesson)}>✓ إنهاء الدرس</button>
                      ) : <span className="chip chip-green">مكتمل ✓</span>}
                    </div>
                    {offlineSaved && <div className="success-msg mt">تم حفظ الدرس — يمكنك قراءته دون اتصال</div>}
                  </>
                )}
              </>
            ) : (
              <p className="muted">لا توجد دروس في هذه الدورة بعد.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'community' && (
        <div>
          <form onSubmit={ask} className="card mb">
            <h3 className="mb">اطرح سؤالك</h3>
            <input className="input mb" placeholder="اكتب سؤالك عن هذه الدورة..." value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
            <button className="btn">إرسال السؤال</button>
          </form>

          {qa.length === 0 && <p className="muted">لا توجد أسئلة بعد. كن أول من يسأل!</p>}
          {qa.map((p) => (
            <div key={p.id} className="card mb">
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <strong>{p.question}</strong>
                <span className="chip">{p.user_name}</span>
              </div>
              {p.answers.map((a) => (
                <div key={a.id} className="chat-msg">
                  <strong>{a.user_name}:</strong> {a.answer}
                </div>
              ))}
              <div className="row mt">
                <input className="input" placeholder="اكتب إجابة..." value={answers[p.id] || ''}
                  onChange={(e) => setAnswers((x) => ({ ...x, [p.id]: e.target.value }))} style={{ flex: 1 }} />
                <button className="btn btn-secondary btn-sm" onClick={() => answer(p.id)}>إجابة</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'reviews' && (
        <div>
          <div className="card mb">
            <div className="row space-between">
              <h3>⭐ تقييم الدورة</h3>
              <div>
                <span className="stat-value">{reviews.avg || '—'}</span>
                <span className="muted"> / 5 ({reviews.count} تقييم)</span>
              </div>
            </div>
            {reviews.mine ? (
              <p className="muted mt">قيمت هذه الدورة بـ {reviews.mine.rating} ⭐. يمكنك تحديث تقييمك أدناه.</p>
            ) : (
              <p className="muted mt">{enrolled ? 'شارك رأيك في هذه الدورة:' : 'سجّل في الدورة أولاً لتتمكن من التقييم.'}</p>
            )}
            {enrolled && (
              <form onSubmit={submitReview} className="mt">
                <div className="row mb">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} className="btn btn-sm" style={{ background: n <= rating ? '#f1c40f' : 'var(--card-2)', fontSize: 18 }}
                      onClick={() => setRating(n)}>{n <= rating ? '★' : '☆'}</button>
                  ))}
                </div>
                <div className="row">
                  <input className="input" placeholder="اكتب تعليقك (اختياري)..." value={comment} onChange={(e) => setComment(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn btn-success">إرسال التقييم</button>
                </div>
              </form>
            )}
          </div>

          {reviews.reviews.map((r) => (
            <div key={r.id} className="card mb">
              <div className="row space-between">
                <strong>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</strong>
                <span className="chip">{r.user_name}</span>
              </div>
              <p className="muted mt">{r.comment || 'بدون تعليق'}</p>
              <div className="muted mt">{r.created_at}</div>
            </div>
          ))}
          {reviews.reviews.length === 0 && <p className="muted">لا توجد تقييمات بعد. كن أول من يقيّم!</p>}
        </div>
      )}
    </div>
  );
}
