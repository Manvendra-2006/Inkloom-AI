// frontend/src/pages/BrandProfile.js
import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import {
  Alert,
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  inputClass,
  PageHeader,
} from '../components/ui';

/* ---------- Constants ---------- */

const TONE_OPTIONS = [
  'Professional and trustworthy',
  'Friendly and approachable',
  'Bold and confident',
  'Simple and clear',
  'Premium and elegant',
  'Technical and informative',
];

const GUIDELINE_CATEGORIES = [
  'TONE',
  'TERMINOLOGY',
  'FACTS',
  'CLAIMS',
  'MESSAGING',
  'RESTRICTED_WORDS',
  'BRANDING',
  'ACCESSIBILITY',
];

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];
const SEVERITY_TONES = { LOW: 'neutral', MEDIUM: 'warning', HIGH: 'danger' };

const EMPTY_GUIDELINE = {
  category: 'CLAIMS',
  title: '',
  description: '',
  rule: '',
  examples: '',
  severity: 'MEDIUM',
  active: true,
};

const EMPTY_FORM = {
  name: '',
  description: '',
  toneOfVoice: '',
  customTone: '',
  preferredTerminology: '',
  termsRequiringReview: '',
  guidelines: [],
};

const TERMINOLOGY_HELP = 'Words or phrases your brand prefers to use. Separate terms with commas.';
const REVIEW_TERMS_HELP = 'Words or phrases that should trigger AI review. Separate terms with commas.';

/* ---------- Helpers ---------- */

const formatEnum = (value) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

const toCommaSeparated = (terms) => (Array.isArray(terms) ? terms.join(', ') : '');

// Splits "a, b, A" into ["a", "b"] (trimmed, case-insensitive unique)
function parseTerms(value) {
  const unique = new Map();
  value
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
    .forEach((term) => {
      const key = term.toLocaleLowerCase();
      if (!unique.has(key)) unique.set(key, term);
    });
  return Array.from(unique.values());
}

function toGuidelines(guidelines) {
  if (!Array.isArray(guidelines)) return [];
  return guidelines.map((g) => ({
    _id: g._id,
    category: g.category || EMPTY_GUIDELINE.category,
    title: g.title || '',
    description: g.description || '',
    rule: g.rule || '',
    examples: g.examples || '',
    severity: g.severity || EMPTY_GUIDELINE.severity,
    active: g.active !== false,
  }));
}

// Single place that converts an API profile into form state
function profileToForm(profile) {
  const toneIsListed = TONE_OPTIONS.includes(profile.toneOfVoice);
  return {
    name: profile.name || '',
    description: profile.description || '',
    toneOfVoice: toneIsListed ? profile.toneOfVoice : 'custom',
    customTone: toneIsListed ? '' : profile.toneOfVoice || '',
    preferredTerminology: toCommaSeparated(profile.preferredTerminology),
    termsRequiringReview: toCommaSeparated(profile.termsRequiringReview),
    guidelines: toGuidelines(profile.guidelines),
  };
}

/* ---------- Small components ---------- */

function FormSection({ title, description, actions, children }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const CHIP_TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
};

function TermChips({ terms, tone }) {
  if (!Array.isArray(terms) || terms.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {terms.map((term) => (
        <span key={term} className={cx('rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', CHIP_TONES[tone])}>
          {term}
        </span>
      ))}
    </div>
  );
}

