"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    __inspireGate?: () => void;
  }
}

/** If React ever re-renders the page from scratch, put the welcome screen back (unless it was already dismissed). */
export function GateKeeper() {
  useEffect(() => window.__inspireGate?.(), []);
  return null;
}
