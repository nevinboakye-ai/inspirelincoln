"use client";
import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";
import { hasSessionCookie } from "@/lib/supabase/session-hint";

/** True once we know this browser is signed in. Read after hydration so server and browser markup match. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(hasSessionCookie()), []);
  return signedIn;
}

/** "Log in" for visitors, "Go to My Hub" for anyone already signed in. */
export function AuthLink({ className, arrow = true, arrowClassName = "size-4" }: { className?: string; arrow?: boolean; arrowClassName?: string }) {
  const signedIn = useSignedIn();
  return (
    <Link href={signedIn ? "/portal" : "/login"} className={className}>
      {signedIn ? (
        <>
          <LayoutDashboard aria-hidden className={arrowClassName} /> Go to My Hub
        </>
      ) : (
        <>
          Log in {arrow && <ArrowRight aria-hidden className={arrowClassName} />}
        </>
      )}
    </Link>
  );
}

/** Hides its content from people who are already signed in, such as "Register" prompts. */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  return useSignedIn() ? null : <>{children}</>;
}
