// frontend/src/pages/EmployeeDashboard.js
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
  PageHeader,
  ScoreMeter,
  Skeleton,
  StatusBadge,
  STATUS_META,
  Table,
  TD,
} from '../components/ui';

/* ---------- Config ---------- */

const TREND_DAYS = 7;
const LIST_LIMIT = 5;

const METRICS = [
  { key: 'DRAFT', badge: 'In progress', caption: 'Not submitted yet', line: 'text-slate-400' },
  { key: 'CHANGES_REQUIRED', badge: 'Action needed', caption: 'Fix and run the AI check again', line: 'text-orange-500' },
  { key: 'PENDING_REVIEW', badge: 'In review', caption: 'Waiting for an admin', line: 'text-amber-500' },
  { key: 'APPROVED', badge: 'Cleared', caption: 'Ready to be published', line: 'text-emerald-500' },
  { key: 'PUBLISHED', badge: 'Live', caption: 'Live on connected accounts', line: 'text-indigo-500' },
];

const LIST_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'CHANGES_REQUIRED', label: 'Changes required' },
  { key: 'PENDING_REVIEW', label: 'Pending review' },
];

const LIST_COLUMNS = ['Advertisement', 'Status', 'AI check', 'Compliance score', ''];

const ICON_PATHS = {
  create: 'M12 5v14M5 12h14',
  list: 'M4 6h16M4 12h16M4 18h10',
  fix: 'M5 21V4m0 0h11l-2 4 2 4H5',
  warning: 'M12 8v5m0 3.5v.01M10.3 4.2L2.8 17.5A2 2 0 004.5 20.5h15a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z',
};

const isCleanAd = (ad) => ad.aiStatus === 'clean' || ad.aiStatus === 'no_flags';

/* ---------- Helpers ---------- */

const toArray = (value) => (Array.isArray(value) ? value : []);

function getTrendDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: TREND_DAYS }, (_, i) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (TREND_DAYS - 1 - i));
    return day.getTime();
  });
}

// How many ads now in `status` were created on each of the last days
function buildTrend(ads, status) {
  const days = getTrendDays();
  const counts = days.map(() => 0);
  ads.forEach((ad) => {
    if (ad.status !== status || !ad.createdAt) return;
    const created = new Date(ad.createdAt);
    created.setHours(0, 0, 0, 0);
    const index = days.indexOf(created.getTime());
    if (index >= 0) counts[index] += 1;
  });
  return counts;
}

function getRowAction(ad) {
  if (ad.status === 'CHANGES_REQUIRED') return { label: 'Fix and resubmit', variant: 'primary' };
  if (ad.status === 'DRAFT') return { label: 'Continue', variant: 'secondary' };
  return { label: 'View', variant: 'secondary' };
}

/* ---------- Small components ---------- */

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// Card with a small label above the title, like the admin dashboard panels
function Panel({ eyebrow, title, description, actions, padded = true, className, children }) {
  return (
    <section className={cx('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p>
          )}
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className={padded ? 'p-5' : 'pt-5'}>{children}</div>
    </section>
  );
}

function Sparkline({ points, className }) {
  const width = 96;
  const height = 32;
  const max = Math.max(...points, 1);
  const step = width / (points.length - 1);
  const coords = points
    .map((value, i) => `${(i * step).toFixed(1)},${(height - 3 - (value / max) * (height - 6)).toFixed(1)}`)
    .join(' ');

  return (
    <svg className={cx('h-8 w-24 shrink-0', className)} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      <polyline points={coords} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricCard({ label, badge, tone, value, caption, trend, line, loading }) {
  const newThisWeek = trend.reduce((sum, n) => sum + n, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <Badge tone={tone}>{badge}</Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {loading ? (
          <Skeleton className="h-9 w-12" />
        ) : (
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
        )}
        <Sparkline points={trend} className={line} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{caption}</p>
      <p className="text-xs text-slate-400">{newThisWeek} new in {TREND_DAYS} days</p>
    </div>
  );
}

function Banner({ count, onDismiss }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 p-5 text-white shadow-sm">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Icon name="warning" className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold">
            {count} {count === 1 ? 'ad needs' : 'ads need'} changes
          </p>
          <p className="mt-0.5 text-sm text-orange-50">
            Open the ad, fix the flagged wording and run the AI check again.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/employee/submissions"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-600"
        >
          Fix now
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-lg p-2 text-orange-50 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ActionTile({ to, icon, iconClass, title, pill, pillTone, description, cta }) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cx('flex h-9 w-9 items-center justify-center rounded-lg', iconClass)}>
          <Icon name={icon} />
        </span>
        <Badge tone={pillTone}>{pill}</Badge>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 flex-1 text-sm text-slate-500">{description}</p>
      <span className="mt-4 text-sm font-medium text-indigo-600 group-hover:text-indigo-700">{cta}</span>
    </Link>
  );
}

