import React from 'react';
import { NavLink } from 'react-router-dom';
import { getUser } from '../../api.js';

export function AdminLayout({ children }) {
  const user = getUser();
  const isMain = user?.role === 'main_admin';

  const links = [
    { to: '/admin', label: '📊 نظرة عامة' },
    { to: '/admin/courses', label: '📚 الدورات' },
    { to: '/admin/lessons', label: '📝 الدروس' },
    { to: '/admin/exams', label: '📋 الامتحانات' },
    { to: '/admin/schedule', label: '📅 الجدول الزمني' },
    { to: '/admin/sections', label: '🗂️ الأقسام' },
    { to: '/admin/challenges', label: '🏆 التحديات' },
    { to: '/admin/live', label: '🎥 قاعات البث' },
    { to: '/admin/audit', label: '📜 سجل التدقيق' },
    { to: '/admin/reports', label: '📄 التقارير' },
    { to: '/admin/backup', label: '💾 النسخ الاحتياطي' },
  ];
  if (isMain) {
    links.push({ to: '/admin/subadmins', label: '👥 إدارة الأدمن الفرعي' });
    links.push({ to: '/admin/users', label: '🎓 الطلاب' });
    links.push({ to: '/admin/academy', label: '🛡️ الأكاديمية' });
    links.push({ to: '/admin/opportunities', label: '💼 الفرص' });
    links.push({ to: '/admin/events', label: '🎪 الفعاليات' });
    links.push({ to: '/admin/analytics', label: '📊 التحليلات' });
    links.push({ to: '/admin/volunteers', label: '🤝 التطوع' });
    links.push({ to: '/admin/resources', label: '🏢 المرافق' });
    links.push({ to: '/admin/settings', label: '⚙️ إعدادات المنصة' });
    links.push({ to: '/admin/security', label: '🛡️ مركز الأمان' });
  }

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        <div className="muted" style={{ padding: '0 14px 12px' }}>لوحة الأدمن</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/admin'}>{l.label}</NavLink>
        ))}
        <div style={{ padding: '16px 14px 0' }}>
          <span className="chip">{isMain ? 'أدمن رئيسي' : 'أدمن فرعي'}</span>
        </div>
      </div>
      <div className="admin-content">{children}</div>
    </div>
  );
}
