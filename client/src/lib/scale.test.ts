import { describe, expect, it } from "vitest";
import { CONCERN_RATING, flagNeedsCheckIn, getScaleColor, SCALE_LABELS } from "./scale";

/** Convenience: the ratings that got flagged, for readable assertions. */
const flagged = (ratings: number[]) =>
  ratings.filter((_, i) => flagNeedsCheckIn(ratings)[i]);

describe("flagNeedsCheckIn — absolute floor", () => {
  it("flags a low rating even as the very first response", () => {
    expect(flagged([2])).toEqual([2]);
  });

  it("flags every student when the whole class is struggling", () => {
    // The case a purely relative rule misses entirely: no deviation to detect,
    // yet every one of these students needs attention.
    const ratings = [2, 2, 3, 2, 1, 3];
    expect(flagged(ratings)).toEqual(ratings);
  });

  it("flags at the concern rating but not just above it", () => {
    expect(flagged([CONCERN_RATING])).toEqual([CONCERN_RATING]);
    expect(flagged([CONCERN_RATING + 1])).toEqual([]);
  });
});

describe("flagNeedsCheckIn — relative rule", () => {
  it("flags a student sitting well below an otherwise healthy class", () => {
    expect(flagged([8, 8, 9, 8, 9, 5])).toEqual([5]);
  });

  it("flags struggling students in a split room", () => {
    // High variance previously pushed the threshold out far enough that nobody
    // was flagged, despite three students at 2-3.
    expect(flagged([9, 9, 8, 2, 2, 3])).toEqual([2, 2, 3]);
  });

  it("does not fire on a tight, healthy spread", () => {
    expect(flagged([7, 7, 7, 8, 7, 6])).toEqual([]);
  });

  it("needs at least three responses before comparing to the class", () => {
    // 6 is below the mean of [9, 6] but two responses say nothing about spread,
    // and 6 is above the absolute floor.
    expect(flagged([9, 6])).toEqual([]);
  });
});

describe("flagNeedsCheckIn — never flags thriving students", () => {
  it("ignores a student far above their class", () => {
    expect(flagged([5, 5, 4, 6, 5, 10])).toEqual([]);
  });

  it("never flags a rating above the midpoint, whatever the class looks like", () => {
    const arrangements = [
      [1, 10, 10],
      [10, 10, 10],
      [4, 9, 10, 9], // the 4 is correctly flagged; the 9s and 10 must not be
      [2, 2, 10],
      [6, 6, 6, 10],
    ];
    for (const ratings of arrangements) {
      const flags = flagNeedsCheckIn(ratings);
      const flaggedRatings = ratings.filter((_, i) => flags[i]);
      expect(Math.max(0, ...flaggedRatings)).toBeLessThanOrEqual(5);
    }
  });

  it("flags a student sitting far below a thriving class", () => {
    expect(flagged([4, 9, 10, 9])).toEqual([4]);
  });
});

describe("flagNeedsCheckIn — shape", () => {
  it("returns one flag per rating, in order", () => {
    const ratings = [8, 7, 5, 2, 9, 7, 6];
    const flags = flagNeedsCheckIn(ratings);
    expect(flags).toHaveLength(ratings.length);
    expect(flags[3]).toBe(true); // the 2
    expect(flags.filter(Boolean)).toHaveLength(1);
  });

  it("handles an empty session", () => {
    expect(flagNeedsCheckIn([])).toEqual([]);
  });
});

describe("scale colors and labels", () => {
  it("covers every rating on the 1-10 scale", () => {
    for (let r = 1; r <= 10; r++) {
      expect(getScaleColor(r)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(SCALE_LABELS[r]).toBeTruthy();
    }
  });

  it("moves from the surviving end to the thriving end", () => {
    expect(getScaleColor(1)).not.toBe(getScaleColor(10));
  });
});
