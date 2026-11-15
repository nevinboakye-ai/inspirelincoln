import Link from "next/link";
import type { ReactNode } from "react";

export function AdminHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 sm:mb-8">
      {back && <Link href={back.href} className="tap mb-3 inline-flex min-h-10 items-center gap-1 rounded-full bg-white px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-navy/[0.08] hover:text-ink">← {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="enter-up font-display text-[1.75rem] font-semibold leading-tight text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 text-[0.95rem] text-slate-700 sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ title, children, className = "", actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`app-card p-4 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export const btn = {
  primary: "inline-flex min-h-11 items-center justify-center gap-2 tap rounded-xl bg-navy px-5 text-sm font-semibold text-paper shadow-[0_6px_16px_-10px_rgba(12,24,44,0.8)] hover:bg-navy-700 disabled:opacity-60",
  secondary: "inline-flex min-h-11 items-center justify-center gap-2 tap rounded-xl border border-navy/15 bg-white px-5 text-sm font-semibold text-ink hover:border-navy/40 disabled:opacity-60",
  danger: "inline-flex min-h-11 items-center justify-center gap-2 tap rounded-xl border border-danger/30 bg-white px-5 text-sm font-semibold text-danger hover:bg-danger/[0.05] disabled:opacity-60",
};

export function Flash({ children }: { children: ReactNode }) {
  return <p role="status" className="pop-in mb-6 rounded-xl border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">{children}</p>;
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="app-card relative overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 border-b border-navy/10 bg-paper/80 text-xs uppercase tracking-wider text-slate">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-navy/10">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
