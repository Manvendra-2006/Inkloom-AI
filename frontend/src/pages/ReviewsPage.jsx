// frontend/src/pages/ReviewsPage.js
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import AuditReport from '../components/AuditReport';

export default function ReviewsPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAds = async () => {
    try {
      const res = await api.get('/ads'); // admin can get all
      const pending = res.data.filter((a) => a.status === 'PENDING_REVIEW' || a.status === 'CHANGES_REQUIRED');
      setAds(pending);
    } catch (err) {
      setError('Failed to load ads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const handleReview = async (adId, action, comment) => {
    try {
      await api.post(`/admin/reviews/${adId}`, { action, comment });
      fetchAds();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <MainLayout><p>Loading...</p></MainLayout>;
  if (error) return <MainLayout><div className="bg-red-100 text-red-700 p-2 rounded">{error}</div></MainLayout>;

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Review Submissions</h1>
      {ads.length === 0 ? (
        <p>No ads awaiting review.</p>
      ) : (
        <table className="min-w-full bg-white shadow rounded">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Title</th>
              <th className="px-4 py-2 border">Creator</th>
              <th className="px-4 py-2 border">Workflow Status</th>
              <th className="px-4 py-2 border">AI Status</th>
              <th className="px-4 py-2 border">Finding Count</th>
              <th className="px-4 py-2 border">Human Review</th>
              <th className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => {
              const rawResult = ad.aiReport?.rawResult;
              const findings = rawResult?.combined_findings || [];
              return (
                <React.Fragment key={ad._id}>
                  <tr className="hover:bg-gray-100">
                    <td className="px-4 py-2 border">{ad.title}</td>
                    <td className="px-4 py-2 border">
                      {ad.createdBy?.name || ad.createdBy?.email || '—'}
                    </td>
                    <td className="px-4 py-2 border">{ad.status}</td>
                    <td className="px-4 py-2 border">{ad.aiStatus ? ad.aiStatus.toUpperCase() : '—'}</td>
                    <td className="px-4 py-2 border">
                      {rawResult?.finding_count ?? findings.length}
                    </td>
                    <td className="px-4 py-2 border">
                      {rawResult?.human_review_required ? 'Required' : '—'}
                    </td>
                    <td className="px-4 py-2 border space-x-2">
                      <button
                        onClick={() => {
                          const comment = prompt('Reason for approval (optional)');
                          handleReview(ad._id, 'APPROVED', comment);
                        }}
                        className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const comment = prompt('Reason for rejection');
                          handleReview(ad._id, 'REJECTED', comment);
                        }}
                        className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          const comment = prompt('Request changes comment');
                          handleReview(ad._id, 'CHANGES_REQUESTED', comment);
                        }}
                        className="bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                      >
                        Request Changes
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="border p-4" colSpan={7}>
                      {ad.aiReport ? (
                        <AuditReport
                          report={ad.aiReport}
                          aiStatus={ad.aiStatus}
                          advertisementTitle={ad.title}
                        />
                      ) : (
                        <p className="text-gray-600">AI audit has not been run for this advertisement.</p>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </MainLayout>
  );
}
