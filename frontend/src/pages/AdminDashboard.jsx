// frontend/src/pages/AdminDashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import {
  AiBadge,
  Alert,
  Badge,
  buttonClass,
  Card,
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
const QUEUE_LIMIT = 5;

const METRICS = [
  { key: 'PENDING_REVIEW', badge: 'Queue', caption: 'Awaiting reviewer action', line: 'text-amber-500' },
  { key: 'CHANGES_REQUIRED', badge: 'Revisions', caption: 'Needs creator revision', line: 'text-orange-500' },
  { key: 'APPROVED', badge: 'Cleared', caption: 'Ready for publishing', line: 'text-emerald-500' },
  { key: 'PUBLISHED', badge: 'Live', caption: 'Live on connected accounts', line: 'text-indigo-500' },
  { key: 'REJECTED', badge: 'Failed', caption: 'Compliance violations', line: 'text-rose-500' },
];

const QUEUE_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING_REVIEW', label: 'Pending review' },
  { key: 'CHANGES_REQUIRED', label: 'Changes required' },
];

const QUEUE_COLUMNS = ['Creative', 'Brand', 'Submitter', 'Status', 'AI check', 'Compliance score', ''];

const ICON_PATHS = {
  review: 'M5 13l4 4L19 7',
  publish: 'M12 16V4m0 0l-4 4m4-4l4 4M4 20h16',
  history: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  link: 'M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1',
  close: 'M6 6l12 12M18 6L6 18',
};

/* ---------- Helpers ---------- */

const toArray = (value) => (Array.isArray(value) ? value : []);

// Start-of-day timestamps for the last TREND_DAYS days, oldest first
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

const personName = (person) => person?.name || person?.email || '—';

/* ---------- Small components ---------- */

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
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

