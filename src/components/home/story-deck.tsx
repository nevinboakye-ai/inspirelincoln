"use client";
import { STORY } from "@/content/story";
import { CardDeck } from "@/components/ui/card-deck";
import { STORY_STYLES, StoryCard } from "./story-card";

/** On phones the story is a stack of cards, one chapter at a time. */
export function StoryDeck() {
  return (
    <CardDeck
      label="Our story"
      noun="chapter"
      cards={STORY.map((ch, i) => ({
        key: ch.label,
        label: ch.label,
        dot: STORY_STYLES[i % STORY_STYLES.length].dot,
        card: <StoryCard index={i} label={ch.label} text={ch.text} />,
      }))}
    />
  );
}
