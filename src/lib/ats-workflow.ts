/**
 * ATS workflow vocabulary — shared by the staff UI, the server functions, and
 * (through a generated catalog) the database.
 *
 * Database values are stable lowercase keys. Everything a person reads comes
 * from the `label` fields here.
 */

export type StatusKey =
  | "new"
  | "screening"
  | "interview_1"
  | "interview_2"
  | "offer"
  | "hired"
  | "not_selected";

export const STATUSES: { key: StatusKey; label: string }[] = [
  { key: "new", label: "New" },
  { key: "screening", label: "Screening" },
  { key: "interview_1", label: "Interview #1" },
  { key: "interview_2", label: "Interview #2" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "not_selected", label: "Not Selected" },
];

export const STATUS_KEYS = STATUSES.map((s) => s.key) as StatusKey[];

export function statusLabel(key: string | null | undefined): string {
  // Records created before the workflow existed carry the intake default.
  if (!key || key === "submitted") return "New";
  return STATUSES.find((s) => s.key === key)?.label ?? key;
}

/** Normalizes any historic status value to a workflow status key. */
export function normalizeStatus(value: string | null | undefined): StatusKey {
  if (!value || value === "submitted") return "new";
  if ((STATUS_KEYS as string[]).includes(value)) return value as StatusKey;
  // Records created before Interview #1 / #2 were split, or before the
  // reference-check stage was removed, land on Interview #1.
  if (value === "interview" || value === "reference_check") return "interview_1";
  const byLabel = STATUSES.find((s) => s.label.toLowerCase() === value.toLowerCase());
  return byLabel?.key ?? "new";
}

export type Milestone = {
  key: string;
  label: string;
  status: StatusKey;
  /** Milestones the applicant, not staff, is expected to act on next. */
  awaitingApplicant?: boolean;
  requiresExplanation?: boolean;
};

/**
 * The approved hiring sequence. Pending conditions (outreach pending, awaiting
 * confirmation, decision pending, overdue) are statuses applied to a milestone,
 * not milestones of their own. Not Selected is a terminal decision, so it is
 * not part of the sequential progression.
 */
export const MILESTONES: Milestone[] = [
  { key: "application_received", label: "Application received", status: "new" },

  { key: "initial_outreach", label: "Initial outreach", status: "screening" },
  { key: "applicant_response_received", label: "Applicant response received", status: "screening", awaitingApplicant: true },
  { key: "phone_interview_scheduled_v2", label: "Phone interview scheduled", status: "screening" },
  { key: "phone_interview_confirmed_v2", label: "Phone interview confirmed", status: "screening", awaitingApplicant: true },
  { key: "phone_interview_completed_v2", label: "Phone interview completed", status: "screening" },
  { key: "screening_decision_recorded", label: "Screening decision recorded", status: "screening" },

  { key: "i1_availability_requested", label: "Availability requested", status: "interview_1", awaitingApplicant: true },
  { key: "i1_availability_received", label: "Availability received", status: "interview_1" },
  { key: "i1_interview_scheduled", label: "Interview scheduled", status: "interview_1" },
  { key: "i1_interview_confirmed", label: "Interview confirmed", status: "interview_1", awaitingApplicant: true },
  { key: "i1_confirmation_received", label: "Candidate confirmation received", status: "interview_1", awaitingApplicant: true },
  { key: "i1_interview_completed", label: "Interview completed", status: "interview_1" },
  { key: "i1_decision_recorded", label: "Interview decision recorded", status: "interview_1" },
  { key: "i1_advancement_call", label: "Advancement call", status: "interview_1" },

  { key: "i2_materials_sent", label: "Materials sent", status: "interview_2" },
  { key: "i2_availability_requested", label: "Availability requested", status: "interview_2", awaitingApplicant: true },
  { key: "i2_availability_received", label: "Availability received", status: "interview_2" },
  { key: "i2_interview_scheduled", label: "Interview scheduled", status: "interview_2" },
  { key: "i2_interview_confirmed", label: "Interview confirmed", status: "interview_2", awaitingApplicant: true },
  { key: "i2_interview_completed", label: "Interview completed", status: "interview_2" },
  { key: "i2_decision_recorded", label: "Interview decision recorded", status: "interview_2" },

  { key: "offer_call_scheduled", label: "Verbal offer call scheduled", status: "offer" },
  { key: "offer_extended", label: "Verbal offer extended", status: "offer", awaitingApplicant: true },
  { key: "offer_decision_received", label: "Applicant decision received", status: "offer", awaitingApplicant: true },
  { key: "offer_handoff_completed", label: "Onboarding handoff completed", status: "offer" },

  { key: "hired_onboarding_initiated", label: "Onboarding initiated", status: "hired" },
  { key: "hired_onboarding_in_progress", label: "Onboarding in progress", status: "hired" },
  { key: "hired_cleared_to_work", label: "Cleared to begin work", status: "hired" },
  { key: "hired_start_date_scheduled", label: "Start date scheduled", status: "hired" },
  { key: "hired_onboarding_completed", label: "Onboarding completed", status: "hired" },

  { key: "closed_no_response", label: "Closed—no response", status: "not_selected" },
  { key: "closed_qualifications", label: "Closed—qualifications", status: "not_selected" },
  { key: "closed_availability", label: "Closed—availability", status: "not_selected" },
  { key: "closed_phone_interview_outcome", label: "Closed—phone interview outcome", status: "not_selected" },
  { key: "closed_interview1_outcome", label: "Closed—Interview #1 outcome", status: "not_selected" },
  { key: "closed_interview2_outcome", label: "Closed—Interview #2 outcome", status: "not_selected" },
  { key: "closed_offer_declined", label: "Closed—offer declined", status: "not_selected" },
  { key: "closed_other", label: "Closed—other", status: "not_selected", requiresExplanation: true },
];

/**
 * Milestone keys retired by the approved sequence. They are kept only so
 * historical milestone and activity rows keep their original wording, and so a
 * record that has not been remapped yet still reads correctly.
 */