function Banner({ pending, onDismiss }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-sm">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Icon name="review" className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold">
            {pending} {pending === 1 ? 'ad is' : 'ads are'} waiting for review
          </p>
          <p className="mt-0.5 text-sm text-indigo-100">
            Review pending submissions so approved ads can go live.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/admin/reviews"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600"
        >
          Review now
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-lg p-2 text-indigo-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Icon name="close" className="h-4 w-4" />
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

function QueueTabs({ tabs, active, counts, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
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

/* ---------- Page ---------- */

export default function AdminDashboard() {
  const [ads, setAds] = useState([]);
  const [profiles, setProfiles] = useState(null); // null = could not load
  const [accounts, setAccounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [queueTab, setQueueTab] = useState('ALL');

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [adsRes, profilesRes, accountsRes] = await Promise.allSettled([
        api.get('/ads'), // admin can fetch all
        api.get('/brand-profiles'),
        api.get('/social/accounts'),
      ]);
      if (!active) return;

      if (adsRes.status === 'fulfilled') {
        setAds(toArray(adsRes.value.data));
      } else {
        console.error(adsRes.reason);
        setError('Could not load ads. Refresh the page or try again later.');
      }
      if (profilesRes.status === 'fulfilled') setProfiles(toArray(profilesRes.value.data));
      if (accountsRes.status === 'fulfilled') setAccounts(toArray(accountsRes.value.data));
      setLoading(false);
    };

    load();
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

  const trends = useMemo(
    () => Object.fromEntries(METRICS.map(({ key }) => [key, buildTrend(ads, key)])),
    [ads]
  );

  // Ads still needing a moderator, newest first
  const queue = useMemo(
    () =>
      ads
        .filter((ad) => ad.status === 'PENDING_REVIEW' || ad.status === 'CHANGES_REQUIRED')
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [ads]
  );

  const tabCounts = {
    ALL: queue.length,
    PENDING_REVIEW: statusCounts.PENDING_REVIEW || 0,
    CHANGES_REQUIRED: statusCounts.CHANGES_REQUIRED || 0,
  };
  const visibleQueue = queue.filter((ad) => queueTab === 'ALL' || ad.status === queueTab);
  const shownQueue = visibleQueue.slice(0, QUEUE_LIMIT);

  const pending = statusCounts.PENDING_REVIEW || 0;
  const activeProfiles = profiles ? profiles.filter((p) => p.isActive !== false).length : null;

  return (
    <MainLayout>
      <PageHeader
        title="Dashboard"
        description={loading ? 'Loading ads…' : `Live ad moderation and publishing pipeline · ${ads.length} total ads`}
        actions={
          <>
            <Link to="/admin/history" className={buttonClass({ variant: 'secondary' })}>History</Link>
            <Link to="/admin/reviews" className={buttonClass()}>Open review queue</Link>
          </>
        }
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {!loading && pending > 0 && !bannerDismissed && (
          <Banner pending={pending} onDismiss={() => setBannerDismissed(true)} />
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

        {/* Workflow + governance */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            title="Review and publish"
            description="Day-to-day work on submitted ads across all campaigns."
            className="lg:col-span-2"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <ActionTile
                to="/admin/reviews"
                icon="review"
                iconClass="bg-indigo-50 text-indigo-600"
                title="Review submissions"
                pill={`${pending} pending`}
                pillTone="warning"
                description="Approve, reject or request changes on creative."
                cta="Open queue"
              />
              <ActionTile
                to="/admin/publishing"
                icon="publish"
                iconClass="bg-emerald-50 text-emerald-600"
                title="Publish ads"
                pill={`${statusCounts.APPROVED || 0} ready`}
                pillTone="success"
                description="Push approved assets to connected networks."
                cta="Publish now"
              />
              <ActionTile
                to="/admin/history"
                icon="history"
                iconClass="bg-slate-100 text-slate-600"
                title="History and logs"
                pill={`${ads.length} total`}
                pillTone="neutral"
                description="Past checks, reviews, versions and audit trail."
                cta="Inspect audits"
              />
            </div>
          </Card>

          <Card title="Governance setup" description="Rules and accounts the checks depend on.">
            <div className="space-y-3">
              <ActionTile
                to="/admin/brand-profiles"
                icon="shield"
                iconClass="bg-violet-50 text-violet-600"
                title="Brand profiles"
                pill={activeProfiles === null ? '—' : `${activeProfiles} active`}
                pillTone="success"
                description="Tone, terminology and official guidelines."
                cta="Manage profiles"
              />
              <ActionTile
                to="/admin/social"
                icon="link"
                iconClass="bg-sky-50 text-sky-600"
                title="Social accounts"
                pill={accounts === null ? '—' : `${accounts.length} connected`}
                pillTone="indigo"
                description="Connect and manage publishing accounts."
                cta="Manage accounts"
              />
            </div>
          </Card>
        </div>

        {/* Queue preview */}
        <Card
          title="Queue preview"
          description="Recent submissions awaiting moderator review."
          padded={false}
          actions={<QueueTabs tabs={QUEUE_TABS} active={queueTab} counts={tabCounts} onChange={setQueueTab} />}
        >
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading...</p>
          ) : shownQueue.length === 0 ? (
            <EmptyState
              title="Nothing waiting for review"
              description="New submissions will show up here as soon as employees run their AI check."
            />
          ) : (
            <>
              <Table columns={QUEUE_COLUMNS}>
                {shownQueue.map((ad) => (
                  <tr key={ad._id} className="hover:bg-slate-50">
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <Thumbnail ad={ad} />
                        <span className="max-w-[14rem] truncate font-medium text-slate-900">{ad.title}</span>
                      </div>
                    </td>
                    <td className={TD}>{ad.brandGuideline?.name || '—'}</td>
                    <td className={TD}>{personName(ad.createdBy)}</td>
                    <td className={TD}><StatusBadge status={ad.status} /></td>
                    <td className={TD}><AiBadge status={ad.aiStatus} /></td>
                    <td className={TD}><ScoreMeter score={ad.aiComplianceScore} /></td>
                    <td className={cx(TD, 'text-right')}>
                      <Link to="/admin/reviews" className={buttonClass({ size: 'sm' })}>Review</Link>
                    </td>
                  </tr>
                ))}
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
                <span>Showing {shownQueue.length} of {visibleQueue.length} items</span>
                <Link to="/admin/reviews" className="font-medium text-indigo-600 hover:text-indigo-700">
                  Open full queue
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}