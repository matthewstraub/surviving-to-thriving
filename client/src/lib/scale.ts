/**
 * The shared 1–10 "surviving to thriving" scale.
 *
 * These colors are semantic rather than institutional: students read red as
 * struggling and green as thriving at a glance, so the ramp stays fixed across
 * brand changes. Keep it visually distinct from whatever the brand accent is.
 */

/** Low end of the scale — used for the "Surviving" label and ratings 1–2. */
export const SCALE_SURVIVING = "#dc3c3c";
/** High end of the scale — used for the "Thriving" label and ratings 9–10. */
export const SCALE_THRIVING = "#1e8c64";

const SCALE_COLORS = [
  SCALE_SURVIVING, // 1–2   struggling
  "#e68c32", // 3–4
  "#c8b432", // 5–6
  "#50aa50", // 7–8
  SCALE_THRIVING, // 9–10  thriving
] as const;

/** Color for a single 1–10 rating. */
export function getScaleColor(rating: number): string {
  if (rating <= 2) return SCALE_COLORS[0];
  if (rating <= 4) return SCALE_COLORS[1];
  if (rating <= 6) return SCALE_COLORS[2];
  if (rating <= 8) return SCALE_COLORS[3];
  return SCALE_COLORS[4];
}

/** Left-to-right ramp used behind the slider and the mini scale bars. */
export function getScaleGradient(): string {
  return `linear-gradient(to right, ${SCALE_COLORS.join(", ")})`;
}

/** Wording shown to students beneath the slider. */
export const SCALE_LABELS: Record<number, string> = {
  1: "Barely surviving",
  2: "Really struggling",
  3: "Having a tough time",
  4: "Below average",
  5: "Getting by",
  6: "Doing okay",
  7: "Feeling good",
  8: "Doing great",
  9: "Really thriving",
  10: "Absolutely thriving!",
};

// ─── Who needs a check-in ───────────────────────────────────────────

/**
 * Ratings at or below this are always flagged, however the rest of the class is
 * doing. This absolute floor matters because a purely relative rule goes silent
 * exactly when it is needed most: if a whole class reports 2s and 3s there is no
 * deviation to detect, and nobody gets flagged.
 */
export const CONCERN_RATING = 3;

/** Someone below their class is only flagged if they are not already doing okay. */
const RELATIVE_CEILING = 5;

/** How far below the class mean counts as "notably below". */
const RELATIVE_SIGMA = 1.5;

/** A mean and spread are meaningless until a few students have responded. */
const MIN_RESPONSES_FOR_RELATIVE = 3;

/**
 * Flags students who may need the instructor's attention, aligned by index with
 * the ratings passed in.
 *
 * Deliberately one-sided: a student thriving at 10/10 is statistically unusual
 * but is not a concern, and badging them buries the students who are.
 */
export function flagNeedsCheckIn(ratings: number[]): boolean[] {
  const flags = ratings.map((rating) => rating <= CONCERN_RATING);

  if (ratings.length >= MIN_RESPONSES_FOR_RELATIVE) {
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const stdDev = Math.sqrt(
      ratings.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratings.length
    );
    const notablyBelow = mean - RELATIVE_SIGMA * stdDev;

    ratings.forEach((rating, i) => {
      if (rating <= RELATIVE_CEILING && rating < notablyBelow) flags[i] = true;
    });
  }

  return flags;
}
