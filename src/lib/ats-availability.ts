/**
 * Availability vocabulary and display-only selectors shared by the staff ATS.
 *
 * Filtering here never changes an application, stage, milestone, or HR-review
 * flag — it only narrows what the signed-in staff member sees.
 */

export type AvailabilityCategoryKey = "noc" | "early_morning" | "midday" | "weekday_evening";

export type AvailabilityCategory = {
  key: AvailabilityCategoryKey;
  label: string;
  window: string;
  days: string[];
  /** Column in the submitted application data that holds this answer. */
  field: string;
};

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAYS = WEEK.slice(0, 5);

export const AVAILABILITY_CATEGORIES: AvailabilityCategory[] = [
  {
    key: "noc",
    label: "NOC / Overnight",
    window: "10:00 PM–8:00 AM",
    days: WEEK,
    field: "overnight_availability",
  },
  {
    key: "early_morning",
    label: "Early-morning doctor appointments",
    window: "7:00 AM–11:30 AM",
    days: WEEKDAYS,
    field: "early_morning_availability",
  },
  {
    key: "midday",
    label: "Midday / early-afternoon doctor appointments",
    window: "11:30 AM–2:30 PM",
    days: WEEKDAYS,
    field: "mid_afternoon_availability",
  },
  {
    key: "weekday_evening",
    label: "Weekday afternoon/evening",
    window: "2:15 PM–10:00 PM",
    days: WEEKDAYS,
    field: "weekday_evening_availability",
  },
];

export const SHORT_CATEGORY_LABEL: Record<AvailabilityCategoryKey, string> = {
  noc: "NOC",
  early_morning: "Morning",
  midday: "Midday",
  weekday_evening: "Afternoon",
};

/** `null` means the answer did not exist on the submitted application version. */
export type AvailabilityAnswer = { days: string[] } | { notAvailable: true } | null;

export type ApplicantAvailability = Record<AvailabilityCategoryKey, AvailabilityAnswer>;

export function emptyAvailability(): ApplicantAvailability {
  return { noc: null, early_morning: null, midday: null, weekday_evening: null };
}

/** Parses one submitted availability answer from stored application data. */
export function parseAvailabilityAnswer(
  raw: unknown,
  category: AvailabilityCategory,
): AvailabilityAnswer {
  if (raw == null) return null;
  const list = (Array.isArray(raw) ? raw : [raw]).filter(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  if (list.length === 0) return null;
  const days = list.filter((v) => category.days.includes(v));
  if (days.length > 0) return { days };
  // Any remaining answer is one of the "not available for this shift" choices.
  return { notAvailable: true };
}

export function availabilityFromApplicationData(
  data: Record<string, unknown> | null | undefined,
): ApplicantAvailability {
  const out = emptyAvailability();
  if (!data) return out;
  for (const cat of AVAILABILITY_CATEGORIES) {
    out[cat.key] = parseAvailabilityAnswer(data[cat.field], cat);
  }
  return out;
}

/* ------------------------------ filter state ------------------------------ */

export type AvailabilityMode = "every" | "any";

export type AvailabilityRule = { days: string[]; mode: AvailabilityMode };

export type FilterState = Record<AvailabilityCategoryKey, AvailabilityRule>;

export function emptyRule(): AvailabilityRule {
  return { days: [], mode: "any" };
}

export function emptyFilters(): FilterState {
  return {
    noc: emptyRule(),
    early_morning: emptyRule(),
    midday: emptyRule(),
    weekday_evening: emptyRule(),
  };
}

export function ruleActive(rule: AvailabilityRule) {
  return rule.days.length > 0;
}

export function filtersActive(f: FilterState) {
  return AVAILABILITY_CATEGORIES.some((c) => ruleActive(f[c.key]));
}

export function activeCategories(f: FilterState) {
  return AVAILABILITY_CATEGORIES.filter((c) => ruleActive(f[c.key]));
}

function matchesRule(
  availability: ApplicantAvailability,
  key: AvailabilityCategoryKey,
  rule: AvailabilityRule,
) {
  const answer = availability[key];
  // A missing answer is never read as "Not available" — and never satisfies a filter.
  if (!answer || "notAvailable" in answer) return false;
  const available = answer.days;
  return rule.mode === "every"
    ? rule.days.every((d) => available.includes(d))
    : rule.days.some((d) => available.includes(d));
}

/** Availability-only matching. Every active section must be satisfied. */
export function matchesAvailability(availability: ApplicantAvailability, f: FilterState) {
  return activeCategories(f).every((c) => matchesRule(availability, c.key, f[c.key]));
}

const short = (day: string) => day.slice(0, 3);

/** e.g. "Morning: Mon + Wed · Afternoon: Tue or Thu" */
export function filterSummary(f: FilterState) {
  return activeCategories(f)
    .map((c) => {
      const rule = f[c.key];
      const joiner = rule.mode === "every" ? " + " : " or ";
      return `${SHORT_CATEGORY_LABEL[c.key]}: ${rule.days.map(short).join(joiner)}`;
    })
    .join(" · ");
}

/** The applicant's own submitted days for the currently active categories. */
export function relevantAvailability(availability: ApplicantAvailability, f: FilterState) {
  return activeCategories(f).map((c) => {
    const answer = availability[c.key];
    const value = !answer
      ? "Not captured"
      : "notAvailable" in answer
        ? "Not available"
        : answer.days.map(short).join(", ");
    return `${SHORT_CATEGORY_LABEL[c.key]}: ${value}`;
  });
}
