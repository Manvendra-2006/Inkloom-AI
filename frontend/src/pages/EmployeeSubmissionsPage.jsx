// frontend/src/pages/EmployeeSubmissionsPage.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

/* ---------- Constants ---------- */

const WORKFLOW_LABELS = {
  DRAFT: 'Draft',
  CHANGES_REQUIRED: 'Changes required',
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
};

const WORKFLOW_VARIANTS = {
  DRAFT: 'secondary',
  CHANGES_REQUIRED: 'danger',
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'dark',
  PUBLISHED: 'primary',
};

// `status` is null for the "total" card
const SUMMARY_CARDS = [
  { label: 'Total submissions', status: null, color: 'primary' },
  { label: 'Pending review', status: 'PENDING_REVIEW', color: 'warning' },
  { label: 'Changes required', status: 'CHANGES_REQUIRED', color: 'danger' },
  { label: 'Approved', status: 'APPROVED', color: 'success' },
  { label: 'Published', status: 'PUBLISHED', color: 'info' },
];

const CLEAN_AI_STATUSES = ['clean', 'no_flags'];

const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/* ---------- Helpers ---------- */

function getErrorMessage(error) {
  const status = error.response?.status;
  if (status === 401) return 'Your session is invalid or expired. Please sign in again.';
  if (status === 403) return 'You are not authorized to view these submissions.';
  if (status === 404) return 'The submissions service could not be found.';
  if (status >= 500) return 'The server could not load your submissions. Please try again.';
  return error.response?.data?.message || 'Failed to load your submissions.';
}

function getFindings(ad) {
  const report = ad.aiReport;
  if (Array.isArray(report?.issues)) return report.issues;
  if (Array.isArray(report?.rawResult?.combined_findings)) return report.rawResult.combined_findings;
  return [];
}

// Returns the most severe level found (e.g. "HIGH"), or undefined
function getTopSeverity(findings) {
  return findings
    .map((finding) => String(finding?.severity || '').toUpperCase())
    .filter((level) => SEVERITY_RANK[level] !== undefined)
    .sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b])[0];
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

const hasValue = (value) => value !== undefined && value !== null;

/* ---------- Components ---------- */

function StatusBadge({ status }) {
  return (
    <span className={`badge text-bg-${WORKFLOW_VARIANTS[status] || 'secondary'}`}>
      {WORKFLOW_LABELS[status] || status || 'Unknown'}
    </span>
  );
}

function AiBadge({ status }) {
  if (!status) return <span className="badge text-bg-secondary">Not checked</span>;
  const clean = CLEAN_AI_STATUSES.includes(status);
  return (
    <span className={`badge text-bg-${clean ? 'success' : 'danger'}`}>
      {clean ? 'Clean' : 'Flagged'}
    </span>
  );
}

function SummaryCard({ label, value, color, loading }) {
  return (
    <div className="col-12 col-sm-6 col-xl">
      <div className="card h-100 shadow-sm">
        <div className="card-body">
          <p className="text-secondary mb-2">{label}</p>
          <p className={`h3 text-${color} mb-0`}>{loading ? '—' : value}</p>
        </div>
      </div>
    </div>
  );
}

function SubmissionRow({ ad }) {
  const findings = getFindings(ad);
  const findingCount = ad.aiReport?.finding_count ?? findings.length;
  const severity = getTopSeverity(findings);
  const aiStatus = ad.aiStatus || ad.aiReport?.status;
  const detailUrl = `/employee/ad/${ad._id}`;

  return (
    <tr>
      <td>
        <Link className="fw-semibold" to={detailUrl}>{ad.title}</Link>
        <div className="small text-secondary text-truncate" style={{ maxWidth: 280 }}>
          {ad.caption || 'No description'}
        </div>
        <div className="small text-secondary">
          {ad.brandGuideline?.name || 'Brand not available'}
          {ad.brandGuideline?.version ? ` · v${ad.brandGuideline.version}` : ''}
        </div>
      </td>

      <td>
        <AiBadge status={aiStatus} />
        {hasValue(ad.aiComplianceScore) && (
          <div className="small text-secondary mt-1">Score: {ad.aiComplianceScore}/100</div>
        )}
        {ad.aiCheckedAt && (
          <div className="small text-secondary mt-1">Checked {formatDate(ad.aiCheckedAt)}</div>
        )}
      </td>

      <td>
        {findingCount}
        {severity && <div className="small text-secondary">{severity}</div>}
      </td>

      <td><StatusBadge status={ad.status} /></td>
      <td>{formatDate(ad.createdAt)}</td>

      <td>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-sm btn-outline-primary" to={detailUrl}>View</Link>
          {ad.aiReport && (
            <Link className="btn btn-sm btn-outline-secondary" to={`${detailUrl}#ai-audit-report`}>
              View AI report
            </Link>
          )}
          {ad.status === 'CHANGES_REQUIRED' && (
            <Link className="btn btn-sm btn-danger" to={detailUrl}>Fix &amp; resubmit</Link>
          )}
        </div>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="card shadow-sm">
      <div className="card-body text-center py-5">
        <h2 className="h4">No submissions yet</h2>
        <p className="text-secondary">Create an advertisement and submit it for AI compliance review.</p>
        <Link className="btn btn-primary" to="/employee/create-ad">Create advertisement</Link>
      </div>
    </div>
  );
}

function SubmissionsTable({ ads }) {
  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Advertisement</th>
                <th scope="col">AI check</th>
                <th scope="col">Findings</th>
                <th scope="col">Status</th>
                <th scope="col">Submitted</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => <SubmissionRow key={ad._id} ad={ad} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function EmployeeSubmissionsPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api
      .get('/ads/my-submissions')
      .then(({ data }) => {
        if (active) setAds(Array.isArray(data) ? data : []);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const statusCounts = useMemo(
    () =>
      ads.reduce((acc, ad) => {
        acc[ad.status] = (acc[ad.status] || 0) + 1;
        return acc;
      }, {}),
    [ads]
  );

  return (
    <MainLayout>
      <div className="container-fluid py-3">
        <header className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <div>
            <h1 className="h2 mb-1">My submissions</h1>
            <p className="text-secondary mb-0">
              Track your advertisements and review their current compliance status.
            </p>
          </div>
          <Link className="btn btn-primary" to="/employee/create-ad">Create advertisement</Link>
        </header>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <section aria-label="Submission summary" className="row g-3 mb-4">
          {SUMMARY_CARDS.map(({ label, status, color }) => (
            <SummaryCard
              key={label}
              label={label}
              color={color}
              loading={loading}
              value={status ? statusCounts[status] || 0 : ads.length}
            />
          ))}
        </section>

        {loading ? (
          <div className="text-center py-5" role="status">Loading your submissions...</div>
        ) : !error && ads.length === 0 ? (
          <EmptyState />
        ) : (
          <SubmissionsTable ads={ads} />
        )}
      </div>
    </MainLayout>
  );
}