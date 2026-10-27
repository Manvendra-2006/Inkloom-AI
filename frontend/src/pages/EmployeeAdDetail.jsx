import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import AuditReport from '../components/AuditReport';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  inputClass,
  PageHeader,
  StatusBadge,
} from '../components/ui';

const EDITABLE_STATUSES = ['DRAFT', 'CHANGES_REQUIRED'];

function DetailItem({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function AiProgress({ profile }) {
  const activeGuidelines = (profile?.guidelines || []).filter((guideline) => guideline.active !== false);

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4" role="status" aria-live="polite">
      <p className="font-medium text-indigo-950">AI is analyzing your advertisement...</p>
      <p className="mt-2 text-sm text-indigo-900">
        {profile?.name || 'Loading selected brand'} · {profile?.toneOfVoice || 'Brand tone'}
      </p>
      {activeGuidelines.length > 0 && (
        <p className="mt-1 text-sm text-indigo-800">
          Checking {activeGuidelines.length} active brand guideline{activeGuidelines.length === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
}

function currentFindings(report) {
  const data = report?.rawResult || report || {};
  return Array.isArray(data.combined_findings)
    ? data.combined_findings
    : Array.isArray(report?.issues) ? report.issues : [];
}

function replaceFirstIgnoringCase(text, search, replacement) {
  const index = text.toLocaleLowerCase().indexOf(search.toLocaleLowerCase());
  if (index < 0) return null;
  return `${text.slice(0, index)}${replacement}${text.slice(index + search.length)}`;
}

export default function EmployeeAdDetail() {
  const { id } = useParams();

  const [ad, setAd] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [draft, setDraft] = useState({ title: '', caption: '' });
  const [selectedBrandGuideline, setSelectedBrandGuideline] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [suggestionResult, setSuggestionResult] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const [savingContent, setSavingContent] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copying, setCopying] = useState(false);

  const fetchAd = useCallback(async () => {
    try {
      const [adsResponse, profilesResponse] = await Promise.all([
        api.get('/ads/my-submissions'),
        api.get('/brand-profiles'),
      ]);
      const found = adsResponse.data.find((item) => item._id === id) || null;

      setAd(found);
      setDraft({ title: found?.title || '', caption: found?.caption || '' });
      setAiResult(found?.aiReport || null);
      setSuggestionResult(null);
      setProfiles(profilesResponse.data);
      setSelectedBrandGuideline(found?.brandGuideline?._id || '');
    } catch (requestError) {
      setLoadError(requestError.response?.data?.message || 'Failed to load advertisement');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAd();
  }, [fetchAd]);

  const runAction = async ({ setBusy, request, successMessage, fallbackError }) => {
    setError(null);
    setMessage('');
    setBusy(true);
    try {
      await request();
      await fetchAd();
      if (successMessage) setMessage(successMessage);
    } catch (requestError) {
      setError(requestError.response?.data?.message || fallbackError);
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (field) => (event) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }));

  const handleSaveContent = (event) => {
    event.preventDefault();
    return runAction({
      setBusy: setSavingContent,
      request: () => api.put(`/ads/${id}`, {
        title: draft.title.trim(),
        caption: draft.caption,
      }),
      successMessage: 'Advertisement changes saved. Run the AI check again before submitting.',
      fallbackError: 'Failed to save advertisement changes',
    });
  };

  const handleSaveBrand = () =>
    runAction({
      setBusy: setSavingBrand,
      request: () => api.put(`/ads/${id}`, { brandGuideline: selectedBrandGuideline }),
      successMessage: 'Brand profile updated. Run the AI check again before submitting.',
      fallbackError: 'Failed to assign brand profile',
    });

  const handleAiCheck = async () => {
    setError(null);
    setMessage('');
    setSuggestionResult(null);
    setAiChecking(true);
    try {
      if (draft.title.trim() !== ad.title || draft.caption !== (ad.caption || '')) {
        await api.put(`/ads/${id}`, {
          title: draft.title.trim(),
          caption: draft.caption,
        });
      }

      const response = await api.post(`/ai/check-ad/${id}`);
      setSuggestionResult(null);
      await fetchAd();
      setAiResult(response.data);
      setMessage('AI compliance check completed.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'AI check failed');
      await fetchAd();
    } finally {
      setAiChecking(false);
    }
  };

  const handleGetSuggestions = async () => {
    setError(null);
    setMessage('');
    setSuggesting(true);
    try {
      const response = await api.post(`/ai/suggest-improvements/${id}`, {
        title: ad.title,
        caption: ad.caption || '',
        findings: currentFindings(aiResult || ad.aiReport),
      });
      setSuggestionResult(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to generate AI suggestions. Please try again.');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSubmitForReview = () =>
    runAction({
      setBusy: setSubmitting,
      request: () => api.post(`/ads/${id}/submit`),
      successMessage: 'Advertisement submitted for admin review.',
      fallbackError: 'Failed to submit advertisement for review',
    });

  const handleUseSuggestedVersion = () => {
    const revisedDraft = suggestionResult?.revised_draft;
    if (!revisedDraft) return;
    setDraft({ title: revisedDraft.title, caption: revisedDraft.caption });
    setMessage('Suggested version is in the editable draft. Review it, make any edits, and save it when ready.');
  };

  const handleApplySuggestion = (suggestion) => {
    const original = String(suggestion.original_text || '');
    const replacement = String(suggestion.suggested_replacement || '');
    const title = replaceFirstIgnoringCase(draft.title, original, replacement);
    if (title !== null) {
      setDraft((current) => ({ ...current, title }));
      setMessage('Suggestion applied to the title. Review and save the draft when ready.');
      return;
    }
    const caption = replaceFirstIgnoringCase(draft.caption, original, replacement);
    if (caption !== null) {
      setDraft((current) => ({ ...current, caption }));
      setMessage('Suggestion applied to the caption. Review and save the draft when ready.');
      return;
    }
    setError('That wording is no longer in the editable draft. Run AI Check again to refresh suggestions.');
  };

  const handleCopySuggestedVersion = async () => {
    setError(null);
    setCopying(true);
    try {
      await navigator.clipboard.writeText(
        `Title: ${suggestionResult.revised_draft.title}\n\n${suggestionResult.revised_draft.caption}`
      );
      setMessage('Revised advertisement copied to the clipboard.');
    } catch {
      setError('Could not copy the revised advertisement. Check clipboard permissions and try again.');
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return <MainLayout><p className="text-sm text-slate-600">Loading advertisement...</p></MainLayout>;
  }
  if (loadError) {
    return <MainLayout><Alert tone="error">{loadError}</Alert></MainLayout>;
  }
  if (!ad) {
    return <MainLayout><Alert tone="warning">Advertisement not found.</Alert></MainLayout>;
  }

  const isEditable = EDITABLE_STATUSES.includes(ad.status);
  const savedBrandId = ad.brandGuideline?._id || '';
  const brandSelectionChanged = selectedBrandGuideline !== savedBrandId;
  const draftChanged =
    draft.title.trim() !== ad.title || draft.caption !== (ad.caption || '');
  const currentBrandProfile =
    profiles.find((profile) => profile._id === selectedBrandGuideline) || ad.brandGuideline;
  const savedProfileIsInactive =
    ad.brandGuideline && !profiles.some((profile) => profile._id === ad.brandGuideline._id);
  const activeReport = aiResult || ad.aiReport;
  const isFlagged = ad.aiStatus === 'flagged';
  const isClean = ad.aiStatus === 'clean';
  const isAiUnavailable = ad.aiStatus === 'unavailable';
  const canRequestSuggestions = isEditable && isFlagged && !draftChanged && !brandSelectionChanged;
  const canSubmit = isEditable && isClean && !draftChanged && !brandSelectionChanged;

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Advertisement detail"
          description="Review and edit your draft, run a compliance check, then submit it for admin review."
          actions={<StatusBadge status={ad.status} />}
        />

        {error && <Alert tone="error">{error}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}
        {ad.status === 'CHANGES_REQUIRED' && (
          <Alert tone="warning" title="Changes required">
            Update the advertisement, save the draft, and run AI Check again before submitting.
          </Alert>
        )}

        <Card title="Advertisement" description="Your original saved advertisement stays unchanged until you save edits.">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{ad.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{ad.caption || 'No caption provided.'}</p>
            </div>
            {ad.imageUrl && (
              <img
                src={ad.imageUrl}
                alt={ad.title || 'Advertisement'}
                className="max-h-48 w-full rounded-lg border border-slate-200 object-cover"
              />
            )}
          </div>
          <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Brand profile">
              {ad.brandGuideline?.name || '—'}
              {ad.brandGuideline?.version ? ` · v${ad.brandGuideline.version}` : ''}
            </DetailItem>
            <DetailItem label="AI status">
              <Badge tone={isClean ? 'success' : isFlagged ? 'danger' : isAiUnavailable ? 'warning' : 'neutral'}>
                {isClean ? 'Clean' : isFlagged ? 'Flagged' : isAiUnavailable ? 'Unavailable' : 'Not checked'}
              </Badge>
            </DetailItem>
            <DetailItem label="Compliance score">
              {ad.aiComplianceScore === undefined || ad.aiComplianceScore === null
                ? '—'
                : `${ad.aiComplianceScore}/100`}
            </DetailItem>
            <DetailItem label="Last AI check">
              {ad.aiCheckedAt ? new Date(ad.aiCheckedAt).toLocaleString() : '—'}
            </DetailItem>
          </dl>
        </Card>

        {isEditable && (
          <Card title="Edit advertisement" description="Changes are saved only when you choose Save changes.">
            <form onSubmit={handleSaveContent} className="space-y-5">
              <Field id="advertisement-title" label="Advertisement title">
                <input
                  id="advertisement-title"
                  className={inputClass}
                  value={draft.title}
                  onChange={updateDraft('title')}
                  required
                />
              </Field>
              <Field id="advertisement-caption" label="Caption / content">
                <textarea
                  id="advertisement-caption"
                  className={inputClass}
                  rows={5}
                  value={draft.caption}
                  onChange={updateDraft('caption')}
                />
              </Field>
              <Field id="brand-profile-select" label="Brand profile">
                <select
                  id="brand-profile-select"
                  value={selectedBrandGuideline}
                  onChange={(event) => setSelectedBrandGuideline(event.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select a brand profile...</option>
                  {savedProfileIsInactive && (
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
              </Field>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Button type="submit" disabled={savingContent || !draft.title.trim()}>
                  {savingContent ? 'Saving...' : 'Save changes'}
                </Button>
                {brandSelectionChanged && (
                  <Button
                    variant="secondary"
                    onClick={handleSaveBrand}
                    disabled={!selectedBrandGuideline || savingBrand}
                  >
                    {savingBrand ? 'Saving brand...' : 'Save brand profile'}
                  </Button>
                )}
              </div>
            </form>
          </Card>
        )}

        {isEditable && (
          <Card title="AI compliance check" description="AI Check only audits the saved draft; it never generates suggestions automatically.">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleAiCheck}
                disabled={aiChecking || !ad.brandGuideline || brandSelectionChanged || !draft.title.trim()}
              >
                {aiChecking ? 'Analyzing...' : 'AI Check'}
              </Button>
              {canSubmit && (
                <Button onClick={handleSubmitForReview} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </Button>
              )}
            </div>
            {brandSelectionChanged && (
              <p className="mt-3 text-sm text-amber-800">Save the selected brand profile before running AI Check.</p>
            )}
            {draftChanged && (
              <p className="mt-3 text-sm text-amber-800">
                Unsaved edits will be saved before AI Check. Save changes explicitly before requesting suggestions or submitting.
              </p>
            )}
            {aiChecking && <div className="mt-4"><AiProgress profile={currentBrandProfile} /></div>}
            {isClean && (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                No potential findings. You may submit this draft for admin review; a clean AI result is not an approval.
              </p>
            )}
            {isFlagged && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Potential compliance issues were found. Review the report and update the draft before resubmitting.
              </p>
            )}
          </Card>
        )}

        {activeReport && (
          <AuditReport
            report={activeReport}
            aiStatus={ad.aiStatus}
            advertisementTitle={ad.title}
          />
        )}

        {canRequestSuggestions && (
          <Card title="AI suggestions" description="Generate optional, reviewable copy suggestions based on the latest audit.">
            <Button onClick={handleGetSuggestions} disabled={suggesting}>
              {suggesting ? 'Generating AI Suggestions...' : 'Get AI Suggestions'}
            </Button>
          </Card>
        )}
        {isFlagged && draftChanged && (
          <Alert tone="warning">
            Save your edits and run AI Check again before requesting suggestions for the updated copy.
          </Alert>
        )}

        {suggesting && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900" role="status" aria-live="polite">
            Generating line-by-line suggestions and a complete revised advertisement...
          </div>
        )}

        {suggestionResult && (
          <div className="space-y-5">
            <Card title="Line-by-line suggestions" description="Apply individual replacements to your editable draft, then review and save.">
              {suggestionResult.suggestions.length === 0 ? (
                <p className="text-sm text-slate-600">No line-by-line replacements were returned. Review the complete revised advertisement below.</p>
              ) : (
                <div className="space-y-4">
                  {suggestionResult.suggestions.map((suggestion, index) => (
                    <article
                      key={`${suggestion.original_text}-${index}`}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Original wording</p>
                      <p className="mt-1 font-mono text-sm text-slate-900">{suggestion.original_text}</p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Reason</p>
                      <p className="mt-1 text-sm text-slate-700">{suggestion.reason}</p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Suggested replacement</p>
                      <p className="mt-1 text-sm font-medium text-indigo-800">{suggestion.suggested_replacement}</p>
                      {isEditable && (
                        <Button
                          variant="secondary"
                          className="mt-4"
                          onClick={() => handleApplySuggestion(suggestion)}
                        >
                          Apply Suggestion
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Complete revised advertisement" description="Using this version fills the editable draft only; it does not overwrite the saved advertisement.">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</p>
                  <p className="mt-1 font-medium text-slate-900">{suggestionResult.revised_draft.title}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Caption</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">
                    {suggestionResult.revised_draft.caption}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {isEditable && (
                    <Button onClick={handleUseSuggestedVersion}>Use Suggested Version</Button>
                  )}
                  <Button variant="secondary" onClick={handleCopySuggestedVersion} disabled={copying}>
                    {copying ? 'Copying...' : 'Copy'}
                  </Button>
                </div>
                {suggestionResult.human_review_required && (
                  <p className="text-xs text-slate-500">Review all generated copy and verify claims before saving or submitting.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {ad.status === 'PENDING_REVIEW' && (
          <Alert tone="success">This advertisement has been submitted for human review. Admin approval remains the final decision.</Alert>
        )}
      </div>
    </MainLayout>
  );
}
