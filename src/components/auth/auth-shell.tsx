import Link from "next/link";
import type { ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function AuthShell({ title, intro, children, footer }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="grid min-h-[100svh] lg:grid-cols-2">
      <div className="surface-midnight relative isolate hidden overflow-hidden lg:block">
        <div aria-hidden className="absolute inset-0 -z-10">
          <img src="/brand/crest-white.png" alt="" className="absolute -bottom-24 -right-24 h-[80%] w-auto opacity-[0.06]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(58,95,148,0.3),transparent_60%)]" />
        </div>
        <div className="flex h-full flex-col justify-end p-16">
          <p className="eyebrow text-cyan">My Hub</p>
          <p className="mt-6 max-w-md font-display text-4xl font-semibold leading-tight">Your ticket, your agenda and the people you will meet, in one place.</p>
        </div>
      </div>
      <div className="flex items-center bg-paper px-5 pb-16 pt-32 sm:px-12 lg:pt-28">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-display-sm font-medium text-ink">{title}</h1>
          {intro && <p className="mt-3 text-slate-700">{intro}</p>}
          {!isSupabaseConfigured && (
            <Notice tone="warning" className="mt-6" title="Accounts are not switched on yet">
              Logging in becomes available once the database is connected. You can still explore the full programme and save sessions in this
              browser.
            </Notice>
          )}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-navy/10 pt-6 text-sm text-slate-700">{footer}</div>}
          <p className="mt-10 text-xs text-slate">
            Browsing the site never requires an account. <Link href="/privacy" className="underline underline-offset-4">Privacy policy</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
