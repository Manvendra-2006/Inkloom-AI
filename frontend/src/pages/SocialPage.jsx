// frontend/src/pages/SocialPage.js
import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

/* ---------- Constants ---------- */

const PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X (Twitter)' },
];

const PLATFORM_LABELS = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]));

const FEEDBACK_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
};

/* ---------- Components ---------- */

function AccountsTable({ accounts, deletingId, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Platform</th>
            <th scope="col" className="px-4 py-3 font-medium">Account name</th>
            <th scope="col" className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((account) => (
            <tr key={account._id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                {PLATFORM_LABELS[account.platform] || account.platform}
              </td>
              <td className="px-4 py-3 text-gray-700">{account.accountName || '—'}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onDelete(account)}
                  disabled={deletingId === account._id}
                  className="rounded bg-rose-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === account._id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Page ---------- */

export default function SocialPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text }
  const [connecting, setConnecting] = useState(null); // platform being connected
  const [deletingId, setDeletingId] = useState(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get('/social/accounts');
      setAccounts(res.data);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Could not load accounts. Refresh the page and try again.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleConnect = async (platform) => {
    setFeedback(null);
    setConnecting(platform);
    try {
      const res = await api.post('/social/connect', { platform });
      setFeedback({ type: 'success', text: res.data.message || 'Account connected.' });
      await fetchAccounts();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Connect failed' });
    } finally {
      setConnecting(null);
    }
  };

  const handleDelete = async (account) => {
    const name = account.accountName || PLATFORM_LABELS[account.platform] || 'this account';
    if (!window.confirm(`Delete ${name}? You will need to connect it again to publish with it.`)) return;

    setFeedback(null);
    setDeletingId(account._id);
    try {
      await api.delete(`/social/accounts/${account._id}`);
      await fetchAccounts();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Could not delete the account.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <MainLayout>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Social media accounts</h1>
        <p className="text-sm text-gray-500">Connect the accounts you want to publish approved ads to.</p>
      </header>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mb-4 rounded border p-3 text-sm ${FEEDBACK_STYLES[feedback.type]}`}
        >
          {feedback.text}
        </div>
      )}

      <section aria-label="Connect an account" className="mb-6 flex flex-wrap gap-3">
        {PLATFORMS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleConnect(value)}
            disabled={connecting !== null}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connecting === value ? 'Connecting...' : `Connect ${label}`}
          </button>
        ))}
      </section>

      <section aria-label="Connected accounts">
        {loading ? (
          <p className="text-gray-500">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="font-medium text-gray-800">No accounts connected</p>
            <p className="mt-1 text-sm text-gray-500">Connect a platform above to start publishing.</p>
          </div>
        ) : (
          <AccountsTable accounts={accounts} deletingId={deletingId} onDelete={handleDelete} />
        )}
      </section>
    </MainLayout>
  );
}