function GuidelineEditor({ guideline, index, onChange, onRemove }) {
  const id = (field) => `guideline-${field}-${index}`;
  const update = (field) => (event) => onChange(index, field, event.target.value);

  return (
    <fieldset className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <legend className="px-2 text-sm font-medium text-slate-800">
        {guideline.title || `Guideline ${index + 1}`}
      </legend>

      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-4">
          <Field id={id('category')} label="Category">
            <select id={id('category')} className={inputClass} value={guideline.category} onChange={update('category')} required>
              {GUIDELINE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{formatEnum(category)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="md:col-span-5">
          <Field id={id('title')} label="Title">
            <input id={id('title')} className={inputClass} value={guideline.title} onChange={update('title')} required maxLength={160} />
          </Field>
        </div>

        <div className="md:col-span-3">
          <Field id={id('severity')} label="Severity">
            <select id={id('severity')} className={inputClass} value={guideline.severity} onChange={update('severity')}>
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>{formatEnum(severity)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="md:col-span-12">
          <Field id={id('description')} label="Description">
            <textarea id={id('description')} rows={2} className={inputClass} value={guideline.description} onChange={update('description')} />
          </Field>
        </div>

        <div className="md:col-span-12">
          <Field id={id('rule')} label="Rule">
            <textarea id={id('rule')} rows={2} className={inputClass} value={guideline.rule} onChange={update('rule')} />
          </Field>
        </div>

        <div className="md:col-span-8">
          <Field id={id('examples')} label="Examples">
            <textarea id={id('examples')} rows={2} className={inputClass} value={guideline.examples} onChange={update('examples')} />
          </Field>
        </div>

        <div className="flex flex-col justify-center gap-3 md:col-span-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={guideline.active}
              onChange={(event) => onChange(index, 'active', event.target.checked)}
            />
            Active in AI checks
          </label>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="self-start text-sm font-medium text-rose-600 hover:text-rose-700 focus:outline-none focus-visible:underline"
          >
            Remove guideline
          </button>
        </div>
      </div>
    </fieldset>
  );
}

function ProfileCard({ profile, selected, onEdit, onToggleActive }) {
  const isInactive = profile.isActive === false;
  const guidelines = profile.guidelines || [];

  return (
    <Card className={cx('h-full', selected && 'ring-2 ring-indigo-500')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{profile.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{profile.description}</p>
        </div>
        <Badge tone={isInactive ? 'neutral' : 'success'}>{isInactive ? 'Inactive' : 'Active'}</Badge>
      </div>

      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="mb-1.5 text-xs font-medium text-slate-500">Tone of voice</dt>
          <dd className="text-slate-800">{profile.toneOfVoice}</dd>
        </div>
        <div>
          <dt className="mb-1.5 text-xs font-medium text-slate-500">Preferred terminology</dt>
          <dd><TermChips terms={profile.preferredTerminology} tone="success" /></dd>
        </div>
        <div>
          <dt className="mb-1.5 text-xs font-medium text-slate-500">Terms requiring review</dt>
          <dd><TermChips terms={profile.termsRequiringReview} tone="warning" /></dd>
        </div>
        <div>
          <dt className="mb-1.5 text-xs font-medium text-slate-500">Official guidelines</dt>
          <dd>
            {guidelines.length === 0 ? (
              <span className="text-slate-400">—</span>
            ) : (
              <ul className="space-y-1.5">
                {guidelines.map((g) => (
                  <li key={g._id || g.title} className="flex flex-wrap items-center gap-2">
                    <span className={cx('font-medium', g.active ? 'text-slate-800' : 'text-slate-400 line-through')}>{g.title}</span>
                    <Badge tone="neutral">{formatEnum(g.category)}</Badge>
                    {g.severity && <Badge tone={SEVERITY_TONES[g.severity] || 'neutral'}>{formatEnum(g.severity)}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Version {profile.version || '1.0'}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(profile)}>Edit</Button>
          <Button size="sm" variant={isInactive ? 'primary' : 'danger'} onClick={() => onToggleActive(profile)}>
            {isInactive ? 'Activate' : 'Deactivate'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Page ---------- */

export default function BrandProfile() {
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  /* ----- Data loading ----- */

  const fetchProfiles = useCallback(async (selectedProfileId) => {
    try {
      const { data: loaded } = await api.get('/brand-profiles');
      setProfiles(loaded);

      const selected =
        loaded.find((p) => p._id === selectedProfileId) ||
        loaded.find((p) => p.isActive !== false) ||
        loaded[0];

      if (selected) {
        setEditingId(selected._id);
        setForm(profileToForm(selected));
      } else {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load brand profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  /* ----- Form handlers ----- */

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleGuidelineChange = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      guidelines: previous.guidelines.map((g, i) => (i === index ? { ...g, [field]: value } : g)),
    }));
  };

  const addGuideline = () => {
    setForm((previous) => ({
      ...previous,
      guidelines: [...previous.guidelines, { ...EMPTY_GUIDELINE }],
    }));
  };

  const removeGuideline = (index) => {
    setForm((previous) => ({
      ...previous,
      guidelines: previous.guidelines.filter((_, i) => i !== index),
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleCreateAnother = () => {
    resetForm();
    clearMessages();
  };

  const handleEdit = (profile) => {
    setEditingId(profile._id);
    setForm(profileToForm(profile));
    clearMessages();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ----- API actions ----- */

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearMessages();

    const toneOfVoice = (form.toneOfVoice === 'custom' ? form.customTone : form.toneOfVoice).trim();
    if (!form.name.trim() || !form.description.trim() || !toneOfVoice) {
      setError('Brand name, description, and tone of voice are required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      toneOfVoice,
      preferredTerminology: parseTerms(form.preferredTerminology),
      termsRequiringReview: parseTerms(form.termsRequiringReview),
      guidelines: form.guidelines,
    };

    setSaving(true);
    try {
      const response = editingId
        ? await api.put(`/brand-profiles/${editingId}`, payload)
        : await api.post('/brand-profiles', payload);

      setNotice('Brand profile saved successfully.');
      await fetchProfiles(response.data._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the brand profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleActiveToggle = async (profile) => {
    clearMessages();
    const wasInactive = profile.isActive === false;

    try {
      if (wasInactive) {
        await api.put(`/brand-profiles/${profile._id}`, { isActive: true });
      } else {
        await api.delete(`/brand-profiles/${profile._id}`);
      }
      setNotice(`Brand profile ${wasInactive ? 'activated' : 'deactivated'}.`);
      await fetchProfiles(wasInactive ? profile._id : undefined);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the brand profile status.');
    }
  };

  /* ----- Render ----- */

  return (
    <MainLayout>
      <PageHeader
        title="Brand profile"
        description="Manage your official brand guidelines. Every AI check runs against the active profile."
        actions={
          editingId && (
            <Button variant="secondary" onClick={handleCreateAnother}>New profile</Button>
          )
        }
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        {/* Form */}
        <Card title={editingId ? 'Edit brand profile' : 'Create brand profile'}>
          <form onSubmit={handleSubmit} className="space-y-8">
            <FormSection title="Basics" description="Who the brand is and how it should sound.">
              <div className="grid gap-4 lg:grid-cols-2">
                <Field id="brand-name" label="Brand name">
                  <input id="brand-name" name="name" className={inputClass} value={form.name} onChange={handleChange} required maxLength={120} />
                </Field>

                <Field id="brand-tone" label="Preferred tone of voice">
                  <select id="brand-tone" name="toneOfVoice" className={inputClass} value={form.toneOfVoice} onChange={handleChange} required>
                    <option value="">Select a tone...</option>
                    {TONE_OPTIONS.map((tone) => (
                      <option key={tone} value={tone}>{tone}</option>
                    ))}
                    <option value="custom">Custom tone...</option>
                  </select>
                  {form.toneOfVoice === 'custom' && (
                    <input
                      name="customTone"
                      className={cx(inputClass, 'mt-2')}
                      value={form.customTone}
                      onChange={handleChange}
                      placeholder="Enter a custom tone"
                      aria-label="Custom tone of voice"
                      required
                    />
                  )}
                </Field>

                <div className="lg:col-span-2">
                  <Field id="brand-description" label="Brand description">
                    <textarea id="brand-description" name="description" rows={3} className={inputClass} value={form.description} onChange={handleChange} required maxLength={2000} />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title="Language rules" description="Wording the AI should encourage or flag.">
              <div className="grid gap-4 lg:grid-cols-2">
                <Field id="preferred-terminology" label="Preferred terminology" hint={TERMINOLOGY_HELP}>
                  <textarea
                    id="preferred-terminology"
                    name="preferredTerminology"
                    rows={3}
                    className={inputClass}
                    value={form.preferredTerminology}
                    onChange={handleChange}
                    placeholder="customers, designed to help, evidence-based"
                  />
                </Field>
                <Field id="review-terms" label="Terms requiring review" hint={REVIEW_TERMS_HELP}>
                  <textarea
                    id="review-terms"
                    name="termsRequiringReview"
                    rows={3}
                    className={inputClass}
                    value={form.termsRequiringReview}
                    onChange={handleChange}
                    placeholder="guarantees, 100% success, cheapest, risk-free"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              title="Official brand guidelines"
              description="Active rules are included with this profile during every advertisement AI check."
              actions={<Button size="sm" variant="secondary" onClick={addGuideline}>Add guideline</Button>}
            >
              {form.guidelines.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No additional rules. Tone and terminology above are still included in AI checks.
                </div>
              ) : (
                <div className="space-y-4">
                  {form.guidelines.map((guideline, index) => (
                    <GuidelineEditor
                      key={guideline._id || `new-${index}`}
                      guideline={guideline}
                      index={index}
                      onChange={handleGuidelineChange}
                      onRemove={removeGuideline}
                    />
                  ))}
                </div>
              )}
            </FormSection>

            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update brand profile' : 'Save brand profile'}
              </Button>
              {editingId && (
                <Button variant="secondary" onClick={resetForm}>Cancel</Button>
              )}
            </div>
          </form>
        </Card>

        {/* Saved profiles */}
        <section aria-labelledby="saved-profiles-heading">
          <h2 id="saved-profiles-heading" className="mb-4 text-lg font-semibold text-slate-900">
            Saved brand profiles
          </h2>

          {loading ? (
            <p className="text-sm text-slate-500">Loading brand profiles...</p>
          ) : profiles.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                title="No brand profiles yet"
                description="Save your first profile above so ads can be checked against it."
              />
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile._id}
                  profile={profile}
                  selected={profile._id === editingId}
                  onEdit={handleEdit}
                  onToggleActive={handleActiveToggle}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}