import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { viewAsAvailable } from "@/lib/view-as-seal";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

/**
 * For the floating "View as" button. Uses the site owner's own session, so it
 * still answers while they're viewing as someone else. Anyone else gets
 * { owner: false } and nothing more. With ?people=1 the owner also gets every
 * account they can view as (never site owners or themselves).
 */
export async function GET(request: NextRequest) {
  const db = await createSessionClient();
  const { data: { user } = { user: null } } = (await db?.auth.getUser()) ?? {};
  if (!db || !user) return NextResponse.json({ owner: false }, { headers: PRIVATE });
  const { data: me } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return NextResponse.json({ owner: false }, { headers: PRIVATE });

  const available = viewAsAvailable();
  if (request.nextUrl.searchParams.get("people") !== "1" || !available) return NextResponse.json({ owner: true, available }, { headers: PRIVATE });

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .neq("role", "admin")
    .neq("id", user.id)
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(5000);
  if (error) return NextResponse.json({ owner: true, available, error: true }, { headers: PRIVATE });
  const people = (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string | null) || (p.email as string),
    email: p.email as string,
    types: [p.account_type, ...((p.extra_types as string[] | null) ?? [])].filter((t, i, a) => a.indexOf(t) === i),
    status: p.account_status as string,
    institution: (p.institution as string | null) ?? null,
  }));
  return NextResponse.json({ owner: true, available, people }, { headers: PRIVATE });
}
