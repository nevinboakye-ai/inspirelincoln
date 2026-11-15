import type { Metadata } from "next";
import { JudgeScanner } from "@/components/judge/judge-scanner";

export const metadata: Metadata = { title: "Scan" };

export default function ScanPage() {
  return <JudgeScanner />;
}
