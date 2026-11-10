import { Eye } from "lucide-react";
import { startViewAs } from "@/app/admin/view-as/actions";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import type { AccountStatus, AccountType } from "@/lib/types";

/** "View as" for one account. Site owner only; the action checks again. */
export function ViewAsButton({ id, name, back, className = "" }: { id: string; name: string; back: string; className?: string }) {
  return (
    <form action={startViewAs} className={className}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <button className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-cyan/50 bg-midnight px-4 text-sm font-semibold text-paper hover:border-cyan">
        <Eye aria-hidden className="size-4 text-cyan" /> View as {name.split(" ")[0]}
      </button>
    </form>
  );
}

type Person = { id: string; full_name: string | null; email: string; account_type: string; account_status: string; role: string };

/** Pick any account, grouped by account type, and see the site exactly as they do. */
export function ViewAsPicker({ people, types, available }: { people: Person[]; types: readonly AccountType[]; available: boolean }) {
  const groups = types
    .map((t) => ({ t, list: people.filter((p) => p.account_type === t && p.role !== "admin").sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email)) }))
    .filter((g) => g.list.length);
  return (
    <section aria-labelledby="viewas-h" id="view-as" className="scroll-mt-28 space-y-3">
      <div>
        <h2 id="viewas-h" className="flex items-center gap-2 font-display text-xl text-ink"><Eye aria-hidden className="size-5 text-navy" /> View as someone</h2>
        <p className="max-w-3xl text-sm text-slate-700">
          See the site exactly as a particular person sees it, using their own account, not a mock-up. Pick an account type, then the person. It&apos;s read only, so nothing can be changed or sent while you look, and it ends after an hour or when you press Stop. Every view is recorded in the audit log.
        </p>
      </div>
      {!available ? (
        <p className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4 text-sm text-ink">
          To switch this on, add <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel (Settings, Environment Variables), then redeploy. You&apos;ll find the key in Supabase under Project Settings, API keys. Never paste it anywhere else.
        </p>
      ) : !groups.length ? (
        <p className="rounded-xl border border-navy/10 bg-white p-5 text-sm text-slate-700">No accounts to view yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ t, list }) => (
            <li key={t} className="rounded-xl border border-navy/10 bg-white p-4">
              <form action={startViewAs} className="space-y-3">
                <input type="hidden" name="back" value="/admin/platform" />
                <p className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">{ACCOUNT_TYPE_LABEL[t]}</span>
                  <span className="text-xs text-slate">{list.length} {list.length === 1 ? "account" : "accounts"}</span>
                </p>
                <label htmlFor={`va-${t}`} className="sr-only">Choose a {ACCOUNT_TYPE_LABEL[t].toLowerCase()} to view as</label>
                <select id={`va-${t}`} name="id" className="min-h-11 w-full rounded-[3px] border border-navy/15 bg-white px-3 text-sm">
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email} ({ACCOUNT_STATUS_LABEL[p.account_status as AccountStatus]?.label ?? p.account_status})
                    </option>
                  ))}
                </select>
                <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-4 text-sm font-semibold text-paper hover:bg-navy-700">
                  <Eye aria-hidden className="size-4" /> View as this {ACCOUNT_TYPE_LABEL[t].toLowerCase()}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
