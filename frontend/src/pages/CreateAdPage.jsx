// frontend/src/pages/CreateAdPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import { Alert, Button, Card, Field, inputClass, PageHeader } from '../components/ui';

/* ---------- Constants ---------- */

const INITIAL_FORM = {
  title: '',
  caption: '',
  imageUrl: '',
  brandGuideline: '',
};

/* ---------- Components ---------- */

// Shows the ad roughly as a reader would see it, updating as the form is filled in
function AdPreview({ title, caption, imageUrl }) {
  const [failedUrl, setFailedUrl] = useState('');
  const showImage = imageUrl && failedUrl !== imageUrl;

  return (
    <Card title="Preview" description="Updates as you type." padded={false} className="lg:sticky lg:top-8">
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
        <h3 className={`text-base font-semibold ${title ? 'text-slate-900' : 'text-slate-400'}`}>
          {title || 'Advertisement title'}
        </h3>
        <p className={`mt-2 whitespace-pre-line text-sm ${caption ? 'text-slate-600' : 'text-slate-400'}`}>
          {caption || 'Your caption will appear here.'}
        </p>
      </div>
    </Card>
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

        <div className="grid items-start gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card title="Advertisement details">
              <form onSubmit={handleSubmit} className="space-y-5">
                <Field
                  id="brandGuideline"
                  label="Brand profile"
                  hint={selectedProfile ? `Tone of voice: ${selectedProfile.toneOfVoice}` : undefined}
                >
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
            </Card>
          </div>

          <div className="lg:col-span-2">
            <AdPreview title={form.title} caption={form.caption} imageUrl={form.imageUrl} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}