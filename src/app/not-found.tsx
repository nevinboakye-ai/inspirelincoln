import Link from "next/link";

export default function NotFound() {
  return (
    <section className="surface-midnight relative isolate flex min-h-[80svh] items-center overflow-hidden pt-24">
      <div aria-hidden className="absolute inset-0 -z-10">
        <img src="/brand/crest-white.png" alt="" className="absolute left-1/2 top-1/2 h-[90%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" />
      </div>
      <div className="container-page">
        <p className="eyebrow text-cyan">Error 404</p>
        <h1 className="mt-6 text-display-lg font-normal">This page couldn&apos;t be found.</h1>
        <p className="mt-6 max-w-xl text-lg text-paper/70">The link may be out of date, or the page may have moved.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex min-h-12 items-center rounded-[3px] bg-cyan px-6 font-ui font-semibold text-midnight">Go to the homepage</Link>
          <Link href="/programme" className="inline-flex min-h-12 items-center rounded-[3px] border border-white/20 px-6 font-ui font-medium">View the programme</Link>
        </div>
      </div>
    </section>
  );
}
