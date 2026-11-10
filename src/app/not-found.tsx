import Link from "next/link";
import { NeuralField } from "@/components/visual/neural-field";

export default function NotFound() {
  return (
    <section className="surface-midnight relative isolate flex min-h-[80svh] items-center overflow-hidden pt-24">
      <div aria-hidden className="absolute inset-0 -z-10">
        <NeuralField density={0.5} />
      </div>
      <div className="container-page">
        <p className="eyebrow text-cyan">Error 404</p>
        <h1 className="mt-6 text-display-lg font-semibold">This page couldn&apos;t be found.</h1>
        <p className="mt-6 max-w-xl text-lg text-paper/70">The link may be out of date, or the page may have moved.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex min-h-12 items-center rounded-full bg-cyan px-6 font-display font-semibold text-midnight">Go to the homepage</Link>
          <Link href="/programme" className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 font-display font-medium">View the programme</Link>
        </div>
      </div>
    </section>
  );
}
