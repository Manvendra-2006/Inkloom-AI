// frontend/src/pages/SocialPage.js
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

const platforms = ['linkedin', 'instagram', 'facebook', 'x'];

export default function SocialPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/social/accounts');
      setAccounts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleConnect = async (platform) => {
    try {
      const res = await api.post('/social/connect', { platform });
      setMessage(res.data.message);
      fetchAccounts();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Connect failed');
    }
  };

  const handleDelete = async (id) => {
    await api.delete(`/social/accounts/${id}`);
    fetchAccounts();
  };

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Social Media Accounts</h1>
      {message && <div className="bg-blue-100 text-blue-800 p-2 mb-4 rounded">{message}</div>}
      <div className="flex space-x-4 mb-4">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => handleConnect(p)}
            className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
          >
            Connect {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <p>Loading accounts...</p>
      ) : (
        <table className="min-w-full bg-white shadow rounded">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Platform</th>
              <th className="px-4 py-2 border">Account Name</th>
              <th className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc._id} className="hover:bg-gray-100">
                <td className="px-4 py-2 border">{acc.platform}</td>
                <td className="px-4 py-2 border">{acc.accountName || '—'}</td>
                <td className="px-4 py-2 border">
                  <button
                    onClick={() => handleDelete(acc._id)}
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </MainLayout>
  );
}
