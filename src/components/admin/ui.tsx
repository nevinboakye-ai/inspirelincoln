import Link from "next/link";
import type { ReactNode } from "react";

export function AdminHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-8">
      {back && <Link href={back.href} className="mb-3 inline-flex min-h-10 items-center text-sm font-medium text-slate-700 hover:text-ink">← {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
          {description && <p className="mt-2 text-slate-700">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ title, children, className = "", actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-navy/10 bg-white p-5 sm:p-6 ${className}`}>
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
  primary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] bg-navy px-5 text-sm font-semibold text-paper hover:bg-navy-700 disabled:opacity-60",
  secondary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border border-navy/15 bg-white px-5 text-sm font-semibold text-ink hover:border-navy/40 disabled:opacity-60",
  danger: "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border border-danger/30 px-5 text-sm font-semibold text-danger hover:bg-danger/[0.05] disabled:opacity-60",
};

export function Flash({ children }: { children: ReactNode }) {
  return <p role="status" className="mb-6 rounded-md border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">{children}</p>;
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-navy/10 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-navy/10 bg-paper text-xs uppercase tracking-wider text-slate">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-navy/10">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
