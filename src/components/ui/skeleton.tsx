"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Loading placeholders. Next.js shows these the moment a link is tapped (the
 * route's loading.tsx), so the page responds straight away and the real
 * content streams in behind them. They are shaped like the page that's coming,
 * so nothing jumps when it arrives.
 */
export function Skeleton({ className, dark = false }: { className?: string; dark?: boolean }) {
  return <div aria-hidden className={cn("skeleton", dark && "skeleton-dark", className)} />;
}

function Screen({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("skeleton-screen", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function CardBlock({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-navy/10 bg-white p-4 sm:p-5", className)}>
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

/** My Hub: the lanyard and to-do list beside the main cards. */
function HubSkeleton() {
  return (
    <Screen label="Loading My Hub" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20.5rem] xl:items-start">
      <div className="min-w-0 space-y-4 xl:col-start-2 xl:row-start-1">
        {/* The lanyard folds into a slim bar on phones. */}
        <div className="rounded-2xl bg-midnight p-4 xl:p-5">
          <div className="flex items-center gap-3 xl:flex-col xl:items-start">
            <Skeleton dark className="size-12 shrink-0 rounded-full xl:size-24" />
            <div className="min-w-0 flex-1 space-y-2 xl:w-full">
              <Skeleton dark className="h-4 w-36" />
              <Skeleton dark className="h-3 w-24" />
            </div>
          </div>
          <Skeleton dark className="mt-5 hidden aspect-square w-full xl:block" />
        </div>
        <div className="rounded-xl border border-navy/10 bg-white p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-14 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-48 rounded-full" />
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-4 xl:col-start-1 xl:row-start-1">
        <CardBlock lines={4} />
        <div className="grid gap-3 lg:grid-cols-2">
          <CardBlock lines={2} />
          <CardBlock lines={2} />
        </div>
        <CardBlock lines={3} />
      </div>
    </Screen>
  );
}

/** A page title and a list of people or conversations. */
function ListSkeleton({ label }: { label: string }) {
  return (
    <Screen label={label} className="space-y-4">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-12 w-full rounded-[3px]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-navy/10 bg-white p-4">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** A page title and a form or document. */
function FormSkeleton({ label }: { label: string }) {
  return (
    <Screen label={label} className="space-y-4">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="rounded-xl border border-navy/10 bg-white p-4 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-12 w-full rounded-[3px]" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-6 h-12 w-40 rounded-[3px]" />
      </div>
      <CardBlock lines={3} />
    </Screen>
  );
}

/** Account pages: shaped like whichever page is on its way. */
export function PortalSkeleton() {
  const path = usePathname();
  if (path === "/portal") return <HubSkeleton />;
  if (/^\/portal\/(network|people|enquiries$)/.test(path)) return <ListSkeleton label="Loading" />;
  return <FormSkeleton label="Loading" />;
}

/** Committee dashboard pages: a header, a row of figures and a table. */
export function AdminSkeleton() {
  return (
    <Screen label="Loading" className="space-y-6">
      <div className="space-y-2.5">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-xl border border-navy/10 bg-white p-5">
            <Skeleton className="size-10 shrink-0 rounded-[3px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-navy/10 bg-white p-5 sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-8 w-20 rounded-[3px]" />
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

/** Reviewer pages. */
export function ReviewSkeleton() {
  return <ListSkeleton label="Loading reviews" />;
}
