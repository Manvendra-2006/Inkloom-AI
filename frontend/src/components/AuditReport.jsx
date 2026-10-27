import React from 'react';

const HUMAN_REVIEW_MESSAGE =
  'These findings support a review. They do not replace human judgment, verification of evidence or legal review.';

function formatAiStatus(status) {
  if (!status) return 'Not checked';
  if (status === 'no_flags') return 'Clean';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatSources(finding) {
  const sourceNames = {
    ai: 'AI',
    ai_review: 'AI',
    rule: 'Rule',
    rule_based: 'Rule',
    brand_custom: 'Brand Custom',
  };
  const sources = Array.isArray(finding.sources)
    ? finding.sources
    : Array.isArray(finding.source)
      ? finding.source
      : [finding.source || 'ai'];

  return [...new Set(sources.map((source) => sourceNames[source] || source))]
    .join(', ');
}

export default function AuditReport({ report, aiStatus, advertisementTitle }) {
  if (!report) return null;

  const result = report.rawResult || report;
  const guideline = report.brandGuidelineSnapshot
    || result.brand_guideline
    || report.brandGuideline
    || {};
  const findings = Array.isArray(result.combined_findings)
    ? result.combined_findings
    : [];
  const status = aiStatus || result.aiStatus || result.status;
  const findingCount = Number.isInteger(result.finding_count)
    ? result.finding_count
    : findings.length;
  const toneOfVoice = guideline.toneOfVoice || guideline.tone_of_voice;
  const preferredTerminology = guideline.preferredTerminology
    || guideline.preferred_terminology
    || [];
  const termsRequiringReview = guideline.termsRequiringReview
    || guideline.terms_requiring_review
    || [];
  const officialGuidelines = Array.isArray(guideline.guidelines)
    ? guideline.guidelines
    : [];

  return (
    <section id="ai-audit-report" className="mt-4" aria-label="AI audit report">
      <h3 className="h5 mb-3">AI Audit Report</h3>
      <div className="card bg-light">
        <div className="card-body">
          {advertisementTitle && <p className="mb-2"><strong>Advertisement:</strong> {advertisementTitle}</p>}
          <p className="mb-2"><strong>AI Status:</strong> {formatAiStatus(status)}</p>
          <p className="mb-2"><strong>{findingCount} potential findings</strong></p>
          <p className="mb-2">
            <strong>Human Review:</strong>{' '}
            {result.human_review_required ? 'Required' : 'Not required'}
          </p>
          <p className="mb-2"><strong>Brand:</strong> {guideline.name || result.brand_name || '—'}</p>
          {guideline.version && (
            <p className="mb-2"><strong>Brand Guideline Version:</strong> {guideline.version}</p>
          )}
          {guideline.description && (
            <p className="mb-2"><strong>Brand Description:</strong> {guideline.description}</p>
          )}
          {toneOfVoice && <p className="mb-2"><strong>Tone of Voice:</strong> {toneOfVoice}</p>}
          {preferredTerminology.length > 0 && (
            <p className="mb-2"><strong>Preferred Terminology:</strong> {preferredTerminology.join(', ')}</p>
          )}
          {termsRequiringReview.length > 0 && (
            <p className="mb-2"><strong>Guideline Terms:</strong> {termsRequiringReview.join(', ')}</p>
          )}
          {officialGuidelines.length > 0 && (
            <div className="mb-3">
              <strong>Official Brand Guidelines:</strong>
              <ul className="list-group mt-2">
                {officialGuidelines.map((item) => (
                  <li
                    className="list-group-item"
                    key={item.id || item.guideline_id || item.title}
                  >
                    <strong>{item.title}</strong>
                    {item.active === false && ' (inactive)'}
                    {item.rule && ` — ${item.rule}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.human_review_required && (
            <div className="alert alert-info mb-0">{HUMAN_REVIEW_MESSAGE}</div>
          )}
        </div>
      </div>

      <h4 className="h5 mt-4 mb-3">Findings</h4>
      {findings.length === 0 ? (
        <p className="text-secondary">No findings.</p>
      ) : (
        <div>
          {findings.map((finding, index) => {
            const mappingStatus = finding.mapping_status
              || (finding.guideline_id ? 'mapped' : 'unmapped');
            const matchedText = finding.matched_text || finding.matchedText;
            return (
              <article
                key={`${finding.guideline_id || 'finding'}-${index}`}
                className={`card ${index > 0 ? 'mt-3' : ''}`}
              >
                <div className="card-body">
                  <h5 className="card-title">
                    {finding.guideline_id || 'AI-detected issue'}
                  </h5>
                  <p className="mb-1">
                    <strong>Source:</strong> {formatSources(finding)}
                  </p>
                  <p className="mb-1">
                    <strong>Mapping:</strong>{' '}
                    {mappingStatus === 'mapped' ? 'Mapped' : 'Unmapped'}
                  </p>
                  <p className="mb-1"><strong>Category:</strong> {finding.category || '—'}</p>
                  <p className="mb-1">
                    <strong>Severity:</strong>{' '}
                    {finding.severity ? finding.severity.toUpperCase() : '—'}
                  </p>
                  <p className="mb-1">
                    <strong>Matched wording:</strong>{' '}
                    <span className="font-monospace">{matchedText || '—'}</span>
                  </p>
                  <p className="mb-0">
                    <strong>Reason:</strong>{' '}
                    {finding.reason || finding.explanation || finding.issue || '—'}
                  </p>
                  {(finding.suggested_correction || finding.suggestedCorrection) && (
                    <p className="mb-0 mt-2">
                      <strong>Suggested correction:</strong>{' '}
                      {finding.suggested_correction || finding.suggestedCorrection}
                    </p>
                  )}
                  {mappingStatus !== 'mapped' && (
                    <p className="alert alert-warning mt-3 mb-0 py-2">
                      No matching configured guideline.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
