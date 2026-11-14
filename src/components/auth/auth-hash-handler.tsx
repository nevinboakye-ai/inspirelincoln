"use client";
import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Some Supabase links (invites sent from the dashboard, older emails, or an
 * expired link) come back with their result in the address's #fragment,
 * which the server never sees. Finish them here instead of leaving the person
 * on the homepage wondering what happened.
 */
export function AuthHashHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.length < 2 || !/(access_token|error_code|error_description)=/.test(hash)) return;
    const p = new URLSearchParams(hash.slice(1));
    const clear = () => history.replaceState(null, "", window.location.pathname + window.location.search);
    if (p.get("error_code") || p.get("error_description")) {
      clear();
      window.location.replace("/login?error=link");
      return;
    }
    const access_token = p.get("access_token");
    const refresh_token = p.get("refresh_token");
    const db = getBrowserClient();
    if (!access_token || !refresh_token || !db) return;
    const type = p.get("type");
    clear();
    db.auth.setSession({ access_token, refresh_token }).then(({ error }: { error: unknown }) => {
      if (error) window.location.replace("/login?error=link");
      else window.location.replace(type === "recovery" || type === "invite" ? "/auth/update-password" : "/portal?welcome=1");
    });
  }, []);
  return null;
}
