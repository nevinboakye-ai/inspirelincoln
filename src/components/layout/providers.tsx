"use client";
import { LazyMotion, MotionConfig } from "motion/react";
import { ToastProvider } from "@/components/ui/toast";
import { AgendaProvider } from "@/components/programme/agenda-context";
import { SearchLauncher } from "./search-launcher";
import { ConsentBanner } from "./consent-banner";

// Animation features load after the page is interactive, so buttons respond straight away.
const loadFeatures = () => import("@/components/motion/features").then((mod) => mod.default);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AgendaProvider>
          {children}
          <SearchLauncher />
          <ConsentBanner />
        </AgendaProvider>
      </ToastProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
