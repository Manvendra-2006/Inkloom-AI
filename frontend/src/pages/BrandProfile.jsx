import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

const TONE_OPTIONS = [
  'Professional and trustworthy',
  'Friendly and approachable',
  'Bold and confident',
  'Simple and clear',
  'Premium and elegant',
  'Technical and informative',
];

const EMPTY_FORM = {
  name: '',
  description: '',
  toneOfVoice: '',
  customTone: '',
  preferredTerminology: '',
  termsRequiringReview: '',
  guidelines: [],
};

function toCommaSeparated(terms) {
  return Array.isArray(terms) ? terms.join(', ') : '';
}

function parseTerms(value) {
  const uniqueTerms = new Map();
  value
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
    .forEach((term) => {
      const key = term.toLocaleLowerCase();
      if (!uniqueTerms.has(key)) uniqueTerms.set(key, term);
    });
  return Array.from(uniqueTerms.values());
}

function toGuidelines(guidelines) {
  return Array.isArray(guidelines) ? guidelines.map((guideline) => ({
    _id: guideline._id,
    category: guideline.category || 'CLAIMS',
    title: guideline.title || '',
    description: guideline.description || '',
    rule: guideline.rule || '',
    examples: guideline.examples || '',
    severity: guideline.severity || 'MEDIUM',
    active: guideline.active !== false,
  })) : [];
}

