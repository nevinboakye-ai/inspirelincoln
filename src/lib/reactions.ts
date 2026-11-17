/** Emoji reactions on direct messages and enquiries. Mirrors public.reaction_emoji() in the database. */

export const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "✅"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];
export const isReactionEmoji = (e: unknown): e is ReactionEmoji => typeof e === "string" && (REACTION_EMOJI as readonly string[]).includes(e);

/** Spoken names, for screen readers and tooltips. */
export const REACTION_LABEL: Record<ReactionEmoji, string> = {
  "👍": "thumbs up",
  "❤️": "heart",
  "😂": "laughing",
  "😮": "surprised",
  "😢": "sad",
  "🙏": "thank you",
  "🎉": "celebrate",
  "✅": "done",
};

/** One person's reaction to one message. user_name is set for enquiries. */
export type Reaction = { message_id: string; user_id: string; emoji: string; user_name?: string | null; from_committee?: boolean };

export const DM_REACTION_COLUMNS = "message_id, user_id, emoji";
export const ENQUIRY_REACTION_COLUMNS = "message_id, user_id, emoji, user_name, from_committee";

/** A message's reactions grouped by emoji, in picker order: who reacted and whether that includes me. */
export function groupReactions(list: readonly Reaction[], me: string) {
  const by = new Map<string, { emoji: ReactionEmoji; count: number; mine: boolean; people: Reaction[] }>();
  for (const r of list) {
    if (!isReactionEmoji(r.emoji)) continue;
    const g = by.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, people: [] };
    g.count++;
    g.people.push(r);
    if (r.user_id === me) g.mine = true;
    by.set(r.emoji, g);
  }
  return REACTION_EMOJI.flatMap((e) => (by.has(e) ? [by.get(e)!] : []));
}

/** Reactions keyed by message, for quick lookup while drawing a conversation. */
export function reactionsByMessage(list: readonly Reaction[]) {
  const out = new Map<string, Reaction[]>();
  for (const r of list) {
    const arr = out.get(r.message_id);
    if (arr) arr.push(r);
    else out.set(r.message_id, [r]);
  }
  return out;
}

/** Adds or removes one reaction in a list, as the screen shows it before the server answers. */
export function toggleReaction(list: readonly Reaction[], next: Reaction, on: boolean) {
  const rest = list.filter((r) => !(r.message_id === next.message_id && r.user_id === next.user_id && r.emoji === next.emoji));
  return on ? [...rest, next] : rest;
}

/** "You and Sam Smith", "You", "Sam Smith and 2 others". */
export function whoReacted(people: readonly Reaction[], me: string, nameOf: (r: Reaction) => string) {
  const mine = people.some((p) => p.user_id === me);
  const others = people.filter((p) => p.user_id !== me).map(nameOf);
  const names = [...(mine ? ["You"] : []), ...others];
  if (names.length <= 2) return names.join(" and ");
  return `${names[0]} and ${names.length - 1} others`;
}
