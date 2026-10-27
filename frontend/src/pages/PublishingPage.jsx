// frontend/src/pages/PublishingPage.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

/* ---------- Constants ---------- */

const PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X (Twitter)' },
];

const SELECT_CLASS =
  'w-full rounded border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500';

const FEEDBACK_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
};

/* ---------- Components ---------- */

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-800">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/* ---------- Page ---------- */

export default function PublishingPage() {
  const [ads, setAds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAd, setSelectedAd] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text }
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  /* ----- Data loading ----- */

  const fetchData = useCallback(async () => {
    try {
      const [adsRes, accountsRes] = await Promise.all([
        api.get('/ads'),
        api.get('/social/accounts'),
      ]);
      setAds(adsRes.data.filter((ad) => ad.status === 'APPROVED'));
      setAccounts(accountsRes.data);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Could not load advertisements and accounts. Refresh the page and try again.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const platformAccounts = useMemo(
    () => accounts.filter((account) => account.platform === selectedPlatform),
    [accounts, selectedPlatform]
  );

  /* ----- Handlers ----- */

  const handlePlatformChange = (event) => {
    setSelectedPlatform(event.target.value);
    setSelectedAccount(''); // an account from the previous platform is no longer valid
  };

  const handlePublish = async () => {
    if (!selectedAd || !selectedPlatform || !selectedAccount) {
      setFeedback({ type: 'error', text: 'Select an advertisement, a platform and a connected account.' });
      return;
    }

    setFeedback(null);
    setPublishing(true);
    try {
      const res = await api.post('/social/publish', {
        adId: selectedAd,
        platform: selectedPlatform,
        accountId: selectedAccount,
      });
      setFeedback({ type: 'success', text: res.data.message || 'Published' });
      setSelectedAd(''); // the published ad leaves the approved list
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Publish failed' });
    } finally {
      setPublishing(false);
    }
  };

  /* ----- Render ----- */

  if (loading) return <MainLayout><p>Loading...</p></MainLayout>;

  return (
    <MainLayout>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Publish advertisement</h1>
        <p className="text-sm text-gray-500">Only approved advertisements can be published.</p>
      </header>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mb-4 rounded border p-3 text-sm ${FEEDBACK_STYLES[feedback.type]}`}
        >
          {feedback.text}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field
          id="publish-ad"
          label="Advertisement"
          hint={ads.length === 0 ? 'No approved advertisements available.' : undefined}
        >
          <select
            id="publish-ad"
            value={selectedAd}
            onChange={(e) => setSelectedAd(e.target.value)}
            disabled={ads.length === 0}
            className={SELECT_CLASS}
          >
            <option value="">Select an advertisement</option>
            {ads.map((ad) => (
              <option key={ad._id} value={ad._id}>{ad.title}</option>
            ))}
          </select>
        </Field>

        <Field id="publish-platform" label="Platform">
          <select
            id="publish-platform"
            value={selectedPlatform}
            onChange={handlePlatformChange}
            className={SELECT_CLASS}
          >
            <option value="">Select a platform</option>
            {PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>{platform.label}</option>
            ))}
          </select>
        </Field>

        <Field
          id="publish-account"
          label="Connected account"
          hint={
            selectedPlatform && platformAccounts.length === 0
              ? 'No connected account for this platform. Connect one in Social accounts.'
              : undefined
          }
        >
          <select
            id="publish-account"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            disabled={!selectedPlatform || platformAccounts.length === 0}
            className={SELECT_CLASS}
          >
            <option value="">Select a connected account</option>
            {platformAccounts.map((account) => (
              <option key={account._id} value={account._id}>
                {account.accountName || account.platformUserId}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button
        type="button"
        onClick={handlePublish}
        disabled={publishing}
        className="rounded bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {publishing ? 'Publishing...' : 'Publish'}
      </button>
    </MainLayout>
  );
}