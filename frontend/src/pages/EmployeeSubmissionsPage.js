// frontend/src/pages/EmployeeSubmissionsPage.js
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import { Link } from 'react-router-dom';

export default function EmployeeSubmissionsPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAds = async () => {
    try {
      const res = await api.get('/ads');
      setAds(res.data);
    } catch (err) {
      setError('Failed to load advertisements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  if (loading) return <MainLayout><p>Loading...</p></MainLayout>;
  if (error) return <MainLayout><div className="bg-red-100 text-red-700 p-2 rounded">{error}</div></MainLayout>;

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">My Submissions</h1>
      <table className="min-w-full bg-white shadow rounded">
        <thead>
          <tr>
            <th className="px-4 py-2 border">Title</th>
            <th className="px-4 py-2 border">Status</th>
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
              <td className="px-4 py-2 border">{ad.aiComplianceScore ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MainLayout>
  );
}
