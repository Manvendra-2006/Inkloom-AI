// frontend/src/pages/HistoryPage.js
import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import {
  AiBadge,
  Alert,
  Badge,
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

const FILTER_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'clean', label: 'Clean' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'PENDING_REVIEW', label: 'Pending review' },
  { key: 'CHANGES_REQUIRED', label: 'Changes required' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'PUBLISHED', label: 'Published' },
];

const ACTION_META = {
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CHANGES_REQUESTED: { label: 'Changes requested', tone: 'orange' },
};

const SEVERITY_TONES = { CRITICAL: 'danger', HIGH: 'danger', MEDIUM: 'warning', LOW: 'neutral' };

const CLEAN_AI_STATUSES = ['clean', 'no_flags'];

const TABLE_COLUMNS = ['Advertisement', 'Creator', 'AI result', 'Admin action', 'Status', 'Last activity'];

const ICON_PATHS = {
  list: 'M4 6h16M4 12h16M4 18h10',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  check: 'M5 13l4 4L19 7',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z',
  publish: 'M12 16V4m0 0l-4 4m4-4l4 4M4 20h16',
};

/* ---------- Helpers ---------- */

function getErrorMessage(error) {
  const status = error.response?.status;
  if (status === 401) return 'Your session is invalid or expired. Please sign in again.';
  if (status === 403) return 'Admin access is required to view compliance history.';
  if (status === 404) return 'The history service could not be found.';
  if (status >= 500) return 'The server could not load compliance history. Please try again.';
  return error.response?.data?.message || 'Failed to load compliance history.';
}

const isClean = (item) => CLEAN_AI_STATUSES.includes(item.aiStatus);
const isFlagged = (item) => item.aiStatus === 'flagged';
const hasValue = (value) => value !== undefined && value !== null;
const personName = (person) => person?.name || person?.email || '';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function matchesFilter(item, filter) {
  if (filter === 'ALL') return true;
  if (filter === 'clean') return isClean(item);
  if (filter === 'flagged') return isFlagged(item);
  return item.status === filter;
}

function matchesSearch(item, query) {
  if (!query) return true;
  return [item.title, item.creator?.name, item.creator?.email].some((field) =>
    String(field || '').toLocaleLowerCase().includes(query)
  );
}