export const LEGACY_MILESTONES: { key: string; label: string; mapsTo: string }[] = [
  { key: "initial_outreach_pending", label: "Initial outreach pending", mapsTo: "initial_outreach" },
  { key: "initial_text_sent", label: "Initial text sent", mapsTo: "applicant_response_received" },
  { key: "second_outreach_pending", label: "Second outreach pending", mapsTo: "applicant_response_received" },
  { key: "second_outreach_sent", label: "Second outreach sent", mapsTo: "applicant_response_received" },
  { key: "phone_availability_received", label: "Phone availability received", mapsTo: "phone_interview_scheduled_v2" },
  { key: "phone_interview_scheduled", label: "Phone interview scheduled", mapsTo: "phone_interview_scheduled_v2" },
  { key: "phone_interview_confirmed", label: "Phone interview confirmed", mapsTo: "phone_interview_confirmed_v2" },
  { key: "phone_interview_completed", label: "Phone interview completed", mapsTo: "phone_interview_completed_v2" },
  { key: "screening_decision_pending", label: "Screening decision pending", mapsTo: "screening_decision_recorded" },
  { key: "interview1_availability_requested", label: "Interview #1 availability requested", mapsTo: "i1_availability_requested" },
  { key: "interview1_availability_received", label: "Interview #1 availability received", mapsTo: "i1_availability_received" },
  { key: "interview1_scheduled", label: "Interview #1 scheduled", mapsTo: "i1_interview_scheduled" },
  { key: "interview1_confirmation_pending", label: "Interview #1 confirmation pending", mapsTo: "i1_interview_scheduled" },
  { key: "interview1_confirmed", label: "Interview #1 confirmed", mapsTo: "i1_interview_confirmed" },
  { key: "interview1_completed", label: "Interview #1 completed", mapsTo: "i1_interview_completed" },
  { key: "interview1_decision_pending", label: "Interview #1 decision pending", mapsTo: "i1_decision_recorded" },
  { key: "interview2_materials_pending", label: "Interview #2 materials pending", mapsTo: "i2_materials_sent" },
  { key: "interview2_materials_sent", label: "Interview #2 materials sent", mapsTo: "i2_availability_requested" },
  { key: "interview2_availability_requested", label: "Interview #2 availability requested", mapsTo: "i2_availability_requested" },
  { key: "interview2_availability_received", label: "Interview #2 availability received", mapsTo: "i2_availability_received" },
  { key: "interview2_scheduled", label: "Interview #2 scheduled", mapsTo: "i2_interview_scheduled" },
  { key: "interview2_confirmation_pending", label: "Interview #2 confirmation pending", mapsTo: "i2_interview_scheduled" },
  { key: "interview2_confirmed", label: "Interview #2 confirmed", mapsTo: "i2_interview_confirmed" },
  { key: "interview2_completed", label: "Interview #2 completed", mapsTo: "i2_interview_completed" },
  { key: "interview2_decision_pending", label: "Interview #2 decision pending", mapsTo: "i2_decision_recorded" },
  { key: "verbal_offer_pending", label: "Verbal offer pending", mapsTo: "offer_call_scheduled" },
  { key: "verbal_offer_extended", label: "Verbal offer extended", mapsTo: "offer_extended" },
  { key: "verbal_offer_accepted", label: "Verbal offer accepted", mapsTo: "offer_decision_received" },
  { key: "verbal_offer_declined", label: "Verbal offer declined", mapsTo: "offer_decision_received" },
  { key: "onboarding_initiated", label: "Onboarding initiated", mapsTo: "hired_onboarding_initiated" },
  { key: "onboarding_in_progress", label: "Onboarding in progress", mapsTo: "hired_onboarding_in_progress" },
  { key: "onboarding_completed", label: "Onboarding completed", mapsTo: "hired_onboarding_completed" },
];

const LEGACY_BY_KEY = new Map(LEGACY_MILESTONES.map((m) => [m.key, m]));

export const MILESTONE_BY_KEY = new Map(MILESTONES.map((m) => [m.key, m]));

/** Reads any stored milestone value, current or historical, as an approved key. */
export function normalizeMilestone(key: string | null | undefined): string {
  if (!key) return "application_received";
  if (MILESTONE_BY_KEY.has(key)) return key;
  return LEGACY_BY_KEY.get(key)?.mapsTo ?? key;
}

export function milestoneLabel(key: string | null | undefined) {
  if (!key) return "Application received";
  return MILESTONE_BY_KEY.get(key)?.label ?? LEGACY_BY_KEY.get(key)?.label ?? key;
}

export function milestonesForStatus(status: StatusKey) {
  return MILESTONES.filter((m) => m.status === status);
}

export function milestoneOrdinal(key: string) {
  return MILESTONES.findIndex((m) => m.key === normalizeMilestone(key));
}

/**
 * Milestones may advance one step at a time, or move sideways within the same
 * status, or move backwards (a correction). Any larger jump forward is a skip
 * and needs an Admin/HR override reason.
 */
export function isSkip(fromKey: string | null | undefined, toKey: string) {
  const from = milestoneOrdinal(fromKey ?? "application_received");
  const to = milestoneOrdinal(toKey);
  if (from < 0 || to < 0) return false;
  // Closing an application is always allowed without an override.
  if (MILESTONE_BY_KEY.get(toKey)?.status === "not_selected") return false;
  return to - from > 1;
}

/** Interview #2 is only reachable through the recorded advance decision. */
export const INTERVIEW2_ENTRY_MILESTONE = "i2_materials_sent";
export const INTERVIEW1_COMPLETED_MILESTONE = "i1_interview_completed";


export function canAdvanceToInterview2(input: {
  status: StatusKey;
  interview1Completed: boolean;
}) {
  return input.interview1Completed && input.status === "interview_1";
}