function Thumbnail({ ad }) {
  const [failed, setFailed] = useState(false);

  if (ad.imageUrl && !failed) {
    return (
      <img src={ad.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" onError={() => setFailed(true)} />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-400">
      {(ad.title || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function ListTabs({ tabs, active, counts, onChange }) {
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
          {label} <span className="text-slate-400">{counts[key]}</span>
        </button>
      ))}
    </div>
  );
}

function SnapshotRow({ dot, label, value }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-slate-600">
        <span className={cx('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
        {label}
      </span>
      <span className="font-medium tabular-nums text-slate-900">{value}</span>
    </li>
  );
}

// Average score and clean / flagged split across the employee's ads
function ComplianceSnapshot({ ads, loading }) {
  const scored = ads.filter((ad) => typeof ad.aiComplianceScore === 'number');
  const average = scored.length
    ? Math.round(scored.reduce((sum, ad) => sum + ad.aiComplianceScore, 0) / scored.length)
    : null;
  const barColor = average >= 80 ? 'bg-emerald-500' : average >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <Panel eyebrow="Compliance" title="Snapshot" description="Across your checked advertisements.">
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          {average === null ? (
            <p className="text-sm text-slate-500">Run an AI check to see your average score.</p>
          ) : (
            <div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                {average}
                <span className="text-base font-normal text-slate-400">/100 average</span>
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                <div className={cx('h-full rounded-full', barColor)} style={{ width: `${Math.min(average, 100)}%` }} />
              </div>
            </div>
          )}
          <ul className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <SnapshotRow dot="bg-emerald-500" label="Clean" value={ads.filter(isCleanAd).length} />
            <SnapshotRow dot="bg-rose-500" label="Flagged" value={ads.filter((ad) => ad.aiStatus === 'flagged').length} />
            <SnapshotRow dot="bg-slate-300" label="Not checked" value={ads.filter((ad) => !ad.aiStatus).length} />
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ---------- Page ---------- */

export default function EmployeeDashboard() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [listTab, setListTab] = useState('ALL');

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await api.get('/ads');
        setAds(toArray(res.data));
      } catch (err) {
        console.error(err);
        setError('Could not load your advertisements. Refresh the page or try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchAds();
  }, []);

  const statusCounts = useMemo(
    () =>
      ads.reduce((acc, ad) => {
        acc[ad.status] = (acc[ad.status] || 0) + 1;
        return acc;
      }, {}),
    [ads]
  );

  const trends = useMemo(
    () => Object.fromEntries(METRICS.map(({ key }) => [key, buildTrend(ads, key)])),
    [ads]
  );

  const recent = useMemo(
    () => [...ads].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [ads]
  );

  const tabCounts = {
    ALL: ads.length,
    DRAFT: statusCounts.DRAFT || 0,
    CHANGES_REQUIRED: statusCounts.CHANGES_REQUIRED || 0,
    PENDING_REVIEW: statusCounts.PENDING_REVIEW || 0,
  };
  const visibleAds = recent.filter((ad) => listTab === 'ALL' || ad.status === listTab);
  const shownAds = visibleAds.slice(0, LIST_LIMIT);

  const needsChanges = statusCounts.CHANGES_REQUIRED || 0;
  const createButton = (
    <Link to="/employee/create-ad" className={buttonClass()}>Create advertisement</Link>
  );

  const renderList = () => {
    if (loading) return <p className="p-5 text-sm text-slate-500">Loading...</p>;
    if (ads.length === 0 && !error) {
      return (
        <EmptyState
          title="No advertisements yet"
          description="Create your first advertisement to run the brand check."
          action={createButton}
        />
      );
    }
    if (shownAds.length === 0) {
      return <EmptyState title="Nothing in this view" description="Try another tab to see your other ads." />;
    }
    return (
      <>
        <Table columns={LIST_COLUMNS}>
          {shownAds.map((ad) => {
            const action = getRowAction(ad);
            return (
              <tr key={ad._id} className="hover:bg-slate-50">
                <td className={TD}>
                  <div className="flex items-center gap-3">
                    <Thumbnail ad={ad} />
                    <div className="min-w-0">
                      <Link
                        to={`/employee/ad/${ad._id}`}
                        className="block max-w-[14rem] truncate font-medium text-slate-900 hover:text-indigo-600 focus:outline-none focus-visible:underline"
                      >
                        {ad.title}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{ad.brandGuideline?.name || 'No brand profile'}</p>
                    </div>
                  </div>
                </td>
                <td className={TD}><StatusBadge status={ad.status} /></td>
                <td className={TD}><AiBadge status={ad.aiStatus} /></td>
                <td className={TD}><ScoreMeter score={ad.aiComplianceScore} /></td>
                <td className={cx(TD, 'text-right')}>
                  <Link
                    to={`/employee/ad/${ad._id}`}
                    className={buttonClass({ size: 'sm', variant: action.variant })}
                  >
                    {action.label}
                  </Link>
                </td>
              </tr>
            );
          })}
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
          <span>Showing {shownAds.length} of {visibleAds.length} ads</span>
          <Link to="/employee/submissions" className="font-medium text-indigo-600 hover:text-indigo-700">
            View all submissions
          </Link>
        </div>
      </>
    );
  };

  return (
    <MainLayout>
      <PageHeader
        title="Dashboard"
        description={loading ? 'Loading ads…' : `Your advertisements and their review progress · ${ads.length} total`}
        actions={createButton}
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {!loading && needsChanges > 0 && !bannerDismissed && (
          <Banner count={needsChanges} onDismiss={() => setBannerDismissed(true)} />
        )}

        {/* Metrics */}
        <section aria-label="Ad status summary" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {METRICS.map(({ key, badge, caption, line }) => (
            <MetricCard
              key={key}
              label={STATUS_META[key].label}
              tone={STATUS_META[key].tone}
              badge={badge}
              caption={caption}
              line={line}
              value={statusCounts[key] || 0}
              trend={trends[key]}
              loading={loading}
            />
          ))}
        </section>

        {/* Workflow + snapshot */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel
            eyebrow="Your workflow"
            title="Create and track"
            description="Start a new ad, follow its review, and fix anything that is flagged."
            className="lg:col-span-2"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <ActionTile
                to="/employee/create-ad"
                icon="create"
                iconClass="bg-indigo-50 text-indigo-600"
                title="Create advertisement"
                pill="New"
                pillTone="indigo"
                description="Write a draft and pick a brand profile."
                cta="Start a draft"
              />
              <ActionTile
                to="/employee/submissions"
                icon="list"
                iconClass="bg-slate-100 text-slate-600"
                title="My submissions"
                pill={`${ads.length} total`}
                pillTone="neutral"
                description="Status, AI results and review progress."
                cta="Open submissions"
              />
              <ActionTile
                to="/employee/submissions"
                icon="fix"
                iconClass="bg-orange-50 text-orange-600"
                title="Fix flagged ads"
                pill={`${needsChanges} to fix`}
                pillTone={needsChanges > 0 ? 'orange' : 'success'}
                description="Update wording and run the AI check again."
                cta="Review feedback"
              />
            </div>
          </Panel>

          <ComplianceSnapshot ads={ads} loading={loading} />
        </div>

        {/* Recent ads */}
        <Panel
          eyebrow="Recent activity"
          title="My advertisements"
          padded={false}
          actions={<ListTabs tabs={LIST_TABS} active={listTab} counts={tabCounts} onChange={setListTab} />}
        >
          {renderList()}
        </Panel>
      </div>
    </MainLayout>
  );
}