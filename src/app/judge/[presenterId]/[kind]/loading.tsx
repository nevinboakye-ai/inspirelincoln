export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-11 w-48 animate-pulse rounded-lg bg-paper-200" />
      <div className="h-56 animate-pulse rounded-2xl bg-midnight/90" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-2xl border border-navy/10 bg-white" />
      ))}
    </div>
  );
}