export const COMMUNICATION_TYPES = [
  { key: "text_attempted", label: "Text attempted" },
  { key: "text_sent", label: "Text sent" },
  { key: "applicant_responded", label: "Applicant responded" },
  { key: "call_attempted", label: "Phone call attempted" },
  { key: "call_completed", label: "Phone call completed" },
  { key: "voicemail_left", label: "Voicemail left" },
  { key: "confirmation_requested", label: "Confirmation requested" },
  { key: "confirmation_received", label: "Confirmation received" },
  { key: "deadline_missed", label: "Deadline missed" },
  { key: "reschedule_requested", label: "Reschedule requested" },
  { key: "reschedule_approved", label: "Reschedule approved" },
  { key: "reschedule_denied", label: "Reschedule denied" },
] as const;

export const COMMUNICATION_KEYS = COMMUNICATION_TYPES.map((c) => c.key);

export function communicationLabel(key: string) {
  return COMMUNICATION_TYPES.find((c) => c.key === key)?.label ?? key;
}

export const CONFIRMATION_STATES = [
  { key: "awaiting_confirmation", label: "Awaiting confirmation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "applicant_declined", label: "Applicant declined proposed time" },
  { key: "rescheduling_under_review", label: "Rescheduling under review" },
  { key: "rescheduled", label: "Rescheduled" },
  { key: "confirmation_deadline_missed", label: "Confirmation deadline missed" },
] as const;

export type ConfirmationStateKey = (typeof CONFIRMATION_STATES)[number]["key"];

export function confirmationLabel(key: string | null | undefined) {
  if (!key) return "Not scheduled";
  return CONFIRMATION_STATES.find((c) => c.key === key)?.label ?? key;
}

/** Once the applicant has confirmed, rescheduling is closed. */
export function canReschedule(state: string | null | undefined) {
  return state !== "confirmed";
}

export const SCHEDULING_KINDS = [
  { key: "phone", label: "Phone interview" },
  { key: "interview_1", label: "Interview #1" },
  { key: "interview_2", label: "Interview #2" },
] as const;

export const PHONE_WINDOW_DEFAULT = { start: "18:00", end: "22:00" };

export const EVENT_LABELS: Record<string, string> = {
  application_received: "Application received",
  assigned: "Applicant assigned",
  reassigned: "Applicant reassigned",
  status_changed: "Status changed",
  milestone_changed: "Milestone changed",
  milestone_completed: "Milestone completed",
  deadline_set: "Deadline created or changed",
  message_recorded: "Message recorded as sent",
  communication_recorded: "Communication recorded",
  confirmation_changed: "Confirmation state changed",
  scheduling_updated: "Scheduling updated",
  slots_offered: "Interview slots offered",
  materials_sent: "Interview #2 materials sent",
  materials_acknowledged: "Materials acknowledgment recorded",
  deadline_missed: "Deadline missed",
  file_accessed: "File opened",
  flag_updated: "HR flag updated",
  note_added: "Private note added",
  workflow_override: "Workflow override used",
  advanced_to_interview_2: "Advanced to Interview #2",
  milestone_jumped: "Manually moved to another step",
};

export function eventLabel(key: string) {
  return EVENT_LABELS[key] ?? key.replace(/_/g, " ");
}

/**
 * Every milestone grouped by stage, in catalog order — used by the
 * "Jump to step" override control.
 */
export function milestonesByStage(): { status: StatusKey; label: string; milestones: Milestone[] }[] {
  return STATUSES.map((stage) => ({
    status: stage.key,
    label:
      stage.key === "not_selected"
        ? "Closed / not selected"
        : stage.key === "new"
          ? "Application"
          : stage.label,
    milestones: MILESTONES.filter((m) => m.status === stage.key),
  })).filter((group) => group.milestones.length > 0);
}

// ---------------------------------------------------------------------------
// Approved message templates
//
// Approved Elev8 recruiting language. "Patients" is intentional where it
// appears. An applicant is always referred to by name and never called an
// employee before an accepted offer and started onboarding.
// ---------------------------------------------------------------------------

export function formatTime12(value: string) {
  const parts = value.split(":");
  const h = Number.parseInt(parts[0] ?? "", 10);
  const m = Number.parseInt(parts[1] ?? "", 10);
  if (Number.isNaN(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(Number.isNaN(m) ? 0 : m).padStart(2, "0")} ${suffix}`;
}


export function formatDateLong(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export const NONRESPONSE_SENTENCE =
  "If we do not hear from you by [deadline], we will close your application for this hiring cycle.";

export const CONFIRMATION_SENTENCE =
  "Please confirm within 24 hours whether this date and time work for you. If the proposed time does not work, let us know within that confirmation period so we can review other available options. Once you confirm the interview, it cannot be rescheduled.";

export const PHONE_WINDOW_EXPLANATION =
  "The phone interview will not last four hours. The call may take place at any time within this window. Please keep your phone nearby.";

export type TemplateKey =
  | "initial_outreach"
  | "second_outreach"
  | "nonresponse_warning"
  | "phone_interview_window"
  | "interview_slot_offer"
  | "interview_confirmation"
  | "interview2_materials"
  | "verbal_offer"
  | "not_selected";

export type TemplateInput = {
  applicantName: string;
  deadline?: string;
  proposedDate?: string;
  windowStart?: string;
  windowEnd?: string;
  materialsLink?: string;
  slots?: SlotDate[];
  selectionsRequested?: number;
};

export type SlotDate = { date: string; times: string[] };

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name.trim();
}

export function countSlots(slots: SlotDate[]) {
  return slots.reduce((total, d) => total + d.times.filter(Boolean).length, 0);
}

/**
 * Wording adapts to the number of slots offered and never asks the applicant
 * for more preferences than there are slots.
 */
export function buildSlotOfferMessage(input: {
  applicantName: string;
  slots: SlotDate[];
  selectionsRequested: number;
  deadline?: string;
}) {
  const total = countSlots(input.slots);
  const asked = Math.max(1, Math.min(input.selectionsRequested || 1, total || 1));
  const lines: string[] = [];

  lines.push(`Hello ${firstName(input.applicantName)},`);
  lines.push("");

  if (total === 0) {
    lines.push(
      "Thank you for your interest in the Support Professional role with Elev8 Services. We will follow up shortly with available interview times.",
    );
    return lines.join("\n");
  }

  if (total === 1) {
    lines.push(
      "Thank you for your interest in the Support Professional role with Elev8 Services. We have one interview time available:",
    );
  } else if (asked === total) {
    lines.push(
      `Thank you for your interest in the Support Professional role with Elev8 Services. We have ${total} interview times available. Please rank all ${total} in order of preference:`,
    );
  } else {
    lines.push(
      `Thank you for your interest in the Support Professional role with Elev8 Services. We have ${total} interview times available. Please reply with your ${asked === 1 ? "preferred time" : `top ${asked} preferences`}:`,
    );
  }
  lines.push("");

  for (const day of input.slots) {
    const times = day.times.filter(Boolean);
    if (!times.length) continue;
    lines.push(`${formatDateLong(day.date)}`);
    for (const time of times) lines.push(`  • ${formatTime12(time)}`);
  }

  lines.push("");
  if (total === 1) {
    lines.push("Please reply to let us know whether this time works for you.");
  }
  lines.push(
    input.deadline
      ? `If we do not hear from you by ${input.deadline}, we will close your application for this hiring cycle.`
      : NONRESPONSE_SENTENCE,
  );
  lines.push("");
  lines.push("Elev8 Services California — Recruiting Team");
  return lines.join("\n");
}

/**
 * Opt-out and help keywords, carried on the first message an applicant
 * receives.
 *
 * A2P 10DLC review expects the recipient to be told how to stop and how to get
 * help within the conversation itself, not only at the point of consent. It is
 * appended to the initial outreach because that is the first message sent; add
 * it to a later template too if carrier feedback asks for it.
 */
export const SMS_KEYWORDS_LINE = "Reply STOP to opt out. Reply HELP for help.";

export function buildTemplate(key: TemplateKey, input: TemplateInput): string {
  const name = firstName(input.applicantName || "Applicant Name");
  const deadlineSentence = input.deadline
    ? `If we do not hear from you by ${input.deadline}, we will close your application for this hiring cycle.`
    : NONRESPONSE_SENTENCE;
  const sign = "Elev8 Services California — Recruiting Team";

  switch (key) {
    case "initial_outreach":
      return [
        `Hello ${name},`,
        "",
        "Thank you for applying to the Support Professional role with Elev8 Services California. We support patients in their homes and in the community, and we are reviewing your application now.",
        "",
        "Please reply to let us know the days and times you are generally available for a short phone interview.",
        "",
        deadlineSentence,
        "",
        sign,
        SMS_KEYWORDS_LINE,
      ].join("\n");
    case "second_outreach":
      return [
        `Hello ${name},`,
        "",
        "We are following up on your application for the Support Professional role with Elev8 Services California. We would still like to speak with you about the role and the patients you would support.",
        "",
        "Please reply with the days and times you are generally available for a short phone interview.",
        "",
        deadlineSentence,
        "",
        sign,
      ].join("\n");
    case "nonresponse_warning":
      return [
        `Hello ${name},`,
        "",
        "We have not yet received your response about scheduling your phone interview for the Support Professional role with Elev8 Services California.",
        "",
        deadlineSentence,
        "",
        sign,
      ].join("\n");
    case "phone_interview_window": {
      const date = input.proposedDate ? formatDateLong(input.proposedDate) : "[date]";
      const start = formatTime12(input.windowStart || PHONE_WINDOW_DEFAULT.start);
      const end = formatTime12(input.windowEnd || PHONE_WINDOW_DEFAULT.end);
      return [
        `Hello ${name},`,
        "",
        `We would like to schedule your phone interview for the Support Professional role with Elev8 Services California on ${date} between ${start} and ${end}.`,
        "",
        PHONE_WINDOW_EXPLANATION,
        "",
        "Please reply to confirm that this date and calling window work for you.",
        "",
        deadlineSentence,
        "",
        sign,
      ].join("\n");
    }
    case "interview_slot_offer":
      return buildSlotOfferMessage({
        applicantName: input.applicantName,
        slots: input.slots ?? [],
        selectionsRequested: input.selectionsRequested ?? 1,
        ...(input.deadline ? { deadline: input.deadline } : {}),
      });
    case "interview_confirmation": {
      const date = input.proposedDate ? formatDateLong(input.proposedDate) : "[date]";
      const start = formatTime12(input.windowStart || "10:00");
      return [
        `Hello ${name},`,
        "",
        `Your interview for the Support Professional role with Elev8 Services California is proposed for ${date} at ${start}.`,
        "",
        CONFIRMATION_SENTENCE,
        "",
        sign,
      ].join("\n");
    }
    case "interview2_materials":
      return [
        `Hello ${name},`,
        "",
        "Thank you for completing your first interview for the Support Professional role with Elev8 Services California. The next step includes a review of the medication support materials our teams use with patients.",
        "",
        `Please review the materials here: ${input.materialsLink || "[secure materials link]"}`,
        "",
        "Reply to confirm that you have received and reviewed the materials. These materials are for your preparation only and contain no patient records or confidential information.",
        "",
        sign,
      ].join("\n");
    case "verbal_offer":
      return [
        `Hello ${name},`,
        "",
        "We are pleased to extend a verbal offer for the Support Professional role with Elev8 Services California. We will review the schedule, pay, and start date with you by phone.",
        "",
        "Please reply to let us know whether you accept this verbal offer so we can begin onboarding.",
        "",
        sign,
      ].join("\n");
    case "not_selected":
      return [
        `Hello ${name},`,
        "",
        "Thank you for your interest in the Support Professional role with Elev8 Services California. We have closed your application for this hiring cycle.",
        "",
        "We appreciate the time you spent with us and encourage you to apply again for a future hiring cycle.",
        "",
        sign,
      ].join("\n");
  }
}

export const TEMPLATE_LIST: { key: TemplateKey; label: string }[] = [
  { key: "initial_outreach", label: "Initial outreach" },
  { key: "second_outreach", label: "Second outreach" },
  { key: "nonresponse_warning", label: "Nonresponse reminder" },
  { key: "phone_interview_window", label: "Phone interview calling window" },
  { key: "interview_slot_offer", label: "Interview slot offer" },
  { key: "interview_confirmation", label: "Interview confirmation" },
  { key: "interview2_materials", label: "Interview #2 materials" },
  { key: "verbal_offer", label: "Verbal offer" },
  { key: "not_selected", label: "Application closed" },
];

export function isOverdue(dueAt: string | null | undefined, completedAt?: string | null) {
  if (!dueAt || completedAt) return false;
  const due = new Date(dueAt).getTime();
  return !Number.isNaN(due) && due < Date.now();
}

export function isDueToday(dueAt: string | null | undefined, completedAt?: string | null) {
  if (!dueAt || completedAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function awaitingApplicant(milestoneKey: string | null | undefined) {
  if (!milestoneKey) return false;
  return !!MILESTONE_BY_KEY.get(milestoneKey)?.awaitingApplicant;
}

// ---------------------------------------------------------------------------
// Screening-stage approved wording (2026 revision)
//
// Staff never type an applicant's name, date, or time by hand: the four
// templates below are generated from the picked date and window. Every
// applicant-facing message ends in the same team signoff — no individual staff
// name or title, ever. The older Screening templates above are kept only so
// messages already recorded keep their original wording.
// ---------------------------------------------------------------------------

export const SCREENING_SIGNOFF = ["Respectfully,", "", "Elev8 Services", "Candidate Selection Team"];

export const SCREENING_POSITION = "Support Professional Intern";
export const SCREENING_PROGRAM = "Paid Internship Program";

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** Minutes between two "HH:MM" values, or null when either is unusable. */
export function windowMinutes(start: string, end: string): number | null {
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":");
    const hours = Number.parseInt(h ?? "", 10);
    const mins = Number.parseInt(m ?? "0", 10);
    if (Number.isNaN(hours)) return null;
    return hours * 60 + (Number.isNaN(mins) ? 0 : mins);
  };
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a === null || b === null) return null;
  const diff = b - a;
  return diff > 0 ? diff : null;
}

/**
 * Plain-language length of the picked calling window — "two hours", "one and a
 * half hours", "45 minutes". Never hardcoded: it always follows the picker.
 */
export function windowDurationPhrase(start: string, end: string): string {
  const minutes = windowMinutes(start, end);
  if (minutes === null) return "the full window";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const word = NUMBER_WORDS[hours] ?? String(hours);
  if (rest === 0) return `${word} ${hours === 1 ? "hour" : "hours"}`;
  if (rest === 30) return `${word} and a half hours`;
  return `${word} ${hours === 1 ? "hour" : "hours"} and ${rest} minutes`;
}

export type ScreeningTemplateKey =
  | "screening_propose"
  | "screening_confirm"
  | "screening_nonresponse"
  | "screening_call_noanswer_followup";

/** Wording still awaiting final sign-off is labelled as a draft in the UI. */
export const SCREENING_TEMPLATE_DRAFT: Record<ScreeningTemplateKey, boolean> = {
  screening_propose: false,
  screening_confirm: false,
  screening_nonresponse: false,
  screening_call_noanswer_followup: true,
};

export const SCREENING_TEMPLATE_LABELS: Record<ScreeningTemplateKey, string> = {
  screening_propose: "Phone interview proposal",
  screening_confirm: "Phone interview confirmation",
  screening_nonresponse: "Nonresponse follow-up",
  screening_call_noanswer_followup: "No-answer follow-up",
};

export type ScreeningTemplateInput = {
  applicantName: string;
  /** "YYYY-MM-DD" — the proposed interview date, or the response deadline. */
  date?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
};

export function buildScreeningTemplate(
  key: ScreeningTemplateKey,
  input: ScreeningTemplateInput,
): string {
  const name = firstName(input.applicantName || "Applicant");
  const when = input.date ? formatDateLong(input.date) : "[weekday], [date]";
  const start = input.windowStart ? formatTime12(input.windowStart) : "[start]";
  const end = input.windowEnd ? formatTime12(input.windowEnd) : "[end]";
  const duration =
    input.windowStart && input.windowEnd
      ? windowDurationPhrase(input.windowStart, input.windowEnd)
      : "the entire window";

  switch (key) {
    case "screening_propose":
      return [
        `Hi ${name},`,
        "",
        `We received your application for the ${SCREENING_POSITION} in our ${SCREENING_PROGRAM}.`,
        "",
        `We'd like to schedule you for a phone interview on ${when}, between ${start} and ${end} to discuss your application further and determine if you qualify for an in-person interview.`,
        "",
        `The phone interview will not take ${duration}; it will simply take place within that time window.`,
        "",
        `Will you be available during this time? If not, which weekday would you be available for a phone interview between ${start} and ${end}?`,
        "",
        "Thank you so much for your time. We look forward to your response! :)",
        "",
        ...SCREENING_SIGNOFF,
      ].join("\n");
    case "screening_confirm":
      return [
        `Hi ${name},`,
        "",
        `You are scheduled for your phone interview on ${when}, between ${start} and ${end}.`,
        "",
        "Please keep your phone nearby during that window, as the call may come at any time. If anything changes with your availability, feel free to let us know.",
        "",
        "We look forward to speaking with you.",
        "",
        ...SCREENING_SIGNOFF,
      ].join("\n");
    case "screening_nonresponse":
      return [
        `Hi ${name},`,
        "",
        `We have not yet received your response regarding scheduling your phone interview for the ${SCREENING_POSITION} with Elev8 Services.`,
        "",
        `If we do not hear from you by ${when}, your application will be closed and you will no longer be eligible for consideration for this internship.`,
        "",
        "Thank you for your interest, and we hope to hear from you.",
        "",
        ...SCREENING_SIGNOFF,
      ].join("\n");
    case "screening_call_noanswer_followup":
      return [
        `Hi ${name},`,
        "",
        "We tried reaching you by phone for your scheduled interview but were unable to connect.",
        "",
        `If we do not hear from you by ${when}, your application will be closed and you will no longer be eligible for consideration for this internship.`,
        "",
        "Thank you for your interest, and we hope to hear from you.",
        "",
        ...SCREENING_SIGNOFF,
      ].join("\n");
  }
}

