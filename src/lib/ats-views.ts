/** Display-only view selectors for the signed-in ATS applicant list. */
import { normalizeStatus, STATUS_KEYS, type StatusKey } from "@/lib/ats-workflow";
import {
  matchesAvailability,
  type ApplicantAvailability,
  type FilterState,
} from "@/lib/ats-availability";

export type StageView = "all" | StatusKey;

export const STAGE_ORDER: StatusKey[] = STATUS_KEYS;

export type AlertKey = "overdue" | "hr" | "awaiting" | "mine";
export type AlertView = AlertKey | null;

export const ALERT_OPTIONS: { key: AlertKey; label: string; help: string }[] = [
  {
    key: "overdue",
    label: "Overdue",
    help: "Current incomplete milestone has passed its assigned deadline.",
  },
  {
    key: "hr",
    label: "HR review items",
    help: "At least one HR-review flag is still open.",
  },
  {
    key: "awaiting",
    label: "Awaiting confirmation",
    help: "A proposed phone, Interview #1, or Interview #2 time has not been confirmed or declined.",
  },
  {
    key: "mine",
    label: "Assigned to me",
    help: "Currently assigned to you.",
  },
];

/** Minimum shape the view selectors need from an applicant row. */
export type ViewRow = {
  name: string;
  email: string;
  reference: string;
  status: string;
  assignedTo: string | null;
  dueAt: string | null;
  completedAt: string | null;
  openFlagCount: number;
  confirmationPending: boolean;
  availability: ApplicantAvailability;
};

export function isOverdue(row: ViewRow) {
  return !!row.dueAt && !row.completedAt && new Date(row.dueAt).getTime() < Date.now();
}

export function matchesAlert(row: ViewRow, key: AlertKey, myId: string) {
  switch (key) {
    case "overdue":
      return isOverdue(row);
    case "hr":
      return row.openFlagCount > 0;
    case "awaiting":
      return row.confirmationPending;
    case "mine":
      return !!myId && row.assignedTo === myId;
  }
}

export function applyView<T extends ViewRow>(
  list: T[],
  opts: {
    stage: StageView;
    alert: AlertView;
    filters: FilterState;
    query: string;
    myId: string;
  },
) {
  const q = opts.query.trim().toLowerCase();
  return list.filter((row) => {
    if (q && !`${row.name} ${row.reference} ${row.email}`.toLowerCase().includes(q)) return false;
    if (opts.stage !== "all" && normalizeStatus(row.status) !== opts.stage) return false;
    if (opts.alert && !matchesAlert(row, opts.alert, opts.myId)) return false;
    return matchesAvailability(row.availability, opts.filters);
  });
}
