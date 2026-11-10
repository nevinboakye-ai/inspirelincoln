import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch|vercel/i;

function device(ua: string) {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Records one anonymous page view (see public.record_page_view). The IP
 * address and browser are only used, with a salt that changes daily, to make a
 * one-way visitor hash in the database; they are never stored.
 */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return done;
  let body: { path?: unknown; referrer?: unknown };
  try {
    body = await req.json();
  } catch {
    return done;
  }
  const path = typeof body.path === "string" ? body.path.split(/[?#]/)[0].slice(0, 300) : "";
  if (!path.startsWith("/") || /^\/(admin|review|view-as|auth|api)(\/|$)/.test(path)) return done;
  const referrer =
    typeof body.referrer === "string" && /^[a-z0-9.-]{1,200}(:\d+)?$/i.test(body.referrer) ? body.referrer.replace(/^www\./i, "").toLowerCase() : null;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  const country = req.headers.get("x-vercel-ip-country");
  const db = createPublicClient();
  if (!db) return done;
  await db.rpc("record_page_view", {
    p_path: path,
    p_referrer: referrer,
    p_device: device(ua),
    p_country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    p_ident: `${ip}|${ua}`,
    p_signed_in: req.cookies.getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name)),
  });
  return done;
}
