// frontend/src/layouts/MainLayout.js
import React from 'react';
import Sidebar from '../components/Sidebar';

export default function MainLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto bg-gray-100 min-h-screen">
        {children}
      </main>
    </div>
  );
}
