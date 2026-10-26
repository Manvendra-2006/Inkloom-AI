// frontend/src/pages/EmployeeAdDetail.js
/* eslint-disable */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

export default function EmployeeAdDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiResult, setAiResult] = useState(null);

  const fetchAd = async () => {
    try {
      const res = await api.get('/ads'); // get all then find one for simplicity
      const found = res.data.find((a) => a._id === id);
      setAd(found);
    } catch (err) {
      setError('Failed to load advertisement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAiCheck = async () => {
    try {
      const res = await api.post(`/ai/check-ad/${id}`);
      setAiResult(res.data);
      // Refresh ad list to get updated status/score
      await fetchAd();
    } catch (err) {
      setError(err.response?.data?.message || 'AI check failed');
    }
  };

  const handleSubmitForReview = async () => {
    try {
      await api.post(`/ads/${id}/submit`);
      await fetchAd();
    } catch (err) {
      setError(err.response?.data?.message || 'Submit failed');
    }
  };

  if (loading) return <MainLayout><p>Loading...</p></MainLayout>;
  if (error) return <MainLayout><div className="bg-red-100 text-red-700 p-2 rounded">{error}</div></MainLayout>;
  if (!ad) return <MainLayout><p>Advertisement not found.</p></MainLayout>;

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Advertisement Detail</h1>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">{ad.title}</h2>
        {ad.imageUrl && (
          <img src={ad.imageUrl} alt="Ad" className="max-w-full h-auto mb-2" />
        )}
        <p className="mb-2"><strong>Caption:</strong> {ad.caption}</p>
        <p className="mb-2"><strong>Status:</strong> {ad.status}</p>
        <p className="mb-2"><strong>Score:</strong> {ad.aiComplianceScore ?? '-'} </p>
        <div className="flex space-x-2 mt-4">
          {['DRAFT', 'CHANGES_REQUIRED'].includes(ad.status) && (
            <button
              onClick={handleAiCheck}
              className="bg-indigo-600 text-white py-1 px-3 rounded hover:bg-indigo-700"
            >
              Check with AI
            </button>
          )}
          {ad.status === 'AI_CHECKED' && (
            <button
              onClick={handleSubmitForReview}
              className="bg-green-600 text-white py-1 px-3 rounded hover:bg-green-700"
            >
              Submit for Review
            </button>
          )}
        </div>
        {aiResult && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">AI Compliance Result</h3>
            <p><strong>Score:</strong> {aiResult.score}</p>
            <p><strong>Status:</strong> {aiResult.status}</p>
            <ul className="list-disc pl-5 mt-2">
              {aiResult.issues.map((iss, idx) => (
                <li key={idx} className="mb-1">
                  <strong>{iss.category}</strong> ({iss.severity}): {iss.issue}<br />
                  <em>{iss.explanation}</em><br />
                  <span className="text-sm">Suggestion: {iss.suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
