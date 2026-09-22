/**
 * Private HR discussion flags (prototype store).
 *
 * Flags are created when an applicant selects a response that requires a human
 * conversation but is NOT disqualifying. They are never shown to the applicant
 * and never end an application. Until the applicant backend is connected, flags
 * live in this browser's localStorage so the employer dashboard can display
 * them; they are not permanently saved.
 */

export const HR_FLAG_STATUSES = ["Needs Review", "Discussed", "Resolved"] as const;
export type HrFlagStatus = (typeof HR_FLAG_STATUSES)[number];

export type HrFlag = {
  id: string;
  attemptId: string;
  applicantName: string;
  /** The exact question that triggered the flag. */
  question: string;
  /** The applicant's exact response. */
  answer: string;
  createdAt: string;
  status: HrFlagStatus;
  /** Private HR notes. */
  notes: string;
};

const KEY = "elev8.hr_discussion_flags.v1";
const EVENT = "elev8:hr-flags-changed";

function read(): HrFlag[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as HrFlag[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(flags: HrFlag[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(flags));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function listHrFlags(): HrFlag[] {
  return read().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Creates one separate flag per triggering question/response pair. Existing
 * flags are never combined or overwritten; a repeat of the same
 * attempt + question + response is skipped so it is not duplicated.
 */
export function recordHrFlags(input: {
  attemptId: string;
  applicantName: string;
  entries: { question: string; answer: string }[];
}): HrFlag[] {
  if (!input.entries.length) return [];
  const existing = read();
  const created: HrFlag[] = [];
  for (const entry of input.entries) {
    const duplicate = existing.some(
      (f) =>
        f.attemptId === input.attemptId &&
        f.question === entry.question &&
        f.answer === entry.answer,
    );
    if (duplicate) continue;
    created.push({
      id: `${input.attemptId}-${existing.length + created.length + 1}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      attemptId: input.attemptId,
      applicantName: input.applicantName || "Applicant",
      question: entry.question,
      answer: entry.answer,
      createdAt: new Date().toISOString(),
      status: "Needs Review",
      notes: "",
    });
  }
  if (created.length) write([...existing, ...created]);
  return created;
}

export function updateHrFlag(id: string, patch: Partial<Pick<HrFlag, "status" | "notes">>) {
  write(read().map((f) => (f.id === id ? { ...f, ...patch } : f)));
}

export function subscribeHrFlags(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function formatFlagTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
