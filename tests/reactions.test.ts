import { describe, expect, it } from "vitest";
import { REACTION_EMOJI, groupReactions, isReactionEmoji, reactionsByMessage, toggleReaction, whoReacted, type Reaction } from "@/lib/reactions";
import { readFileSync } from "node:fs";

const r = (message_id: string, user_id: string, emoji: string, user_name?: string): Reaction => ({ message_id, user_id, emoji, user_name });

describe("reactions", () => {
  it("matches the emoji the database allows", () => {
    const sql = readFileSync("supabase/migrations/20261215000000_message_reactions_and_read_receipts.sql", "utf8");
    const list = sql.match(/select array\[([^\]]+)\]/)![1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
    expect(list).toEqual([...REACTION_EMOJI]);
  });

  it("only accepts listed emoji", () => {
    expect(isReactionEmoji("👍")).toBe(true);
    expect(isReactionEmoji("❤")).toBe(false); // without the variation selector
    expect(isReactionEmoji("💩")).toBe(false);
    expect(isReactionEmoji(null)).toBe(false);
  });

  it("groups by emoji in picker order and marks mine", () => {
    const g = groupReactions([r("m", "b", "🎉"), r("m", "a", "👍"), r("m", "b", "👍"), r("m", "a", "nope")], "a");
    expect(g.map((x) => [x.emoji, x.count, x.mine])).toEqual([
      ["👍", 2, true],
      ["🎉", 1, false],
    ]);
  });

  it("toggles without duplicates", () => {
    const one = toggleReaction([], r("m", "a", "👍"), true);
    expect(toggleReaction(one, r("m", "a", "👍"), true)).toHaveLength(1);
    expect(toggleReaction(one, r("m", "a", "👍"), false)).toHaveLength(0);
  });

  it("keys by message", () => {
    const by = reactionsByMessage([r("m1", "a", "👍"), r("m2", "a", "👍"), r("m1", "b", "😂")]);
    expect(by.get("m1")).toHaveLength(2);
    expect(by.get("m3")).toBeUndefined();
  });

  it("names who reacted", () => {
    const name = (x: Reaction) => x.user_name ?? "?";
    expect(whoReacted([r("m", "a", "👍")], "a", name)).toBe("You");
    expect(whoReacted([r("m", "a", "👍"), r("m", "b", "👍", "Sam")], "a", name)).toBe("You and Sam");
    expect(whoReacted([r("m", "b", "👍", "Sam"), r("m", "c", "👍", "Jo"), r("m", "d", "👍", "Al")], "a", name)).toBe("Sam and 2 others");
  });
});
