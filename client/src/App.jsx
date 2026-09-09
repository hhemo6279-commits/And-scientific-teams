import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { getUser, api, logout as logoutSession } from './api.js';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerifyCertificate from './pages/VerifyCertificate.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import Messages from './pages/Messages.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminBackup from './pages/admin/AdminBackup.jsx';
import StudentTracking from './pages/admin/StudentTracking.jsx';
import OfflineLessons from './pages/OfflineLessons.jsx';
import Bundles from './pages/Bundles.jsx';
import BundleView from './pages/BundleView.jsx';
import InstructorDashboard from './pages/InstructorDashboard.jsx';
import Schedule from './pages/Schedule.jsx';
import StudyGroups from './pages/StudyGroups.jsx';
import GroupView from './pages/GroupView.jsx';
import AdminSchedule from './pages/admin/AdminSchedule.jsx';
import CourseView from './pages/CourseView.jsx';
import LiveRooms from './pages/LiveRooms.jsx';
import LiveRoom from './pages/LiveRoom.jsx';
import Challenges from './pages/Challenges.jsx';
import Profile from './pages/Profile.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Search from './pages/Search.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminSections from './pages/admin/AdminSections.jsx';
import AdminCourses from './pages/admin/AdminCourses.jsx';
import AdminSubAdmins from './pages/admin/AdminSubAdmins.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminAudit from './pages/admin/AdminAudit.jsx';
import AdminChallenges from './pages/admin/AdminChallenges.jsx';
import AdminLive from './pages/admin/AdminLive.jsx';
import AdminLessons from './pages/admin/AdminLessons.jsx';
import AdminExams from './pages/admin/AdminExams.jsx';
import AdminAcademy from './pages/admin/AdminAcademy.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';
import AdminSecurity from './pages/admin/AdminSecurity.jsx';
import AdminOpportunities from './pages/admin/AdminOpportunities.jsx';
import AdminEvents from './pages/admin/AdminEvents.jsx';
import AdminResources from './pages/admin/AdminResources.jsx';
import AdminVolunteers from './pages/admin/AdminVolunteers.jsx';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';
import Academy from './pages/Academy.jsx';
import AcademyTrack from './pages/AcademyTrack.jsx';
import Opportunities from './pages/Opportunities.jsx';
import OpportunityView from './pages/OpportunityView.jsx';
import Events from './pages/Events.jsx';
import EventView from './pages/EventView.jsx';
import Resources from './pages/Resources.jsx';
import ResourceView from './pages/ResourceView.jsx';
import Volunteers from './pages/Volunteers.jsx';
import VolunteerView from './pages/VolunteerView.jsx';
import { loadFlags, isFlagOn } from './flags.js';

function Protected({ children, roles }) {
  const user = getUser();
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// بوابة الميزات: تمنع دخول صفحة ميزة معطلة عند الطلاب
function FeatureGate({ flag, children }) {
  const user = getUser();
  if (user && user.role === 'student' && isFlagOn(flag) === false) return <Navigate to="/" replace />;
  return children;
}

function PushSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!getUser()) return;
    let cancelled = false;
    const run = async () => {
      try {
        if (Notification.permission !== 'granted') return;
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        const { key } = await api('/me/push/key');
        if (!key) return;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          });
        }
        if (!cancelled && sub) {
          await api('/me/push/subscribe', {
            method: 'POST',
            body: JSON.stringify({ subscription: sub.toJSON() }),
          });
        }
      } catch { /* تجاهل أخطاء الإشعارات */ }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const enable = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const reg = await navigator.serviceWorker.getRegistration();
        const { key } = await api('/me/push/key');
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await api('/me/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON() }) });
        alert('تم تفعيل الإشعارات ✅ ستصلك الإشعارات حتى خارج التطبيق');
      }
    } catch { /* تجاهل */ }
  };

  const noSupport = !('serviceWorker' in navigator) || !('PushManager' in window);
  if (noSupport) return null;

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={enable}
      style={{ marginInlineEnd: 10 }}
      title="فعّل الإشعارات لتصلك التنبيهات خارج التطبيق"
    >
      {Notification.permission === 'granted' ? '🔔 مفعّل' : '🔕 فعّل الإشعارات'}
    </button>
  );
}

function InstallApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => { setPrompt(null); setInstalled(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') { setPrompt(null); setInstalled(true); }
  };

  if (!prompt || installed) return null;
  return (
    <button className="btn btn-sm" onClick={install} style={{ marginInlineEnd: 10 }}>
      📲 ثبّت التطبيق
    </button>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="logo-duo">
            <img src="/logo.jpg" alt="شعار 1" />
            <img src="/logo-2.jpg" alt="شعار 2" />
          </div>
          <span>منصة MK التعليمية</span>
        </div>
        <div className="footer-links">
          <Link to="/">الأقسام</Link>
          <Link to="/live">البث المباشر</Link>
          <Link to="/challenges">التحديات</Link>
          <Link to="/leaderboard">الترتيب</Link>
          <Link to="/verify">التحقق من الشهادة</Link>
        </div>
        <div className="muted">جميع الحقوق محفوظة © 2026</div>
      </div>
    </footer>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const ref = useRef(null);

  const load = () => api('/me/notifications').then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const readAll = async () => {
    await api('/me/notifications/read-all', { method: 'POST' });
    load();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen((v) => !v)}>
        🔔 {data.unread > 0 && <span className="chip chip-red">{data.unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="row space-between" style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
            <strong>الإشعارات</strong>
            <button className="btn btn-secondary btn-sm" onClick={readAll}>قراءة الكل</button>
          </div>
          {data.notifications.slice(0, 15).map((n) => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
              <strong>{n.title}</strong>
              <div className="muted">{n.content}</div>
              <div className="muted" style={{ fontSize: 11 }}>{n.created_at}</div>
            </div>
          ))}
          {data.notifications.length === 0 && <div className="muted" style={{ padding: 16, textAlign: 'center' }}>لا توجد إشعارات</div>}
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const user = getUser();
  const nav = useNavigate();
  const location = useLocation();
  const isAdmin = user && (user.role === 'main_admin' || user.role === 'sub_admin');
  const [q, setQ] = useState('');

  const logout = () => {
    logoutSession().then(() => nav('/'));
  };

  const doSearch = (e) => {
    e.preventDefault();
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <nav className="navbar">
      <Link to={user ? (isAdmin ? '/admin' : '/') : '/'} className="logo">
        <div className="logo-duo">
          <img src="/logo.jpg" alt="شعار MK 1" />
          <img src="/logo-2.jpg" alt="شعار MK 2" />
        </div>
        <span>منصة MK</span>
      </Link>

      {user ? (
        <>
          <div className="nav-links">
            {!isAdmin && (
              <>
                <Link to="/" className={location.pathname === '/' ? 'nav-active' : ''}>الرئيسية</Link>
                {isFlagOn('bundles') && <Link to="/bundles" className={location.pathname.startsWith('/bundles') ? 'nav-active' : ''}>📦 الحقائب</Link>}
                {isFlagOn('academy') && <Link to="/academy" className={location.pathname.startsWith('/academy') ? 'nav-active' : ''}>🛡️ الأكاديمية</Link>}
                {isFlagOn('groups') && <Link to="/groups" className={location.pathname.startsWith('/groups') ? 'nav-active' : ''}>👥 المجموعات</Link>}
                {isFlagOn('schedule') && <Link to="/schedule" className={location.pathname === '/schedule' ? 'nav-active' : ''}>📅 الجدول</Link>}
                {isFlagOn('live') && <Link to="/live" className={location.pathname.startsWith('/live') ? 'nav-active' : ''}>البث المباشر</Link>}
                {isFlagOn('challenges') && <Link to="/challenges" className={location.pathname === '/challenges' ? 'nav-active' : ''}>التحديات</Link>}
                {isFlagOn('opportunities') && <Link to="/opportunities" className={location.pathname.startsWith('/opportunities') ? 'nav-active' : ''}>💼 الفرص</Link>}
                {isFlagOn('events') && <Link to="/events" className={location.pathname.startsWith('/events') ? 'nav-active' : ''}>🎪 الفعاليات</Link>}
                {isFlagOn('resources') && <Link to="/resources" className={location.pathname.startsWith('/resources') ? 'nav-active' : ''}>🏢 المرافق</Link>}
                {isFlagOn('volunteers') && <Link to="/volunteers" className={location.pathname.startsWith('/volunteers') ? 'nav-active' : ''}>🤝 التطوع</Link>}
                <Link to="/leaderboard" className={location.pathname === '/leaderboard' ? 'nav-active' : ''}>الترتيب</Link>
              </>
            )}
            {isAdmin && (
              <>
                <Link to="/admin" className={location.pathname === '/admin' ? 'nav-active' : ''}>لوحة التحكم</Link>
                <Link to="/admin/live" className={location.pathname === '/admin/live' ? 'nav-active' : ''}>قاعات البث</Link>
              </>
            )}
            <form onSubmit={doSearch} className="nav-search">
              <input className="input" placeholder="🔍 بحث..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 140 }} />
            </form>
          </div>
          <div className="nav-user">
            {!isAdmin && <Link to="/profile" className="nav-link-profile">الملف الشخصي</Link>}
            {isAdmin && <Link to="/instructor" className="nav-link-profile">👨‍🏫</Link>}
            {isFlagOn('messages') && <Link to="/messages" className="nav-link-profile">💬</Link>}
            {isFlagOn('offline') && <Link to="/offline" className="nav-link-profile">📴</Link>}
            {user.role === 'student' && <NotificationsBell />}
            <PushSetup />
            <InstallApp />
            <span className="avatar">{user.avatar || '👤'}</span>
            <span>{user.name}</span>
            <span className="badge">
              {user.role === 'main_admin' ? 'أدمن رئيسي' : user.role === 'sub_admin' ? 'أدمن فرعي' : 'طالب'}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>خروج</button>
          </div>
        </>
      ) : (
        <div className="nav-links">
          <Link to="/login" className="btn btn-secondary btn-sm">تسجيل الدخول</Link>
          <Link to="/register" className="btn btn-sm">ابدأ مجاناً</Link>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  const [refresh, setRefresh] = useState(0);
  const user = getUser();
  const isAdmin = user && (user.role === 'main_admin' || user.role === 'sub_admin');

  useEffect(() => {
    if (getUser()) loadFlags();
  }, [refresh]);

  return (
    <>
      <Navbar key={refresh} />
      <Routes>
        <Route path="/" element={user ? (isAdmin ? <Navigate to="/admin" replace /> : <StudentDashboard />) : <Landing />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/course/:id" element={<Protected><CourseView /></Protected>} />
        <Route path="/live" element={<Protected><FeatureGate flag="live"><LiveRooms /></FeatureGate></Protected>} />
        <Route path="/live/:id" element={<Protected><FeatureGate flag="live"><LiveRoom /></FeatureGate></Protected>} />
        <Route path="/challenges" element={<Protected><FeatureGate flag="challenges"><Challenges /></FeatureGate></Protected>} />
        <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
        <Route path="/search" element={<Protected><Search /></Protected>} />
        <Route path="/profile" element={<Protected roles={['student']}><Profile /></Protected>} />
        <Route path="/messages" element={<Protected roles={['student', 'main_admin', 'sub_admin']}><FeatureGate flag="messages"><Messages /></FeatureGate></Protected>} />
        <Route path="/messages/:userId" element={<Protected roles={['student', 'main_admin', 'sub_admin']}><FeatureGate flag="messages"><Messages /></FeatureGate></Protected>} />
        <Route path="/offline" element={<Protected roles={['student']}><FeatureGate flag="offline"><OfflineLessons /></FeatureGate></Protected>} />
        <Route path="/bundles" element={<Protected><FeatureGate flag="bundles"><Bundles /></FeatureGate></Protected>} />
        <Route path="/bundles/:id" element={<Protected><FeatureGate flag="bundles"><BundleView /></FeatureGate></Protected>} />
        <Route path="/instructor" element={<Protected roles={['main_admin', 'sub_admin']}><InstructorDashboard /></Protected>} />
        <Route path="/admin" element={<Protected roles={['main_admin', 'sub_admin']}><AdminDashboard onAnyChange={() => setRefresh((r) => r + 1)} /></Protected>} />
        <Route path="/admin/sections" element={<Protected roles={['main_admin', 'sub_admin']}><AdminSections /></Protected>} />
        <Route path="/admin/courses" element={<Protected roles={['main_admin', 'sub_admin']}><AdminCourses /></Protected>} />
        <Route path="/admin/subadmins" element={<Protected roles={['main_admin']}><AdminSubAdmins /></Protected>} />
        <Route path="/admin/users" element={<Protected roles={['main_admin']}><AdminUsers /></Protected>} />
        <Route path="/admin/users/:id" element={<Protected roles={['main_admin', 'sub_admin']}><StudentTracking /></Protected>} />
        <Route path="/admin/audit" element={<Protected roles={['main_admin', 'sub_admin']}><AdminAudit /></Protected>} />
        <Route path="/admin/reports" element={<Protected roles={['main_admin', 'sub_admin']}><AdminReports /></Protected>} />
        <Route path="/admin/backup" element={<Protected roles={['main_admin', 'sub_admin']}><AdminBackup /></Protected>} />
        <Route path="/admin/challenges" element={<Protected roles={['main_admin', 'sub_admin']}><AdminChallenges /></Protected>} />
        <Route path="/admin/live" element={<Protected roles={['main_admin', 'sub_admin']}><AdminLive /></Protected>} />
        <Route path="/admin/lessons" element={<Protected roles={['main_admin', 'sub_admin']}><AdminLessons /></Protected>} />
        <Route path="/admin/exams" element={<Protected roles={['main_admin', 'sub_admin']}><AdminExams /></Protected>} />
        <Route path="/admin/schedule" element={<Protected roles={['main_admin', 'sub_admin']}><AdminSchedule /></Protected>} />
        <Route path="/admin/academy" element={<Protected roles={['main_admin']}><AdminAcademy /></Protected>} />
        <Route path="/admin/settings" element={<Protected roles={['main_admin']}><AdminSettings /></Protected>} />
        <Route path="/admin/security" element={<Protected roles={['main_admin']}><AdminSecurity /></Protected>} />
        <Route path="/admin/opportunities" element={<Protected roles={['main_admin']}><AdminOpportunities /></Protected>} />
        <Route path="/admin/events" element={<Protected roles={['main_admin']}><AdminEvents /></Protected>} />
        <Route path="/admin/resources" element={<Protected roles={['main_admin']}><AdminResources /></Protected>} />
        <Route path="/admin/volunteers" element={<Protected roles={['main_admin']}><AdminVolunteers /></Protected>} />
        <Route path="/admin/analytics" element={<Protected roles={['main_admin']}><AdminAnalytics /></Protected>} />
        <Route path="/academy" element={<Protected><FeatureGate flag="academy"><Academy /></FeatureGate></Protected>} />
        <Route path="/academy/:id" element={<Protected><FeatureGate flag="academy"><AcademyTrack /></FeatureGate></Protected>} />
        <Route path="/schedule" element={<Protected><FeatureGate flag="schedule"><Schedule /></FeatureGate></Protected>} />
        <Route path="/groups" element={<Protected roles={['student']}><FeatureGate flag="groups"><StudyGroups /></FeatureGate></Protected>} />
        <Route path="/groups/:id" element={<Protected roles={['student']}><FeatureGate flag="groups"><GroupView /></FeatureGate></Protected>} />
        <Route path="/opportunities" element={<Protected><FeatureGate flag="opportunities"><Opportunities /></FeatureGate></Protected>} />
        <Route path="/opportunities/:id" element={<Protected><FeatureGate flag="opportunities"><OpportunityView /></FeatureGate></Protected>} />
        <Route path="/events" element={<Protected><FeatureGate flag="events"><Events /></FeatureGate></Protected>} />
        <Route path="/events/:id" element={<Protected><FeatureGate flag="events"><EventView /></FeatureGate></Protected>} />
        <Route path="/resources" element={<Protected><FeatureGate flag="resources"><Resources /></FeatureGate></Protected>} />
        <Route path="/resources/:id" element={<Protected><FeatureGate flag="resources"><ResourceView /></FeatureGate></Protected>} />
        <Route path="/volunteers" element={<Protected><FeatureGate flag="volunteers"><Volunteers /></FeatureGate></Protected>} />
        <Route path="/volunteers/:id" element={<Protected><FeatureGate flag="volunteers"><VolunteerView /></FeatureGate></Protected>} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
