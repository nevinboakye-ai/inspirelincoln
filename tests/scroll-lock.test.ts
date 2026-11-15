import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny stand-in for the page, enough for the lock to read and write.
function fakePage() {
  const classes = new Set<string>();
  const root = { style: { overflow: "" }, classList: { remove: (c: string) => classes.delete(c), add: (c: string) => classes.add(c), contains: (c: string) => classes.has(c) } };
  const doc = { documentElement: root, body: { style: { overflow: "" } }, querySelector: vi.fn(() => null as unknown) };
  vi.stubGlobal("document", doc);
  return { root, doc, classes };
}

async function fresh() {
  vi.resetModules();
  return import("@/lib/scroll-lock");
}

describe("scroll lock", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("only lets the page scroll once every lock is given back", async () => {
    const { root } = fakePage();
    const { lockScroll, heldScrollLocks } = await fresh();
    const menu = lockScroll();
    const popup = lockScroll();
    expect(root.style.overflow).toBe("hidden");
    menu();
    expect(root.style.overflow).toBe("hidden");
    popup();
    expect(root.style.overflow).toBe("");
    expect(heldScrollLocks()).toBe(0);
  });

  it("ignores a lock given back twice", async () => {
    const { root } = fakePage();
    const { lockScroll } = await fresh();
    const a = lockScroll();
    const b = lockScroll();
    a();
    a();
    expect(root.style.overflow).toBe("hidden");
    b();
    expect(root.style.overflow).toBe("");
  });

  it("frees a page left locked when nothing holds a lock", async () => {
    const { root, doc, classes } = fakePage();
    const { freeStrayScrollLock, lockScroll } = await fresh();
    root.style.overflow = "hidden";
    doc.body.style.overflow = "hidden";
    classes.add("gate-open");
    freeStrayScrollLock();
    expect(root.style.overflow).toBe("");
    expect(doc.body.style.overflow).toBe("");
    expect(classes.has("gate-open")).toBe(false);

    const release = lockScroll();
    freeStrayScrollLock();
    expect(root.style.overflow).toBe("hidden");
    release();
  });

  it("leaves the welcome screen's lock while it is still showing", async () => {
    const { doc, classes } = fakePage();
    const { freeStrayScrollLock } = await fresh();
    classes.add("gate-open");
    doc.querySelector.mockReturnValue({});
    freeStrayScrollLock();
    expect(classes.has("gate-open")).toBe(true);
  });
});
