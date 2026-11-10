import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { formatEventDate } from "@/lib/time";
import type { Edition } from "@/lib/types";
import { GateKeeper } from "./gate-keeper";

export const GATE_KEY = "inspire-gate-v1";

/*
 * Runs as the page is parsed, before any of the site's JavaScript, so the gate
 * appears with the first paint and its buttons work straight away.
 * Shown once per browser, never to signed-in people. Add ?gate to the address to see it again.
 */
const script = `(function(){
if(typeof HTMLDialogElement!=='function')return;
var force=/[?&]gate\\b/.test(location.search),seen=null;
try{seen=localStorage.getItem('${GATE_KEY}')}catch(e){}
var signedIn=/(?:^|;\\s*)sb-[^=]+-auth-token(?:\\.\\d+)?=/.test(document.cookie);
if(!force&&(seen||signedIn))return;
var root=document.documentElement,done=false;
function gate(){return document.getElementById('intro-gate')}
function remember(){done=true;try{localStorage.setItem('${GATE_KEY}',String(Date.now()))}catch(e){}}
function leave(){var d=gate();remember();if(!d||d.classList.contains('is-leaving'))return;d.classList.add('is-leaving');
var quick=matchMedia('(prefers-reduced-motion: reduce)').matches;setTimeout(function(){d.close()},quick?0:620)}
function show(){var d=gate();if(done||!d||d.open)return;root.classList.add('gate-open');d.showModal()}
// Listeners sit on the document, so they still work if the page is re-rendered.
document.addEventListener('cancel',function(e){if(e.target===gate()){e.preventDefault();leave()}},true);
document.addEventListener('close',function(e){if(e.target!==gate())return;root.classList.remove('gate-open');var m=document.getElementById('main');if(m)m.focus({preventScroll:true})},true);
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-gate]');if(!t)return;
if(t.getAttribute('data-gate')==='enter'){e.preventDefault();leave()}else remember()});
window.__inspireGate=show;show();
})();`;

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
            <div className="quarter-lattice absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_50%_40%,black,transparent_70%)]" />
          </div>

          <div className="container-page flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-14">
            {/* The crest, assembled one quarter at a time inside turning rings */}
            <div className="relative mx-auto grid aspect-square w-[min(40vw,150px)] place-items-center sm:w-[160px]">
              <div aria-hidden className="gate-ring absolute -inset-[18%] rounded-full border border-white/10" />
              <div aria-hidden className="gate-ring-slow absolute -inset-[40%] rounded-full border border-dashed border-white/[0.09]" />
              <div aria-hidden className="gate-glow absolute inset-0 rounded-full bg-cyan/10 blur-2xl" />
              <div className="relative aspect-[338/397] w-[82%]">
                {quarters.map((clip, n) => (
                  <div key={clip} aria-hidden className="enter-pop absolute inset-0" style={{ clipPath: clip, animationDelay: `${120 + n * 120}ms` }}>
                    <Image src="/brand/crest-white.png" alt="" fill priority sizes="170px" className="object-contain" />
                  </div>
                ))}
              </div>
            </div>

            <p className="enter-up eyebrow mt-12 text-cyan [animation-delay:600ms] sm:mt-14">INSPIRE {edition.year} · National Medical Research Conference</p>
            <h2 id="gate-title" className="mt-5 text-display-lg font-normal">
              <span className="block overflow-hidden pb-[0.08em]">
                <span className="enter-rise block [animation-delay:680ms]">{lead}</span>
              </span>
              {rest && (
                <span className="block overflow-hidden pb-[0.12em]">
                  <span className="enter-rise block text-[0.6em] font-light italic leading-[1.1] text-cyan [animation-delay:780ms]">{rest}</span>
                </span>
              )}
            </h2>
            <p id="gate-desc" className="enter-up mt-5 text-paper/75 [animation-delay:900ms]">
              {formatEventDate(edition.date)} · {edition.venueName}
            </p>

            {/* Heartbeat, drawn across the gate */}
            <svg aria-hidden viewBox="0 0 600 60" preserveAspectRatio="none" fill="none" className="mt-6 h-10 w-full max-w-xl sm:h-12">
              <path
                pathLength={1}
                className="gate-beat"
                d="M0 30 h150 l8 -6 l8 6 h16 l6 8 l9 -32 l10 40 l7 -16 h22 q12 -12 24 0 h340"
                stroke="rgb(201 216 236 / 0.55)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="enter-up mt-6 grid w-full max-w-2xl gap-3 [animation-delay:1050ms] sm:grid-cols-2 sm:gap-4">
              <button
                type="button"
                data-gate="enter"
                autoFocus
                className="shine group flex min-h-24 flex-col items-start justify-center gap-1 rounded-[4px] bg-paper px-6 py-5 text-left text-navy transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-24px_rgba(201,216,236,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan"
              >
                <span className="flex w-full items-center justify-between font-display text-2xl">
                  Visit the website
                  <ArrowRight aria-hidden className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <span className="text-sm text-slate-700">Programme, speakers, venue and FAQs</span>
              </button>
              <Link
                href="/login"
                data-gate="signin"
                className="group flex min-h-24 flex-col items-start justify-center gap-1 rounded-[4px] border border-white/25 bg-white/[0.04] px-6 py-5 text-left backdrop-blur-sm transition-[transform,border-color,background-color] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan"
              >
                <span className="flex w-full items-center justify-between font-display text-2xl text-paper">
                  Sign in
                  <LogIn aria-hidden className="size-5 text-cyan transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <span className="text-sm text-paper/70">Your ticket, submission or committee dashboard</span>
              </Link>
            </div>
            <p className="enter-fade mt-6 text-sm text-paper/70 [animation-delay:1250ms]">
              New to INSPIRE?{" "}
              <Link href="/signup" data-gate="signup" className="font-semibold text-paper underline decoration-white/40 underline-offset-4 hover:decoration-white">
                Create an account
              </Link>
            </p>
          </div>

          <p className="enter-fade pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center text-xs text-paper/60 [@media(hover:none)]:invisible [animation-delay:1400ms]">
            Press Esc to go straight to the website
          </p>
        </div>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <GateKeeper />
    </>
  );
}
