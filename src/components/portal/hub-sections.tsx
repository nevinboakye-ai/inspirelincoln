import Link from "next/link";
import {
  AlertOctagon,
  Camera,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  IdCard,
  Info,
  ListOrdered,
  Megaphone,
  Mic,
  PenLine,
  Pin,
  ShieldCheck,
  Sparkles,
  FlaskConical,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ReadinessRing } from "@/components/portal/hub-motion";

export type HubStep = { label: string; done: boolean; href: string | null };

/** Each kind of step gets its own icon and colour, so the list reads at a glance. */
function stepLook(href: string | null): { icon: LucideIcon; tone: string } {
  if (!href) return { icon: ShieldCheck, tone: "tone-navy" };
  if (href.includes("#photo")) return { icon: Camera, tone: "tone-plum" };
  if (href.includes("#bio")) return { icon: PenLine, tone: "tone-sky" };
  if (href.includes("attend")) return { icon: Mic, tone: "tone-coral" };
  if (href.includes("travel")) return { icon: Car, tone: "tone-teal" };
  if (href.includes("submission")) return { icon: UploadCloud, tone: "tone-gold" };
  if (href.includes("workshops")) return { icon: ListOrdered, tone: "tone-rose" };
  if (href.includes("research")) return { icon: FlaskConical, tone: "tone-teal" };
  return { icon: IdCard, tone: "tone-navy" };
}

/** "Get ready for INSPIRE": what's left as a tappable list, what's done folded away. */
export function HubChecklist({ steps, needsGiven }: { steps: HubStep[]; needsGiven: boolean }) {
  const todo = steps.filter((x) => !x.done);
  const done = steps.filter((x) => x.done);
  return (
    <section aria-labelledby="ready-h" className="app-card overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <ReadinessRing small done={done.length} total={steps.length} />
        <div className="min-w-0">
          <h2 id="ready-h" className="font-display text-lg leading-tight text-ink">
            {todo.length === 0 ? "You're all set for the day" : "Get ready for INSPIRE"}
          </h2>
          <p className="text-sm text-slate-700">
            {todo.length === 0
              ? "Everything we need is in. See you on the day."
              : `${todo.length} ${todo.length === 1 ? "thing" : "things"} left to do`}
          </p>
        </div>
        {todo.length === 0 && <Sparkles aria-hidden className="ml-auto size-5 shrink-0 text-gold-600" />}
      </div>

      {todo.length > 0 && (
        <ol aria-label="Still to do" className="border-t border-navy/[0.06]">
          {todo.map((x, i) => {
            const { icon: Icon, tone } = stepLook(x.href);
            const inner = (
              <>
                <span className={cn("icon-chip-sm", tone)}>
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1 text-[0.9rem] font-semibold leading-snug text-ink">
                  {x.label}
                  <span className="sr-only">, to do</span>
                </span>
                {x.href && <ChevronRight aria-hidden className="size-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />}
              </>
            );
            const cls = "flex min-h-14 items-center gap-3 px-4 py-2";
            return (
              <li key={x.label} className="pop-in border-b border-navy/[0.06] last:border-0" style={{ animationDelay: `${120 + i * 50}ms` }}>
                {x.href ? (
                  <Link href={x.href} className={cn("group tap active:bg-paper-200/70 hover:bg-paper/70", cls)}>
                    {inner}
                  </Link>
                ) : (
                  <span className={cls}>{inner}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="space-y-2 border-t border-navy/[0.06] bg-paper/50 px-4 py-3">
        {done.length > 0 && (
          <details className="group/done">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-success [&::-webkit-details-marker]:hidden">
              <span className="grid size-5 place-items-center rounded-full bg-success text-white">
                <Check aria-hidden className="size-3" strokeWidth={3} />
              </span>
              {done.length} done
              <ChevronDown aria-hidden className="size-4 transition-transform group-open/done:rotate-180" />
            </summary>
            <ul aria-label="Done" className="mt-1.5 flex flex-wrap gap-1.5 pb-1">
              {done.map((x) => (
                <li key={x.label} className="inline-flex items-center gap-1 rounded-full bg-success/10 py-0.5 pl-1.5 pr-2.5 text-xs font-medium text-success">
                  <Check aria-hidden className="size-3.5" />
                  {x.label}
                  <span className="sr-only">, done</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="text-xs text-slate">
          Optional: {needsGiven ? "thank you for telling us about your access or dietary needs." : "any access or dietary needs?"}{" "}
          <Link href="/portal/profile#needs" className="font-semibold text-electric-600 underline underline-offset-4">
            {needsGiven ? "Review" : "Add them"}
          </Link>
        </p>
      </div>
    </section>
  );
}

export type HubAnnouncement = {
  id: string;
  title: string;
  body: string | null;
  level: string;
  pinned?: boolean | null;
  published_at?: string | null;
};

const LEVEL: Record<string, { label: string; icon: LucideIcon; bar: string; chip: string; tag: string }> = {
  urgent: { label: "Urgent", icon: AlertOctagon, bar: "bg-rose", chip: "tone-rose", tag: "bg-rose text-white" },
  important: { label: "Important", icon: Megaphone, bar: "bg-gold", chip: "tone-gold", tag: "bg-gold/25 text-gold-700" },
  info: { label: "Update", icon: Info, bar: "bg-sky", chip: "tone-sky", tag: "bg-sky-100 text-sky" },
};

function ago(iso: string | null | undefined) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
}

/** Announcements from the committee: the most urgent first, each with a colour for its level. */
export function HubAnnouncements({ items }: { items: HubAnnouncement[] }) {
  if (!items.length) return null;
  const rank = (l: string) => (l === "urgent" ? 0 : l === "important" ? 1 : 2);
  const sorted = [...items].sort((a, b) => rank(a.level) - rank(b.level));
  return (
    <section aria-labelledby="news-h" className="app-card p-4">
      <h2 id="news-h" className="flex items-center gap-2 font-display text-lg text-ink">
        <span className="icon-chip-sm tone-coral">
          <Megaphone aria-hidden className="size-4" />
        </span>
        Announcements
        <span className="ml-auto rounded-full bg-paper-200 px-2 py-0.5 font-ui text-xs font-semibold text-slate-700">{items.length}</span>
      </h2>
      <ul className="mt-3 space-y-2.5">
        {sorted.map((a) => {
          const look = LEVEL[a.level] ?? LEVEL.info;
          const when = ago(a.published_at);
          return (
            <li key={a.id} className={cn("relative overflow-hidden rounded-xl border border-navy/[0.07] bg-paper/60 py-3 pl-4 pr-3", a.level === "urgent" && "border-rose/25 bg-rose-100/40")}>
              <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", look.bar)} />
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.12em]">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", look.tag)}>
                  <look.icon aria-hidden className="size-3" /> {look.label}
                </span>
                {a.pinned && (
                  <span className="inline-flex items-center gap-1 text-slate">
                    <Pin aria-hidden className="size-3" /> Pinned
                  </span>
                )}
                {when && <span className="font-medium normal-case tracking-normal text-slate">{when}</span>}
              </p>
              <p className="mt-1.5 font-semibold leading-snug text-ink">{a.title}</p>
              {a.body && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{a.body}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
