import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function LabView({ courseId, lesson, onPassed }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/courses/${courseId}/lessons/${lesson.id}/lab`)
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId, lesson.id]);

  if (loading) return <p className="muted">جارٍ تحميل المعمل...</p>;
  if (error) return <div className="error-msg">{error}</div>;

  const submit = async (step) => {
    try {
      const d = await api(`/courses/${courseId}/lessons/${lesson.id}/lab/submit`, {
        method: 'POST',
        body: JSON.stringify({ step_id: step.id, answer: answers[step.id] }),
      });
      setFeedback((f) => ({ ...f, [step.id]: d }));
      if (d.completed && onPassed) onPassed();
    } catch (e) {
      setError(e.message);
    }
  };

  const solvedCount = data.steps.filter((s) => s.solved || feedback[s.id]?.ok).length;
  const allDone = data.steps.length > 0 && solvedCount === data.steps.length;

  return (
    <div>
      <h2 className="mb">🧪 {lesson.title}</h2>
      <div className="card mb">
        <div className="row space-between">
          <span className="chip">المعمل التطبيقي</span>
          <span className="chip chip-gold">أنجزت {solvedCount}/{data.steps.length} خطوة</span>
        </div>
        <div className="mt" style={{ background: '#0e1024', borderRadius: 8, height: 8, overflow: 'hidden' }}>
          <div style={{ background: '#27ae60', height: '100%', width: (solvedCount / Math.max(data.steps.length, 1)) * 100 + '%' }} />
        </div>
      </div>

      {allDone && <div className="success-msg mb">🎉 أكملت جميع خطوات المعمل! تم إنهاء الدرس تلقائياً.</div>}

      {data.steps.map((step, i) => {
        const f = feedback[step.id];
        const isSolved = step.solved || f?.ok;
        return (
          <div key={step.id} className="card mb">
            <div className="row space-between mb">
              <strong>الخطوة {i + 1}: {step.title}</strong>
              {isSolved ? <span className="chip chip-green">محلولة ✓</span> : <span className="chip">غير محلولة</span>}
            </div>
            <p className="muted mb" style={{ lineHeight: 1.8 }}>{step.instruction}</p>
            {!isSolved && (
              <>
                <div className="row">
                  <input className="input" placeholder="أدخل الإجابة..." dir="ltr" value={answers[step.id] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [step.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') submit(step); }} style={{ flex: 1 }} />
                  <button className="btn" onClick={() => submit(step)}>تحقق</button>
                </div>
                {f && !f.ok && <div className="error-msg mt">إجابة خاطئة، حاول مرة أخرى</div>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
