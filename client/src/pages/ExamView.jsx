import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ExamView({ courseId }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/courses/${courseId}/exam`)
      .then((d) => {
        setData(d);
        if (d.exam?.hasAttempt && d.attempt) setResult({ score: d.attempt.score, passed: d.attempt.passed, maxScore: d.attempt.max_score });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <p className="muted">جارٍ تحميل الامتحان...</p>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data.exam) return <p className="muted">لا يوجد امتحان نهائي لهذه الدورة بعد.</p>;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const d = await api(`/courses/${courseId}/exam/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setResult(d);
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  };

  if (result) {
    return (
      <div className={`card ${result.passed ? 'card-success' : ''}`} style={{ textAlign: 'center' }}>
        <h2 className="mb">{result.passed ? '🎉 نجحت في الامتحان النهائي!' : '😔 لم تجتز الامتحان'}</h2>
        <div className="stat-value mb" style={{ fontSize: 44 }}>{result.score}%</div>
        <p className="muted mb">
          {result.passed
            ? 'أحسنت! أنت مؤهل الآن للحصول على شهادة إتمام الدورة (+10 XP).'
            : `الحد الأدنى للنجاح ${data.exam.passing_score}%. راجع الدروس وحاول لاحقاً.`}
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row space-between mb">
        <h2 className="mb" style={{ marginBottom: 0 }}>📝 {data.exam.title}</h2>
        <span className="chip chip-gold">⏱ {data.exam.duration_minutes} دقيقة · النجاح من {data.exam.passing_score}%</span>
      </div>
      {error && <div className="error-msg mb">{error}</div>}

      {data.exam.questions.map((q, qi) => (
        <div key={q.id} className="card mb" style={{ background: 'var(--bg-2)' }}>
          <p className="mb"><strong>السؤال {qi + 1}:</strong> {q.question}</p>
          {q.options.map((opt, oi) => (
            <label key={oi} className="row mb" style={{ cursor: 'pointer', padding: 8, borderRadius: 8, background: answers[q.id] === oi ? 'rgba(108,123,255,0.15)' : 'transparent', border: answers[q.id] === oi ? '1px solid #6c7bff' : '1px solid transparent' }}>
              <input type="radio" name={`e${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
              {opt}
            </label>
          ))}
        </div>
      ))}

      <button className="btn btn-block" onClick={submit} disabled={submitting || Object.keys(answers).length !== data.exam.questions.length}>
        {Object.keys(answers).length}/{data.exam.questions.length} — تسليم الامتحان
      </button>
      {Object.keys(answers).length !== data.exam.questions.length && (
        <p className="muted mt" style={{ fontSize: 12 }}>أجب عن جميع الأسئلة قبل التسليم. لا يمكن إعادة الامتحان بعد التسليم.</p>
      )}
    </div>
  );
}
