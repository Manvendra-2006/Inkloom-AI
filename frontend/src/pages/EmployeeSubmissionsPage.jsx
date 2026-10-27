import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

const WORKFLOW_LABELS = {
  DRAFT: 'Draft',
  CHANGES_REQUIRED: 'Changes Required',
  PENDING_REVIEW: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
};

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
  if (Array.isArray(report?.rawResult?.combined_findings)) {
    return report.rawResult.combined_findings;
  }
  return [];
}

function StatusBadge({ status }) {
  const variants = {
    DRAFT: 'secondary',
    CHANGES_REQUIRED: 'danger',
    PENDING_REVIEW: 'warning',
    APPROVED: 'success',
    REJECTED: 'dark',
    PUBLISHED: 'primary',
  };
  return (
    <span className={`badge text-bg-${variants[status] || 'secondary'}`}>
      {WORKFLOW_LABELS[status] || status || 'Unknown'}
    </span>
  );
}

function AiBadge({ status }) {
  if (!status) return <span className="badge text-bg-secondary">Not checked</span>;
  const clean = status === 'clean' || status === 'no_flags';
  return (
    <span className={`badge text-bg-${clean ? 'success' : 'danger'}`}>
      {clean ? 'Clean' : 'Flagged'}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function EmployeeSubmissionsPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/ads/my-submissions')
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

  const summary = useMemo(() => ({
    total: ads.length,
    pending: ads.filter((ad) => ad.status === 'PENDING_REVIEW').length,
    changes: ads.filter((ad) => ad.status === 'CHANGES_REQUIRED').length,
    approved: ads.filter((ad) => ad.status === 'APPROVED').length,
    published: ads.filter((ad) => ad.status === 'PUBLISHED').length,
  }), [ads]);

  const cards = [
    { label: 'Total Submissions', value: summary.total, color: 'primary' },
    { label: 'Pending Review', value: summary.pending, color: 'warning' },
    { label: 'Changes Required', value: summary.changes, color: 'danger' },
    { label: 'Approved', value: summary.approved, color: 'success' },
    { label: 'Published', value: summary.published, color: 'info' },
  ];

  return (
    <MainLayout>
      <div className="container-fluid py-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <div>
            <h1 className="h2 mb-1">My Submissions</h1>
            <p className="text-secondary mb-0">
              Track your advertisements and review their current compliance status.
            </p>
          </div>
          <Link className="btn btn-primary" to="/employee/create-ad">
            Create Advertisement
          </Link>
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="row g-3 mb-4">
          {cards.map((card) => (
            <div className="col-12 col-sm-6 col-xl" key={card.label}>
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <p className="text-secondary mb-2">{card.label}</p>
                  <p className={`h3 text-${card.color} mb-0`}>
                    {loading ? '—' : card.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-5" role="status">Loading your submissions...</div>
        ) : !error && ads.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5">
              <h2 className="h4">No submissions yet</h2>
              <p className="text-secondary">
                Create an advertisement and submit it for AI compliance review.
              </p>
              <Link className="btn btn-primary" to="/employee/create-ad">
                Create Advertisement
              </Link>
            </div>
          </div>
        ) : (
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Advertisement</th>
                      <th scope="col">AI Check</th>
                      <th scope="col">Findings</th>
                      <th scope="col">Status</th>
                      <th scope="col">Submitted</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((ad) => {
                      const findings = getFindings(ad);
                      const findingCount = ad.aiReport?.finding_count ?? findings.length;
                      const severityRank = {
                        CRITICAL: 0,
                        HIGH: 1,
                        MEDIUM: 2,
                        LOW: 3,
                      };
                      const severity = findings
                        .map((finding) => String(finding?.severity || '').toUpperCase())
                        .filter((level) => severityRank[level] !== undefined)
                        .sort((left, right) => severityRank[left] - severityRank[right])[0];
                      const aiStatus = ad.aiStatus || ad.aiReport?.status;
                      const reportUrl = `/employee/ad/${ad._id}#ai-audit-report`;

                      return (
                        <tr key={ad._id}>
                          <td>
                            <Link className="fw-semibold" to={`/employee/ad/${ad._id}`}>
                              {ad.title}
                            </Link>
                            <div className="small text-secondary text-truncate" style={{ maxWidth: 280 }}>
                              {ad.caption || 'No description'}
                            </div>
                            <div className="small text-secondary">
                              {ad.brandGuideline?.name || 'Brand not available'}
                              {ad.brandGuideline?.version
                                ? ` · v${ad.brandGuideline.version}`
                                : ''}
                            </div>
                          </td>
                          <td>
                            <AiBadge status={aiStatus} />
                            {ad.aiComplianceScore !== undefined && ad.aiComplianceScore !== null && (
                              <div className="small text-secondary mt-1">
                                Score: {ad.aiComplianceScore}/100
                              </div>
                            )}
                            {ad.aiCheckedAt && (
                              <div className="small text-secondary mt-1">
                                Checked {formatDate(ad.aiCheckedAt)}
                              </div>
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
                              <Link className="btn btn-sm btn-outline-primary" to={`/employee/ad/${ad._id}`}>
                                View
                              </Link>
                              {ad.aiReport && (
                                <Link className="btn btn-sm btn-outline-secondary" to={reportUrl}>
                                  View AI Report
                                </Link>
                              )}
                              {ad.status === 'CHANGES_REQUIRED' && (
                                <Link className="btn btn-sm btn-danger" to={`/employee/ad/${ad._id}`}>
                                  Fix &amp; Resubmit
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
