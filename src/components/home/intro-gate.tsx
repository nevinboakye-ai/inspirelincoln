import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, LogIn } from "lucide-react";
import { formatEventDate } from "@/lib/time";
import type { Edition } from "@/lib/types";
import { GateKeeper } from "./gate-keeper";

export const GATE_KEY = "inspire-gate-v2";

/*
 * Runs as the page is parsed, before any of the site's JavaScript, so the gate
 * appears with the first paint and its buttons work straight away.
 * Shown at the start of every visit to the homepage (once per browser tab, so
 * going back to the homepage during a visit doesn't show it again). People who
 * are signed in are offered their account hub instead of "Sign in".
 * Add ?gate to the address to see it again.
 */
const script = `(function(){
if(typeof HTMLDialogElement!=='function')return;
var force=/[?&]gate\\b/.test(location.search),seen=null;
try{seen=sessionStorage.getItem('${GATE_KEY}')}catch(e){}
if(!force&&seen)return;
var root=document.documentElement,done=false;
var signedIn=/(?:^|;\\s*)sb-[^=]+-auth-token(?:\\.\\d+)?=/.test(document.cookie);
if(signedIn)root.classList.add('gate-member');
function gate(){return document.getElementById('intro-gate')}
function remember(){done=true;try{sessionStorage.setItem('${GATE_KEY}','1')}catch(e){}}
function leave(){var d=gate();remember();if(!d||d.classList.contains('is-leaving'))return;d.classList.add('is-leaving');
var quick=matchMedia('(prefers-reduced-motion: reduce)').matches;setTimeout(function(){d.close()},quick?0:620)}
function show(){var d=gate();if(done||!d||d.open)return;root.classList.add('gate-open');d.showModal();
if(signedIn){var h=d.querySelector('[data-gate=hub]');if(h)h.focus()}}
// Listeners sit on the document, so they still work if the page is re-rendered.
document.addEventListener('cancel',function(e){if(e.target===gate()){e.preventDefault();leave()}},true);
document.addEventListener('close',function(e){if(e.target!==gate())return;root.classList.remove('gate-open');var m=document.getElementById('main');if(m)m.focus({preventScroll:true})},true);
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-gate]');if(!t)return;
if(t.getAttribute('data-gate')==='enter'){e.preventDefault();leave()}else remember()});
window.__inspireGate=show;show();
})();`;

// [left %, size px, seconds to rise, head start]: fixed so server and browser match.
const MOTES: [number, number, number, number][] = [
  [6, 3, 19, 2], [14, 2, 24, 11], [22, 4, 21, 6], [31, 2, 27, 15], [39, 3, 18, 9], [47, 2, 25, 1],
  [55, 3, 22, 13], [63, 2, 20, 4], [71, 4, 26, 17], [79, 2, 19, 8], [87, 3, 23, 12], [94, 2, 21, 3],
];

/** White versions of the partner logos, for the dark intro screen. */
const PARTNERS = [
  { name: "University of Lincoln", src: "/partners/lincoln.png", w: 182, className: "h-7 w-auto sm:h-8", text: true },
  { name: "University of Nottingham", src: "/partners/nottingham.png", w: 529, className: "h-[1.1rem] w-auto sm:h-5", text: false },
  { name: "University of East Anglia", src: "/partners/uea.png", w: 268, className: "h-5 w-auto sm:h-6", text: false },
  { name: "University of Leicester", src: "/partners/leicester.png", w: 600, className: "h-[1.1rem] w-auto sm:h-5", text: false },
];

