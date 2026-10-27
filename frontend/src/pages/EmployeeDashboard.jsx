// frontend/src/pages/EmployeeDashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import {
  AiBadge,
  Alert,
  buttonClass,
  Card,
  EmptyState,
  PageHeader,
  ScoreMeter,
  StatCard,
  StatusBadge,
  STATUS_META,
  Table,
  TD,
} from '../components/ui';

const STAT_STATUSES = ['DRAFT', 'CHANGES_REQUIRED', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED'];
const TABLE_COLUMNS = ['Advertisement', 'Status', 'AI check', 'Compliance score'];

export default function EmployeeDashboard() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await api.get('/ads');
        setAds(res.data);
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

  const needsChanges = statusCounts.CHANGES_REQUIRED || 0;
  const createButton = (
    <Link to="/employee/create-ad" className={buttonClass()}>Create advertisement</Link>
  );

  const renderAds = () => {
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
    return (
      <Table columns={TABLE_COLUMNS}>
        {ads.map((ad) => (
          <tr key={ad._id} className="hover:bg-slate-50">
            <td className={TD}>
              <Link
                to={`/employee/ad/${ad._id}`}
                className="font-medium text-slate-900 hover:text-indigo-600 focus:outline-none focus-visible:underline"
              >
                {ad.title}
              </Link>
            </td>
            <td className={TD}><StatusBadge status={ad.status} /></td>
            <td className={TD}><AiBadge status={ad.aiStatus} /></td>
            <td className={TD}><ScoreMeter score={ad.aiComplianceScore} /></td>
          </tr>
        ))}
      </Table>
    );
  };

  return (
    <MainLayout>
      <PageHeader
        title="Dashboard"
        description={loading ? 'Loading ads…' : `${ads.length} ads in total`}
        actions={createButton}
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {needsChanges > 0 && (
          <Alert
            tone="warning"
            title={`${needsChanges} ${needsChanges === 1 ? 'ad needs' : 'ads need'} changes`}
          >
            Open the ad, fix the flagged wording and run the AI check again.
          </Alert>
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

        <Card title="My advertisements" padded={false}>
          {renderAds()}
        </Card>
      </div>
    </MainLayout>
  );
}