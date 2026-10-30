// frontend/src/pages/CreateAdPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import { Alert, Button, cx, Field, inputClass, PageHeader } from '../components/ui';

/* ---------- Constants ---------- */

const INITIAL_FORM = {
  title: '',
  caption: '',
  imageUrl: '',
  brandGuideline: '',
};

// The path every ad takes after it is saved
const WORKFLOW_STEPS = [
  { title: 'Draft', text: 'Write the ad and pick a brand profile.' },
  { title: 'AI check', text: 'Checked against the brand guidelines.' },
  { title: 'Human review', text: 'An admin approves or asks for changes.' },
  { title: 'Publish', text: 'Approved ads go to connected accounts.' },
];

const CHIP_TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
};

const toList = (value) => (Array.isArray(value) ? value : []);

/* ---------- Components ---------- */

// Card with a small label above the title, like the dashboard panels
function Panel({ eyebrow, title, description, padded = true, className, children }) {
  return (
    <section className={cx('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="px-5 pt-5">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p>
        )}
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className={padded ? 'p-5' : 'pt-5'}>{children}</div>
    </section>
  );
}

function WorkflowSteps() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="What happens after you save">
      {WORKFLOW_STEPS.map(({ title, text }, index) => (
        <li
          key={title}
          className={cx(
            'flex items-start gap-3 rounded-xl border p-4',
            index === 0 ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-white'
          )}
        >
          <span
            className={cx(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              index === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
            )}
          >
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ChipRow({ label, terms, tone }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {terms.map((term) => (
          <span key={term} className={cx('rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', CHIP_TONES[tone])}>
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}

// Tells the writer what the chosen brand expects before they write the copy
function BrandGuidance({ profile }) {
  const preferred = toList(profile.preferredTerminology);
  const flagged = toList(profile.termsRequiringReview);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-700">
        <span className="font-medium text-slate-900">Tone of voice:</span> {profile.toneOfVoice || '—'}
      </p>
      {preferred.length > 0 && <ChipRow label="Preferred wording" terms={preferred} tone="success" />}
      {flagged.length > 0 && <ChipRow label="Wording that triggers review" terms={flagged} tone="warning" />}
    </div>
  );
}

// Shows the ad roughly as a reader would see it, updating as the form is filled in
function AdPreview({ title, caption, imageUrl }) {
  const [failedUrl, setFailedUrl] = useState('');
  const showImage = imageUrl && failedUrl !== imageUrl;

  return (
    <Panel
      eyebrow="Live preview"
      title="Preview"
      description="Updates as you type."
      padded={false}
      className="lg:sticky lg:top-8"
    >
      <div className="aspect-video w-full bg-slate-100">
        {showImage ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailedUrl(imageUrl)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
            {imageUrl ? 'This image could not be loaded.' : 'No image yet'}
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className={cx('text-base font-semibold', title ? 'text-slate-900' : 'text-slate-400')}>
          {title || 'Advertisement title'}
        </h3>
        <p className={cx('mt-2 whitespace-pre-line text-sm', caption ? 'text-slate-600' : 'text-slate-400')}>
          {caption || 'Your caption will appear here.'}
        </p>
      </div>
    </Panel>
  );
}

/* ---------- Page ---------- */

export default function CreateAdPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const noProfiles = !loadingProfiles && profiles.length === 0;
  const selectedProfile = profiles.find((profile) => profile._id === form.brandGuideline);

  useEffect(() => {
    api
      .get('/brand-profiles')
      .then((res) => setProfiles(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load brand profiles'))
      .finally(() => setLoadingProfiles(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post('/ads', form);
      navigate(`/employee/ad/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create advertisement');
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create advertisement"
        description="Save a draft, then run the brand check on the next screen."
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {noProfiles && !error && (
          <Alert tone="warning">
            An administrator must save a brand profile before an advertisement can be checked.
          </Alert>
        )}

        <WorkflowSteps />

        <div className="grid items-start gap-6 lg:grid-cols-5">
          <Panel
            eyebrow="Ad editor"
            title="Advertisement details"
            description="Pick the brand first so you can see its wording rules."
            className="lg:col-span-3"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <Field id="brandGuideline" label="Brand profile">
                <select
                  id="brandGuideline"
                  name="brandGuideline"
                  value={form.brandGuideline}
                  onChange={handleChange}
                  required
                  disabled={loadingProfiles || noProfiles}
                  className={inputClass}
                >
                  <option value="">{loadingProfiles ? 'Loading profiles...' : 'Select a brand profile...'}</option>
                  {profiles.map((profile) => (
                    <option key={profile._id} value={profile._id}>
                      {profile.name} — v{profile.version || '1.0'}
                    </option>
                  ))}
                </select>
                {selectedProfile && <BrandGuidance profile={selectedProfile} />}
              </Field>

              <Field id="title" label="Title">
                <input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </Field>

              <Field id="caption" label="Caption / content">
                <textarea
                  id="caption"
                  name="caption"
                  value={form.caption}
                  onChange={handleChange}
                  rows={5}
                  className={inputClass}
                />
              </Field>

              <Field id="imageUrl" label="Image URL" hint="Link to a hosted image. Optional.">
                <input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  value={form.imageUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                  className={inputClass}
                />
              </Field>

              <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                <Button type="submit" disabled={noProfiles || loadingProfiles || submitting}>
                  {submitting ? 'Saving...' : 'Save draft'}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/employee/dashboard')}>
                  Cancel
                </Button>
              </div>
            </form>
          </Panel>

          <div className="lg:col-span-2">
            <AdPreview title={form.title} caption={form.caption} imageUrl={form.imageUrl} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}