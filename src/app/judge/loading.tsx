/** Shown the instant a judge taps, while the list loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-36 animate-pulse rounded-2xl bg-midnight/90" />
      <div className="h-12 animate-pulse rounded-xl bg-paper-200" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex h-20 items-center gap-3 rounded-2xl border border-navy/10 bg-white p-3">
          <span className="size-12 animate-pulse rounded-full bg-paper-200" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-1/2 animate-pulse rounded bg-paper-200" />
            <span className="block h-3 w-4/5 animate-pulse rounded bg-paper-200" />
          </span>
        </div>
      ))}
    </div>
  );
}
