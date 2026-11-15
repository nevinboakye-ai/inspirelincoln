import "server-only";
import { requireAccess, requireRole } from "@/lib/auth";
import type { EntityDef } from "./entities";

export type Db = Awaited<ReturnType<typeof requireRole>>["db"];

/** Each kind of content needs its own area of the website (delegate records for admin-only ones). */
export function requireEntityAccess(entity: EntityDef) {
  const next = `/admin/content/${entity.key}`;
  if (entity.adminOnly) return requireRole(["admin"], next);
  return requireAccess(entity.area ?? "edit_website", next);
}

export async function currentEditionId(db: Db) {
  const { data } = await db.from("editions").select("id").eq("is_current", true).maybeSingle();
  return data?.id as string | undefined;
}

/** Quotes a value for CSV, neutralising spreadsheet formula injection. */
export function csvCell(v: unknown) {
  let s = v == null ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  return [columns.map(csvCell).join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\r\n");
}
