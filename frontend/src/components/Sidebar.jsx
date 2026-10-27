// frontend/src/components/Sidebar.js
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ---------- Config ---------- */

const NAV_LINKS = {
  EMPLOYEE: [
    { to: '/employee/dashboard', label: 'Dashboard' },
    { to: '/employee/create-ad', label: 'Create ad' },
    { to: '/employee/submissions', label: 'My submissions' },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/brand-profiles', label: 'Brand profile' },
    { to: '/admin/reviews', label: 'Reviews' },
    { to: '/admin/social', label: 'Social accounts' },
    { to: '/admin/publishing', label: 'Publish' },
    { to: '/admin/history', label: 'History' },
  ],
};

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white';

const linkClass = ({ isActive }) =>
  `block rounded px-4 py-2 transition ${FOCUS_RING} ${
    isActive ? 'bg-gray-700 font-medium' : 'text-gray-200 hover:bg-gray-700'
  }`;

/* ---------- Component ---------- */

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false); // mobile drawer only

  const roleLinks = (user && NAV_LINKS[user.role]) || [];

  // Close the drawer with the Escape key
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-gray-800 px-4 py-3 text-white md:hidden">
        <span className="text-lg font-bold">INKLOOM AI</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="sidebar"
          className={`rounded p-1 hover:bg-gray-700 ${FOCUS_RING}`}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Backdrop behind the mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: slide-in drawer on mobile, fixed column on desktop */}
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gray-800 text-white transition-transform md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4">
          <span className="text-xl font-bold">INKLOOM AI</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className={`rounded p-1 hover:bg-gray-700 md:hidden ${FOCUS_RING}`}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-1">
            {roleLinks.map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} className={linkClass} onClick={() => setOpen(false)}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={logout}
          className={`m-4 rounded bg-red-600 px-4 py-2 font-medium transition hover:bg-red-700 ${FOCUS_RING}`}
        >
          Log out
        </button>
      </aside>
    </>
  );
}