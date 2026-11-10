import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { endViewAs, logViewAs } from "@/lib/view-as";

/** Stops viewing as someone and returns to their account page. */
export async function POST(request: NextRequest) {
  const p = await endViewAs();
  if (p) {
    const real = await createSessionClient();
    const { data } = (await real?.auth.getUser()) ?? { data: { user: null } };
    if (data.user?.id === p.o) await logViewAs("view_as_end", p.o, p.t, p.n);
  }
  return NextResponse.redirect(new URL(p ? `/admin/accounts/${p.t}` : "/admin/platform", request.url), 303);
}
