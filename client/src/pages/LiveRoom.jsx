import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getUser } from '../api.js';

const MAX_VIEWERS = 3000;
const BREAKOUT_CAPACITY = 50;

export default function LiveRoom() {
  const { id } = useParams();
  const nav = useNavigate();
  const user = getUser();
  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [joined, setJoined] = useState(false);
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([{ name: user?.name, role: 'أنت' }]);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [poll, setPoll] = useState(null);
  const [breakoutOpen, setBreakoutOpen] = useState(false);
  const [liveMsgs, setLiveMsgs] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [myHand, setMyHand] = useState(false);
  const [chatText, setChatText] = useState('');
  const [handName, setHandName] = useState('');
  const videoRef = useRef(null);

  // تحديث قائمة الحضور المحلية بعد الدخول
  useEffect(() => {
    if (!joined) return;
    setParticipants((p) => [{ name: user?.name, role: isHost ? 'المضيف' : 'أنت' }, ...p.slice(1)]);
  }, [joined]);

  // تحديث دوري للعدد الفعلي للمشاهدين من الخادم
  useEffect(() => {
    if (!joined) return;
    const t = setInterval(() => {
      api('/live').then((d) => {
        const r = d.rooms.find((x) => x.id === Number(id));
        if (r) setRoom((prev) => ({ ...prev, participant_count: r.participant_count, status: r.status }));
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [joined, id]);

  useEffect(() => {
    api(`/live/${id}/join`, { method: 'POST' })
      .then((d) => {
        setRoom(d.room);
        setIsHost(d.isHost);
        setJoined(true);
        setMsg(d.isHost ? 'أنت المضيف — الكاميرا والميكروفون مفعلان' : 'انضممت كمشاهد 👋');
        setParticipants((p) => (d.isHost ? [...p, { name: d.room.host_name || 'المضيف', role: 'المضيف' }] : p));
      })
      .catch((e) => setMsg(e.message));
  }, [id]);

  useEffect(() => {
    if (joined && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn })
        .then((stream) => {
          if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        })
        .catch(() => setMsg('تعذر الوصول للكاميرا (سيُعرض وضع المشاهدة)'));
    }
  }, [joined, camOn, micOn]);

  // تفاعل حي: جلب الدردشة وردود الفعل والأيدي كل ثانيتين
  useEffect(() => {
    if (!joined) return;
    const load = () => {
      api(`/live/${id}/chat`).then((d) => setLiveMsgs(d.messages)).catch(() => {});
      api(`/live/${id}/reactions`).then((d) => setReactions(d.reactions)).catch(() => {});
      if (isHost) api(`/live/${id}/hands`).then((d) => setRaisedHands(d.hands)).catch(() => {});
    };
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [joined, id, isHost]);

  const sendChat = async () => {
    if (!chatText.trim()) return;
    try {
      await api(`/live/${id}/chat`, { method: 'POST', body: JSON.stringify({ message: chatText }) });
      setChatText('');
      const d = await api(`/live/${id}/chat`);
      setLiveMsgs(d.messages);
    } catch {}
  };

  const react = async (emoji) => {
    try { await api(`/live/${id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }); } catch {}
  };

  const toggleHand = async () => {
    const next = !myHand;
    setMyHand(next);
    try { await api(`/live/${id}/hand`, { method: 'POST', body: JSON.stringify({ active: next }) }); } catch {}
  };

  const lowerHand = async (name) => {
    try {
      await api(`/live/${id}/hand`, { method: 'POST', body: JSON.stringify({ active: false }) });
      setHandName(name);
      const d = await api(`/live/${id}/hands`);
      setRaisedHands(d.hands);
      setTimeout(() => setHandName(''), 4000);
    } catch {}
  };

  const send = (text) => {
    setMessages((m) => [...m, { name: user.name, text }]);
  };

  const endRoom = async () => {
    await api(`/live/${id}/end`, { method: 'POST' });
    setMsg('تم إنهاء القاعة وتسجيل الجلسة');
  };

  const launchPoll = () => {
    setPoll({ q: 'ما مستوى المادة حتى الآن؟', options: ['ممتاز', 'جيد', 'يحتاج شرحاً'], results: [42, 35, 23] });
  };

  const breakoutGroups = Math.floor(MAX_VIEWERS / BREAKOUT_CAPACITY);

  if (!room) return <div className="page"><p className="muted">جارٍ الدخول للقاعة...</p></div>;

  return (
    <div className="page">
      <div className="space-between">
        <h1 className="page-title">🎥 {room.title}</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => nav('/live')}>↩ خروج</button>
      </div>

      <div className="live-stage">
        <div className="live-live"><span className="dot" /> مباشر</div>
        <video ref={videoRef} autoPlay playsInline muted={!isHost} style={{ width: '100%', height: '100%', objectFit: 'contain', display: camOn && joined ? 'block' : 'none' }} />
        {(!camOn || !joined) && (
          <div className="stage-placeholder">
            <div style={{ fontSize: 60 }}>📺</div>
            <h2>قاعة {isHost ? 'البث' : 'المشاهدة'}</h2>
            <p>{isHost ? 'أنت تقدم الجلسة الآن' : 'المحتوى يبث هنا بجودة عالية حتى 3000 مشاهد'}</p>
          </div>
        )}
      </div>

      <div className="live-controls mb">
        {isHost ? (
          <>
            <button className="btn" onClick={() => setCamOn((v) => !v)}>{camOn ? '🎥 إيقاف الكاميرا' : '🎥 تشغيل الكاميرا'}</button>
            <button className="btn btn-secondary" onClick={() => setMicOn((v) => !v)}>{micOn ? '🎤 إيقاف المايك' : '🎤 تشغيل المايك'}</button>
            <button className="btn btn-secondary">🖥 مشاركة الشاشة</button>
            <button className="btn btn-secondary" onClick={launchPoll}>📋 استطلاع فوري</button>
            <button className="btn btn-secondary" onClick={() => setBreakoutOpen((v) => !v)}>👥 مجموعات صغيرة</button>
            {raisedHands.length > 0 && <button className="btn btn-gold">✋ أيدي مرفوعة: {raisedHands.length}</button>}
            <button className="btn btn-danger" onClick={endRoom}>إنهاء وتسجيل</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={toggleHand}>{myHand ? '✋ أزلت يدك' : '✋ رفع اليد'}</button>
            <button className="btn btn-secondary" onClick={launchPoll}>📋 تصويت</button>
          </>
        )}
      </div>

      {/* ردود الفعل الحية */}
      <div className="row mb" style={{ gap: 8, flexWrap: 'wrap' }}>
        {['👍', '❤️', '👏', '🎉', '🔥'].map((e) => (
          <button key={e} className="btn btn-secondary btn-sm" onClick={() => react(e)} style={{ fontSize: 18 }}>{e}</button>
        ))}
        {reactions.map((r) => (
          <span key={r.emoji} className="chip">{r.emoji} {r.n}</span>
        ))}
      </div>

      {handName && <div className="success-msg mb">✋ {handName} — تم استدعاؤك، المضيف سيفتح المايك لك</div>}

      {/* الأيدي المرفوعة (للمضيف) */}
      {isHost && raisedHands.length > 0 && (
        <div className="card mb">
          <h3 className="mb">✋ الأيدي المرفوعة ({raisedHands.length})</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {raisedHands.map((h) => (
              <span key={h.id} className="chip">
                {h.avatar || '👤'} {h.user_name}
                <button className="btn btn-secondary btn-sm" style={{ marginRight: 6 }} onClick={() => lowerHand(h.user_name)}>استدعاء</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {msg && <div className="success-msg mb">{msg}</div>}

      {poll && (
        <div className="card mb">
          <h3 className="mb">📋 {poll.q}</h3>
          <div className="row">
            {poll.options.map((o, i) => (
              <button key={i} className="btn btn-secondary" onClick={() => setPoll({ ...poll, results: poll.results.map((v, j) => (j === i ? v + 1 : v)) })}>{o}</button>
            ))}
          </div>
          <div className="mt">
            {poll.options.map((o, i) => (
              <div key={i} className="mb">
                <div className="row space-between" style={{ marginBottom: 4 }}>
                  <span className="muted">{o}</span>
                  <span className="chip">{poll.results[i]} صوت</span>
                </div>
                <div style={{ background: '#0e1024', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#6c7bff', height: '100%', width: ((poll.results[i] / poll.results.reduce((a, b) => a + b, 1)) * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {breakoutOpen && isHost && (
        <div className="card mb">
          <h3 className="mb">👥 مجموعات صغيرة (Breakout Rooms)</h3>
          <p className="muted mb">تم تقسيم <strong>{MAX_VIEWERS}</strong> مشاهد إلى <strong>{breakoutGroups}</strong> مجموعة، سعة كل مجموعة <strong>{BREAKOUT_CAPACITY}</strong> طالب للتفاعل المرئي.</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="card" style={{ padding: 12, textAlign: 'center' }}>
                <div className="stat-value" style={{ fontSize: 18 }}>غرفة {i + 1}</div>
                <div className="muted">{Math.floor(Math.random() * 50) + 20} طالب</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb">
        <div className="row space-between" style={{ marginBottom: 0 }}>
          <h3>👥 الحضور</h3>
          <span className="chip chip-gold"><strong id="viewer-count">{room.participant_count}</strong> / {MAX_VIEWERS.toLocaleString('en-US')} مشاهد</span>
        </div>
        <div className="mt" style={{ background: '#0e1024', borderRadius: 8, height: 8, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg,#6c7bff,#9f6cff)', height: '100%', width: Math.min((room.participant_count / MAX_VIEWERS) * 100, 100) + '%' }} />
        </div>
        <div className="row mt">
          {participants.slice(0, 8).map((p, i) => (
            <span key={i} className="chip">{p.name} {p.role !== 'أنت' && p.role !== 'المضيف' ? `(${p.role})` : ''}</span>
          ))}
          <span className="chip chip-gold">+ مشاهدون آخرون</span>
        </div>
      </div>

      <div className="chat-box">
        <h4 className="mb">💬 الدردشة الحية</h4>
        {liveMsgs.map((m, i) => (
          <div key={m.id || i} className="chat-msg">
            <strong>{m.user_name || m.name}:</strong> {m.message || m.text}
            {m.created_at && <span className="muted" style={{ fontSize: 10, marginRight: 6 }}>{m.created_at.slice(11, 16)}</span>}
          </div>
        ))}
        {liveMsgs.length === 0 && <p className="muted">لا توجد رسائل بعد... كن أول من يتفاعل!</p>}
        <div className="row mt">
          <input className="input" placeholder="اكتب رسالة..." value={chatText} onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }} style={{ flex: 1 }} />
          <button className="btn" onClick={sendChat}>إرسال</button>
        </div>
      </div>
    </div>
  );
}
