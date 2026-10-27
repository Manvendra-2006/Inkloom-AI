// frontend/src/components/ui.js
// Shared UI kit. Every page builds from these pieces so the whole app looks the same.
import React from 'react';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ---------- Buttons ---------- */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANTS = {
  primary: 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

// Use on <Link> too:  <Link className={buttonClass({ variant: 'secondary' })} />
export const buttonClass = ({ variant = 'primary', size = 'md', className } = {}) =>
  cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);

export function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}

/* ---------- Badges ---------- */

const TONES = {
  neutral: { badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
  indigo: { badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  success: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  warning: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  orange: { badge: 'bg-orange-50 text-orange-800 ring-orange-200', dot: 'bg-orange-500' },
  danger: { badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
};

export function Badge({ tone = 'neutral', children }) {
  const { badge, dot } = TONES[tone] || TONES.neutral;
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', badge)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', dot)} aria-hidden="true" />
      {children}
    </span>
  );
}

// One source of truth for workflow statuses across every page
export const STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_REVIEW: { label: 'Pending review', tone: 'warning' },
  CHANGES_REQUIRED: { label: 'Changes required', tone: 'orange' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  PUBLISHED: { label: 'Published', tone: 'indigo' },
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta ? meta.tone : 'neutral'}>{meta ? meta.label : status || 'Unknown'}</Badge>;
}

export function AiBadge({ status }) {
  if (!status) return <Badge tone="neutral">Not checked</Badge>;
  const clean = status === 'clean' || status === 'no_flags';
  return <Badge tone={clean ? 'success' : 'danger'}>{clean ? 'Clean' : 'Flagged'}</Badge>;
}

/* ---------- Layout pieces ---------- */

export function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, description, actions, padded = true, className, children }) {
  return (
    <section className={cx('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? 'p-5' : undefined}>{children}</div>
    </section>
  );
}

export function Skeleton({ className }) {
  return <span className={cx('block animate-pulse rounded bg-slate-200', className)} />;
}

// Solid color fills (text color chosen per tone to keep enough contrast)
const STAT_FILLS = {
  neutral: 'bg-slate-600 text-white',
  indigo: 'bg-indigo-600 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-400 text-amber-950',
  orange: 'bg-orange-600 text-white',
  danger: 'bg-rose-600 text-white',
};

export function StatCard({ label, value, tone = 'neutral', loading }) {
  return (
    <div className={cx('rounded-xl p-5 shadow-sm', STAT_FILLS[tone] || STAT_FILLS.neutral)}>
      <p className="text-sm font-medium opacity-90">{label}</p>
      <div className="mt-3 text-4xl font-semibold tabular-nums tracking-tight">
        {loading ? <span className="block h-10 w-12 animate-pulse rounded bg-black/10" /> : value}
      </div>
    </div>
  );
}

const ALERT_TONES = {
  info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
};

export function Alert({ tone = 'info', title, action, children }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm', ALERT_TONES[tone])}
    >
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <p className={title ? 'mt-0.5 opacity-90' : undefined}>{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Tables ---------- */

export const TD = 'px-4 py-3 text-sm text-slate-700';

export function Table({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function ScoreMeter({ score }) {
  if (score === undefined || score === null) return <span className="text-slate-400">—</span>;
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  const width = Math.min(Math.max(score, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div className={cx('h-full rounded-full', color)} style={{ width: `${width}%` }} />
      </div>
      <span className="text-sm tabular-nums text-slate-700">{score}</span>
    </div>
  );
}

/* ---------- Forms ---------- */

export const inputClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500';

export function Field({ id, label, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800">{label}</label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}