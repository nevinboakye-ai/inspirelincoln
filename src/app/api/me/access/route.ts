import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { WEBSITE_CAPABILITIES } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/**
 * What the signed-in person can edit, so public pages can show an edit
 * shortcut. `areas` lists the parts of the website they can change.
 */
export async function GET() {
  const current = await getCurrentUser();
  const access = current?.profile.access;
  const areas = access ? WEBSITE_CAPABILITIES.filter((c) => access.owner || access.can[c]) : [];
  const body = { edit: areas.length > 0, owner: Boolean(access?.owner), areas };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