/** Screening milestones, in order, with the kind of work each one needs. */
export const SCREENING_MILESTONE_KEYS = [
  "application_received",
  "initial_outreach",
  "applicant_response_received",
  "phone_interview_scheduled_v2",
  "phone_interview_confirmed_v2",
  "phone_interview_completed_v2",
  "screening_decision_recorded",
] as const;

export function isScreeningStep(key: string | null | undefined) {
  return (SCREENING_MILESTONE_KEYS as readonly string[]).includes(normalizeMilestone(key));
}

/** Superseded Screening wording — hidden from the pickers, kept for history. */
export const RETIRED_SCREENING_TEMPLATES: TemplateKey[] = [
  "initial_outreach",
  "second_outreach",
  "nonresponse_warning",
  "phone_interview_window",
];

export const MAX_CALL_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Interview #1
//
// Staff never type a candidate's name, a date, or a time into a message: they
// pick days, times, and a deadline, and the approved wording is generated.
// Every Interview #1 message ends in the same team signoff — no staff name.
// ---------------------------------------------------------------------------

export type InterviewFacilityKey = "neuro_care" | "lighthouse_care" | "elev8_services";

/** Always listed in this order — Neuro Care first. */
export const INTERVIEW_FACILITIES: {
  key: InterviewFacilityKey;
  name: string;
  /** Address lines, or a description where there is no single address. */
  lines: string[];
  /** Approved arrival note, where one exists. Nothing is invented. */
  note: string | null;
}[] = [
  {
    key: "neuro_care",
    name: "Neuro Care",
    lines: ["6227 Capri Drive", "San Diego, CA 92120"],
    note: "Neuro Care is an adult residential facility located in a residential home and licensed and regulated by the State of California. When you arrive, please look for a residence rather than a traditional office building.",
  },
  {
    key: "lighthouse_care",
    name: "Lighthouse Care",
    lines: ["8868 Hammond Drive", "San Diego, CA 92123"],
    note: "Lighthouse Care is an adult residential facility located in a residential home and licensed and regulated by the State of California. When you arrive, please look for a residence rather than a traditional office building.",
  },
  {
    key: "elev8_services",
    name: "Elev8 Services",
    lines: [
      "Community-based services, including medical appointments and activities throughout San Diego. A company vehicle is provided for work-related transportation.",
    ],
    note: null,
  },
];

