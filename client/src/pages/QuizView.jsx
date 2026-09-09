import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function QuizView({ courseId, lesson, onPassed }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/courses/${courseId}/lessons/${lesson.id}/quiz`)
      .then((d) => {
        setData(d);
        if (d.lastAttempt && d.lastAttempt.passed) setResult(d.lastAttempt);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId, lesson.id]);

  if (loading) return <p className="muted">جارٍ تحميل الاختبار...</p>;
  if (error) return <div className="error-msg">{error}</div>;

  const submit = async () => {
    try {
      const d = await api(`/courses/${courseId}/lessons/${lesson.id}/quiz/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setResult(d);
      if (d.passed && onPassed) onPassed();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      {result ? (
        <div className={`card ${result.passed ? '' : ''}`}>
          <h2 className="mb">
            {result.passed ? '🎉 نجحت في الاختبار!' : '😔 لم تنجح هذه المرة'}
          </h2>
          <div className="stat-value mb">{result.score}/{result.total}</div>
          <p className="muted mb">
            {result.passed
              ? 'أحسنت! تم إنهاء هذا الدرس تلقائياً. تقدمك في الدورة حدث.'
              : 'تحتاج 50% أو أكثر للنجاح. حاول مجدداً.'}
          </p>
          <button className="btn btn-success" onClick={() => setResult(null)}>إعادة المحاولة</button>
        </div>
      ) : (
        <>
          <h2 className="mb">📝 {lesson.title}</h2>
          {data.questions.map((q, qi) => {
            const options = JSON.parse(q.options);
            return (
              <div key={q.id} className="card mb">
                <p className="mb"><strong>السؤال {qi + 1}:</strong> {q.question}</p>
                {options.map((opt, oi) => (
                  <label key={oi} className="row mb" style={{ cursor: 'pointer', padding: 8, borderRadius: 8, background: answers[q.id] === oi ? 'rgba(108,123,255,0.15)' : 'transparent', border: answers[q.id] === oi ? '1px solid #6c7bff' : '1px solid transparent' }}>
                    <input type="radio" name={`q${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                    {opt}
                  </label>
                ))}
              </div>
            );
          })}
          <button className="btn btn-block" onClick={submit} disabled={Object.keys(answers).length !== data.questions.length}>
            {Object.keys(answers).length}/{data.questions.length} — إرسال الإجابات
          </button>
        </>
      )}
    </div>
  );
}