export default function BrandProfile() {
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchProfiles = async (selectedProfileId) => {
    try {
      const response = await api.get('/brand-profiles');
      const loadedProfiles = response.data;
      setProfiles(loadedProfiles);
      const selectedProfile = loadedProfiles.find(
        (profile) => profile._id === selectedProfileId
      ) || loadedProfiles.find((profile) => profile.isActive !== false) || loadedProfiles[0];
      if (selectedProfile) {
        const toneIsListed = TONE_OPTIONS.includes(selectedProfile.toneOfVoice);
        setEditingId(selectedProfile._id);
        setForm({
          name: selectedProfile.name || '',
          description: selectedProfile.description || '',
          toneOfVoice: toneIsListed ? selectedProfile.toneOfVoice : 'custom',
          customTone: toneIsListed ? '' : selectedProfile.toneOfVoice || '',
          preferredTerminology: toCommaSeparated(selectedProfile.preferredTerminology),
          termsRequiringReview: toCommaSeparated(selectedProfile.termsRequiringReview),
          guidelines: toGuidelines(selectedProfile.guidelines),
        });
      } else {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load brand profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleGuidelineChange = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      guidelines: previous.guidelines.map((guideline, guidelineIndex) => (
        guidelineIndex === index
          ? { ...guideline, [field]: value }
          : guideline
      )),
    }));
  };

  const addGuideline = () => {
    setForm((previous) => ({
      ...previous,
      guidelines: [
        ...previous.guidelines,
        {
          category: 'CLAIMS',
          title: '',
          description: '',
          rule: '',
          examples: '',
          severity: 'MEDIUM',
          active: true,
        },
      ],
    }));
  };

  const removeGuideline = (index) => {
    setForm((previous) => ({
      ...previous,
      guidelines: previous.guidelines.filter((_, guidelineIndex) => guidelineIndex !== index),
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleEdit = (profile) => {
    const toneIsListed = TONE_OPTIONS.includes(profile.toneOfVoice);
    setEditingId(profile._id);
    setForm({
      name: profile.name || '',
      description: profile.description || '',
      toneOfVoice: toneIsListed ? profile.toneOfVoice : 'custom',
      customTone: toneIsListed ? '' : profile.toneOfVoice || '',
      preferredTerminology: toCommaSeparated(profile.preferredTerminology),
      termsRequiringReview: toCommaSeparated(profile.termsRequiringReview),
      guidelines: toGuidelines(profile.guidelines),
    });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

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
      let savedProfile;
      if (editingId) {
        const response = await api.put(`/brand-profiles/${editingId}`, payload);
        savedProfile = response.data;
      } else {
        const response = await api.post('/brand-profiles', payload);
        savedProfile = response.data;
      }
      setNotice('Brand profile saved successfully.');
      await fetchProfiles(savedProfile._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the brand profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleActiveToggle = async (profile) => {
    setError('');
    setNotice('');
    try {
      if (profile.isActive === false) {
        await api.put(`/brand-profiles/${profile._id}`, { isActive: true });
      } else {
        await api.delete(`/brand-profiles/${profile._id}`);
      }
      setNotice(`Brand profile ${profile.isActive === false ? 'activated' : 'deactivated'}.`);
      await fetchProfiles(profile.isActive === false ? profile._id : undefined);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the brand profile status.');
    }
  };

  return (
    <MainLayout>
      <div className="container-fluid py-3 brand-profile-page">
        <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <h1 className="h2 mb-1">Brand Profile</h1>
            <p className="mb-0 text-secondary">Manage your official brand guidelines.</p>
          </div>
          {editingId && (
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => {
                resetForm();
                setError('');
                setNotice('');
              }}
            >
              Create another profile
            </button>
          )}
        </header>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}

        <section className="card shadow-sm mb-5">
          <div className="card-body p-4">
            <h2 className="h4 mb-4">{editingId ? 'Edit Brand Profile' : 'Create Brand Profile'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-12 col-lg-6">
                  <label htmlFor="brand-name" className="form-label">Brand name</label>
                  <input
                    id="brand-name"
                    name="name"
                    className="form-control"
                    value={form.name}
                    onChange={handleChange}
                    required
                    maxLength={120}
                  />
                </div>
                <div className="col-12 col-lg-6">
                  <label htmlFor="brand-tone" className="form-label">Preferred tone of voice</label>
                  <select
                    id="brand-tone"
                    name="toneOfVoice"
                    className="form-select"
                    value={form.toneOfVoice}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a tone...</option>
                    {TONE_OPTIONS.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                    <option value="custom">Custom tone...</option>
                  </select>
                  {form.toneOfVoice === 'custom' && (
                    <input
                      name="customTone"
                      className="form-control mt-2"
                      value={form.customTone}
                      onChange={handleChange}
                      placeholder="Enter a custom tone"
                      aria-label="Custom tone of voice"
                      required
                    />
                  )}
                </div>
                <div className="col-12">
                  <label htmlFor="brand-description" className="form-label">Brand description</label>
                  <textarea
                    id="brand-description"
                    name="description"
                    className="form-control"
                    rows="3"
                    value={form.description}
                    onChange={handleChange}
                    required
                    maxLength={2000}
                  />
                </div>
                <div className="col-12 col-lg-6">
                  <label htmlFor="preferred-terminology" className="form-label">
                    Preferred terminology
                    <span
                      className="badge rounded-pill text-bg-secondary ms-2"
                      title="Enter words or phrases your brand prefers to use. Separate multiple terms with commas."
                      aria-label="Enter words or phrases your brand prefers to use. Separate multiple terms with commas."
                      tabIndex="0"
                    >
                      ?
                    </span>
                  </label>
                  <textarea
                    id="preferred-terminology"
                    name="preferredTerminology"
                    className="form-control"
                    rows="3"
                    value={form.preferredTerminology}
                    onChange={handleChange}
                    placeholder="customers, designed to help, evidence-based"
                  />
                  <div className="form-text">
                    Enter words or phrases your brand prefers to use. Separate multiple terms with commas.
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <label htmlFor="review-terms" className="form-label">
                    Terms requiring review
                    <span
                      className="badge rounded-pill text-bg-secondary ms-2"
                      title="Enter words or phrases that should trigger AI review. Separate multiple terms with commas."
                      aria-label="Enter words or phrases that should trigger AI review. Separate multiple terms with commas."
                      tabIndex="0"
                    >
                      ?
                    </span>
                  </label>
                  <textarea
                    id="review-terms"
                    name="termsRequiringReview"
                    className="form-control"
                    rows="3"
                    value={form.termsRequiringReview}
                    onChange={handleChange}
                    placeholder="guarantees, 100% success, cheapest, risk-free"
                  />
                  <div className="form-text">
                    Enter words or phrases that should trigger AI review. Separate multiple terms with commas.
                  </div>
                </div>
                <div className="col-12">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                      <h3 className="h5 mb-1">Official brand guidelines</h3>
                      <p className="form-text mb-0">
                        Active rules are included with this profile during every advertisement AI check.
                      </p>
                    </div>
                    <button className="btn btn-outline-primary" type="button" onClick={addGuideline}>
                      Add guideline
                    </button>
                  </div>
                  {form.guidelines.length === 0 ? (
                    <div className="alert alert-secondary mb-0">
                      No additional rules. Tone and terminology above are still included in AI checks.
                    </div>
                  ) : (
                    <div className="d-grid gap-3">
                      {form.guidelines.map((guideline, index) => (
                        <fieldset className="border rounded p-3" key={guideline._id || `new-${index}`}>
                          <legend className="float-none w-auto px-2 fs-6">
                            {guideline.title || `Guideline ${index + 1}`}
                          </legend>
                          <div className="row g-3">
                            <div className="col-12 col-md-4">
                              <label className="form-label" htmlFor={`guideline-category-${index}`}>
                                Category
                              </label>
                              <select
                                id={`guideline-category-${index}`}
                                className="form-select"
                                value={guideline.category}
                                onChange={(event) => handleGuidelineChange(index, 'category', event.target.value)}
                                required
                              >
                                {[
                                  'TONE',
                                  'TERMINOLOGY',
                                  'FACTS',
                                  'CLAIMS',
                                  'MESSAGING',
                                  'RESTRICTED_WORDS',
                                  'BRANDING',
                                  'ACCESSIBILITY',
                                ].map((category) => <option key={category} value={category}>{category}</option>)}
                              </select>
                            </div>
                            <div className="col-12 col-md-5">
                              <label className="form-label" htmlFor={`guideline-title-${index}`}>Title</label>
                              <input
                                id={`guideline-title-${index}`}
                                className="form-control"
                                value={guideline.title}
                                onChange={(event) => handleGuidelineChange(index, 'title', event.target.value)}
                                required
                                maxLength={160}
                              />
                            </div>
                            <div className="col-12 col-md-3">
                              <label className="form-label" htmlFor={`guideline-severity-${index}`}>
                                Severity
                              </label>
                              <select
                                id={`guideline-severity-${index}`}
                                className="form-select"
                                value={guideline.severity}
                                onChange={(event) => handleGuidelineChange(index, 'severity', event.target.value)}
                              >
                                {['LOW', 'MEDIUM', 'HIGH'].map((severity) => (
                                  <option key={severity} value={severity}>{severity}</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-12">
                              <label className="form-label" htmlFor={`guideline-description-${index}`}>
                                Description
                              </label>
                              <textarea
                                id={`guideline-description-${index}`}
                                className="form-control"
                                rows="2"
                                value={guideline.description}
                                onChange={(event) => handleGuidelineChange(index, 'description', event.target.value)}
                              />
                            </div>
                            <div className="col-12">
                              <label className="form-label" htmlFor={`guideline-rule-${index}`}>Rule</label>
                              <textarea
                                id={`guideline-rule-${index}`}
                                className="form-control"
                                rows="2"
                                value={guideline.rule}
                                onChange={(event) => handleGuidelineChange(index, 'rule', event.target.value)}
                              />
                            </div>
                            <div className="col-12 col-md-8">
                              <label className="form-label" htmlFor={`guideline-examples-${index}`}>
                                Examples
                              </label>
                              <textarea
                                id={`guideline-examples-${index}`}
                                className="form-control"
                                rows="2"
                                value={guideline.examples}
                                onChange={(event) => handleGuidelineChange(index, 'examples', event.target.value)}
                              />
                            </div>
                            <div className="col-12 col-md-4 d-flex flex-column justify-content-center gap-3">
                              <div className="form-check">
                                <input
                                  id={`guideline-active-${index}`}
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={guideline.active}
                                  onChange={(event) => handleGuidelineChange(index, 'active', event.target.checked)}
                                />
                                <label className="form-check-label" htmlFor={`guideline-active-${index}`}>
                                  Active in AI checks
                                </label>
                              </div>
                              <button
                                className="btn btn-outline-danger align-self-start"
                                type="button"
                                onClick={() => removeGuideline(index)}
                              >
                                Remove guideline
                              </button>
                            </div>
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-12 d-flex gap-2">
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Update brand profile' : 'Save brand profile'}
                  </button>
                  {editingId && (
                    <button className="btn btn-outline-secondary" type="button" onClick={resetForm}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </section>

        <section aria-labelledby="saved-profiles-heading">
          <h2 className="h4 mb-3" id="saved-profiles-heading">Saved Brand Profiles</h2>
          {loading ? (
            <p>Loading brand profiles...</p>
          ) : profiles.length === 0 ? (
            <div className="alert alert-info">No brand profiles have been saved yet.</div>
          ) : (
            <div className="row g-3">
              {profiles.map((profile) => (
                <div className="col-12 col-xl-6" key={profile._id}>
                  <article className="card h-100 shadow-sm">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start gap-3">
                        <div>
                          <h3 className="h5 mb-1">{profile.name}</h3>
                          <p className="text-secondary mb-3">{profile.description}</p>
                        </div>
                        <span className={`badge ${profile.isActive === false ? 'text-bg-secondary' : 'text-bg-success'}`}>
                          {profile.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </div>
                      <dl className="row mb-3">
                        <dt className="col-sm-4">Tone</dt>
                        <dd className="col-sm-8">{profile.toneOfVoice}</dd>
                        <dt className="col-sm-4">Preferred terminology</dt>
                        <dd className="col-sm-8">{toCommaSeparated(profile.preferredTerminology) || '—'}</dd>
                        <dt className="col-sm-4">Terms for review</dt>
                        <dd className="col-sm-8">{toCommaSeparated(profile.termsRequiringReview) || '—'}</dd>
                        <dt className="col-sm-4">Official guidelines</dt>
                        <dd className="col-sm-8">
                          {(profile.guidelines || []).length
                            ? profile.guidelines.map((guideline) => (
                              <div key={guideline._id}>
                                <strong>{guideline.title}</strong>
                                {' · '}
                                {guideline.category}
                                {' · '}
                                {guideline.active ? 'Active' : 'Inactive'}
                              </div>
                            ))
                            : '—'}
                        </dd>
                        <dt className="col-sm-4">Version</dt>
                        <dd className="col-sm-8">{profile.version || '1.0'}</dd>
                      </dl>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => handleEdit(profile)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${profile.isActive === false ? 'btn-outline-success' : 'btn-outline-danger'}`}
                          onClick={() => handleActiveToggle(profile)}
                        >
                          {profile.isActive === false ? 'Activate' : 'Deactivate'}
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