export function facilityByKey(key: string) {
  return INTERVIEW_FACILITIES.find((f) => f.key === key) ?? INTERVIEW_FACILITIES[0]!;
}

export function facilityByName(name: string | null | undefined) {
  if (!name) return null;
  return INTERVIEW_FACILITIES.find((f) => f.name === name) ?? null;
}

/** The interview time slots offered to candidates. */
export const INTERVIEW_TIME_OPTIONS = ["15:00", "15:20", "15:40", "16:00", "16:20", "16:40"];

/** Hourly "HH:MM" values between two hours, inclusive. */
export function hourlyOptions(startHour: number, endHour: number) {
  const out: string[] = [];
  for (let h = startHour; h <= endHour; h += 1) out.push(`${String(h).padStart(2, "0")}:00`);
  return out;
}

/** Nonresponse follow-up deadline times: 8:00 AM – 10:00 PM. */
export const FOLLOWUP_DEADLINE_HOURS = hourlyOptions(8, 22);

/** Confirm-by times on the day of the interview: 10:00 AM – 2:00 PM. */
export const CONFIRM_BY_HOURS = hourlyOptions(10, 14);
export const CONFIRM_BY_DEFAULT = "11:00";

export const MAX_REQUESTED_SLOTS = 5;

export type InterviewDay = { date: string; times: string[] };

