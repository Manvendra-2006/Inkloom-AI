// frontend/src/pages/AdminDashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import { Alert, buttonClass, Card, PageHeader, StatCard, STATUS_META } from '../components/ui';

/* ---------- Config ---------- */

const STAT_STATUSES = ['PENDING_REVIEW', 'CHANGES_REQUIRED', 'APPROVED', 'PUBLISHED', 'REJECTED'];

const ACTION_GROUPS = [
  {
    title: 'Review and publish',
    description: 'Day-to-day work on submitted ads.',
    links: [
      { to: '/admin/reviews', label: 'Review submissions', description: 'Approve, reject or request changes.' },
      { to: '/admin/publishing', label: 'Publish ads', description: 'Send approved ads to connected accounts.' },
      { to: '/admin/history', label: 'History', description: 'Past checks, reviews and decisions.' },
    ],
  },
  {
    title: 'Set up',
    description: 'Rules and accounts the checks depend on.',
    links: [
      { to: '/admin/brand-profiles', label: 'Brand profile', description: 'Tone, terminology and official guidelines.' },
      { to: '/admin/social', label: 'Social accounts', description: 'Connect and manage publishing accounts.' },
    ],
  },
];

/* ---------- Components ---------- */

function ActionLink({ to, label, description }) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <span className="block text-sm font-semibold text-slate-900">{label}</span>
      <span className="mt-1 block text-sm text-slate-500">{description}</span>
    </Link>
  );
}

/* ---------- Page ---------- */

export default function AdminDashboard() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await api.get('/ads'); // admin can fetch all
        setAds(res.data);
      } catch (err) {
        console.error(err);
        setError('Could not load ads. Refresh the page or try again later.');
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

  const pending = statusCounts.PENDING_REVIEW || 0;

  return (
    <MainLayout>
      <PageHeader
        title="Dashboard"
        description={loading ? 'Loading ads…' : `${ads.length} ads across all statuses`}
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {!loading && pending > 0 && (
          <Alert
            tone="info"
            title={`${pending} ${pending === 1 ? 'ad is' : 'ads are'} waiting for review`}
            action={<Link to="/admin/reviews" className={buttonClass({ size: 'sm' })}>Review now</Link>}
          />
        )}

        <section aria-label="Ad status summary" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {STAT_STATUSES.map((key) => (
            <StatCard
              key={key}
              label={STATUS_META[key].label}
              tone={STATUS_META[key].tone}
              value={statusCounts[key] || 0}
              loading={loading}
            />
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {ACTION_GROUPS.map((group, index) => (
            <Card
              key={group.title}
              title={group.title}
              description={group.description}
              className={index === 0 ? 'lg:col-span-2' : undefined}
            >
              <div className={`grid gap-3 ${index === 0 ? 'sm:grid-cols-2' : ''}`}>
                {group.links.map((link) => <ActionLink key={link.to} {...link} />)}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}