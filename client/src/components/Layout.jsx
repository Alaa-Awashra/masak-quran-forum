import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { Avatar, Icon } from './ui.jsx';
import { BRAND } from '../lib/brand.js';
import { supervisorTypeLabel } from '../lib/labels.js';
import { fmtDate } from '../lib/format.js';

export default function Layout() {
  const { user, isAdmin, n, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);

  const links = isAdmin
    ? [
        { to: '/', label: 'لوحة التحكم', icon: 'home', end: true },
        { to: '/supervisors', label: 'المشرفون', icon: 'users' },
        { to: '/students', label: 'الطلاب', icon: 'user' },
        { to: '/calendar', label: 'التقويم', icon: 'calendar' },
        { to: '/reports', label: 'التقارير', icon: 'report' },
        { to: '/activity', label: 'سجل النشاط', icon: 'activity' },
        { to: '/settings', label: 'الإعدادات', icon: 'sliders' },
        { to: '/profile', label: 'ملفي الشخصي', icon: 'key' },
      ]
    : [
        { to: '/', label: 'لوحة التحكم', icon: 'home', end: true },
        { to: '/students', label: n.many, icon: 'users' },
        { to: '/calendar', label: 'التقويم والمواعيد', icon: 'calendar' },
        { to: '/reports', label: 'التقارير', icon: 'report' },
        { to: '/profile', label: 'ملفي الشخصي', icon: 'key' },
      ];

  const roleLabel = isAdmin ? 'المسؤول الإداري' : supervisorTypeLabel(user.supervisor_type);

  return (
    <div className="app">
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src={BRAND.logo} alt="" />
          <b>{BRAND.name}</b>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={l.icon} />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className="btn btn-block"
            style={{ background: '#ffffff1f' }}
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            type="button"
          >
            <Icon name="logout" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar no-print">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="القائمة" type="button">
            <Icon name="menu" size={22} />
          </button>
          <span className="muted small hide-mobile">{fmtDate(new Date())}</span>
          <span className="spacer" />
          <div className="user">
            <div className="user-info">
              <b>{user.full_name}</b>
              <span className="muted small">{roleLabel}</span>
            </div>
            <Avatar name={user.full_name} />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
