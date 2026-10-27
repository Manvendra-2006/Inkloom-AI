// frontend/src/components/Sidebar.js
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = {
  EMPLOYEE: [
    { to: '/employee/dashboard', label: 'Dashboard' },
    { to: '/employee/create-ad', label: 'Create Ad' },
    { to: '/employee/submissions', label: 'My Submissions' },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/brand-profiles', label: 'Brand Profile' },
    { to: '/admin/reviews', label: 'Reviews' },
    { to: '/admin/social', label: 'Social Accounts' },
    { to: '/admin/publishing', label: 'Publish' },
    { to: '/admin/history', label: 'History' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const roleLinks = user ? links[user.role] : [];

  return (
    <aside className="w-64 bg-gray-800 text-white h-screen flex flex-col">
      <div className="p-4 text-xl font-bold">INKLOOM AI</div>
      <nav className="flex-1">
        <ul>
          {roleLinks.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  isActive
                    ? 'block px-4 py-2 bg-gray-700'
                    : 'block px-4 py-2 hover:bg-gray-700'
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <button
        onClick={logout}
        className="m-4 px-4 py-2 bg-red-600 rounded hover:bg-red-700"
      >
        Log Out
      </button>
    </aside>
  );
}