// Builds a sorted timeline of everything that happened to an ad
function getActivity(item) {
  const activity = [];

  if (item.createdAt) activity.push({ label: 'Advertisement created', at: item.createdAt });
  if (item.checkedAt) activity.push({ label: 'AI compliance checked', at: item.checkedAt });

  (item.reviewEvents || []).forEach((event) => {
    const action = ACTION_META[event.action]?.label || '—';
    activity.push({
      label: `${action} by ${personName(event.reviewedBy) || 'Admin'}`,
      at: event.createdAt,
      comment: event.comment,
    });
  });

  if (item.publishedAt) activity.push({ label: 'Published', at: item.publishedAt });

  return activity
    .filter((event) => event.at)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
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

function ActivityTimeline({ activity }) {
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none text-xs font-medium text-indigo-600 hover:text-indigo-700 focus:outline-none focus-visible:underline">
        <span className="group-open:hidden">View activity ({activity.length})</span>
        <span className="hidden group-open:inline">Hide activity</span>
      </summary>
      <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4">
        {activity.map((event, index) => (
          <li key={`${event.at}-${index}`} className="relative">
            <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-white" aria-hidden="true" />
            <p className="text-xs font-medium text-slate-800">{event.label}</p>
            <p className="text-xs text-slate-400">{formatDate(event.at)}</p>
            {event.comment && (
              <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">{event.comment}</p>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function HistoryRow({ item }) {
  const activity = getActivity(item);
  const action = ACTION_META[item.adminAction];
  const creator = personName(item.creator);
  const reviewer = personName(item.reviewedBy);
  const severity = item.severity ? String(item.severity).toUpperCase() : null;

  return (
    <tr className="align-top hover:bg-slate-50">
      <td className={TD}>
        <p className="max-w-[16rem] truncate font-medium text-slate-900">{item.title}</p>
        <p className="text-xs text-slate-500">
          {item.brand?.name || 'Brand unavailable'}
          {item.brand?.version ? ` · v${item.brand.version}` : ''}
        </p>
        {hasValue(item.score) && <div className="mt-1.5"><ScoreMeter score={item.score} /></div>}
      </td>

      <td className={TD}>
        {creator ? (
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
              {creator.charAt(0).toUpperCase()}
            </span>
            <span className="max-w-[10rem] truncate">{creator}</span>
          </div>
        ) : (
          '—'
        )}
      </td>

      <td className={TD}>
        <div className="space-y-1.5">
          <AiBadge status={item.aiStatus} />
          <p className="text-xs text-slate-500">
            {item.findingCount ?? 0} {(item.findingCount ?? 0) === 1 ? 'finding' : 'findings'}
          </p>
          {severity && <Badge tone={SEVERITY_TONES[severity] || 'neutral'}>{severity}</Badge>}
        </div>
      </td>

      <td className={TD}>
        {action ? <Badge tone={action.tone}>{action.label}</Badge> : '—'}
        {reviewer && <p className="mt-1.5 text-xs text-slate-500">by {reviewer}</p>}
      </td>

      <td className={TD}><StatusBadge status={item.status} /></td>

      <td className={TD}>
        <p className="whitespace-nowrap">{formatDate(item.latestActivityAt)}</p>
        {activity.length > 1 && <ActivityTimeline activity={activity} />}
      </td>
    </tr>
  );
}

/* ---------- Page ---------- */

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    api
      .get('/admin/history')
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

  const tabCounts = useMemo(() => {
    const counts = { ALL: history.length, clean: 0, flagged: 0 };
    history.forEach((item) => {
      if (isClean(item)) counts.clean += 1;
      if (isFlagged(item)) counts.flagged += 1;
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    return counts;
  }, [history]);

  const totalReviewed = useMemo(
    () => history.filter((item) => item.report || item.reviewedAt).length,
    [history]
  );

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((item) => matchesFilter(item, filter) && matchesSearch(item, query));
  }, [filter, history, search]);

  const renderResults = () => {
    if (loading) return <p className="p-5 text-sm text-slate-500">Loading compliance history...</p>;
    if (!error && history.length === 0) {
      return (
        <EmptyState
          title="No history yet"
          description="Advertisement checks and review activity will appear here when available."
        />
      );
    }
    if (!error && filteredHistory.length === 0) {
      return <EmptyState title="No history entries match" description="Try another filter or clear the search." />;
    }
    return (
      <>
        <Table columns={TABLE_COLUMNS}>
          {filteredHistory.map((item) => <HistoryRow key={item._id} item={item} />)}
        </Table>
        <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
          Showing {filteredHistory.length} of {history.length} entries
        </div>
      </>
    );
  };

  return (
    <MainLayout>
      <PageHeader
        title="History"
        description="View the compliance and review activity across submitted advertisements."
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        <section aria-label="History summary" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <SummaryTile icon="list" iconClass="bg-indigo-50 text-indigo-600" label="Total reviewed" value={totalReviewed} caption="Checked or reviewed" loading={loading} />
          <SummaryTile icon="flag" iconClass="bg-rose-50 text-rose-600" label="AI flagged" value={tabCounts.flagged} caption="Potential issues found" loading={loading} />
          <SummaryTile icon="shield" iconClass="bg-emerald-50 text-emerald-600" label="AI clean" value={tabCounts.clean} caption="No findings" loading={loading} />
          <SummaryTile icon="check" iconClass="bg-teal-50 text-teal-600" label="Approved" value={tabCounts.APPROVED || 0} caption="Cleared by an admin" loading={loading} />
          <SummaryTile icon="edit" iconClass="bg-orange-50 text-orange-600" label="Changes requested" value={tabCounts.CHANGES_REQUIRED || 0} caption="Sent back to creators" loading={loading} />
          <SummaryTile icon="publish" iconClass="bg-violet-50 text-violet-600" label="Published" value={tabCounts.PUBLISHED || 0} caption="Live on accounts" loading={loading} />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-5 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Audit trail</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Compliance history</h2>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 pb-4">
            <FilterTabs tabs={FILTER_TABS} active={filter} counts={tabCounts} onChange={setFilter} />
            <div className="w-full sm:w-64">
              <label htmlFor="history-search" className="sr-only">Search history</label>
              <input
                id="history-search"
                type="search"
                className={inputClass}
                placeholder="Search advertisement or creator"
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