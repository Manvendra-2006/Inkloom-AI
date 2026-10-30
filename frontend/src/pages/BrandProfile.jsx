// frontend/src/pages/BrandProfile.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';
import {
  Alert,
  Badge,
  Button,
  cx,
  EmptyState,
  Field,
  inputClass,
  PageHeader,
  Skeleton,
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

// What each part of a profile does during an AI check
const HOW_IT_WORKS = [
  { dot: 'bg-indigo-500', title: 'Tone of voice', text: 'Included in every AI check.' },
  { dot: 'bg-emerald-500', title: 'Preferred terminology', text: 'Wording the AI encourages.' },
  { dot: 'bg-amber-500', title: 'Terms requiring review', text: 'Wording that triggers AI review.' },
  { dot: 'bg-violet-500', title: 'Official guidelines', text: 'Active rules are added to each check.' },
];

const ICON_PATHS = {
  profiles: 'M4 6h16M4 12h16M4 18h10',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  rules: 'M5 13l4 4L19 7',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
};

/* ---------- Helpers ---------- */

const formatEnum = (value) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

const toCommaSeparated = (terms) => (Array.isArray(terms) ? terms.join(', ') : '');

const countOf = (list) => (Array.isArray(list) ? list.length : 0);

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

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// Card with a small label above the title, like the dashboard panels
function Panel({ eyebrow, title, description, actions, className, children }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p>
          )}
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SummaryTile({ icon, iconClass, label, value, caption, loading }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconClass)}>
          <Icon name={icon} />
        </span>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-9 w-12" />
        ) : (
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

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

function GuidelineEditor({ guideline, index, onChange, onRemove }) {
  const id = (field) => `guideline-${field}-${index}`;
  const update = (field) => (event) => onChange(index, field, event.target.value);

  return (
    <fieldset className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <legend className="px-2 text-sm font-medium text-slate-800">
        {guideline.title || `Guideline ${index + 1}`}
      </legend>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <Field id={id('category')} label="Category">
            <select id={id('category')} className={inputClass} value={guideline.category} onChange={update('category')} required>
              {GUIDELINE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{formatEnum(category)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="xl:col-span-5">
          <Field id={id('title')} label="Title">
            <input id={id('title')} className={inputClass} value={guideline.title} onChange={update('title')} required maxLength={160} />
          </Field>
        </div>

        <div className="xl:col-span-3">
          <Field id={id('severity')} label="Severity">
            <select id={id('severity')} className={inputClass} value={guideline.severity} onChange={update('severity')}>
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>{formatEnum(severity)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="xl:col-span-12">
          <Field id={id('description')} label="Description">
            <textarea id={id('description')} rows={2} className={inputClass} value={guideline.description} onChange={update('description')} />
          </Field>
        </div>

        <div className="xl:col-span-12">
          <Field id={id('rule')} label="Rule">
            <textarea id={id('rule')} rows={2} className={inputClass} value={guideline.rule} onChange={update('rule')} />
          </Field>
        </div>

        <div className="xl:col-span-8">
          <Field id={id('examples')} label="Examples">
            <textarea id={id('examples')} rows={2} className={inputClass} value={guideline.examples} onChange={update('examples')} />
          </Field>
        </div>

        <div className="flex flex-col justify-center gap-3 xl:col-span-4">
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

// One saved profile in the side list. Clicking the row opens it in the editor.
function ProfileListItem({ profile, selected, onEdit, onToggleActive }) {
  const isInactive = profile.isActive === false;
  const activeGuidelines = (profile.guidelines || []).filter((g) => g.active !== false).length;

  return (
    <li
      className={cx(
        'rounded-lg border p-3 transition',
        selected ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-300'
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(profile)}
        aria-current={selected ? 'true' : undefined}
        className="block w-full rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{profile.name}</p>
          <Badge tone={isInactive ? 'neutral' : 'success'}>{isInactive ? 'Inactive' : 'Active'}</Badge>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {profile.toneOfVoice} · v{profile.version || '1.0'}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {activeGuidelines} {activeGuidelines === 1 ? 'guideline' : 'guidelines'} ·{' '}
          {countOf(profile.preferredTerminology)} preferred · {countOf(profile.termsRequiringReview)} for review
        </p>
      </button>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant={isInactive ? 'primary' : 'secondary'} onClick={() => onToggleActive(profile)}>
          {isInactive ? 'Activate' : 'Deactivate'}
        </Button>
      </div>
    </li>
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

  // Totals across active profiles, for the summary tiles
  const summary = useMemo(() => {
    const active = profiles.filter((p) => p.isActive !== false);
    return {
      total: profiles.length,
      active: active.length,
      guidelines: active.reduce(
        (sum, p) => sum + (p.guidelines || []).filter((g) => g.active !== false).length,
        0
      ),
      flaggedTerms: active.reduce((sum, p) => sum + countOf(p.termsRequiringReview), 0),
    };
  }, [profiles]);

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

        {/* Summary */}
        <section aria-label="Brand profile summary" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SummaryTile
            icon="profiles"
            iconClass="bg-indigo-50 text-indigo-600"
            label="Profiles"
            value={summary.total}
            caption="Saved in total"
            loading={loading}
          />
          <SummaryTile
            icon="shield"
            iconClass="bg-emerald-50 text-emerald-600"
            label="Active profiles"
            value={summary.active}
            caption="Used by AI checks"
            loading={loading}
          />
          <SummaryTile
            icon="rules"
            iconClass="bg-violet-50 text-violet-600"
            label="Active guidelines"
            value={summary.guidelines}
            caption="Across active profiles"
            loading={loading}
          />
          <SummaryTile
            icon="flag"
            iconClass="bg-amber-50 text-amber-600"
            label="Terms for review"
            value={summary.flaggedTerms}
            caption="Wording that triggers review"
            loading={loading}
          />
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* Editor */}
          <Panel
            eyebrow="Profile editor"
            title={editingId ? 'Edit brand profile' : 'Create brand profile'}
            description="Changes apply to every new AI check that uses this profile."
            className="lg:col-span-2"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              <FormSection title="Basics" description="Who the brand is and how it should sound.">
                <div className="grid gap-4 xl:grid-cols-2">
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

                  <div className="xl:col-span-2">
                    <Field id="brand-description" label="Brand description">
                      <textarea id="brand-description" name="description" rows={3} className={inputClass} value={form.description} onChange={handleChange} required maxLength={2000} />
                    </Field>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Language rules" description="Wording the AI should encourage or flag.">
                <div className="grid gap-4 xl:grid-cols-2">
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
          </Panel>

          {/* Side column */}
          <div className="space-y-6">
            <Panel eyebrow="Library" title="Saved profiles" description="Select a profile to edit it.">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : profiles.length === 0 ? (
                <EmptyState
                  title="No brand profiles yet"
                  description="Save your first profile so ads can be checked against it."
                />
              ) : (
                <ul className="space-y-3">
                  {profiles.map((profile) => (
                    <ProfileListItem
                      key={profile._id}
                      profile={profile}
                      selected={profile._id === editingId}
                      onEdit={handleEdit}
                      onToggleActive={handleActiveToggle}
                    />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel eyebrow="Guide" title="How checks use a profile">
              <ul className="space-y-4">
                {HOW_IT_WORKS.map(({ dot, title, text }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{title}</p>
                      <p className="text-sm text-slate-500">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}