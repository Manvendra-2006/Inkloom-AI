import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'clean', label: 'Clean' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'CHANGES_REQUIRED', label: 'Changes Required' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PUBLISHED', label: 'Published' },
];

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
  if (status === 403) return 'Admin access is required to view compliance history.';
  if (status === 404) return 'The history service could not be found.';
  if (status >= 500) return 'The server could not load compliance history. Please try again.';
  return error.response?.data?.message || 'Failed to load compliance history.';
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

function WorkflowBadge({ status }) {
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

function formatAction(action) {
  if (action === 'CHANGES_REQUESTED') return 'Changes Requested';
  if (action === 'APPROVED') return 'Approved';
  if (action === 'REJECTED') return 'Rejected';
  return '—';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function getActivity(item) {
  const activity = [];
  if (item.createdAt) {
    activity.push({ label: 'Advertisement created', at: item.createdAt });
  }
  if (item.checkedAt) {
    activity.push({ label: 'AI compliance checked', at: item.checkedAt });
  }
  (item.reviewEvents || []).forEach((event) => {
    activity.push({
      label: `${formatAction(event.action)} by ${event.reviewedBy?.name || event.reviewedBy?.email || 'Admin'}`,
      at: event.createdAt,
      comment: event.comment,
    });
  });
  if (item.publishedAt) {
    activity.push({ label: 'Published', at: item.publishedAt });
  }
  return activity
    .filter((event) => event.at)
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
}

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/admin/history')
      .then(({ data }) => {
        if (active) setHistory(Array.isArray(data) ? data : []);
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
    totalReviewed: history.filter((item) => item.report || item.reviewedAt).length,
    flagged: history.filter((item) => item.aiStatus === 'flagged').length,
    clean: history.filter((item) => ['clean', 'no_flags'].includes(item.aiStatus)).length,
    approved: history.filter((item) => item.status === 'APPROVED').length,
    changes: history.filter((item) => item.status === 'CHANGES_REQUIRED').length,
    published: history.filter((item) => item.status === 'PUBLISHED').length,
  }), [history]);

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((item) => {
      const filterMatches = filter === 'ALL'
        || (filter === 'clean' && ['clean', 'no_flags'].includes(item.aiStatus))
        || (filter === 'flagged' && item.aiStatus === 'flagged')
        || item.status === filter;
      const searchMatches = !query
        || String(item.title || '').toLocaleLowerCase().includes(query)
        || String(item.creator?.name || '').toLocaleLowerCase().includes(query)
        || String(item.creator?.email || '').toLocaleLowerCase().includes(query);
      return filterMatches && searchMatches;
    });
  }, [filter, history, search]);

  const cards = [
    { label: 'Total Reviewed', value: summary.totalReviewed, color: 'primary' },
    { label: 'AI Flagged', value: summary.flagged, color: 'danger' },
    { label: 'AI Clean', value: summary.clean, color: 'success' },
    { label: 'Approved', value: summary.approved, color: 'success' },
    { label: 'Changes Requested', value: summary.changes, color: 'warning' },
    { label: 'Published', value: summary.published, color: 'info' },
  ];

  return (
    <MainLayout>
      <div className="container-fluid py-3">
        <div className="mb-4">
          <h1 className="h2 mb-1">History</h1>
          <p className="text-secondary mb-0">
            View the compliance and review activity across submitted advertisements.
          </p>
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="row g-3 mb-4">
          {cards.map((card) => (
            <div className="col-12 col-sm-6 col-xl-2" key={card.label}>
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

        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-4">
                <label className="form-label" htmlFor="history-filter">Filter history</label>
                <select
                  id="history-filter"
                  className="form-select"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  {FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-8">
                <label className="form-label" htmlFor="history-search">Search</label>
                <input
                  id="history-search"
                  className="form-control"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search advertisement or creator"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-5" role="status">Loading compliance history...</div>
            ) : !error && history.length === 0 ? (
              <div className="text-center py-5">
                <h2 className="h4">No history yet</h2>
                <p className="text-secondary mb-0">
                  Advertisement checks and review activity will appear here when available.
                </p>
              </div>
            ) : !error && filteredHistory.length === 0 ? (
              <div className="text-center py-5">
                <p className="text-secondary mb-0">No history entries match these filters.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Advertisement</th>
                      <th scope="col">Creator</th>
                      <th scope="col">AI Result</th>
                      <th scope="col">Findings</th>
                      <th scope="col">Admin Action</th>
                      <th scope="col">Reviewed By</th>
                      <th scope="col">Status</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => {
                      const activity = getActivity(item);
                      return (
                      <tr key={item._id}>
                        <td>
                          <span className="fw-semibold">{item.title}</span>
                          <div className="small text-secondary">
                            {item.brand?.name || 'Brand unavailable'}
                            {item.brand?.version ? ` · v${item.brand.version}` : ''}
                          </div>
                          {item.score !== null && item.score !== undefined && (
                            <div className="small text-secondary">Score: {item.score}/100</div>
                          )}
                        </td>
                        <td>{item.creator?.name || item.creator?.email || '—'}</td>
                        <td><AiBadge status={item.aiStatus} /></td>
                        <td>
                          {item.findingCount ?? 0}
                          {item.severity && (
                            <div className="small text-secondary">{item.severity}</div>
                          )}
                        </td>
                        <td>{formatAction(item.adminAction)}</td>
                        <td>{item.reviewedBy?.name || item.reviewedBy?.email || '—'}</td>
                        <td><WorkflowBadge status={item.status} /></td>
                        <td>
                          {formatDate(item.latestActivityAt)}
                          {activity.length > 1 && (
                            <details className="small mt-1">
                              <summary className="text-primary">View activity</summary>
                              <ul className="list-unstyled mt-2 mb-0">
                                {activity.map((event, index) => (
                                  <li className="mb-2" key={`${event.at}-${index}`}>
                                    <span className="fw-semibold">{event.label}</span>
                                    <br />
                                    <span className="text-secondary">{formatDate(event.at)}</span>
                                    {event.comment && <div>{event.comment}</div>}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
