/**
 * Parses a candidate's free-text reply against the interview slots that were
 * actually offered to them.
 *
 * Rules this parser enforces:
 *  - Empty or whitespace-only input matches nothing at all (a no-op).
 *  - Weekday names are case-insensitive; times may be bare ("3:40") or have a
 *    meridiem ("3:40 pm"); dates may be numeric ("9/16") or month-name
 *    ("September 16", "Sep 16").
 *  - Flexible language ("all", "any", "either", "whichever", "whatever",
 *    "anytime") matches every offered slot when no day is named, or every
 *    offered time on the day that is named.
 *  - Once a specific day IS named, matching is restricted to that day.
 *  - A bare time with no day named that exists on more than one offered day
 *    matches all of them, and raises a warning so staff double-check.
 *
 * Output is always a suggestion: the caller shows editable checkboxes and
 * requires an explicit human confirmation before anything is recorded.
 */

export type OfferedSlot = { date: string; time: string };

export type ParseResult = {
  matched: OfferedSlot[];
  warnings: string[];
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const FLEXIBLE = ["all", "any", "either", "whichever", "whatever", "anytime", "any time"];

function slotKey(slot: OfferedSlot) {
  return `${slot.date}|${slot.time}`;
}

function dateParts(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
    weekday: WEEKDAYS[parsed.getDay()]!,
  };
}

/** Minutes since midnight for an "HH:MM" offered time. */
function offeredMinutes(time: string) {
  const [h, m] = time.split(":");
  return Number.parseInt(h ?? "0", 10) * 60 + Number.parseInt(m ?? "0", 10);
}

/**
 * Every plausible reading of a mentioned time. Interview slots are afternoon
 * only, so a bare "3:40" is read as 3:40 PM as well as 3:40 AM.
 */
function timeCandidates(hour: number, minute: number, meridiem: string | null): number[] {
  if (meridiem === "am") return [(hour % 12) * 60 + minute];
  if (meridiem === "pm") return [((hour % 12) + 12) * 60 + minute];
  const base = (hour % 12) * 60 + minute;
  return [base, base + 12 * 60];
}

/** Dates named in the reply, as offered-slot date strings. */
function namedDates(text: string, offered: OfferedSlot[]): string[] {
  const dates = [...new Set(offered.map((s) => s.date))];
  const hits = new Set<string>();

  for (const date of dates) {
    const parts = dateParts(date);
    if (!parts) continue;

    // Numeric: 9/16, 09/16, 9-16
    const numeric = new RegExp(`(?<!\\d)0?${parts.month}\\s*[/-]\\s*0?${parts.day}(?!\\d)`);
    if (numeric.test(text)) hits.add(date);

    // Month name: September 16, Sep 16, 16 September
    const monthName = MONTHS[parts.month - 1]!;
    const monthPattern = `${monthName.slice(0, 3)}[a-z]*\\.?`;
    const dayPattern = `0?${parts.day}(?:st|nd|rd|th)?`;
    if (new RegExp(`${monthPattern}\\s+${dayPattern}(?!\\d)`).test(text)) hits.add(date);
    if (new RegExp(`(?<!\\d)${dayPattern}\\s+(?:of\\s+)?${monthPattern}`).test(text)) hits.add(date);

    // Weekday name
    if (new RegExp(`\\b${parts.weekday}\\b`).test(text)) hits.add(date);
    if (new RegExp(`\\b${parts.weekday.slice(0, 3)}\\b`).test(text)) hits.add(date);
  }

  return [...hits];
}

export function parseInterviewReply(reply: string, offered: OfferedSlot[]): ParseResult {
  const text = (reply ?? "").toLowerCase().trim();
  if (!text || offered.length === 0) return { matched: [], warnings: [] };

  const warnings: string[] = [];
  const days = namedDates(text, offered);
  const scope = days.length > 0 ? offered.filter((s) => days.includes(s.date)) : offered;

  // Times mentioned anywhere in the reply.
  const mentioned: { minutes: number[] }[] = [];
  const timeRe = /(?<!\d)(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/g;
  let match: RegExpExecArray | null;
  while ((match = timeRe.exec(text))) {
    const hour = Number.parseInt(match[1] ?? "", 10);
    const minute = Number.parseInt(match[2] ?? "0", 10);
    if (Number.isNaN(hour) || hour < 1 || hour > 23) continue;
    // Skip bare numbers with no minutes and no meridiem — those are dates or counts.
    if (match[2] === undefined && match[3] === undefined) continue;
    const meridiem = match[3] ? (match[3].startsWith("a") ? "am" : "pm") : null;
    mentioned.push({ minutes: timeCandidates(hour, minute, meridiem) });
  }

  const flexible = FLEXIBLE.some((word) => new RegExp(`\\b${word}\\b`).test(text));
  const matchedKeys = new Set<string>();
  const matched: OfferedSlot[] = [];
  const add = (slot: OfferedSlot) => {
    const key = slotKey(slot);
    if (matchedKeys.has(key)) return;
    matchedKeys.add(key);
    matched.push(slot);
  };

  if (mentioned.length === 0) {
    // No time given: flexible language, or a bare day, means every slot in scope.
    if (flexible || days.length > 0) scope.forEach(add);
    return { matched: sortSlots(matched), warnings };
  }

  for (const time of mentioned) {
    const hits = scope.filter((slot) => time.minutes.includes(offeredMinutes(slot.time)));
    if (hits.length === 0) continue;
    const distinctDays = new Set(hits.map((h) => h.date));
    if (days.length === 0 && distinctDays.size > 1) {
      warnings.push(
        "This time was offered on more than one day — no specific day was named in the reply, so double-check which day is correct before confirming.",
      );
    }
    hits.forEach(add);
  }

  if (matched.length === 0 && flexible) scope.forEach(add);

  return { matched: sortSlots(matched), warnings: [...new Set(warnings)] };
}

export function sortSlots(slots: OfferedSlot[]) {
  return [...slots].sort((a, b) =>
    a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1,
  );
}
