"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setRoles } from "@/app/admin/roles-actions";
import { ResultBanner } from "@/components/portal/profile-forms";
import { rolesLabel, rolesOf } from "@/lib/accounts";
import type { ActionResult } from "@/app/portal/actions";
import type { AccountStatus, AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";
import { RoleCheckboxes } from "./roles";
import { btn } from "./ui";

/**
 * Pick every role someone holds from grouped cards: attending, the supporting
 * committee teams and the executive committee. Saving keeps their approval as
 * it is; the email is optional.
 */
export function AccountTypePicker({
  id,
  type,
  extra,
  status,
  canLead,
  name,
}: {
  id: string;
  type: AccountType;
  extra?: AccountType[] | null;
  status: AccountStatus;
  canLead: boolean;
  name: string;
}) {
  const current = rolesOf(type, extra);
  const [saved, setSaved] = useState<AccountType[]>(current);
  const [chosen, setChosen] = useState<AccountType[]>(current);
  const [notify, setNotify] = useState(false);
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const changed = chosen.join(",") !== saved.join(",");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      let res: ActionResult;
      try {
        res = await setRoles({ id, kind: "account", types: chosen, notify });
      } catch {
        res = { ok: false, error: "Could not save. Check your connection and try again." };
      }
      setState(res);
      if (res?.ok) setSaved(chosen);
    });
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <ResultBanner state={state} />
      <RoleCheckboxes initial={current} canLead={canLead} onChange={setChosen} disabled={pending} name="roles" />
      <div className="flex flex-col gap-3 rounded-lg border border-navy/10 bg-paper p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className={cn("flex min-h-11 items-center gap-3 text-sm text-ink", status !== "approved" && "opacity-60")}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={status !== "approved"} className="size-5 accent-navy" />
          Email {name.split(" ")[0]} to let them know
        </label>
        <button type="submit" disabled={!changed || !chosen.length || pending} className={btn.primary}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {!chosen.length ? "Choose a role" : changed ? `Save: ${rolesLabel(chosen)}` : "No change to save"}
        </button>
      </div>
      {status !== "approved" && (
        <p className="text-xs text-slate">Their account isn&apos;t approved yet, so this only changes what they&apos;ll be once approved. Use the account decision below to approve them.</p>
      )}
    </form>
  );
}
