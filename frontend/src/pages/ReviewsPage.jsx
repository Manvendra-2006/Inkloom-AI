// frontend/src/pages/ReviewsPage.js
import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import AuditReport from '../components/AuditReport';

/* ---------- Constants ---------- */

const REVIEWABLE_STATUSES = ['PENDING_REVIEW', 'CHANGES_REQUIRED'];

const REVIEW_ACTIONS = [
  {
    action: 'APPROVED',
    label: 'Approve',
    promptText: 'Reason for approval (optional)',
    style: 'bg-emerald-600 hover:bg-emerald-700',
  },
  {
    action: 'REJECTED',
    label: 'Reject',
    promptText: 'Reason for rejection',
    style: 'bg-rose-600 hover:bg-rose-700',
  },
  {
    action: 'CHANGES_REQUESTED',
    label: 'Request changes',
    promptText: 'Request changes comment',
    style: 'bg-amber-600 hover:bg-amber-700',
  },
];

const TABLE_HEADERS = [
  'Title',
  'Creator',
  'Brand',
  'Workflow status',
  'AI status',
  'Findings',
  'Severity',
  'Human review',
  'Actions',
];

const STATUS_BADGES = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  CHANGES_REQUIRED: 'bg-orange-100 text-orange-800',
};

/* ---------- Helpers ---------- */

const formatEnum = (value) =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—';

function highestSeverity(findings) {
  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const severities = findings.map((finding) => String(finding.severity || '').toUpperCase());
  return order.find((severity) => severities.includes(severity)) || '—';
}

/* ---------- Components ---------- */

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_BADGES[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {formatEnum(status)}
    </span>
  );
}

function ReviewButtons({ disabled, onReview }) {
  return (
    <div className="flex flex-wrap gap-2">
      {REVIEW_ACTIONS.map(({ action, label, promptText, style }) => (
        <button
          key={action}
          type="button"
          disabled={disabled}
          onClick={() => onReview(action, promptText)}
          className={`rounded px-3 py-1 text-sm font-medium text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${style}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ReviewRows({ ad, busy, onReview }) {
  const rawResult = ad.aiReport?.rawResult;
  const findings = ad.aiReport?.issues || rawResult?.combined_findings || [];

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 font-medium text-gray-900">{ad.title}</td>
        <td className="px-4 py-3">{ad.createdBy?.name || ad.createdBy?.email || '—'}</td>
        <td className="px-4 py-3">{ad.brandGuideline?.name || '—'}</td>
        <td className="px-4 py-3"><StatusBadge status={ad.status} /></td>
        <td className="px-4 py-3">{ad.aiStatus ? formatEnum(ad.aiStatus) : '—'}</td>
        <td className="px-4 py-3">{rawResult?.finding_count ?? findings.length}</td>
        <td className="px-4 py-3">{highestSeverity(findings)}</td>
        <td className="px-4 py-3">{rawResult?.human_review_required ? 'Required' : '—'}</td>
        <td className="px-4 py-3">
          <ReviewButtons disabled={busy} onReview={(action, promptText) => onReview(ad._id, action, promptText)} />
        </td>
      </tr>
      <tr>
        <td className="p-4" colSpan={TABLE_HEADERS.length}>
          {ad.aiReport ? (
            <AuditReport report={ad.aiReport} aiStatus={ad.aiStatus} advertisementTitle={ad.title} />
          ) : (
            <p className="text-gray-600">AI audit has not been run for this advertisement.</p>
          )}
        </td>
      </tr>
    </>
  );
}

/* ---------- Page ---------- */

export default function ReviewsPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // page could not load
  const [actionError, setActionError] = useState(null); // a review failed
  const [reviewingId, setReviewingId] = useState(null);

  const fetchAds = useCallback(async () => {
    try {
      const res = await api.get('/ads'); // admin can get all
      setAds(res.data.filter((ad) => REVIEWABLE_STATUSES.includes(ad.status)));
    } catch (err) {
      setLoadError('Failed to load ads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleReview = async (adId, action, promptText) => {
    const comment = window.prompt(promptText);
    if (comment === null) return; // admin pressed Cancel, so do nothing

    setActionError(null);
    setReviewingId(adId);
    try {
      await api.post(`/admin/reviews/${adId}`, { action, comment });
      await fetchAds();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not save the review. Please try again.');
    } finally {
      setReviewingId(null);
    }
  };

  if (loading) return <MainLayout><p>Loading...</p></MainLayout>;
  if (loadError) {
    return (
      <MainLayout>
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review submissions</h1>
        <p className="text-sm text-gray-500">{ads.length} awaiting review</p>
      </header>

      {actionError && (
        <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {ads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="font-medium text-gray-800">No ads awaiting review</p>
          <p className="mt-1 text-sm text-gray-500">New submissions will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {TABLE_HEADERS.map((header) => (
                  <th key={header} scope="col" className="px-4 py-3 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ads.map((ad) => (
                <ReviewRows
                  key={ad._id}
                  ad={ad}
                  busy={reviewingId === ad._id}
                  onReview={handleReview}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MainLayout>
  );
}