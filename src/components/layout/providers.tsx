"use client";
import { MotionConfig } from "motion/react";
import { ToastProvider } from "@/components/ui/toast";
import { AgendaProvider } from "@/components/programme/agenda-context";
import { CommandPalette } from "./command-palette";
import { ConsentBanner } from "./consent-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AgendaProvider>
          {children}
          <CommandPalette />
          <ConsentBanner />
        </AgendaProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
