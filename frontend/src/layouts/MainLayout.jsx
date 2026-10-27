// frontend/src/layouts/MainLayout.js
import React from 'react';
import Sidebar from '../components/Sidebar';

export default function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Lets keyboard users jump past the sidebar */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to main content
      </a>

      <Sidebar />

      {/* min-w-0 stops wide tables from stretching the page past the screen */}
      <main id="main-content" className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}