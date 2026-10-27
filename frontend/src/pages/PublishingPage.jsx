// frontend/src/pages/PublishingPage.js
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

export default function PublishingPage() {
  const [ads, setAds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAd, setSelectedAd] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [adsRes, accountsRes] = await Promise.all([
        api.get('/ads'),
        api.get('/social/accounts'),
      ]);
      const approvedAds = adsRes.data.filter((a) => a.status === 'APPROVED');
      setAds(approvedAds);
      setAccounts(accountsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePublish = async () => {
    if (!selectedAd || !selectedPlatform || !selectedAccount) {
      setMessage('Select ad, platform and connected account');
      return;
    }
    try {
      const res = await api.post('/social/publish', {
        adId: selectedAd,
        platform: selectedPlatform,
        accountId: selectedAccount,
      });
      setMessage(res.data.message || 'Published');
      fetchData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Publish failed');
    }
  };

  if (loading) return <MainLayout><p>Loading...</p></MainLayout>;

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Publish Advertisement</h1>
      {message && <div className="bg-green-100 text-green-800 p-2 mb-4 rounded">{message}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <select
          value={selectedAd}
          onChange={(e) => setSelectedAd(e.target.value)}
          className="border rounded p-2"
        >
          <option value="">Select Advertisement</option>
          {ads.map((ad) => (
            <option key={ad._id} value={ad._id}>
              {ad.title}
            </option>
          ))}
        </select>
        <select
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value)}
          className="border rounded p-2"
        >
          <option value="">Select Platform</option>
          <option value="linkedin">LinkedIn</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="x">X (Twitter)</option>
        </select>
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="border rounded p-2"
        >
          <option value="">Select Connected Account</option>
          {accounts
            .filter((a) => a.platform === selectedPlatform)
            .map((acc) => (
              <option key={acc._id} value={acc._id}>
                {acc.accountName || acc.platformUserId}
              </option>
            ))}
        </select>
      </div>
      <button
        onClick={handlePublish}
        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
      >
        Publish
      </button>
    </MainLayout>
  );
}
