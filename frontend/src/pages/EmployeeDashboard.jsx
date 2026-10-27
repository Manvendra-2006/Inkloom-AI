// frontend/src/pages/EmployeeDashboard.js
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import { Link } from 'react-router-dom';

export default function EmployeeDashboard() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await api.get('/ads');
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
      <h1 className="text-2xl font-bold mb-4">Employee Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {['DRAFT', 'CHANGES_REQUIRED', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED'].map((status) => (
          <div key={status} className="bg-white p-4 rounded shadow">
            <h2 className="text-lg font-medium">{status.replace('_', ' ')}</h2>
            <p className="text-2xl font-bold">{statusCounts[status] || 0}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">My Advertisements</h2>
        <Link
          to="/employee/create-ad"
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Create Advertisement
        </Link>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="min-w-full bg-white shadow rounded">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Title</th>
              <th className="px-4 py-2 border">Status</th>
              <th className="px-4 py-2 border">AI Status</th>
              <th className="px-4 py-2 border">Score</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => (
              <tr key={ad._id} className="hover:bg-gray-100">
                <td className="px-4 py-2 border">
                  <Link to={`/employee/ad/${ad._id}`} className="text-indigo-600 hover:underline">
                    {ad.title}
                  </Link>
                </td>
                <td className="px-4 py-2 border">{ad.status}</td>
                <td className="px-4 py-2 border">{ad.aiStatus ? ad.aiStatus.toUpperCase() : '—'}</td>
                <td className="px-4 py-2 border">{ad.aiComplianceScore ?? '-'} </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </MainLayout>
  );
}
