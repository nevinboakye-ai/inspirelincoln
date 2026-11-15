/** Shown the moment a conversation is tapped, while it loads. */
export default function LoadingConversation() {
  return (
    <div aria-busy="true" aria-label="Loading conversation" className="fixed inset-0 z-[55] flex flex-col bg-white lg:relative lg:z-auto lg:h-full lg:rounded-2xl lg:border lg:border-navy/10">
      <div className="flex items-center gap-3 border-b border-navy/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="size-10 animate-pulse rounded-full bg-paper-200" />
        <span className="flex-1 space-y-1.5">
          <span className="block h-3.5 w-36 animate-pulse rounded bg-paper-200" />
          <span className="block h-3 w-24 animate-pulse rounded bg-paper-200" />
        </span>
      </div>
      <div className="flex-1 space-y-3 bg-paper/60 p-4">
        {[60, 40, 72, 50].map((w, i) => (
          <span key={i} className={`block h-10 animate-pulse rounded-2xl ${i % 2 ? "ml-auto bg-navy/15" : "bg-white"}`} style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="border-t border-navy/10 p-3">
        <span className="block h-12 animate-pulse rounded-3xl bg-paper-200" />
      </div>
    </div>
  );
}