/** Days always read chronologically, whatever order staff entered them in. */
export function sortInterviewDays(days: InterviewDay[]) {
  return [...days]
    .filter((d) => d.date && d.times.length > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((d) => ({ date: d.date, times: [...d.times].sort() }));
}

export function formatDateShort(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export type Interview1TemplateKey =
  | "i1_availability_request"
  | "i1_nonresponse_followup"
  | "i1_finalize"
  | "i1_availability_reminder";

export const INTERVIEW1_TEMPLATE_LABELS: Record<Interview1TemplateKey, string> = {
  i1_availability_request: "Interview #1 availability request",
  i1_nonresponse_followup: "Interview #1 nonresponse follow-up",
  i1_finalize: "Interview #1 confirmation",
  i1_availability_reminder: "Interview #1 availability reminder",
};

export type Interview1TemplateInput = {
  applicantName: string;
  days?: InterviewDay[];
  requiredSlots?: number;
  /** Response deadline, "YYYY-MM-DD". */
  deadlineDate?: string | null;
  /** Response deadline time, "HH:MM". */
  deadlineTime?: string | null;
  /** Finalized interview date and time. */
  date?: string | null;
  time?: string | null;
  facility?: InterviewFacilityKey | null;
  confirmBy?: string | null;
  /** How many slots have been identified so far (reminder wording). */
  identified?: number;
};

export function buildInterview1Template(
  key: Interview1TemplateKey,
  input: Interview1TemplateInput,
): string {
  const name = firstName(input.applicantName || "Applicant");
  const days = sortInterviewDays(input.days ?? []);

  switch (key) {
    case "i1_availability_request": {
      const slotLines: string[] = [];
      days.forEach((day) => {
        slotLines.push(formatDateShort(day.date));
        slotLines.push(day.times.map((t) => formatTime12(t)).join(", "));
        slotLines.push("");
      });
      if (slotLines.length === 0) slotLines.push("[offered days and times]", "");
      return [
        `Hi ${name},`,
        "",
        "Thank you for taking the time to speak with us!",
        "",
        "1. COMMUTE REQUIREMENTS",
        "",
        "Please review the information below and confirm that you are comfortable commuting to all three locations, as this position may require working at any of them:",
        "",
        ...INTERVIEW_FACILITIES.flatMap((f) => [f.name, ...f.lines, ""]),
        "2. INTERVIEW AVAILABILITY",
        "",
        `Please select at least ${input.requiredSlots ?? 1} available time slots:`,
        "",
        ...slotLines,
        "If you are available for all listed times, please let us know.",
        "",
        `Please respond by ${input.deadlineDate ? formatDateShort(input.deadlineDate) : "[deadline]"}. If we do not hear from you by the deadline, we will close your application, and you will no longer be eligible to reapply.`,
        "",
        "We look forward to hearing from you.",
        "",
        ...SCREENING_SIGNOFF,
      ].join("\n");
    }
    case "i1_nonresponse_followup":
      return [
        `Hi ${name},`,
        "",
        "We're following up because we have not yet received your response regarding your availability for Interview #1.",
        "",
        `To continue with the application process, please confirm that you are comfortable commuting to the listed locations and provide the requested number of available interview times by ${input.deadlineDate ? formatDateShort(input.deadlineDate) : "[deadline]"}, at ${input.deadlineTime ? formatTime12(input.deadlineTime) : "[time]"}.`,
        "",
        "If we do not receive your response by the deadline, we will assume that you are no longer interested and close your application.",
        "",
        "Thank you for your interest. We hope to hear from you!",
        "",
        ...SCREENING_SIGNOFF,
      ].join("\n");
    case "i1_availability_reminder":
      return [
        `Hi ${name},`,
        "",
        `Thank you for your response. We received ${input.identified ?? 0} of the ${input.requiredSlots ?? 1} available time slots we asked for.`,
        "",
        "So that we can finalize the interview schedule, please let us know any additional times from the list that would work for you.",
        "",
        "Thank you!",
        "",
        ...SCREENING_SIGNOFF,
      ].join("\n");
    case "i1_finalize": {
      const facility = facilityByKey(input.facility ?? "neuro_care");
      return [
        `Hi ${name},`,
        "",
        "We have finalized our interview schedule, and you are scheduled for an in-person interview:",
        "",
        input.date ? formatDateShort(input.date) : "[weekday, date]",
        input.time ? formatTime12(input.time) : "[time]",
        "",
        facility.name,
        ...facility.lines,
        ...(facility.note ? ["", facility.note] : []),
        "",
        "Please bring a copy of your résumé if you did not upload one with your application. Casual, appropriate attire is acceptable.",
        "",
        `Please confirm that the scheduled date and time work for you by ${input.confirmBy ? formatTime12(input.confirmBy) : "[time]"} on the day of your interview. If we do not receive your confirmation by the deadline, the appointment may be offered to an applicant on our waitlist.`,
        "",
        "We look forward to meeting you!",
        "",
        ...SCREENING_SIGNOFF,
      ].join("\n");
    }
  }
}

/** Interview #1 milestones, in order. */
export const INTERVIEW1_MILESTONE_KEYS = [
  "i1_availability_requested",
  "i1_availability_received",
  "i1_interview_scheduled",
  "i1_interview_confirmed",
  "i1_confirmation_received",
  "i1_interview_completed",
  "i1_decision_recorded",
  "i1_advancement_call",
] as const;

export function isInterview1Step(key: string | null | undefined) {
  return (INTERVIEW1_MILESTONE_KEYS as readonly string[]).includes(normalizeMilestone(key));
}

export const INTERVIEW2_MATERIALS_VIDEOS = [
  {
    name: "Administration of Daily Medications",
    url: "https://tinyurl.com/4f3wzdyh",
  },
  { name: "Auditing Meds Daily", url: "https://tinyurl.com/y5yvan4x" },
  { name: "PRNs", url: "https://tinyurl.com/2zcaz3df" },
  { name: "Home Visit Medication", url: "https://tinyurl.com/mpswkwxp" },
  { name: "Hospitalizations", url: "https://tinyurl.com/572mp3ra" },
] as const;

/** Approved, fixed Interview #2 preparation message. */
export function buildInterview2MaterialsMessage(applicantName: string) {
  const name = firstName(applicantName || "Applicant");
  const videoLines = INTERVIEW2_MATERIALS_VIDEOS.flatMap((video, index) => [
    `${index + 1}. ${video.name}: ${video.url}`,
    "",
  ]);

  return [
    `Hi ${name},`,
    "",
    "The patients, team, & I really enjoyed getting to know you!",
    "",
    "Per our conversation, we would like to invite you to our second round of interviews. As part of the second interview, we'll give you a closer look at one of the important responsibilities of the position: medications.",
    "",
    "Here are the medication videos:",
    "",
    ...videoLines,
    "Please review the MEDICATION links. The purpose of this material is to give you a realistic preview of an important part of the position and the types of medication-related responsibilities you may encounter in the role.",
    "",
    "You will be tested on this material during Interview #2, so please make sure you review the videos and documents carefully. You are welcome to take notes as you go.",
    "",
    "If you need a larger screen to view the videos, feel free to forward the links to your email and watch them on a desktop or laptop. You can also change the video quality to 1080 under settings for better visibility. :)",
    "",
    "Feel free to reach out if you have any questions.",
    "",
    "During the second interview, we'll conduct a preliminary medication competency assessment based on the material provided. The purpose is to evaluate how well you understand, process, retain, and apply the information presented to you. Health and safety are paramount to our organization, so this is an important part of our hiring process.",
    "",
    "The second interview takes approximately 1–2 hours. Available Interview #2 time slots will be sent in the next text.",
    "",
    "Thanks again for your time. We look forward to seeing you again soon!",
    "",
    "Elev8 Services",
    "Candidate Selection Team",
  ].join("\n");
}

/**
 * Interview #2 availability times: 7:00 AM – 8:00 PM in 15-minute increments.
 * Wider and finer-grained than Interview #1's fixed slots, and chosen from
 * dropdowns rather than toggle buttons.
 */
export const INTERVIEW2_TIME_OPTIONS = (() => {
  const out: string[] = [];
  for (let minutes = 7 * 60; minutes <= 20 * 60; minutes += 15) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

const ORDINAL_WORDS = ["first", "second", "third", "fourth", "fifth"] as const;

/** "first", "first and second", "first, second, and third", … */
export function rankedChoicePhrase(count: number) {
  const words = ORDINAL_WORDS.slice(0, Math.min(Math.max(count, 1), ORDINAL_WORDS.length));
  const noun = words.length === 1 ? "choice" : "choices";
  if (words.length === 1) return `your ${words[0]} ${noun}`;
  if (words.length === 2) return `your ${words[0]} and ${words[1]} ${noun}`;
  return `your ${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]} ${noun}`;
}

/**
 * Approved Interview #2 availability request. Purely about scheduling: it
 * carries no commute or facility block, unlike the Interview #1 request.
 */
export function buildInterview2AvailabilityMessage(input: {
  applicantName: string;
  days: InterviewDay[];
  choicesRequested: number;
  deadlineDate?: string | null;
}) {
  const name = firstName(input.applicantName || "Applicant");
  const days = sortInterviewDays(input.days);
  const dayLines: string[] = [];
  days.forEach((day) => {
    dayLines.push(formatDateShort(day.date));
    dayLines.push(day.times.map((t) => formatTime12(t)).join(" | "));
    dayLines.push("");
  });
  if (dayLines.length === 0) dayLines.push("[offered days and times]", "");

  return [
    `Hi ${name},`,
    "",
    `Please rank ${rankedChoicePhrase(input.choicesRequested)} for Interview #2. Each interview will take approximately two hours.`,
    "",
    ...dayLines,
    "We will assign your appointment based on availability and send you a confirmation. Once confirmed, the appointment is final. Rescheduling is limited to emergencies and subject to availability.",
    "",
    `Please respond by ${input.deadlineDate ? formatDateShort(input.deadlineDate) : "[deadline]"}.`,
    "",
    "Respectfully,",
    "",
    "Elev8 Services",
    "Candidate Selection Team",
  ].join("\n");
}

/**
 * Advancement call — the live HR call telling the applicant they are moving on
 * to Interview #2. This is a reference script for a conversation, not a message
 * to copy and send, so it carries no dates, times, or slot wording.
 */
export type CallScriptLine =
  | { kind: "line"; speaker: "HR" | "Applicant"; text: string }
  | { kind: "note"; text: string };

export const ADVANCEMENT_CALL_SCRIPT: { title: string; lines: CallScriptLine[] }[] = [
  {
    title: "1. Open the call",
    lines: [
      { kind: "line", speaker: "HR", text: "Hi, this is the Candidate Selection Team with Elev8 Services. Is now still a good time to talk?" },
      { kind: "line", speaker: "Applicant", text: "Yes, now works." },
      { kind: "line", speaker: "HR", text: "Great. Before we get started — how did the first interview feel for you?" },
      { kind: "line", speaker: "Applicant", text: "(brief reaction)" },
      { kind: "line", speaker: "HR", text: "That's good to hear. Thank you for sharing that." },
      { kind: "note", text: "Brief reaction only — don't spend several minutes on the first interview. Move into the decision." },
    ],
  },
  {
    title: "2. Give the update",
    lines: [
      {
        kind: "line",
        speaker: "HR",
        text: "Okay, let me give you an update. We had a chance to speak with the clients after the interviews. And I want to say congratulations. The clients selected you as one of their top candidates, so we would like to advance you to Interview #2.",
      },
      { kind: "note", text: "Pause. Let the applicant react." },
      { kind: "line", speaker: "HR", text: "Would you like to proceed to the second interview?" },
    ],
  },
  {
    title: "3. Explain the medication videos",
    lines: [
      {
        kind: "line",
        speaker: "HR",
        text: "For Interview #2, we're going to send you a set of medication videos to watch beforehand. You can watch them on your own time, pause, replay, and take notes.",
      },
      {
        kind: "line",
        speaker: "HR",
        text: "There is no expectation that you already know this material. The purpose is to see how well you can learn and apply the information we provide.",
      },
    ],
  },
  {
    title: "4. Set expectations for Interview #2",
    lines: [
      {
        kind: "line",
        speaker: "HR",
        text: "In the second interview, you'll have a chance to demonstrate what you learned from the videos.",
      },
      {
        kind: "line",
        speaker: "HR",
        text: "You're welcome to use your notes. The interview is time-limited, so it helps to be familiar with the material beforehand rather than reading through it for the first time.",
      },
    ],
  },
  {
    title: "5. Explain scheduling",
    lines: [
      {
        kind: "line",
        speaker: "HR",
        text: "You'll also receive a separate follow-up text with the available time slots for the second interview, and you'll be able to submit your preferences from those options.",
      },
      {
        kind: "note",
        text: "If they offer a specific time on this call, do not verbally reserve it — “Once we send the available options, you'll be able to submit your preferences.”",
      },
    ],
  },
  {
    title: "6. Recap",
    lines: [
      {
        kind: "line",
        speaker: "HR",
        text: "So to recap: we'll send you the medication videos to watch on your own time, and a separate message with the available time slots for the second interview.",
      },
    ],
  },
  {
    title: "7. Questions & end the call",
    lines: [
      { kind: "line", speaker: "HR", text: "What questions do you have for me?" },
      {
        kind: "note",
        text: "If you don't know an answer: “I don't want to give you the wrong information, so let me confirm that and we'll follow up with you.” Never guess.",
      },
      { kind: "line", speaker: "HR", text: "Thank you again for your time, and congratulations. We're looking forward to the second interview." },
      { kind: "line", speaker: "HR", text: "Have a good rest of your day." },
    ],
  },
];

export const ADVANCEMENT_CALL_REMINDERS = [
  "Never promise a specific interview slot, even if they offer one — no time is reserved on this call.",
  "Don't oversell the video/competency check — frame it as “see how well you can learn,” not an exam.",
  "Every candidate watches the videos, even if they claim to already know the material.",
  "If they want time to think, do not push — do not send Interview #2 prep until they confirm.",
];
