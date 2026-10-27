// frontend/src/pages/EmployeeAdDetail.js
/* eslint-disable */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import AuditReport from '../components/AuditReport';

export default function EmployeeAdDetail() {
  const { id } = useParams();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [draft, setDraft] = useState({ title: '', caption: '' });
  const [profiles, setProfiles] = useState([]);
  const [selectedBrandGuideline, setSelectedBrandGuideline] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);

  const fetchAd = async () => {
    try {
      const [adsResponse, profilesResponse] = await Promise.all([
        api.get('/ads/my-submissions'),
        api.get('/brand-profiles'),
      ]);
      const found = adsResponse.data.find((a) => a._id === id);
      setAd(found);
      setDraft({ title: found?.title || '', caption: found?.caption || '' });
      setAiResult(found?.aiReport || null);
      setProfiles(profilesResponse.data);
      setSelectedBrandGuideline(found?.brandGuideline?._id || '');
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
    setError(null);
    setMessage('');
    setAiChecking(true);
    try {
      const res = await api.post(`/ai/check-ad/${id}`);
      await fetchAd();
      setAiResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'AI check failed');
    } finally {
      setAiChecking(false);
    }
  };

  const handleSaveBrand = async () => {
    setError(null);
    setMessage('');
    setSavingBrand(true);
    try {
      await api.put(`/ads/${id}`, { brandGuideline: selectedBrandGuideline });
      await fetchAd();
      setMessage('Brand Profile updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign brand profile');
    } finally {
      setSavingBrand(false);
    }
  };

  const handleSaveContent = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage('');
    setSavingContent(true);
    try {
      await api.put(`/ads/${id}`, {
        title: draft.title.trim(),
        caption: draft.caption,
      });
      await fetchAd();
      setMessage('Advertisement changes saved. Run AI Check to resubmit it for review.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save advertisement changes');
    } finally {
      setSavingContent(false);
    }
  };

  if (loading) return <MainLayout><p>Loading...</p></MainLayout>;
  if (error) return <MainLayout><div className="bg-red-100 text-red-700 p-2 rounded">{error}</div></MainLayout>;
  if (!ad) return <MainLayout><p>Advertisement not found.</p></MainLayout>;
  const currentBrandProfile = profiles.find((profile) => profile._id === selectedBrandGuideline)
    || ad.brandGuideline;
  const brandSelectionChanged = selectedBrandGuideline !== (ad.brandGuideline?._id || '');

  return (
    <MainLayout>
      <div className="container-fluid py-3">
      <h1 className="h2 mb-4">Advertisement Detail</h1>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {ad.status === 'CHANGES_REQUIRED' && (
        <div className="alert alert-danger">
          <strong>Changes Required.</strong> Update the advertisement and run AI Check again.
        </div>
      )}
      <div className="card shadow-sm">
        <div className="card-body">
        <h2 className="h4 mb-2">{ad.title}</h2>
        {ad.imageUrl && (
          <img src={ad.imageUrl} alt="Advertisement" className="img-fluid rounded mb-3" />
        )}
        <p className="mb-2"><strong>Caption:</strong> {ad.caption || '—'}</p>
        <p className="mb-2">
          <strong>Brand Profile:</strong>{' '}
          {ad.brandGuideline?.name || '—'}
          {ad.brandGuideline?.version ? ` · v${ad.brandGuideline.version}` : ''}
        </p>
        <p className="mb-2"><strong>Workflow Status:</strong> {ad.status}</p>
        <p className="mb-2"><strong>AI Status:</strong> {ad.aiStatus ? ad.aiStatus.toUpperCase() : 'Not checked'}</p>
        <p className="mb-2"><strong>Score:</strong> {ad.aiComplianceScore ?? '—'}{ad.aiComplianceScore !== undefined ? '/100' : ''}</p>
        {ad.aiCheckedAt && (
          <p className="mb-2">
            <strong>Last AI Check:</strong> {new Date(ad.aiCheckedAt).toLocaleString()}
          </p>
        )}
        {['DRAFT', 'CHANGES_REQUIRED'].includes(ad.status) && (
          <form onSubmit={handleSaveContent} className="row g-3 mt-2">
            <div className="col-12">
              <label className="form-label" htmlFor="advertisement-title">Advertisement title</label>
              <input
                id="advertisement-title"
                className="form-control"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="advertisement-caption">Caption / content</label>
              <textarea
                id="advertisement-caption"
                className="form-control"
                rows={4}
                value={draft.caption}
                onChange={(event) => setDraft((current) => ({ ...current, caption: event.target.value }))}
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="brand-profile-select">
              Brand Profile
              <select
                id="brand-profile-select"
                value={selectedBrandGuideline}
                onChange={(e) => setSelectedBrandGuideline(e.target.value)}
                className="form-select mt-1"
                required
              >
                <option value="">Select a brand profile...</option>
                {ad.brandGuideline
                  && !profiles.some((profile) => profile._id === ad.brandGuideline._id)
                  && (
                    <option value={ad.brandGuideline._id}>
                      {ad.brandGuideline.name} — v{ad.brandGuideline.version || '1.0'} (inactive historical profile)
                    </option>
                  )}
                {profiles.map((profile) => (
                  <option key={profile._id} value={profile._id}>
                    {profile.name} — v{profile.version || '1.0'}
                  </option>
                ))}
              </select>
              </label>
            </div>
            <div className="col-12 d-flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={savingContent || !draft.title.trim()}
                className="btn btn-outline-primary"
              >
                {savingContent ? 'Saving...' : 'Save Changes'}
              </button>
            {selectedBrandGuideline !== (ad.brandGuideline?._id || '') && (
              <button
                type="button"
                onClick={handleSaveBrand}
                disabled={!selectedBrandGuideline || savingBrand}
                className="btn btn-outline-secondary"
              >
                {savingBrand ? 'Saving...' : 'Save Brand Profile'}
              </button>
            )}
            </div>
          </form>
        )}
        <div className="d-flex gap-2 mt-4">
          {['DRAFT', 'CHANGES_REQUIRED'].includes(ad.status) && (
            <button
              onClick={handleAiCheck}
              disabled={aiChecking || !ad.brandGuideline || brandSelectionChanged}
              className="btn btn-primary"
            >
              {aiChecking ? 'Analyzing...' : 'Check with AI'}
            </button>
          )}
        </div>
        {brandSelectionChanged && (
          <p className="text-warning mt-2">
            Save the selected Brand Profile before running an AI check.
          </p>
        )}
        {aiChecking && (
          <div className="mt-4 border rounded p-4 bg-light" role="status" aria-live="polite">
            <p className="font-semibold">AI is analyzing your advertisement...</p>
            <p>Brand: {currentBrandProfile?.name || 'Loading selected brand'}</p>
            <p>Checking against: {currentBrandProfile?.toneOfVoice || 'Preferred tone of voice'}</p>
            <p>
              Preferred terminology:{' '}
              {(currentBrandProfile?.preferredTerminology || []).join(', ') || 'Loading'}
            </p>
            <p>
              Terms requiring review:{' '}
              {(currentBrandProfile?.termsRequiringReview || []).join(', ') || 'Loading'}
            </p>
            {(currentBrandProfile?.guidelines || [])
              .filter((guideline) => guideline.active !== false)
              .map((guideline) => (
                <p key={guideline._id}>
                  Official guideline: {guideline.title}
                  {guideline.rule ? ` — ${guideline.rule}` : ''}
                </p>
              ))}
            <p>Analyzing advertisement...</p>
          </div>
        )}
        {ad.status === 'PENDING_REVIEW' && (
          <p className="alert alert-success mt-4">This clean advertisement has been submitted for human review.</p>
        )}
        <AuditReport
          report={aiResult}
          aiStatus={ad.aiStatus}
          advertisementTitle={ad.title}
        />
        </div>
      </div>
      </div>
    </MainLayout>
  );
}
