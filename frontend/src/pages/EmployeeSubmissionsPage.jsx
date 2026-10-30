// frontend/src/pages/EmployeeSubmissionsPage.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import {
  AiBadge,
  Alert,
  Badge,
  buttonClass,
  cx,
  EmptyState,
  inputClass,
  PageHeader,
  ScoreMeter,
  Skeleton,
  StatusBadge,
  Table,
  TD,
} from '../components/ui';

/* ---------- Constants ---------- */

const SUMMARY_TILES = [
  { label: 'Total submissions', status: null, icon: 'list', iconClass: 'bg-indigo-50 text-indigo-600', caption: 'All your advertisements' },
  { label: 'Pending review', status: 'PENDING_REVIEW', icon: 'clock', iconClass: 'bg-amber-50 text-amber-600', caption: 'Waiting for an admin' },
  { label: 'Changes required', status: 'CHANGES_REQUIRED', icon: 'flag', iconClass: 'bg-orange-50 text-orange-600', caption: 'Fix and resubmit' },
  { label: 'Approved', status: 'APPROVED', icon: 'check', iconClass: 'bg-emerald-50 text-emerald-600', caption: 'Ready to publish' },
  { label: 'Published', status: 'PUBLISHED', icon: 'publish', iconClass: 'bg-violet-50 text-violet-600', caption: 'Live on accounts' },
];

const FILTER_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_REVIEW', label: 'Pending review' },
  { key: 'CHANGES_REQUIRED', label: 'Changes required' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PUBLISHED', label: 'Published' },
];

const TABLE_COLUMNS = ['Advertisement', 'AI check', 'Findings', 'Status', 'Submitted', 'Actions'];

const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_TONES = { CRITICAL: 'danger', HIGH: 'danger', MEDIUM: 'warning', LOW: 'neutral' };

const ICON_PATHS = {
  list: 'M4 6h16M4 12h16M4 18h10',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  check: 'M5 13l4 4L19 7',
  publish: 'M12 16V4m0 0l-4 4m4-4l4 4M4 20h16',
};

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

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

function matchesSearch(ad, query) {
  if (!query) return true;
  return [ad.title, ad.caption, ad.brandGuideline?.name].some((field) =>
    String(field || '').toLocaleLowerCase().includes(query)
  );
}

/* ---------- Small components ---------- */

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function SummaryTile({ icon, iconClass, label, value, caption, loading }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconClass)}>
          <Icon name={icon} />
        </span>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-9 w-12" />
        ) : (
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

function Thumbnail({ ad }) {
  const [failed, setFailed] = useState(false);

  if (ad.imageUrl && !failed) {
    return (
      <img src={ad.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" onError={() => setFailed(true)} />
    );
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-400">
      {(ad.title || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function FilterTabs({ tabs, active, counts, onChange }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-0.5">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={active === key}
          onClick={() => onChange(key)}
          className={cx(
            'rounded-md px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            active === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {label} <span className="text-slate-400">{counts[key] || 0}</span>
        </button>
      ))}
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
    <tr className="align-top hover:bg-slate-50">
      <td className={TD}>
        <div className="flex items-start gap-3">
          <Thumbnail ad={ad} />
          <div className="min-w-0">
            <Link
              to={detailUrl}
              className="block max-w-[16rem] truncate font-medium text-slate-900 hover:text-indigo-600 focus:outline-none focus-visible:underline"
            >
              {ad.title}
            </Link>
            <p className="max-w-[16rem] truncate text-xs text-slate-500">{ad.caption || 'No description'}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {ad.brandGuideline?.name || 'Brand not available'}
              {ad.brandGuideline?.version ? ` · v${ad.brandGuideline.version}` : ''}
            </p>
          </div>
        </div>
      </td>

      <td className={TD}>
        <div className="space-y-1.5">
          <AiBadge status={aiStatus} />
          {ad.aiComplianceScore !== undefined && ad.aiComplianceScore !== null && (
            <ScoreMeter score={ad.aiComplianceScore} />
          )}
          {ad.aiCheckedAt && (
            <p className="text-xs text-slate-400">Checked {formatDate(ad.aiCheckedAt, true)}</p>
          )}
        </div>
      </td>

      <td className={TD}>
        <div className="space-y-1.5">
          <span className="font-medium tabular-nums text-slate-900">{findingCount}</span>
          {severity && (
            <div><Badge tone={SEVERITY_TONES[severity]}>{severity}</Badge></div>
          )}
        </div>
      </td>

      <td className={TD}><StatusBadge status={ad.status} /></td>
      <td className={cx(TD, 'whitespace-nowrap')}>{formatDate(ad.createdAt)}</td>

      <td className={TD}>
        <div className="flex flex-wrap gap-2">
          <Link to={detailUrl} className={buttonClass({ size: 'sm', variant: 'secondary' })}>View</Link>
          {ad.aiReport && (
            <Link to={`${detailUrl}#ai-audit-report`} className={buttonClass({ size: 'sm', variant: 'ghost' })}>
              AI report
            </Link>
          )}
          {ad.status === 'CHANGES_REQUIRED' && (
            <Link to={detailUrl} className={buttonClass({ size: 'sm' })}>Fix and resubmit</Link>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ---------- Page ---------- */

export default function EmployeeSubmissionsPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

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
      ads.reduce(
        (acc, ad) => {
          acc[ad.status] = (acc[ad.status] || 0) + 1;
          return acc;
        },
        { ALL: ads.length }
      ),
    [ads]
  );

  const visibleAds = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return ads.filter((ad) => (filter === 'ALL' || ad.status === filter) && matchesSearch(ad, query));
  }, [ads, filter, search]);

  const createButton = (
    <Link to="/employee/create-ad" className={buttonClass()}>Create advertisement</Link>
  );

  const renderResults = () => {
    if (loading) return <p className="p-5 text-sm text-slate-500">Loading your submissions...</p>;
    if (!error && ads.length === 0) {
      return (
        <EmptyState
          title="No submissions yet"
          description="Create an advertisement and submit it for AI compliance review."
          action={createButton}
        />
      );
    }
    if (!error && visibleAds.length === 0) {
      return <EmptyState title="No submissions match" description="Try another status or clear the search." />;
    }
    return (
      <>
        <Table columns={TABLE_COLUMNS}>
          {visibleAds.map((ad) => <SubmissionRow key={ad._id} ad={ad} />)}
        </Table>
        <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
          Showing {visibleAds.length} of {ads.length} submissions
        </div>
      </>
    );
  };

  return (
    <MainLayout>
      <PageHeader
        title="My submissions"
        description="Track your advertisements and review their current compliance status."
        actions={createButton}
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        <section aria-label="Submission summary" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {SUMMARY_TILES.map(({ label, status, icon, iconClass, caption }) => (
            <SummaryTile
              key={label}
              icon={icon}
              iconClass={iconClass}
              label={label}
              caption={caption}
              loading={loading}
              value={status ? statusCounts[status] || 0 : ads.length}
            />
          ))}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-5 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Submissions</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">All advertisements</h2>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 pb-4">
            <FilterTabs tabs={FILTER_TABS} active={filter} counts={statusCounts} onChange={setFilter} />
            <div className="w-full sm:w-64">
              <label htmlFor="submission-search" className="sr-only">Search submissions</label>
              <input
                id="submission-search"
                type="search"
                className={inputClass}
                placeholder="Search title, caption or brand"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {renderResults()}
        </section>
      </div>
    </MainLayout>
  );
}