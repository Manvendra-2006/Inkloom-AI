// frontend/src/pages/AdminDashboard.js
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await api.get('/ads'); // admin can fetch all
        setAds(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAds();
  }, []);

  const statusCounts = ads.reduce((acc, ad) => {
    acc[ad.status] = (acc[ad.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'CHANGES_REQUIRED'].map((status) => (
          <div key={status} className="bg-white p-4 rounded shadow">
            <h2 className="text-lg font-medium">{status.replace('_', ' ')}</h2>
            <p className="text-2xl font-bold">{statusCounts[status] || 0}</p>
          </div>
        ))}
      </div>
      <div className="flex space-x-4 mb-4">
        <Link to="/admin/brand-profiles" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
          Manage Brand Profile
        </Link>
        <Link to="/admin/reviews" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Review Submissions
        </Link>
        <Link to="/admin/social" className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">
          Social Accounts
        </Link>
        <Link to="/admin/publishing" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Publish Ads
        </Link>
        <Link to="/admin/history" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
          History
        </Link>
      </div>
    </MainLayout>
  );
}
