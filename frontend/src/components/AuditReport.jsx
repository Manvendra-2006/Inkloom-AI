import React from 'react';
import { AiBadge, Badge, Card } from './ui';

const HUMAN_REVIEW_MESSAGE =
  'These findings support a review. They do not replace human judgment, verification of evidence or legal review.';

const SOURCE_NAMES = {
  ai: 'AI',
  ai_review: 'AI',
  rule: 'Rule',
  rule_based: 'Rule',
  brand_custom: 'Brand custom',
};

const SEVERITY_TONES = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const toArray = (value) => (Array.isArray(value) ? value : []);

function normalizeReport(report, aiStatus) {
  const result = report.rawResult || report;
  const guideline =
    report.brandGuidelineSnapshot || result.brand_guideline || report.brandGuideline || {};
  const findings = toArray(result.combined_findings || report.issues || result.findings);

  return {
    humanReviewRequired: Boolean(result.human_review_required),
    status: aiStatus || report.aiStatus || result.aiStatus || result.status || report.status,
    findings,
    findingCount: Number.isInteger(result.finding_count)
      ? result.finding_count
      : Number.isInteger(report.finding_count) ? report.finding_count : findings.length,
    brand: {
      name: guideline.name || result.brand_name,
      version: guideline.version,
      description: guideline.description,
      toneOfVoice: guideline.toneOfVoice || guideline.tone_of_voice,
      preferredTerminology: guideline.preferredTerminology || guideline.preferred_terminology || [],
      termsRequiringReview: guideline.termsRequiringReview || guideline.terms_requiring_review || [],
      guidelines: toArray(guideline.guidelines),
    },
  };
}

function Sources({ finding }) {
  const sources = Array.isArray(finding.sources)
    ? finding.sources
    : Array.isArray(finding.source) ? finding.source : [finding.source || 'ai'];
  const names = [...new Set(sources.map((source) => SOURCE_NAMES[source] || source))];
  return <span>{names.join(', ') || 'AI'}</span>;
}

function SeverityBadge({ severity }) {
  if (!severity) return <span className="text-slate-400">—</span>;
  const level = String(severity).toLowerCase();
  return <Badge tone={SEVERITY_TONES[level] || 'neutral'}>{level.toUpperCase()}</Badge>;
}

function OfficialGuidelines({ guidelines }) {
  if (guidelines.length === 0) return null;

  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold text-slate-900">Official brand guidelines</h4>
      <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {guidelines.map((item) => (
          <li className="p-3 text-sm" key={item.id || item.guideline_id || item.title}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{item.title || item.category}</span>
              {item.category && <span className="text-xs text-slate-500">{item.category}</span>}
              {item.active === false && <Badge tone="neutral">Inactive</Badge>}
            </div>
            {item.description && <p className="mt-1 text-slate-600">{item.description}</p>}
            {item.rule && <p className="mt-1 text-slate-700">{item.rule}</p>}
            {item.examples && <p className="mt-1 text-xs text-slate-500">Examples: {item.examples}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FindingCard({ finding }) {
  const guidelineId = finding.guideline_id;
  const mappingStatus = finding.mapping_status || (guidelineId ? 'mapped' : 'unmapped');
  const matchedText = finding.matched_text || finding.matchedText;
  const reason = finding.reason || finding.explanation || finding.issue || 'No explanation provided.';

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold text-slate-900">{guidelineId || 'AI-detected issue'}</h4>
        <SeverityBadge severity={finding.severity} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Source</dt>
          <dd className="mt-0.5 text-slate-800"><Sources finding={finding} /></dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Mapping</dt>
          <dd className="mt-0.5 capitalize text-slate-800">{mappingStatus}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Category</dt>
          <dd className="mt-0.5 text-slate-800">{finding.category || '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Matched wording</dt>
          <dd className="mt-0.5 break-words font-mono text-slate-800">{matchedText || '—'}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Reason</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{reason}</p>
      </div>
      {mappingStatus !== 'mapped' && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No matching configured guideline was found.
        </p>
      )}
    </article>
  );
}

export default function AuditReport({ report, aiStatus, advertisementTitle }) {
  if (!report) return null;

  const data = normalizeReport(report, aiStatus);
  const clean = data.status === 'clean' || data.status === 'no_flags';

  return (
    <section className="mt-6 space-y-5" aria-label="AI compliance report">
      <Card
        title="AI compliance review"
        description={advertisementTitle ? `Review for ${advertisementTitle}` : undefined}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AI status</p>
            <div className="mt-2"><AiBadge status={clean ? 'clean' : data.status} /></div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Findings</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{data.findingCount}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Human review</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {data.humanReviewRequired ? 'Required' : 'Not required'}
            </p>
          </div>
        </div>

        {data.brand.name && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h4 className="font-semibold text-slate-900">
              {data.brand.name}{data.brand.version ? ` · v${data.brand.version}` : ''}
            </h4>
            {data.brand.description && <p className="mt-1 text-sm text-slate-600">{data.brand.description}</p>}
            {data.brand.toneOfVoice && (
              <p className="mt-2 text-sm text-slate-700"><strong>Tone of voice:</strong> {data.brand.toneOfVoice}</p>
            )}
            {data.brand.preferredTerminology.length > 0 && (
              <p className="mt-1 text-sm text-slate-700">
                <strong>Preferred terminology:</strong> {data.brand.preferredTerminology.join(', ')}
              </p>
            )}
            {data.brand.termsRequiringReview.length > 0 && (
              <p className="mt-1 text-sm text-slate-700">
                <strong>Terms requiring review:</strong> {data.brand.termsRequiringReview.join(', ')}
              </p>
            )}
            <OfficialGuidelines guidelines={data.brand.guidelines} />
          </div>
        )}

        {data.humanReviewRequired && (
          <p className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
            {HUMAN_REVIEW_MESSAGE}
          </p>
        )}
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Detected issues</h3>
          <span className="text-sm text-slate-500">{data.findingCount} potential finding{data.findingCount === 1 ? '' : 's'}</span>
        </div>
        {data.findings.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            No potential findings. This AI result does not replace final human review.
          </div>
        ) : (
          <div className="space-y-3">
            {data.findings.map((finding, index) => (
              <FindingCard
                key={`${finding.guideline_id || 'finding'}-${finding.matched_text || index}`}
                finding={finding}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