/** The welcome screen: sign in, or carry on to the website. */
export function IntroGate({ edition }: { edition: Edition }) {
  const i = edition.theme.indexOf(":");
  const lead = i === -1 ? edition.theme : edition.theme.slice(0, i).trim();
  const rest = i === -1 ? "" : edition.theme.slice(i + 1).trim();
  const quarters = ["inset(0 50% 50% 0)", "inset(0 0 50% 50%)", "inset(50% 50% 0 0)", "inset(50% 0 0 50%)"];

  return (
    <>
      <dialog id="intro-gate" aria-labelledby="gate-title" aria-describedby="gate-desc" className="gate" suppressHydrationWarning>
        <div className="gate-panel surface-midnight noise relative isolate flex min-h-full flex-col">
          {/* Atmosphere */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="animate-drift absolute -inset-[15%] bg-[radial-gradient(ellipse_50%_45%_at_50%_38%,rgba(58,95,148,0.5),transparent_70%)]" />
            {/* The Brayford Pool campus, drawn faintly from our own map data */}
            <div className="gate-map absolute inset-0 bg-[url('/map/campus-outline.svg')] bg-cover bg-center [mask-image:radial-gradient(ellipse_70%_65%_at_50%_45%,black_20%,transparent_75%)]" />
            <div className="quarter-lattice absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_50%_40%,black,transparent_70%)]" />
            {/* Drifting points of light, like data rising off the page */}
            {MOTES.map(([left, size, dur, delay], n) => (
              <span
                key={n}
                className="gate-mote absolute bottom-[-2%] rounded-full bg-cyan"
                style={{ left: `${left}%`, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}
              />
            ))}
          </div>

          <div className="container-page flex flex-1 flex-col items-center justify-center py-6 text-center sm:py-10">
            {/* The crest, assembled one quarter at a time inside turning rings */}
            <div className="relative mx-auto grid aspect-square w-[min(22vw,84px)] place-items-center sm:w-[124px] gate-crest">
              <div aria-hidden className="gate-ring absolute -inset-[18%] rounded-full border border-white/10" />
              <div aria-hidden className="gate-ring-slow absolute -inset-[40%] rounded-full border border-dashed border-white/[0.09]" />
              {/* A soft, steady glow behind the crest */}
              <div aria-hidden className="gate-glow absolute inset-[-6%] rounded-full bg-cyan/15 blur-2xl" />
              <div className="gate-crest-img relative aspect-[338/397] w-[82%]">
                {quarters.map((clip, n) => (
                  <div key={clip} aria-hidden className="enter-pop absolute inset-0" style={{ clipPath: clip, animationDelay: `${120 + n * 120}ms` }}>
                    <Image src="/brand/crest-white.png" alt="" fill priority sizes="170px" className="object-contain" />
                  </div>
                ))}
              </div>
            </div>

            <p className="gate-eyebrow enter-up eyebrow mt-6 text-gold [animation-delay:600ms] sm:mt-10">
              INSPIRE {edition.year}<span className="hidden sm:inline"> · </span><span className="mt-1.5 block sm:mt-0 sm:inline">National Medical Research Conference</span>
            </p>
            <h2 id="gate-title" className="mt-2.5 text-[2.15rem] font-normal leading-[1.02] sm:mt-4 sm:text-[3.4rem] lg:text-[4rem]">
              <span className="block overflow-hidden pb-[0.08em]">
                <span className="enter-rise block [animation-delay:680ms]">{lead}</span>
              </span>
              {rest && (
                <span className="block overflow-hidden pb-[0.12em]">
                  <span className="enter-rise block text-[0.6em] font-light italic leading-[1.1] text-gold-300 [animation-delay:780ms]">{rest}</span>
                </span>
              )}
            </h2>
            <p id="gate-desc" className="enter-up mt-2.5 text-[0.8rem] text-paper/75 [animation-delay:900ms] sm:mt-4 sm:text-sm">
              {formatEventDate(edition.date)} · {edition.venueName}
            </p>

            {/* Heartbeat, drawn across the gate */}
            <svg aria-hidden viewBox="0 0 600 60" preserveAspectRatio="none" fill="none" className="gate-beat-svg mt-2 h-7 w-full max-w-md sm:mt-4 sm:h-10">
              <path
                pathLength={1}
                className="gate-beat"
                d="M0 30 h150 l8 -6 l8 6 h16 l6 8 l9 -32 l10 40 l7 -16 h22 q12 -12 24 0 h340"
                stroke="rgb(201 216 236 / 0.55)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                pathLength={1}
                className="gate-tracer"
                d="M0 30 h150 l8 -6 l8 6 h16 l6 8 l9 -32 l10 40 l7 -16 h22 q12 -12 24 0 h340"
                stroke="#e6c97f"
                strokeWidth="2.25"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="enter-up mt-3 grid w-full max-w-sm gap-2 sm:mt-5 sm:max-w-xl [animation-delay:1050ms] sm:grid-cols-2 sm:gap-4">
              <button
                type="button"
                data-gate="enter"
                autoFocus
                className="shine group flex min-h-[3.75rem] flex-col items-start justify-center gap-0.5 rounded-[4px] bg-paper px-4 py-2.5 text-left sm:min-h-20 sm:gap-1 sm:px-5 sm:py-4 text-navy transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-24px_rgba(201,216,236,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan"
              >
                <span className="flex w-full items-center justify-between font-display text-lg sm:text-xl">
                  Visit the website
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <span className="text-[0.72rem] text-slate-700 sm:text-[0.8rem]">Programme, speakers, venue and FAQs</span>
              </button>
              <Link
                href="/login"
                data-gate="signin"
                className="gate-guest group flex min-h-[3.75rem] flex-col items-start justify-center gap-0.5 rounded-[4px] border border-white/25 bg-white/[0.04] px-4 py-2.5 text-left sm:min-h-20 sm:gap-1 sm:px-5 sm:py-4 backdrop-blur-sm transition-[transform,border-color,background-color] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan"
              >
                <span className="flex w-full items-center justify-between font-display text-lg sm:text-xl text-paper">
                  Log in
                  <LogIn aria-hidden className="size-4 text-cyan transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <span className="text-[0.72rem] text-paper/70 sm:text-[0.8rem]">Selected delegates, presenters and committee</span>
              </Link>
              {/* Shown instead of "Sign in" when this browser is already signed in. */}
              <Link
                href="/portal"
                data-gate="hub"
                className="gate-member-only group flex min-h-[3.75rem] flex-col items-start justify-center gap-0.5 rounded-[4px] border border-white/25 bg-white/[0.04] px-4 py-2.5 text-left sm:min-h-20 sm:gap-1 sm:px-5 sm:py-4 backdrop-blur-sm transition-[transform,border-color,background-color] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan"
              >
                <span className="flex w-full items-center justify-between font-display text-lg sm:text-xl text-paper">
                  Go to My Hub
                  <LayoutDashboard aria-hidden className="size-4 text-cyan transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <span className="text-[0.72rem] text-paper/70 sm:text-[0.8rem]">You&apos;re logged in. Your presentation, agenda and profile</span>
              </Link>
            </div>
            <p className="gate-guest enter-fade mt-3 text-[0.8rem] sm:mt-5 text-paper/70 [animation-delay:1250ms]">
              New to INSPIRE?{" "}
              <Link href="/signup" data-gate="signup" className="font-semibold text-paper underline decoration-white/40 underline-offset-4 hover:decoration-white">
                Create an account
              </Link>
            </p>
          </div>

          <section aria-labelledby="gate-partners" className="gate-partners enter-fade container-page pb-4 text-center [animation-delay:1350ms]">
            <h3 id="gate-partners" className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-paper/60">Partner universities</h3>
            <ul className="mt-2.5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 sm:gap-x-10">
              {PARTNERS.map((u) => (
                <li key={u.name} className="flex items-center gap-2.5 opacity-80 transition-opacity duration-300 hover:opacity-100">
                  <img src={u.src} alt={u.text ? "" : u.name} width={u.w} height={160} className={u.className} loading="eager" decoding="async" />
                  {u.text && <span className="text-left font-display text-[0.7rem] leading-tight text-paper">University<br />of Lincoln</span>}
                </li>
              ))}
            </ul>
          </section>

          <p className="enter-fade pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center text-xs text-paper/60 [@media(hover:none)]:hidden [animation-delay:1400ms]">
            Press Esc to go straight to the website
          </p>
        </div>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <GateKeeper />
    </>
  );
}
