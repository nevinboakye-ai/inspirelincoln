import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { STORY } from "@/content/story";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { LineDraw } from "@/components/motion/effects";
import { StoryCard } from "./story-card";
import { StoryDeck } from "./story-deck";

export function OurStory() {
  return (
    <section aria-labelledby="story-title" className="bg-paper pb-12 sm:pb-24">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow flex items-center gap-3 text-electric-600">
              <LineDraw className="w-8 bg-electric-600/50" /> Our story
            </p>
            <h2 id="story-title" className="mt-3 text-display-sm font-normal text-ink">More than a decade of student research</h2>
          </div>
          <Link href="/about" className="group inline-flex min-h-11 items-center gap-2 font-ui text-sm font-semibold text-electric-600">
            About INSPIRE <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="mt-6 md:hidden">
          <StoryDeck />
        </div>
        <Stagger className="mt-10 hidden gap-4 md:grid md:grid-cols-3">
          {STORY.map((ch, i) => (
            <StaggerItem key={ch.label} className="h-full">
              <StoryCard index={i} label={ch.label} text={ch.text} className="transition-transform duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1" />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
