import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  Clock,

  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  HandHeart,
  Church,
  HeartHandshake,

  Info,
  Moon,
  Palette,
  Plus,
  Split,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Choice,
  Field,
  Fieldset,
  RequiredLegend,
  describedBy,
  inputClass,
} from "@/components/apply/fields";
import {
  APPLICATION_DISQUALIFICATION_KEY,
  APPLICATION_DRAFT_KEY,
  clearApplicantApplicationState,
  createApplicationAttempt,
  getOrCreateApplicationAttempt,
} from "@/lib/application-attempt";
import { recordHrFlags } from "@/lib/hr-flags";
import {
  APPLICATION_VERSION,
  SMS_CONSENT_INTRO,
  SMS_CONSENT_AGREE,
  SMS_CONSENT_NOT_GIVEN,
  SMS_CONSENT_PROMPT,
  SMS_CONSENT_QUESTION,
  SMS_CONSENT_RATES,
  SMS_CONSENT_TEXT,
  SMS_PROGRAM_DESCRIPTION,
  SMS_MESSAGE_FREQUENCY,
  SMS_RATES_NOTICE,
  SMS_STOP_REPLY,
  SMS_HELP_REPLY,
} from "@/lib/sms-consent";
import { recordDeclinedTextConsent } from "@/lib/sms-consent.functions";
import {
  CERT_ACCEPT,
  CERT_UPLOAD_HELP,
  parseCertFile,
  parseFileList,
  type CertFileRef,
  uploadCertificationFile,
  validateCertFile,
} from "@/lib/certification-upload";
import { useServerFn } from "@tanstack/react-start";
import { submitApplication } from "@/lib/applications.functions";
import { Button } from "@/components/ui/button";
import elev8Logo from "@/assets/elev8-logo.png.asset.json";


import { SubmittedAnswerRow } from "@/components/ats/SubmittedAnswers";
import {
  normalizeAnswerRow,
  type AnswerField,
  type AnswerRow,
  type AnswerSection,
} from "@/lib/answer-display";

export const Route = createFileRoute("/careers/apply")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { fresh?: boolean; testMode?: boolean } => ({
    fresh: search["fresh"] === true || search["fresh"] === "true",
    // Developer testing mode: only ever enabled by an explicit ?testMode=true.
    testMode: search["testMode"] === true || search["testMode"] === "true",
  }),


  head: () => ({
    meta: [
      { title: "Support Professional Application — Elev8 Services" },
      {
        name: "description",
        content:
          "Apply for a support professional or internship role with Elev8 Services. A short five-step application covering your information, availability, and fit.",
      },
      {
        property: "og:title",
        content: "Support Professional Application — Elev8 Services",
      },
      {
        property: "og:description",
        content:
          "A five-step application for support professional and internship roles with Elev8 Services.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplyPage,
});

/* ------------------------------------------------------------------ */
/* Field definitions                                                   */
/* ------------------------------------------------------------------ */

export type ClassEntry = {
  name: string;
  /** Academic term for this class (Fall, Winter, ...). */
  term: string;
  /** Selected weekdays, or the single "Schedule not yet announced" option. */
  days: string[];
  startTime: string;
  endTime: string;
  timeUnknown: boolean;
  status: string;
  start: string;
  end: string;
  examDates: string[];
  examUnknown: boolean;
  finalExam: string;
  finalUnknown: boolean;
  explain: string;
};

/** One anticipated time-off request. Each request is stored separately. */
export type TimeOffEntry = {
  start: string;
  end: string;
  details: string;
};

/** One fixed day/time block inside a regular commitment. */
export type CommitmentBlock = {
  days: string[];
  startTime: string;
  endTime: string;
};

/** One current or planned outside commitment. Each is stored separately. */
export type CommitmentEntry = {
  type: string;
  status: string;
  org: string;
  hours: string;
  scheduleType: string;
  blocks: CommitmentBlock[];
  varies: string;
  tbd: string;
  jobPlan: string;
  manage: string;
  /** Weekend variant only: affected days for variable/undetermined schedules. */
  weekendDays: string[];
};

type FieldValue =
  | string
  | string[]
  | boolean
  | ClassEntry[]
  | TimeOffEntry[]
  | CommitmentEntry[];

type Values = Record<string, FieldValue>;

type CardOption = {
  value: string;
  desc: string;
  icon?: LucideIcon;
};

type FieldDef = {
  key: string;
  label: string;
  type:
    | "text"
    | "email"
    | "phone"
    | "date"
    | "number"
    | "select"
    | "multiselect"
    | "radio"
    | "cards"
    | "checkboxes"
    | "availability"
    | "onboarding"
    | "ack"
    | "textarea"
    | "file"
    | "certupload"
    | "classes"
    | "scheduleupload"
    | "timeoff"
    | "commitments"
    | "history"
    | "info";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  optionInfo?: Record<string, { title: string; body: string }>;
  cards?: CardOption[];
  help?: string;
  /** Short label used on the Review page instead of the full question. */
  reviewLabel?: string;
  /** Clarifying text rendered beneath the input. */
  note?: string;
  /** When present, the note renders only if this returns true. */
  noteIf?: (v: Values) => boolean;

  min?: number;
  /** Minimum characters for substantive written responses (with live counter). */
  minChars?: number;
  /** Numeric bounds and precision for `number` fields. */
  numMin?: number;
  numMax?: number;
  decimals?: number;
  /** Question-specific validation copy for `number` fields. */
  emptyMsg?: string;
  rangeMsg?: string;
  /**
   * Optional alternative checkbox ("not yet determined", "no major selected")
   * stored under its own key. When checked the input clears, is disabled, and
   * the question counts as complete.
   */
  altKey?: string;
  altLabel?: string;

  /** Review-summary grouping label (Step 5). */
  group?: string;
  policy?: string;


  custom?: "holiday" | "pay" | "breaks" | "weekend" | "commitmentsIntro" | "smsConsent";
  /** Selects the weekend-specific rendering of the repeatable commitments field. */
  commitVariant?: "weekend";
  /** Selects the housing-absence rendering of the repeatable time-off field. */
  timeoffVariant?: "housing";

  sectionBreak?: boolean;
  /** Renders a Step-3 style section heading above this field. */
  sectionTitle?: string;
  visibleIf?: (v: Values) => boolean;
  requiredIf?: (v: Values) => boolean;
  /** Clears and disables a numeric input while this returns true. */
  disabledIf?: (v: Values) => boolean;
  validate?: (v: Values) => string | undefined;

};

const OPP_INTERNSHIP = "Paid Internship";
const OPP_EMPLOYMENT = "Employment";
const OPP_EITHER = "Open to Either";

const OPPORTUNITY_CARDS: CardOption[] = [
  {
    value: OPP_INTERNSHIP,
    desc: "Gain paid, hands-on experience while preparing for your future career or graduate program.",
    icon: GraduationCap,
  },
  {
    value: OPP_EMPLOYMENT,
    desc: "Find meaningful, consistent work with opportunities for professional growth.",
    icon: Briefcase,
  },
  {
    value: OPP_EITHER,
    desc: "Consider me for the opportunity that best matches my qualifications and availability.",
    icon: Split,
  },
];

const INTERNSHIP_INTEREST_CARDS: CardOption[] = [
  {
    value: "Hands-On Experience",
    desc: "Gain clinical and direct-care experience + clinical hours.",
  },
  {
    value: "Graduate-School Preparation",
    desc: "Strengthen my application for medical, PA, nursing, pharmacy, or another graduate program.",
  },
  { value: "Letters of Recommendation", desc: "Secure strong references for your future." },
  { value: "Earn While I Learn", desc: "Build my r\u00e9sum\u00e9 while earning an income." },
  {
    value: "Student-Friendly Scheduling",
    desc: "Find an opportunity that works around my class schedule.",
  },
];

const EMPLOYMENT_INTEREST_CARDS: CardOption[] = [
  {
    value: "Meaningful Work",
    desc: "Support adults with intellectual and developmental disabilities.",
  },
  { value: "Professional Experience", desc: "Develop healthcare and direct-care skills." },
  { value: "Consistent Employment", desc: "Find reliable, ongoing paid work." },
  {
    value: "Schedule Compatibility",
    desc: "Find work that can accommodate my existing schedule.",
  },
  { value: "Long-Term Career", desc: "Build a career in healthcare or human services." },
  {
    value: "Professional Growth",
    desc: "Develop toward positions with greater responsibility.",
  },
];

const EITHER_INTEREST_CARDS: CardOption[] = [
  { value: "Hands-On Experience", desc: "Develop clinical and direct-care skills." },
  {
    value: "Meaningful Work",
    desc: "Support adults with intellectual and developmental disabilities.",
  },
  {
    value: "Future Preparation",
    desc: "Strengthen my r\u00e9sum\u00e9 or future school applications.",
  },
  { value: "Letters of Recommendation", desc: "Secure strong references for your future." },
  { value: "Paid, Flexible Work", desc: "Find paid work that can accommodate my schedule." },
  { value: "Long-Term Growth", desc: "Build a career in healthcare or human services." },
];

export const OBSERVED_HOLIDAYS = [
  "New Year's Day",
  "Martin Luther King Jr. Day",
  "Presidents' Day",
  "Cesar Chavez Day",
  "Memorial Day",
  "Juneteenth",
  "Independence Day",
  "Labor Day",
  "Veterans Day",
  "Thanksgiving Day",
  "Christmas Day",
];

/* ---------------- School enrollment & class schedule --------------- */

const ENROLL_CURRENT = "Yes, I am currently enrolled.";
const ENROLL_UPCOMING = "No, but I will be enrolled in an upcoming academic term.";
const ENROLL_NO =
  "No, I am not currently enrolled and do not have an upcoming term scheduled.";

const CLASS_STATUS_ENROLLED = "Enrolled";
const CLASS_STATUS_PENDING = "Enrollment pending";
const CLASS_STATUS_TENTATIVE = "Tentative or still deciding";
const CLASS_STATUS_WAITLISTED = "Waitlisted";
const CLASS_STATUS_TBA = "Schedule not yet announced";
const CLASS_STATUSES = [
  CLASS_STATUS_ENROLLED,
  CLASS_STATUS_PENDING,
  CLASS_STATUS_TENTATIVE,
  CLASS_STATUS_WAITLISTED,
  CLASS_STATUS_TBA,
];
/** Only these statuses require the short status explanation. */
const CLASS_EXPLAIN_STATUSES = [CLASS_STATUS_WAITLISTED, CLASS_STATUS_TENTATIVE];

const DAYS_TBA = "Schedule not yet announced";

const EXPLAIN_LIMIT = 500;

const CLASS_TERMS = ["Fall", "Intersession", "Winter", "Spring", "Summer"];

const emptyClass = (): ClassEntry => ({
  name: "",
  term: "",
  days: [],
  startTime: "",
  endTime: "",
  timeUnknown: false,
  status: "",
  start: "",
  end: "",
  examDates: [],
  examUnknown: false,
  finalExam: "",
  finalUnknown: false,
  explain: "",
});

/** Tolerates drafts saved under an earlier class shape. */
const normalizeClass = (raw: unknown): ClassEntry => {
  const c = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  const list = (k: string) =>
    Array.isArray(c[k])
      ? (c[k] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
  return {
    name: s("name"),
    term: s("term"),
    days: Array.isArray(c["days"]) ? list("days") : s("days") ? [s("days")] : [],
    startTime: s("startTime"),
    endTime: s("endTime"),
    timeUnknown: c["timeUnknown"] === true,
    status: s("status"),
    start: s("start"),
    end: s("end"),
    examDates: list("examDates"),
    examUnknown: c["examUnknown"] === true,
    finalExam: s("finalExam"),
    finalUnknown: c["finalUnknown"] === true,
    explain: s("explain"),
  };
};

const isStudent = (v: Values) =>
  str(v, "enrolled") === ENROLL_CURRENT || str(v, "enrolled") === ENROLL_UPCOMING;

/* ---------------- Academic standing & career goals ----------------- */

const LEVEL_OTHER = "Other postsecondary program";
const ACADEMIC_LEVELS = [
  "First-year undergraduate student",
  "Second-year undergraduate student",
  "Third-year undergraduate student",
  "Fourth-year undergraduate student",
  "Fifth-year or later undergraduate student",
  "Certificate or vocational program student",
  "Post-baccalaureate student",
  "Master\u2019s degree student",
  "Doctoral or professional-degree student",
  LEVEL_OTHER,
];

const FIRST_TERM_YES =
  "Yes, this will be my first academic term at this college or in this program.";
const FIRST_TERM_NO =
  "No, I have already completed at least one academic term at this college or in this program.";

/* --------------------------- Transfer students ---------------------------- */

const TRANSFER_NO = "No, I have only attended my current college or program.";
const TRANSFER_YES = "Yes, I previously attended another college, university, or program.";
const ENROLLMENT_LOADS = [
  "Full-time (12 or more units per term)",
  "Three-quarter time (9\u201311 units per term)",
  "Half-time (6\u20138 units per term)",
  "Less than half-time (fewer than 6 units per term)",
  "My enrollment load varied by term.",
];
const isTransfer = (v: Values) => isStudent(v) && str(v, "transfer_status") === TRANSFER_YES;

const HISTORY_NO = "No, I did not maintain any regular commitments during that time.";
const HISTORY_YES = "Yes, I maintained one or more regular commitments during that time.";

/* --------------- College GPA (determined from earlier answers) ------------ */

const isFirstTerm = (v: Values) => str(v, "first_term_status") === FIRST_TERM_YES;

const COLLEGE_GPA_FIRST_TERM = "Not yet required \u2014 first college term";

/**
 * Exactly one college-GPA path is ever shown. Transfer status wins over
 * first-term status, so a transfer student always reports a transfer GPA.
 */
type CollegeGpaPath = "transfer" | "first_term" | "current" | null;


const CAREER_OTHER_HEALTH = "Other healthcare or human-services career";
const CAREER_OTHER_FIELD = "Another career field";
const CAREER_GOALS = [
  "Medicine / Physician",
  "Nursing",
  "Physician Assistant",
  "Pharmacy",
  "Psychology",
  "Behavioral Health",
  "Social Work",
  "Human Services",
  "Occupational Therapy",
  "Physical Therapy",
  "Education",
  "Healthcare Administration",
  CAREER_OTHER_HEALTH,
  CAREER_OTHER_FIELD,
  "I am still exploring my career options.",
];

/**
 * Education and career-goal questions apply to students and to anyone seeking
 * an internship. Employment-only applicants who are not in school never see or
 * need this section.
 */
const showEducation = (v: Values) => {
  const pref = str(v, "opportunity_pref");
  return isStudent(v) || pref === OPP_INTERNSHIP || pref === OPP_EITHER;
};

/**
 * The applicable college-GPA question is derived from the transfer-student and
 * first-term answers, so the applicant is never asked to categorize their GPA.
 */
const collegeGpaPath = (v: Values): CollegeGpaPath => {
  if (!showEducation(v)) return null;
  if (isTransfer(v)) return "transfer";
  if (isFirstTerm(v)) return "first_term";
  return "current";
};
const gpaPathIs = (path: CollegeGpaPath) => (v: Values) => collegeGpaPath(v) === path;
/** Every college-GPA answer, cleared whenever the applicable path changes. */
const COLLEGE_GPA_KEYS = ["transfer_gpa", "current_gpa"];




const classList = (v: Values, k: string): ClassEntry[] =>
  Array.isArray(v[k]) ? (v[k] as unknown[]).map(normalizeClass) : [];

const validateClasses = (v: Values) => {
  if (!isStudent(v)) return undefined;
  if (bool(v, "classes_none")) return undefined;
  const list = classList(v, "class_entries");
  if (list.length === 0)
    return "Please add at least one class, or confirm that you have no current or upcoming classes.";
  for (const [i, c] of list.entries()) {
    const issue = classIssue(c);
    if (issue) return `Class ${i + 1} \u2014 ${issue}`;
  }
  return undefined;
};

/**
 * Private review flags for a final exam scheduled after ordinary instruction
 * ends. Such a date is accepted, never rejected, and never surfaced to the
 * applicant.
 */
const classReviewFlags = (v: Values) => {
  if (!isStudent(v) || bool(v, "classes_none")) return [];
  return classList(v, "class_entries").flatMap((c, i) =>
    !c.finalUnknown && c.finalExam && c.end && c.finalExam > c.end
      ? [
          {
            question: "Final Exam After Class End Date Requires Review",
            answer: `Class ${i + 1}${c.name ? ` (${c.name})` : ""}: final-exam date ${c.finalExam} falls after the entered class end date ${c.end}.`,
          },
        ]
      : [],
  );
};


const DUTY_OPTIONS = [
  "Provide companionship and support community activities",
  "Assist with meal preparation and light housekeeping",
  "Support medication routines according to training, policy, and the individual's care plan",
  "Assist with showering, toileting, grooming, oral hygiene, and other personal-care needs",
  "Follow Positive Behavior Support Plans and use approved redirection techniques",
  "Maintain professional boundaries and respond appropriately to challenging behavior",
  "Transport clients in an approved company or personal vehicle when authorized",
  "Complete accurate daily notes and required documentation",
  "Communicate changes, concerns, and incidents promptly to supervisors",
];


const SCHOOLS = [
  "University of California, San Diego",
  "University of California, Los Angeles",
  "University of Southern California",
  "University of San Diego",
  "San Diego State University",
  "Cuyamaca College",
  "Grossmont College",
  "San Diego Mesa College",
  "San Diego Miramar College",
  "San Diego City College",
  "Southwestern College",
  "Point Loma Nazarene University",
  "National University",
  "A friend or current team member",
  "Other",
];

const NOT_AVAILABLE = "I am not available for these shifts";

const EMPLOYMENT_SHORT_TERM =
  "Temporary, seasonal, or short-term internship/employment — 1 to 6 months";
const EMPLOYMENT_LONG_TERM = "Long-term internship/employment — 1 year or longer";

const EVENING_NONE = "I am not regularly available during this shift period.";
const ONBOARDING_CANNOT = "I cannot meet this initial onboarding requirement.";

const CURRENT_STATUS_OPTIONS = [
  "Currently employed",
  "Currently completing another internship",
  "Looking for additional employment",
  "Looking to replace my current job",
  "Not currently employed or completing an internship",
];
const NOT_EMPLOYED = CURRENT_STATUS_OPTIONS[4];

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const WEEKDAY_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const CERT_HOLDS = "I currently hold valid First Aid and CPR certifications.";
const CERT_COMBINED = "First Aid and CPR are included on the same certification or card.";
const CERT_SEPARATE = "First Aid and CPR were issued separately.";
const CERT_UNSURE = "I am not sure.";
const CERT_EXPIRED_MSG =
  "This certification appears to be expired. Please select that you are willing to obtain the required certification or correct the date.";

const todayISO = () => new Date().toISOString().slice(0, 10);

const certDateValidate = (key: string) => (v: Values) => {
  const text = str(v, key).trim();
  if (!text) return "This answer is required.";
  if (text < todayISO()) return CERT_EXPIRED_MSG;
  return undefined;
};

const HOLIDAY_MEET = "Yes, I can meet this availability requirement.";
const HOLIDAY_CANNOT = "No, I cannot meet this availability requirement.";
const HOLIDAY_DISCUSS = "I need to discuss a specific availability limitation.";

const holidayAnswered = (v: Values) => str(v, "holiday_availability") !== "";

const BREAKS_YES = "Yes. I understand and can meet these requirements.";
const BREAKS_NO = "No. I cannot meet one or more of these requirements.";

const PREFERRED_HOLIDAY_OPTIONS = [
  "Thanksgiving Day — Morning (8:00 AM–12:00 PM)",
  "Thanksgiving Day — Afternoon (12:00 PM–5:00 PM)",
  "Thanksgiving Day — Evening (5:00 PM–10:00 PM)",
  "Christmas Eve — Evening (5:00 PM–10:00 PM)",
  "Christmas Day — Morning (8:00 AM–12:00 PM)",
  "Christmas Day — Afternoon (12:00 PM–5:00 PM)",
  "I am available for all holiday periods and do not have a preference.",
];

const PAY_MEET = "Yes, the stated starting pay meets my expectations.";
const PAY_QUEST = "I have questions and would like to discuss the pay structure.";
const PAY_NO = "No, the stated starting pay does not meet my expectations.";

const SD_COMMIT_YES = "Yes, I can confidently make this commitment.";
const SD_COMMIT_NO = "No, or I am not certain that I can make this commitment.";

const HYGIENE_NO = "I am not comfortable providing one or more forms of personal care.";
const BEHAVIOR_NO = "I am not comfortable providing this type of behavioral support.";
const TRAINING_NO =
  "I am unable or unwilling to complete all required onboarding and training.";
const CERT_NO = "I am not willing to obtain the required certifications.";

const POPULATION_INFO =
  "I would like additional information before confirming my comfort level.";
const HYGIENE_DISCUSS = "I would like to discuss these responsibilities before confirming.";
const BEHAVIOR_DISCUSS = "I would like to discuss this responsibility before confirming.";

const WEEKEND_NO =
  "No, I do not have any current or planned commitments that would limit my weekend availability.";
const WEEKEND_YES =
  "Yes, I have or anticipate having a commitment that may limit my availability on Saturday, Sunday, or both.";
const WEEKEND_NOTE =
  "Weekend availability remains an essential scheduling requirement. Providing this information does not guarantee a scheduling exception.";
const WEEKEND_FLAG = "Weekend Availability Limitation \u2014 HR Review Required";

const TIMEOFF_NO = "No, I do not anticipate requesting time off.";
const TIMEOFF_YES = "Yes, I anticipate requesting time off.";
const TIMEOFF_NOTE =
  "Disclosing anticipated time off does not constitute approval. All requests remain subject to the Travel and time-off policy above.";
const TIMEOFF_DETAILS_PLACEHOLDER =
  "Describe the planned time off and indicate whether flights, accommodations, or other nonrefundable arrangements have already been booked.";
const TIMEOFF_ORDER_ERROR =
  "The anticipated end date cannot be earlier than the start date.";
const TIMEOFF_WINDOW_ERROR = "Please enter a date within the next eight months.";

const emptyTimeOff = (): TimeOffEntry => ({ start: "", end: "", details: "" });

/** Tolerates drafts saved under an earlier shape. */
const normalizeTimeOff = (raw: unknown): TimeOffEntry => {
  const c = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  return { start: s("start"), end: s("end"), details: s("details") };
};

const timeOffList = (v: Values, k: string): TimeOffEntry[] =>
  Array.isArray(v[k]) ? (v[k] as unknown[]).map(normalizeTimeOff) : [];

/** Last calendar day inside the eight-month disclosure window. */
const eightMonthsOutISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 8);
  return d.toISOString().slice(0, 10);
};

/** Per-field messages for one request; keys map to that request's inputs. */
function timeOffIssues(r: TimeOffEntry): Partial<Record<keyof TimeOffEntry, string>> {
  const out: Partial<Record<keyof TimeOffEntry, string>> = {};
  const today = todayISO();
  const limit = eightMonthsOutISO();
  const window = (date: string) =>
    date < today || date > limit ? TIMEOFF_WINDOW_ERROR : undefined;

  if (!r.start) out.start = "This answer is required.";
  else {
    const w = window(r.start);
    if (w) out.start = w;
  }
  if (!r.end) out.end = "This answer is required.";
  else {
    const w = window(r.end);
    if (w) out.end = w;
    else if (r.start && r.end < r.start) out.end = TIMEOFF_ORDER_ERROR;
  }
  if (!r.details.trim()) out.details = "This answer is required.";
  return out;
}

const validateTimeOff = (v: Values) => {
  if (str(v, "upcoming_time_off") !== TIMEOFF_YES) return undefined;
  const list = timeOffList(v, "time_off_requests");
  if (!list.length) return "Please add at least one anticipated time-off request.";
  for (const [i, r] of list.entries()) {
    const issues = timeOffIssues(r);
    const first = issues.start ?? issues.end ?? issues.details;
    if (first) return `Time-off request ${i + 1} \u2014 ${first}`;
  }
  return undefined;
};

/**
 * One private review flag per disclosed request. Requests are never combined
 * into a single paragraph, and a disclosure never disqualifies an applicant.
 */
const timeOffReviewFlags = (v: Values) => {
  if (str(v, "upcoming_time_off") !== TIMEOFF_YES) return [];
  return timeOffList(v, "time_off_requests").map((r, i) => ({
    question: "Upcoming Time-Off Review Required",
    answer: `Time-off request ${i + 1}\nAnticipated start date: ${r.start}\nAnticipated end date: ${r.end}\nRelevant details: ${r.details.trim()}`,
  }));
};

/* -------- Housing and San Diego availability during academic breaks -------- */

const HOUSING_STABLE =
  "No. I expect to remain in San Diego and have stable local housing throughout academic breaks and between terms.";
const HOUSING_LOCAL_CHANGE =
  "My housing may change, but I expect to remain in San Diego and maintain my required work availability.";
const HOUSING_LEAVE =
  "My housing situation may require me to leave San Diego temporarily.";
const HOUSING_UNCERTAIN =
  "I am not yet certain what my housing situation will be during one or more academic breaks.";

const HOUSING_OPTIONS = [
  HOUSING_STABLE,
  HOUSING_LOCAL_CHANGE,
  HOUSING_LEAVE,
  HOUSING_UNCERTAIN,
];

const HOUSING_QUESTION =
  "Do you anticipate any change in housing during academic breaks or between terms that could affect your ability to remain in San Diego and work your required schedule?";
const HOUSING_HELP =
  "Examples may include campus-housing closures, a lease ending between terms, returning home during a school break, or another temporary housing change. Please disclose only information relevant to your availability for work.";

const HOUSING_LOCAL_PROMPT =
  "Please briefly explain how your housing may change and confirm how you plan to remain locally available for work.";
const HOUSING_LOCAL_PLACEHOLDER =
  "Example: My campus housing closes between terms, but I plan to arrange temporary housing in San Diego and remain available for my scheduled shifts.";

const HOUSING_ABSENCE_PROMPT =
  "Please explain why you may need to leave San Diego and provide the anticipated date range or ranges.";
const HOUSING_ABSENCE_DETAILS_PLACEHOLDER =
  "Briefly describe why you may need to leave San Diego during this period.";
const HOUSING_LIMIT_NOTE =
  "Summer-break time off is limited to a maximum of 14 total approved days. All time off must be requested and approved before travel or other nonrefundable arrangements are finalized. Disclosing anticipated dates in this application does not constitute approval.";

const HOUSING_UNCERTAIN_PROMPT =
  "Please explain what remains uncertain, when you expect to know more, and what arrangements you are considering so you can remain available for work.";
const HOUSING_UNCERTAIN_PLACEHOLDER =
  "Example: I am waiting to learn whether campus housing will remain available during winter break. If it closes, I will need to arrange temporary housing in San Diego.";

const HOUSING_COMPLY_YES = "Yes. I have a plan that will allow me to meet these requirements.";
const HOUSING_COMPLY_DISCUSS =
  "I would like to discuss my housing and availability plan with the hiring team.";
const HOUSING_COMPLY_NO =
  "No. I do not expect to be able to meet one or more of these requirements.";
const HOUSING_COMPLY_OPTIONS = [
  HOUSING_COMPLY_YES,
  HOUSING_COMPLY_DISCUSS,
  HOUSING_COMPLY_NO,
];
const HOUSING_COMPLY_LEAVE_LABEL =
  "Can you maintain Elev8\u2019s required availability and comply with the applicable school-break and time-off limits despite this anticipated housing change?";
const HOUSING_COMPLY_UNCERTAIN_LABEL =
  "Can you maintain Elev8\u2019s required availability and comply with the applicable school-break and time-off limits despite this uncertainty?";
const HOUSING_COMPLY_REASON =
  "Remaining locally available to work your required schedule during academic breaks is an essential requirement of this position, and the response you selected indicates that this requirement cannot be met.";

const HOUSING_FLAG = "Housing Plan \u2014 HR Review";
const HOUSING_DISCUSS_FLAG = "Housing and Availability Discussion Requested";
const HOUSING_SYNC_FLAG = "Housing-related anticipated time off";

/**
 * Housing stability is asked of students and of anyone seeking an internship,
 * because it measures continued local availability during academic breaks.
 */
const showHousing = (v: Values) => {
  const pref = str(v, "opportunity_pref");
  return isStudent(v) || pref === OPP_INTERNSHIP || pref === OPP_EITHER;
};

const housingLeave = (v: Values) =>
  showHousing(v) && str(v, "housing_change") === HOUSING_LEAVE;
const housingUncertain = (v: Values) =>
  showHousing(v) && str(v, "housing_change") === HOUSING_UNCERTAIN;

/** Anticipated housing-related absences; the single source for both sections. */
const housingAbsenceList = (v: Values) =>
  housingLeave(v) ? timeOffList(v, "housing_absences") : [];

const HOUSING_ORDER_ERROR =
  "The anticipated return date cannot be earlier than the departure date.";

/** Required dates and details, plus return-after-departure ordering. */
function housingAbsenceIssues(r: TimeOffEntry): Partial<Record<keyof TimeOffEntry, string>> {
  const out: Partial<Record<keyof TimeOffEntry, string>> = {};
  if (!r.start) out.start = "This answer is required.";
  if (!r.end) out.end = "This answer is required.";
  else if (r.start && r.end < r.start) out.end = HOUSING_ORDER_ERROR;
  if (!r.details.trim()) out.details = "This answer is required.";
  return out;
}

const validateHousingAbsences = (v: Values) => {
  if (!housingLeave(v)) return undefined;
  const list = timeOffList(v, "housing_absences");
  if (!list.length) return "Please add at least one anticipated absence.";
  for (const [i, r] of list.entries()) {
    const issues = housingAbsenceIssues(r);
    const first = issues.start ?? issues.end ?? issues.details;
    if (first) return `Anticipated absence ${i + 1} \u2014 ${first}`;
  }
  return undefined;
};

/**
 * One private flag per anticipated housing-related absence. These are the same
 * entries synchronized into Upcoming time-off requests, so the applicant never
 * enters the dates twice and no duplicate request is created.
 */
const housingReviewFlags = (v: Values) =>
  housingAbsenceList(v).map((r, i) => ({
    question: HOUSING_SYNC_FLAG,
    answer: `Anticipated absence ${i + 1}\nAnticipated departure date: ${r.start}\nAnticipated return date: ${r.end}\nRelevant details: ${r.details.trim()}`,
  }));

/** Whether the applicant expects to remain locally available. */
const housingRemainsInSanDiego = (v: Values) => {
  const choice = str(v, "housing_change");
  if (choice === HOUSING_STABLE || choice === HOUSING_LOCAL_CHANGE) return true;
  if (choice === HOUSING_LEAVE) return false;
  return null;
};


/* ---------------- Other regular commitments ---------------- */

const COMMIT_NO =
  "No, I do not have any current or planned regular commitments.";
const COMMIT_YES =
  "Yes, I currently have or plan to begin one or more regular commitments.";

const COMMIT_INTRO =
  "Please include any current or planned commitment that will continue while you are working or interning with Elev8.";

const COMMIT_QUESTION =
  "Do you currently have, or plan to begin, any of the commitments listed above while working or interning with Elev8?";

const COMMIT_INSTRUCTION =
  "Include commitments even if they occur only on certain days, during specific seasons, or on a schedule that has not yet been finalized.";

const COMMIT_CATEGORIES: { label: string; icon: LucideIcon }[] = [
  { label: "Job", icon: Briefcase },
  { label: "Internship", icon: GraduationCap },
  { label: "Extracurricular activity", icon: Palette },
  { label: "Athletic commitment", icon: Dumbbell },
  { label: "Family or caregiving responsibility", icon: HeartHandshake },
  { label: "Religious or faith-based commitment", icon: Church },
  { label: "Volunteer role", icon: HandHeart },
  { label: "Educational commitment", icon: BookOpen },
  { label: "Other regular obligation", icon: ClipboardList },
];

const COMMIT_TYPE_OPTIONS = [
  "Job",
  "Internship",
  "Extracurricular activity",
  "Athletic commitment",
  "Family or caregiving responsibility",
  "Religious or faith-based commitment",
  "Volunteer role",
  "Educational commitment",
  "Other regular commitment",
];


const COMMIT_STATUS_OPTIONS = ["Current", "Planned"];

const SCHED_REGULAR = "Yes, it has a regular schedule.";
const SCHED_VARIES = "The schedule varies from week to week.";
const SCHED_TBD = "The schedule has not yet been determined.";
const COMMIT_SCHEDULE_OPTIONS = [SCHED_REGULAR, SCHED_VARIES, SCHED_TBD];

const JOB_PLAN_OPTIONS = [
  "Leave or end it and replace it with this opportunity.",
  "Keep it and supplement it with this opportunity.",
  "Reduce my hours and continue with both.",
  "I have not decided yet.",
];

const COMMIT_MANAGE_PLACEHOLDER =
  "Briefly explain how you expect to manage both commitments without interfering with your required Elev8 schedule.";
const COMMIT_ORG_PLACEHOLDER =
  "Briefly identify the employer, organization, program, or commitment";
const COMMIT_VARIES_PLACEHOLDER =
  "Example: Usually two weekday evenings, but the specific days change each week.";

const isJobLike = (type: string) => type === "Job" || type === "Internship";

const emptyCommitBlock = (): CommitmentBlock => ({
  days: [],
  startTime: "",
  endTime: "",
});

const emptyCommitment = (): CommitmentEntry => ({
  type: "",
  status: "",
  org: "",
  hours: "",
  scheduleType: "",
  blocks: [emptyCommitBlock()],
  varies: "",
  tbd: "",
  weekendDays: [],
  jobPlan: "",
  manage: "",
});

/** Tolerates drafts saved under an earlier shape. */
const normalizeCommitment = (raw: unknown): CommitmentEntry => {
  const c = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  const blocks = Array.isArray(c["blocks"])
    ? (c["blocks"] as unknown[]).map((b) => {
        const o = (b ?? {}) as Record<string, unknown>;
        return {
          days: Array.isArray(o["days"])
            ? (o["days"] as unknown[]).filter((d): d is string => typeof d === "string")
            : [],
          startTime: typeof o["startTime"] === "string" ? (o["startTime"] as string) : "",
          endTime: typeof o["endTime"] === "string" ? (o["endTime"] as string) : "",
        };
      })
    : [];
  return {
    type: s("type"),
    status: s("status"),
    org: s("org"),
    hours: s("hours"),
    scheduleType: s("scheduleType"),
    blocks: blocks.length ? blocks : [emptyCommitBlock()],
    varies: s("varies"),
    tbd: s("tbd"),
    weekendDays: Array.isArray(c["weekendDays"])
      ? (c["weekendDays"] as unknown[]).filter((d): d is string => typeof d === "string")
      : [],
    jobPlan: s("jobPlan"),
    manage: s("manage"),
  };
};

const commitmentList = (v: Values, k: string): CommitmentEntry[] =>
  Array.isArray(v[k]) ? (v[k] as unknown[]).map(normalizeCommitment) : [];

/* ------- Commitments maintained during previous schooling (transfers) ------ */

type HistoryEntry = { type: string; org: string; hours: string; terms: string };

const emptyHistory = (): HistoryEntry => ({ type: "", org: "", hours: "", terms: "" });

const normalizeHistory = (raw: unknown): HistoryEntry => {
  const h = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof h[k] === "string" ? (h[k] as string) : "");
  return { type: s("type"), org: s("org"), hours: s("hours"), terms: s("terms") };
};

const historyList = (v: Values, k: string): HistoryEntry[] =>
  Array.isArray(v[k]) ? (v[k] as unknown[]).map(normalizeHistory) : [];

/** Every outstanding problem for one historical commitment, in display order. */
function historyIssues(h: HistoryEntry): string[] {
  const out: string[] = [];
  if (!h.type) out.push("Please select the type of commitment.");
  if (!h.org.trim()) out.push("Please enter the organization, program, or a short description.");
  if (!/^\d+$/.test(h.hours.trim()))
    out.push("Please enter the average hours per week as a whole number.");
  if (!h.terms.trim()) out.push("Please enter how many academic terms you maintained this commitment.");
  else if (!/^\d+$/.test(h.terms.trim()))
    out.push("Please enter the number of academic terms as a whole number.");
  return out;
}

function validateHistory(v: Values) {
  if (!isTransfer(v) || str(v, "prev_commitments") !== HISTORY_YES) return undefined;
  const list = historyList(v, "prev_commitment_entries");
  if (!list.length) return "Please add at least one commitment, or answer \u201cNo\u201d above.";
  return list.some((h) => historyIssues(h).length)
    ? "Please complete every field in each commitment below."
    : undefined;
}

const REQUIRED_MSG = "This answer is required.";
const COMMIT_HOURS_ERROR = "Please enter the average hours per week as a whole number.";
const COMMIT_TIME_ERROR = "The end time must be later than the start time.";

/** Every outstanding problem for one commitment, in display order. */
function commitmentIssues(c: CommitmentEntry): string[] {
  const out: string[] = [];
  if (!c.type) out.push("Please select the type of commitment.");
  if (!c.status) out.push("Please select whether this commitment is current or planned.");
  if (!c.org.trim())
    out.push("Please identify the employer, organization, program, or commitment.");
  const hours = c.hours.trim();
  if (!hours) out.push("Please enter the average hours per week.");
  else if (!/^\d+$/.test(hours) || Number(hours) < 1) out.push(COMMIT_HOURS_ERROR);
  if (!c.scheduleType) out.push("Please indicate whether this commitment follows a regular schedule.");

  if (c.scheduleType === SCHED_REGULAR) {
    c.blocks.forEach((b, i) => {
      const label = c.blocks.length > 1 ? `Day/time block ${i + 1} — ` : "";
      if (!b.days.length) out.push(`${label}Please select at least one day.`);
      if (!b.startTime) out.push(`${label}Please select a start time.`);
      if (!b.endTime) out.push(`${label}Please select an end time.`);
      if (b.startTime && b.endTime && b.endTime <= b.startTime)
        out.push(`${label}${COMMIT_TIME_ERROR}`);
    });
  }
  if (c.scheduleType === SCHED_VARIES && !c.varies.trim())
    out.push("Please describe the typical schedule and how frequently it changes.");
  if (c.scheduleType === SCHED_TBD && !c.tbd.trim())
    out.push("Please explain when the schedule is expected to become available.");

  if (isJobLike(c.type) && !c.jobPlan)
    out.push("Please select what you plan to do with this job or internship.");
  if (!c.manage.trim())
    out.push(
      "Please explain how you will manage this commitment alongside Elev8\u2019s scheduling requirements.",
    );
  return out;
}

/** One private review flag per disclosed outside commitment. */
/** Flags surfaced for HR whenever the applicant reports any regular commitment. */
function commitmentAnswerReviewFlags(v: Values) {
  const answer = str(v, "other_commitments");
  if (answer !== COMMIT_YES) return [];
  return [{ question: COMMIT_QUESTION, answer }];
}

/** Weekday afternoon/evening unavailability always needs HR eyes. */
function eveningAvailabilityReviewFlags(v: Values) {
  if (!arr(v, "weekday_evening_availability").includes(EVENING_NONE)) return [];
  return [
    {
      question: "Weekday afternoon/evening availability",
      answer: EVENING_NONE,
    },
  ];
}

function commitmentReviewFlags(v: Values) {
  if (str(v, "other_commitments") !== COMMIT_YES) return [];
  return commitmentList(v, "commitment_entries").map((c, i) => {
    const schedule =
      c.scheduleType === SCHED_REGULAR
        ? c.blocks
            .map(
              (b) =>
                `${b.days.join(", ") || "days pending"}: ${timeLabel(b.startTime)}-${timeLabel(b.endTime)}`,
            )
            .join(" | ")
        : c.scheduleType === SCHED_VARIES
          ? c.varies.trim()
          : c.tbd.trim();
    return {
      question: `Outside Commitment Review Required (commitment ${i + 1})`,
      answer: [
        `Type: ${c.type}`,
        `Status: ${c.status}`,
        `Description: ${c.org.trim()}`,
        `Average hours per week: ${c.hours}`,
        `Schedule: ${c.scheduleType}`,
        schedule ? `Schedule details: ${schedule}` : "",
        c.jobPlan ? `Plan if selected: ${c.jobPlan}` : "",
        `Management plan: ${c.manage.trim()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  });
}

const validateCommitments = (v: Values) => {
  if (str(v, "other_commitments") !== COMMIT_YES) return undefined;
  const list = commitmentList(v, "commitment_entries");
  if (!list.length) return "Please add at least one regular commitment.";
  for (const [i, c] of list.entries()) {
    const first = commitmentIssues(c)[0];
    if (first) return `Regular commitment ${i + 1} \u2014 ${first}`;
  }
  return undefined;
};

/* ---------------- Weekend scheduling conflicts ---------------- */

const WKEND_SAT = "Saturday";
const WKEND_SUN = "Sunday";
const WKEND_BOTH = "Saturday and Sunday";
const WKEND_DAY_OPTIONS = [WKEND_SAT, WKEND_SUN, WKEND_BOTH];

const WKEND_QUESTION =
  "Do you currently have, or plan to begin, any job, internship, extracurricular activity, athletic commitment, family or caregiving responsibility, volunteer role, educational commitment, or other regular obligation that could prevent or limit you from working scheduled shifts on Saturday, Sunday, or both?";

const WKEND_SCHED_REGULAR = "Yes, it has a regular weekend schedule.";
const WKEND_SCHED_VARIES = "The weekend schedule varies from week to week.";
const WKEND_SCHED_TBD = "The weekend schedule has not yet been determined.";
const WKEND_SCHEDULE_OPTIONS = [
  WKEND_SCHED_REGULAR,
  WKEND_SCHED_VARIES,
  WKEND_SCHED_TBD,
];

const WKEND_VARIES_PLACEHOLDER =
  "Example: I am generally committed every other Saturday from 9:00 AM\u20132:00 PM, but the exact Saturdays vary.";
const WKEND_TBD_PLACEHOLDER =
  "Briefly explain what you currently know and when you expect to receive the weekend schedule.";
const WKEND_MANAGE_PLACEHOLDER =
  "Briefly explain how you expect to meet Elev8\u2019s required weekend schedule while managing this commitment.";
const WKEND_TIME_ERROR = "The end time must occur after the start time.";

/** Weekend days covered by one schedule block. */
const wkendBlockDays = (b: CommitmentBlock): string[] => {
  const day = b.days[0] ?? "";
  return day === WKEND_BOTH ? [WKEND_SAT, WKEND_SUN] : day ? [day] : [];
};

/** Every outstanding problem for one weekend commitment, in display order. */
function weekendCommitmentIssues(c: CommitmentEntry): string[] {
  const out: string[] = [];
  if (!c.type) out.push("Please select the type of commitment.");
  if (!c.status) out.push("Please select whether this commitment is current or planned.");
  if (!c.org.trim())
    out.push("Please identify the employer, organization, program, or commitment.");
  const hours = c.hours.trim();
  if (!hours) out.push("Please enter the average hours per week.");
  else if (!/^\d+$/.test(hours) || Number(hours) < 1) out.push(COMMIT_HOURS_ERROR);
  if (!c.scheduleType)
    out.push("Please indicate whether this weekend commitment follows a regular schedule.");

  if (c.scheduleType === WKEND_SCHED_REGULAR) {
    c.blocks.forEach((b, i) => {
      const label = c.blocks.length > 1 ? `Day/time block ${i + 1} \u2014 ` : "";
      if (!b.days[0]) out.push(`${label}Please select a weekend day.`);
      if (!b.startTime) out.push(`${label}Please select a start time.`);
      if (!b.endTime) out.push(`${label}Please select an end time.`);
      if (b.startTime && b.endTime && b.endTime <= b.startTime)
        out.push(`${label}${WKEND_TIME_ERROR}`);
    });
    // Two blocks may not claim overlapping hours on the same weekend day.
    c.blocks.forEach((b, i) => {
      if (!b.startTime || !b.endTime || b.endTime <= b.startTime) return;
      for (let j = 0; j < i; j++) {
        const o = c.blocks[j] as CommitmentBlock;
        if (!o.startTime || !o.endTime || o.endTime <= o.startTime) continue;
        const shared = wkendBlockDays(b).filter((d) => wkendBlockDays(o).includes(d));
        if (!shared.length) continue;
        if (b.startTime < o.endTime && o.startTime < b.endTime)
          out.push(
            `Day/time block ${i + 1} overlaps day/time block ${j + 1} on ${shared.join(" and ")}. Please combine or correct these blocks.`,
          );
      }
    });
  }
  if (c.scheduleType === WKEND_SCHED_VARIES) {
    if (!c.weekendDays.length)
      out.push("Please select at least one weekend day that may be affected.");
    if (!c.varies.trim())
      out.push("Please describe the typical weekend schedule and how frequently it changes.");
  }
  if (c.scheduleType === WKEND_SCHED_TBD) {
    if (!c.weekendDays.length)
      out.push("Please select at least one weekend day that could potentially be affected.");
    if (!c.tbd.trim())
      out.push("Please explain when the weekend schedule is expected to become available.");
  }

  if (isJobLike(c.type) && !c.jobPlan)
    out.push("Please select what you plan to do with this job or internship.");
  if (!c.manage.trim())
    out.push(
      "Please explain how you would manage this commitment alongside Elev8\u2019s weekend scheduling requirements.",
    );
  return out;
}

const validateWeekendCommitments = (v: Values) => {
  if (str(v, "weekend_commitments") !== WEEKEND_YES) return undefined;
  const list = commitmentList(v, "weekend_commitment_entries");
  if (!list.length) return "Please add at least one weekend commitment.";
  for (const [i, c] of list.entries()) {
    const first = weekendCommitmentIssues(c)[0];
    if (first) return `Weekend commitment ${i + 1} \u2014 ${first}`;
  }
  return undefined;
};

/**
 * One main private flag plus a separate entry per disclosed weekend
 * commitment. This never disqualifies and is never shown to the applicant.
 */
function weekendCommitmentReviewFlags(v: Values) {
  if (str(v, "weekend_commitments") !== WEEKEND_YES) return [];
  const list = commitmentList(v, "weekend_commitment_entries");
  const main = {
    question: WEEKEND_FLAG,
    answer: `The applicant reported ${list.length} weekend commitment${list.length === 1 ? "" : "s"} that may limit required weekend availability. Each commitment is recorded separately below.`,
  };
  return [
    main,
    ...list.map((c, i) => {
      const days =
        c.scheduleType === WKEND_SCHED_REGULAR
          ? Array.from(new Set(c.blocks.flatMap(wkendBlockDays))).join(", ")
          : c.weekendDays.join(", ");
      const times =
        c.scheduleType === WKEND_SCHED_REGULAR
          ? c.blocks
              .map(
                (b) =>
                  `${b.days[0] || "day pending"}: ${timeLabel(b.startTime)}-${timeLabel(b.endTime)}`,
              )
              .join(" | ")
          : "";
      return {
        question: `${WEEKEND_FLAG} (weekend commitment ${i + 1})`,
        answer: [
          `Type: ${c.type}`,
          `Status: ${c.status}`,
          `Description: ${c.org.trim()}`,
          `Average hours per week: ${c.hours}`,
          `Weekend schedule type: ${c.scheduleType}`,
          days ? `Weekend days affected: ${days}` : "",
          times ? `Weekend times: ${times}` : "",
          c.scheduleType === WKEND_SCHED_VARIES && c.varies.trim()
            ? `Variable-schedule explanation: ${c.varies.trim()}`
            : "",
          c.scheduleType === WKEND_SCHED_TBD && c.tbd.trim()
            ? `Undetermined-schedule explanation: ${c.tbd.trim()}`
            : "",
          c.jobPlan ? `Plan for this job or internship: ${c.jobPlan}` : "",
          `Management plan: ${c.manage.trim()}`,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }),
  ];
}





/**
 * Single centralized configuration for every response outcome.
 *
 * - "disqualifying" shows the standardized review warning and only ends the
 *   application after the applicant confirms.
 * - "hr_review" lets the applicant continue normally with no applicant-facing
 *   message, and creates a private HR Discussion Requested flag.
 * - Any answer not listed here is eligible.
 */
type OutcomeRule = {
  key: string;
  question: string;
  answer: string;
  outcome: "disqualifying" | "hr_review";
  /** Multi-answer fields match when the answer is among the selections. */
  match?: "includes";
  /** Standardized reason shown on the disqualification card. */
  reason?: string;
  /** Extra applicant-provided detail stored with an hr_review flag. */
  detail?: (v: Values) => string;
};


const OUTCOME_RULES: OutcomeRule[] = [
  {
    key: "longterm_sd",
    question: "Long-term San Diego availability",
    answer: SD_COMMIT_NO,
    outcome: "disqualifying",
    reason:
      "Continuity is important to the people we support, and we invest significant time in training each new team member. To respect both your time and ours, we can only move forward with applicants who can confidently commit to remaining available for in-person work in San Diego County through December 31, 2027.",
  },
  {
    key: "hygiene_readiness",
    question: "Intimate personal-care readiness",
    answer: HYGIENE_NO,
    outcome: "disqualifying",
    reason:
      "Providing respectful personal-care assistance is an essential responsibility of this position. To meet the needs of the people we support, we can only move forward with applicants who are willing and able to assist adult male clients with required personal-care needs after receiving training.",
  },
  {
    key: "behavior_readiness",
    question: "Positive behavioral-support readiness",
    answer: BEHAVIOR_NO,
    outcome: "disqualifying",
    reason:
      "Providing safe, respectful behavioral support is an essential responsibility of this position. We can only move forward with applicants who are willing to follow each client\u2019s support plan and provide the required behavioral support after receiving training.",
  },
  {
    key: "training_willing",
    question: "Willingness to complete training",
    answer: TRAINING_NO,
    outcome: "disqualifying",
    reason:
      "Comprehensive training helps protect the safety, dignity, and well-being of both clients and staff. We can only move forward with applicants who are willing and able to complete all required onboarding and training.",
  },
  {
    key: "first_aid",
    question: "First Aid and CPR certification",
    answer: CERT_NO,
    outcome: "disqualifying",
    reason:
      "Current First Aid and CPR certifications are required before beginning work. We can only move forward with applicants who already hold these certifications or are willing to obtain them before their start date.",
  },
  {
    key: "holiday_availability",
    question: "Holiday and school-break availability",
    answer: HOLIDAY_CANNOT,
    outcome: "disqualifying",
    reason:
      "Consistent staffing is essential because we provide support 24 hours a day, including holidays and school breaks. We can only move forward with applicants who can meet the position\u2019s required availability or have a specific limitation that can be reviewed in advance.",
  },
  {
    key: "breaks_availability",
    question: "School-break and holiday availability requirement",
    answer: BREAKS_NO,
    outcome: "disqualifying",
    reason:
      "Consistent staffing during school breaks and major holidays is essential because the people we support rely on scheduled coverage every day of the year. We can only move forward with applicants who can meet the school-break time-off limits and remain available for the Thanksgiving and Christmas periods they are scheduled to work.",
  },
  {
    key: "pay_response",
    question: "Pay expectations",
    answer: PAY_NO,
    outcome: "disqualifying",
    reason:
      "We want applicants to understand the position\u2019s compensation before investing additional time in the hiring process. Because the current starting rate for the Support Professional position is $17.75 per hour, we can only move forward with applicants who confirm that this rate meets their current expectations.",
  },
  {
    key: "onboarding_availability",
    question: "Weekday onboarding availability (first three weeks)",
    answer: ONBOARDING_CANNOT,
    outcome: "disqualifying",
    match: "includes",
    reason:
      "The response you selected does not meet an essential onboarding requirement for this position and will end your application.",
  },

  /* HR review required — applicant continues normally, private flag created. */
  {
    key: "population_comfort",
    question: "Understanding the people we support",
    answer: POPULATION_INFO,
    outcome: "hr_review",
  },
  {
    key: "hygiene_readiness",
    question: "Intimate personal-care readiness",
    answer: HYGIENE_DISCUSS,
    outcome: "hr_review",
  },
  {
    key: "behavior_readiness",
    question: "Positive behavioral-support readiness",
    answer: BEHAVIOR_DISCUSS,
    outcome: "hr_review",
  },
  {
    key: "holiday_availability",
    question: "Holiday and school-break availability",
    answer: HOLIDAY_DISCUSS,
    outcome: "hr_review",
  },
  {
    key: "pay_response",
    question: "Pay expectations",
    answer: PAY_QUEST,
    outcome: "hr_review",
  },
  {
    key: "employment_type",
    question: "Short-Term Commitment — HR Review",
    answer: EMPLOYMENT_SHORT_TERM,
    outcome: "hr_review",
  },
  {
    key: "cert_format",
    question: "Certification Format Requires Review",
    answer: CERT_UNSURE,
    outcome: "hr_review",
  },
  {
    key: "housing_change",
    question: HOUSING_FLAG,
    answer: HOUSING_LOCAL_CHANGE,
    outcome: "hr_review",
    detail: (v) => str(v, "housing_local_explain"),
  },
  {
    key: "housing_compliance_leave",
    question: HOUSING_FLAG,
    answer: HOUSING_COMPLY_YES,
    outcome: "hr_review",
  },
  {
    key: "housing_compliance_leave",
    question: HOUSING_DISCUSS_FLAG,
    answer: HOUSING_COMPLY_DISCUSS,
    outcome: "hr_review",
  },
  {
    key: "housing_compliance_leave",
    question: "Housing and San Diego availability",
    answer: HOUSING_COMPLY_NO,
    outcome: "disqualifying",
    reason: HOUSING_COMPLY_REASON,
  },
  {
    key: "housing_compliance_uncertain",
    question: HOUSING_FLAG,
    answer: HOUSING_COMPLY_YES,
    outcome: "hr_review",
    detail: (v) => str(v, "housing_uncertain_explain"),
  },
  {
    key: "housing_compliance_uncertain",
    question: HOUSING_DISCUSS_FLAG,
    answer: HOUSING_COMPLY_DISCUSS,
    outcome: "hr_review",
  },
  {
    key: "housing_compliance_uncertain",
    question: "Housing and San Diego availability",
    answer: HOUSING_COMPLY_NO,
    outcome: "disqualifying",
    reason: HOUSING_COMPLY_REASON,
  },


  /* The weekend limitation flag and its per-commitment entries are generated by
     weekendCommitmentReviewFlags so each commitment stays a separate entry. */
  /* "Upcoming Time-Off Review Required" is generated per request by
     timeOffReviewFlags so each disclosed request stays a separate entry. */
];


/** Answers that end the application after the applicant confirms the warning. */
const DISQUALIFIERS = OUTCOME_RULES.filter(
  (rule) => rule.outcome === "disqualifying",
) as (OutcomeRule & { reason: string })[];

const HR_REVIEW_RULES = OUTCOME_RULES.filter((rule) => rule.outcome === "hr_review");


type DqRecord = {
  attemptId: string;
  question: string;
  answer: string;
  reason: string;
  at: string;
  /** Closing paragraph override for the standardized card. */
  closing?: string;
  /** Label for the single action button on the standardized card. */
  buttonLabel?: string;
  /** Admin-only record of which requirement statements were left unchecked. */
  unchecked?: string[];
};

const MIN_REQUIREMENTS = [
  "I am at least 18 years old.",
  "I am legally authorized to work in the United States.",
  "I have a high-school diploma or GED.",
  "I am willing and able to work at either assigned location.",
  "I am willing to follow required infection-control procedures and use provided personal protective equipment.",
  "I understand that reliable attendance and punctuality are essential because the people we support depend on scheduled staffing.",
];

const MIN_REQ_REASON =
  "Each statement listed represents a minimum requirement of the Support Professional position. To meet our employment standards and provide safe, dependable support to the people we serve, we can only move forward with applicants who can confirm that they meet all of these requirements.";

const MIN_REQ_CLOSING =
  "Based on your response, you do not currently meet one or more position requirements and cannot continue the application. We appreciate your honesty and interest in Elev8 Services.";

const DUTIES_REASON =
  "Every responsibility listed is an essential requirement of the Support Professional position. To provide safe, consistent, and dignified support to the people we serve, we can only move forward with applicants who are willing to perform each listed responsibility after receiving the required training.";

const DUTIES_CLOSING =
  "Based on your response, you are not able to confirm willingness to perform every listed responsibility and cannot continue the application. We appreciate your honesty and interest in Elev8 Services.";





const SCHOOL_BREAKS = [
  "Spring break",
  "Summer break",
  "Fall break",
  "Winter break",
  "Other periods when your school is not in session",
];


const str = (v: Values, k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
const arr = (v: Values, k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : []);
const bool = (v: Values, k: string) => v[k] === true;

type StepDef = { title: string; short: string; intro: string; fields: FieldDef[] };

/**
 * Five-step application. Each step has one purpose: contact and opportunity
 * interest, position requirements, schedule and availability, commitments and
 * fit, then review. Field keys are the backend identifiers and never change
 * when a question moves between steps, so saved drafts migrate automatically.
 */
const STEPS: StepDef[] = [
  {
    title: "Applicant Information & Career Interests",
    short: "Information",
    intro:
      "Tell us how to contact you, how you learned about Elev8, and which opportunity interests you.",
    fields: [
      {
        key: "first_name",
        label: "Legal first name",
        type: "text",
        required: true,
        group: "Applicant Information",
      },
      {
        key: "last_name",
        label: "Legal last name",
        type: "text",
        required: true,
        group: "Applicant Information",
      },
      {
        key: "phone",
        label: "Phone number",
        type: "phone",
        required: true,
        group: "Applicant Information",
      },
      {
        key: "email",
        label: "Email address",
        type: "email",
        required: true,
        group: "Applicant Information",
      },
      {
        key: "referral_source",
        label: "How did you hear about us?",
        type: "select",
        required: true,
        options: SCHOOLS,
        group: "Applicant Information",
      },
      {
        key: "referral_class",
        label: "Which class or instructor referred you?",
        type: "text",
        group: "Applicant Information",
        visibleIf: (v) =>
          !!str(v, "referral_source") &&
          str(v, "referral_source") !== "A friend or current team member" &&
          str(v, "referral_source") !== "Other",
        requiredIf: (v) =>
          !!str(v, "referral_source") &&
          str(v, "referral_source") !== "A friend or current team member" &&
          str(v, "referral_source") !== "Other",
      },
      {
        key: "referral_other",
        label: "Please tell us how you heard about us",
        type: "text",
        group: "Applicant Information",
        visibleIf: (v) => str(v, "referral_source") === "Other",
        requiredIf: (v) => str(v, "referral_source") === "Other",
      },
      {
        key: "opportunity_pref",
        label: "Opportunity Preference",
        type: "cards",
        required: true,
        sectionBreak: true,
        help: "Which type of opportunity are you primarily seeking?",
        cards: OPPORTUNITY_CARDS,
        group: "Opportunity Preferences",
      },
      {
        key: "internship_interest",
        label: "Internship Interest",
        type: "cards",
        help: "What interests you most about our paid internship?",
        cards: INTERNSHIP_INTEREST_CARDS,
        group: "Opportunity Preferences",
        visibleIf: (v) => str(v, "opportunity_pref") === OPP_INTERNSHIP,
        requiredIf: (v) => str(v, "opportunity_pref") === OPP_INTERNSHIP,
      },
      {
        key: "employment_interest",
        label: "Employment Interest",
        type: "cards",
        help: "What interests you most about working with Elev8 Services?",
        cards: EMPLOYMENT_INTEREST_CARDS,
        group: "Opportunity Preferences",
        visibleIf: (v) => str(v, "opportunity_pref") === OPP_EMPLOYMENT,
        requiredIf: (v) => str(v, "opportunity_pref") === OPP_EMPLOYMENT,
      },
      {
        key: "either_interest",
        label: "Primary Interest",
        type: "cards",
        help: "What interests you most about this opportunity?",
        cards: EITHER_INTEREST_CARDS,
        group: "Opportunity Preferences",
        visibleIf: (v) => str(v, "opportunity_pref") === OPP_EITHER,
        requiredIf: (v) => str(v, "opportunity_pref") === OPP_EITHER,
      },
      {
        key: "pay_response",
        label: "Does this pay structure meet your expectations?",
        type: "select",
        required: true,
        sectionBreak: true,
        placeholder: "Select one",
        custom: "pay",
        options: [PAY_MEET, PAY_QUEST, PAY_NO],
        group: "Opportunity Preferences",
      },
    ],
  },
  {
    title: "Position Requirements & Acknowledgments",
    short: "Requirements",
    intro:
      "Please review the position\u2019s essential requirements, responsibilities, training expectations, and pre-employment conditions.",
    fields: [
      {
        key: "longterm_sd",
        label: "Long-term San Diego availability",
        type: "select",
        required: true,
        placeholder: "Select one",
        help: "Can you confidently commit to remaining available for in-person work in San Diego County through December 31, 2027?",
        options: [SD_COMMIT_YES, SD_COMMIT_NO],
        group: "Position Requirements",
      },
      {
        key: "eligibility",
        label: "Minimum Position Requirements",
        type: "checkboxes",
        required: true,
        sectionBreak: true,
        min: 6,
        help: "Please confirm each statement. All statements are required for this position.",
        options: MIN_REQUIREMENTS,
        group: "Position Requirements",
      },
      {
        key: "population_comfort",
        label: "Understanding the people we support",
        type: "select",
        required: true,
        sectionBreak: true,
        placeholder: "Select one",
        help: "Elev8 supports primarily adult men with developmental disabilities. Many are largely independent and benefit from companionship, structure, community involvement, health-related support, and assistance with daily living. Some individuals require hands-on help with personal care or positive behavioral support. Training, written support plans, supervision, and guidance are provided.",
        options: [
          "I understand the population and type of support described.",
          POPULATION_INFO,
        ],
        group: "Position Requirements",
      },
      {
        key: "hygiene_readiness",
        label: "Intimate personal-care readiness",
        type: "select",
        required: true,
        placeholder: "Select one",
        help: "This position may require assisting adult male clients with showering, toileting, continence care, dressing, shaving, oral hygiene, and other personal-care needs. These responsibilities may involve appropriate professional contact with genital or perineal areas. Staff must provide this assistance respectfully while protecting each person's dignity, privacy, safety, and personal boundaries. Training is provided before staff perform these responsibilities independently.",
        options: [
          "I am willing to provide this care after receiving training.",
          HYGIENE_NO,
          HYGIENE_DISCUSS,
        ],
        group: "Position Requirements",
      },
      {
        key: "behavior_readiness",
        label: "Positive behavioral-support readiness",
        type: "select",
        required: true,
        placeholder: "Select one",
        help: "Working in an Adult Residential Facility includes supporting individuals with a range of behavioral needs. Currently, one adult male client has a Positive Behavior Support Plan that addresses occasional sexually inappropriate comments, gestures, exposure, challenges with personal boundaries, or attempts at inappropriate contact.\n\nStaff receive training on the client's support plan, approved redirection techniques, professional boundaries, documentation, and when to seek supervisory assistance. Staff safety, client dignity, and respectful support remain priorities at all times.",
        options: [
          "I am willing to provide this support after receiving training.",
          BEHAVIOR_NO,
          BEHAVIOR_DISCUSS,
        ],
        group: "Position Requirements",
      },
      {
        key: "duties_comfort",
        label: "Job responsibilities",
        type: "checkboxes",
        required: true,
        min: DUTY_OPTIONS.length,
        help: "All listed responsibilities are required for this position. Please confirm that you are willing to perform each responsibility after receiving the required training.\n\nApplicants must select every listed responsibility to meet the position requirements.",
        options: DUTY_OPTIONS,
        group: "Position Requirements",
      },
      {
        key: "training_willing",
        label: "Willingness to complete training",
        type: "select",
        required: true,
        placeholder: "Select one",
        help: "Elev8 provides paid onboarding and required training covering client rights, personal care, medication support, positive behavioral support, documentation, emergency procedures, professional boundaries, and workplace safety.",
        options: [
          "I am willing to complete all required onboarding and training.",
          TRAINING_NO,
        ],
        group: "Position Requirements",
      },
      {
        key: "first_aid",
        label: "First Aid and CPR certification",
        type: "select",
        required: true,
        sectionBreak: true,
        placeholder: "Select one",
        help: "Support Professionals must hold current First Aid and CPR certifications, or be willing to obtain them before starting.",
        options: [
          CERT_HOLDS,
          "I am willing to obtain the required certifications before starting.",
          CERT_NO,
        ],
        group: "Position Requirements",
      },
      {
        key: "cert_format",
        label: "How are your certifications issued?",
        type: "radio",
        group: "Position Requirements",
        visibleIf: (v) => str(v, "first_aid") === CERT_HOLDS,
        requiredIf: (v) => str(v, "first_aid") === CERT_HOLDS,
        options: [CERT_COMBINED, CERT_SEPARATE, CERT_UNSURE],
      },
      {
        key: "cert_combined_exp",
        label: "First Aid and CPR expiration date",
        type: "date",
        group: "Position Requirements",
        visibleIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_COMBINED,
        requiredIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_COMBINED,
        validate: certDateValidate("cert_combined_exp"),
        help: "Enter the single expiration date printed on your combined certification or card.",
      },
      {
        key: "cert_fa_exp",
        label: "First Aid expiration date",
        type: "date",
        group: "Position Requirements",
        visibleIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_SEPARATE,
        requiredIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_SEPARATE,
        validate: certDateValidate("cert_fa_exp"),
      },
      {
        key: "cert_cpr_exp",
        label: "CPR expiration date",
        type: "date",
        group: "Position Requirements",
        visibleIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_SEPARATE,
        requiredIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_SEPARATE,
        validate: certDateValidate("cert_cpr_exp"),
        help: "Enter the expiration date printed on each certification.",
      },
      {
        key: "cert_upload_combined",
        label: "Upload your First Aid and CPR certification",
        type: "certupload",
        help: CERT_UPLOAD_HELP,
        group: "Position Requirements",
        visibleIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_COMBINED,
        requiredIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_COMBINED,
      },
      {
        key: "cert_upload_fa",
        label: "Upload your First Aid certification",
        type: "certupload",
        help: CERT_UPLOAD_HELP,
        group: "Position Requirements",
        visibleIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_SEPARATE,
        requiredIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_SEPARATE,
      },
      {
        key: "cert_upload_cpr",
        label: "Upload your CPR certification",
        type: "certupload",
        help: CERT_UPLOAD_HELP,
        group: "Position Requirements",
        visibleIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_SEPARATE,
        requiredIf: (v) =>
          str(v, "first_aid") === CERT_HOLDS && str(v, "cert_format") === CERT_SEPARATE,
      },
      {
        key: "ack_cdss",
        label: "CDSS criminal-record clearance requirement",
        type: "ack",
        required: true,
        sectionBreak: true,
        policy:
          "Employment in a licensed community care facility is contingent upon completion of the criminal-record clearance process required by the California Department of Social Services. When applicable, CDSS determines eligibility for a criminal-record exemption.",
        help: "I understand that I must receive the clearance or exemption required by CDSS before I may work or have contact with clients.",
        group: "Position Requirements",
      },
      {
        key: "commute",
        label: "How will you commute to shifts?",
        type: "select",
        required: true,
        sectionBreak: true,
        placeholder: "Select an option",
        visibleIf: (v) => str(v, "longterm_sd") !== SD_COMMIT_NO,
        options: ["My own vehicle", "Public transportation", "Rideshare or carpool", "Other"],
        group: "Position Requirements",
      },
      {
        key: "commute_other",
        label: "Please describe your commute",
        type: "text",
        group: "Position Requirements",
        visibleIf: (v) => str(v, "commute") === "Other",
        requiredIf: (v) => str(v, "commute") === "Other",
      },
    ],
  },
  {
    title: "Schedule, Availability & Time Off",
    short: "Availability",
    intro:
      "Please complete each section below so we can accurately understand your class schedule, regular availability, weekend availability, holiday availability, and anticipated time-off needs.",
    fields: [
      {
        key: "ack_availability",
        label: "General availability",
        type: "ack",
        required: true,
        policy:
          "General availability refers to the regular, ongoing days and times you are consistently available to work. Schedules are created using the availability provided during the hiring process, and the people we support depend on consistent and reliable staffing.",
        help: "I understand that I am expected to maintain the availability I provide and promptly report any requested changes.",
        group: "Regular Availability",
      },
      {
        key: "enrolled",
        sectionTitle: "School and Class Schedule",
        sectionBreak: true,
        label: "Are you currently enrolled in school?",
        type: "select",
        required: true,
        placeholder: "Select one",
        help: "For students, we use your academic calendar and class schedule to understand your availability. Schools may follow a semester, quarter, trimester, or another academic calendar.",
        options: [ENROLL_CURRENT, ENROLL_UPCOMING, ENROLL_NO],
        group: "School and Class Schedule",
      },
      {
        key: "school_name",
        label: "School, college, or university name",
        type: "text",
        group: "School and Class Schedule",
        visibleIf: isStudent,
        requiredIf: isStudent,
      },
      {
        key: "academic_calendar",
        label: "Which academic calendar does your school use?",
        type: "select",
        placeholder: "Select one",
        options: ["Semester", "Quarter", "Trimester", "Other", "I am not sure"],
        group: "School and Class Schedule",
        visibleIf: isStudent,
        requiredIf: isStudent,
      },
      {
        key: "academic_level",
        label: "What is your current academic level or year?",
        type: "select",
        placeholder: "Select your current academic level",
        options: ACADEMIC_LEVELS,
        group: "Academic Information",
        visibleIf: isStudent,
        requiredIf: isStudent,
      },
      {
        key: "academic_level_other",
        label: "Please describe your current academic level or program.",
        type: "text",
        placeholder: "Enter your current academic level or program",
        group: "Academic Information",
        visibleIf: (v) => isStudent(v) && str(v, "academic_level") === LEVEL_OTHER,
        requiredIf: (v) => isStudent(v) && str(v, "academic_level") === LEVEL_OTHER,
      },
      {
        key: "first_term_status",
        label:
          "Will the upcoming academic term be your first academic term at this college or in this program?",
        type: "select",
        placeholder: "Select one",
        options: [FIRST_TERM_YES, FIRST_TERM_NO],
        note: "This question is separate from your academic level. For example, a transfer student may be a third-year student while still entering a first term at a new college or program.",
        group: "Academic Information",
        visibleIf: isStudent,
        requiredIf: isStudent,
      },
      {
        key: "upcoming_units",
        label:
          "How many units or credits do you expect to take during your upcoming academic term?",
        type: "number",
        numMin: 0,
        numMax: 40,
        decimals: 1,
        placeholder: "Example: 12",
        help: "If your enrollment is not final, provide your best current estimate.",
        altKey: "upcoming_units_tbd",
        altLabel: "My upcoming unit or credit total has not yet been determined.",
        group: "Academic Information",
        visibleIf: isStudent,
        requiredIf: isStudent,
      },
      {
        key: "transfer_status",
        label: "Transfer status",
        type: "select",
        sectionBreak: true,
        placeholder: "Select one",
        help: "Did you attend another college, university, or postsecondary program before your current school or program?",
        options: [TRANSFER_NO, TRANSFER_YES],
        group: "Academic Information",
        visibleIf: isStudent,
        requiredIf: isStudent,
      },
      {
        key: "transfer_school",
        label: "Name of the institution you previously attended",
        type: "text",
        placeholder: "Enter the college, university, or program name",
        group: "Academic Information",
        visibleIf: isTransfer,
        requiredIf: isTransfer,
      },
      {
        key: "transfer_calendar",
        label: "Which academic calendar did that institution use?",
        type: "select",
        placeholder: "Select one",
        options: ["Semester", "Quarter", "Trimester", "Other", "I am not sure"],
        group: "Academic Information",
        visibleIf: isTransfer,
        requiredIf: isTransfer,
      },
      {
        key: "transfer_load",
        label: "What was your typical enrollment load at that institution?",
        type: "select",
        placeholder: "Select one",
        options: ENROLLMENT_LOADS,
        group: "Academic Information",
        visibleIf: isTransfer,
        requiredIf: isTransfer,
      },


      {
        key: "class_entries",
        label: "Current and upcoming classes",
        type: "classes",
        help: "Add every class that you are enrolled in or may take during this academic term, including classes that are pending enrollment, tentative, waitlisted, or not yet scheduled.",
        group: "School and Class Schedule",
        visibleIf: isStudent,
        requiredIf: isStudent,
        validate: validateClasses,
      },
      {
        key: "class_schedule_files",
        label: "Submission of current/upcoming class schedule",
        type: "scheduleupload",
        help: "Please upload a current copy or screenshot of your official or upcoming class schedule. The schedule should show your courses, class days, and class times when available.\n\nIf enrollment or scheduling is still pending, upload the most current schedule or enrollment information available to you.",
        group: "School and Class Schedule",
        visibleIf: isStudent,
        requiredIf: isStudent,
        validate: (v) =>
          !isStudent(v) || parseFileList(str(v, "class_schedule_files")).length
            ? undefined
            : "Please upload at least one class-schedule file.",
      },
      {
        key: "housing_change",
        sectionTitle: "Housing and San Diego Availability",
        sectionBreak: true,
        label: HOUSING_QUESTION,
        type: "select",
        placeholder: "Select one",
        help: HOUSING_HELP,
        options: HOUSING_OPTIONS,
        group: "Housing and San Diego Availability",
        visibleIf: showHousing,
        requiredIf: showHousing,
      },
      {
        key: "housing_local_explain",
        minChars: 30,
        label: HOUSING_LOCAL_PROMPT,
        type: "textarea",
        placeholder: HOUSING_LOCAL_PLACEHOLDER,
        group: "Housing and San Diego Availability",
        visibleIf: (v) => showHousing(v) && str(v, "housing_change") === HOUSING_LOCAL_CHANGE,
        requiredIf: (v) => showHousing(v) && str(v, "housing_change") === HOUSING_LOCAL_CHANGE,
      },
      {
        key: "housing_absences",
        label: HOUSING_ABSENCE_PROMPT,
        type: "timeoff",
        timeoffVariant: "housing",
        group: "Housing and San Diego Availability",
        visibleIf: housingLeave,
        requiredIf: housingLeave,
        validate: validateHousingAbsences,
      },
      {
        key: "housing_compliance_leave",
        label: HOUSING_COMPLY_LEAVE_LABEL,
        type: "select",
        placeholder: "Select one",
        options: HOUSING_COMPLY_OPTIONS,
        group: "Housing and San Diego Availability",
        visibleIf: housingLeave,
        requiredIf: housingLeave,
      },
      {
        key: "housing_uncertain_explain",
        minChars: 30,
        label: HOUSING_UNCERTAIN_PROMPT,
        type: "textarea",
        placeholder: HOUSING_UNCERTAIN_PLACEHOLDER,
        group: "Housing and San Diego Availability",
        visibleIf: housingUncertain,
        requiredIf: housingUncertain,
      },
      {
        key: "housing_compliance_uncertain",
        label: HOUSING_COMPLY_UNCERTAIN_LABEL,
        type: "select",
        placeholder: "Select one",
        options: HOUSING_COMPLY_OPTIONS,
        group: "Housing and San Diego Availability",
        visibleIf: housingUncertain,
        requiredIf: housingUncertain,
      },
      {
        key: "overnight_availability",
        sectionTitle: "Regular Shift Availability",
        sectionBreak: true,

        label: "Nocturnal/overnight availability",
        type: "availability",
        required: true,
        help: "Please select every overnight shift you are available to work.\n\nOvernight shifts run from 10:00 PM to 8:00 AM the following day. Applicants must not have a class or other commitment beginning before 10:00 AM the following morning.\n\nFor example, selecting Tuesday means you are available from Tuesday at 10:00 PM through Wednesday at 8:00 AM.\n\nApplicants with broader overnight availability and greater scheduling flexibility may receive priority when interviews are scheduled.",
        options: [...ALL_DAYS, NOT_AVAILABLE],
        group: "Regular Availability",
      },
      {
        key: "early_morning_availability",
        label: "Early-morning availability for doctor appointments",
        type: "availability",
        required: true,
        sectionBreak: true,
        help: "Please select every weekday you are available to support morning doctor appointments, typically scheduled between 7:00 AM and 11:30 AM.",
        options: [...WEEKDAY_DAYS, NOT_AVAILABLE],
        group: "Regular Availability",
      },
      {
        key: "mid_afternoon_availability",
        label: "Midday/early-afternoon availability for doctor appointments",
        type: "availability",
        required: true,
        sectionBreak: true,
        help: "Please select every weekday you are available to support doctor appointments typically scheduled between 11:30 AM and 2:30 PM.",
        options: [...WEEKDAY_DAYS, NOT_AVAILABLE],
        group: "Regular Availability",
      },
      {
        key: "weekday_evening_availability",
        label: "Weekday afternoon/evening availability",
        type: "availability",
        required: true,
        sectionBreak: true,
        help: "Please select every weekday you are regularly available to work between 2:15 PM and 10:00 PM.\n\nApplicants with broader availability and greater scheduling flexibility may receive priority when interviews are scheduled.",
        options: [...WEEKDAY_DAYS, EVENING_NONE],
        group: "Regular Availability",
      },
      {
        key: "onboarding_ack",
        label: "Initial onboarding availability required",
        type: "ack",
        required: true,
        group: "Regular Availability",
        visibleIf: (v) =>
          arr(v, "weekday_evening_availability").includes(EVENING_NONE),
        policy:
          "If you receive and accept an offer, you must be available from 2:00 PM\u201310:00 PM on at least two weekdays per week during your first three weeks of employment or internship.\n\nThe hiring and pre-employment process generally takes approximately four weeks after an application is submitted. When answering below, please consider your anticipated availability beginning around that time.",
        help: "I understand that, even though I am not regularly available during this shift period, I must be available from 2:00 PM\u201310:00 PM on at least two weekdays per week during my first three weeks with Elev8.",
        validate: (v) =>
          v["onboarding_ack"] === true ? undefined : "This answer is required.",
      },
      {
        key: "onboarding_availability",
        label:
          "Which weekdays could you be available from 2:00 PM\u201310:00 PM during your first three weeks?",
        type: "onboarding",
        required: true,
        group: "Regular Availability",
        visibleIf: (v) =>
          arr(v, "weekday_evening_availability").includes(EVENING_NONE),
        help: "Select at least two weekdays. This temporary onboarding availability applies only to your first three weeks and does not replace the regular availability you provided above.",
        options: [...WEEKDAY_DAYS, ONBOARDING_CANNOT],
        validate: validateOnboardingAvailability,
      },
      {
        key: "ack_weekend",
        sectionTitle: "Weekend Availability",
        sectionBreak: true,
        label: "Weekend availability",
        type: "ack",
        required: true,
        custom: "weekend",
        help: "I understand and agree that my regular work schedule will include weekend shifts on either Saturdays or Sundays, or both Saturdays and Sundays.",
        validate: (v) => (v["ack_weekend"] === true ? undefined : "This answer is required."),
        group: "Weekend Availability",
      },
      {
        key: "weekend_commitments",
        label: "Weekend scheduling conflicts",
        type: "select",
        required: true,
        placeholder: "Select one",
        help: WKEND_QUESTION,
        options: [WEEKEND_NO, WEEKEND_YES],
        note: WEEKEND_NOTE,
        noteIf: (v) => str(v, "weekend_commitments") !== WEEKEND_YES,
        group: "Weekend Availability",
      },
      {
        key: "weekend_commitment_entries",
        label: "Weekend commitments",
        type: "commitments",
        commitVariant: "weekend",
        group: "Weekend Availability",
        visibleIf: (v) => str(v, "weekend_commitments") === WEEKEND_YES,
        requiredIf: (v) => str(v, "weekend_commitments") === WEEKEND_YES,
        validate: validateWeekendCommitments,
      },
      {
        key: "holiday_availability",
        sectionTitle: "Holiday and School-Break Availability",
        sectionBreak: true,
        label: "Can you meet this availability requirement?",
        type: "select",
        required: true,
        placeholder: "Select one",
        custom: "holiday",
        options: [HOLIDAY_MEET, HOLIDAY_CANNOT, HOLIDAY_DISCUSS],
        group: "Holiday and Time-Off Information",
      },
      {
        key: "holiday_explain",
        minChars: 30,
        label:
          "Please describe the specific limitation, including any applicable days, times, or dates.",
        type: "textarea",
        group: "Holiday and Time-Off Information",
        visibleIf: (v) => str(v, "holiday_availability") === HOLIDAY_DISCUSS,
        requiredIf: (v) => str(v, "holiday_availability") === HOLIDAY_DISCUSS,
      },
      {
        key: "breaks_availability",
        label: "Can you meet these school-break and holiday availability requirements?",
        type: "select",
        required: true,
        placeholder: "Select one",
        custom: "breaks",
        options: [BREAKS_YES, BREAKS_NO],
        group: "Holiday and Time-Off Information",
        visibleIf: holidayAnswered,
        requiredIf: holidayAnswered,
      },
      {
        key: "preferred_holiday",
        label: "Preferred holiday period off",
        type: "select",
        placeholder: "Select your top preference",
        help: "Which one holiday period would you most prefer to have off? This is a scheduling preference only and does not guarantee approval. If approved, you must remain available to work the other holiday periods.",
        options: PREFERRED_HOLIDAY_OPTIONS,
        group: "Holiday and Time-Off Information",
        visibleIf: (v) =>
          holidayAnswered(v) && str(v, "breaks_availability") === BREAKS_YES,
        requiredIf: (v) =>
          holidayAnswered(v) && str(v, "breaks_availability") === BREAKS_YES,
      },
      {
        key: "ack_travel",
        sectionTitle: "Travel and Upcoming Time Off",
        sectionBreak: true,
        label: "Travel and time-off policy",
        type: "ack",
        required: true,
        policy: `Time off must be requested and approved before booking flights, accommodations, or other nonrefundable travel. Submitting a request does not guarantee approval.

Except for travel booked before your employment start date, reservations made without prior time-off approval will not be honored as approved leave. Submit your request and wait for an approval or denial before finalizing any travel arrangements.`,
        help: "I understand that time off must be approved before I finalize travel arrangements.",
        group: "Holiday and Time-Off Information",
      },
      {
        key: "upcoming_time_off",
        label: "Upcoming time-off requests",
        type: "select",
        required: true,
        placeholder: "Select one",
        help: "Do you anticipate requesting any time off within the next eight months?",
        options: [TIMEOFF_NO, TIMEOFF_YES],
        group: "Holiday and Time-Off Information",
      },
      {
        key: "time_off_requests",
        label: "Anticipated time-off requests",
        type: "timeoff",
        group: "Holiday and Time-Off Information",
        visibleIf: (v) => str(v, "upcoming_time_off") === TIMEOFF_YES,
        requiredIf: (v) => str(v, "upcoming_time_off") === TIMEOFF_YES,
        validate: validateTimeOff,
      },
    ],
  },
  {
    title: "Commitments, Experience & Fit",
    short: "Fit",
    intro:
      "Tell us about the type of opportunity you are seeking, your current or planned commitments, and the experience you would bring to Elev8.",
    fields: [
      {
        key: "employment_type",
        label: "Intended internship/employment commitment",
        type: "radio",
        required: true,
        help: "Which option best reflects the length of time you currently intend to work or intern with Elev8?\n\nThis question asks how long you currently intend to remain with Elev8. It is separate from the requirement to remain geographically available for in-person work in San Diego County.",
        options: [EMPLOYMENT_SHORT_TERM, EMPLOYMENT_LONG_TERM],
        optionInfo: {
          [EMPLOYMENT_LONG_TERM]: {
            title: "Letter of recommendation and hour verification",
            body: "A minimum one-year commitment is required to qualify for a letter of recommendation and verification of completed internship hours.",
          },
        },
        group: "Commitments and Experience",
      },
      {
        key: "other_commitments",
        label: COMMIT_QUESTION,
        type: "select",
        required: true,
        sectionBreak: true,
        custom: "commitmentsIntro",
        placeholder: "Select one",
        options: [COMMIT_NO, COMMIT_YES],
        group: "Commitments and Experience",
      },
      {
        key: "commitment_entries",
        label: "Regular commitments",
        type: "commitments",
        group: "Commitments and Experience",
        visibleIf: (v) => str(v, "other_commitments") === COMMIT_YES,
        requiredIf: (v) => str(v, "other_commitments") === COMMIT_YES,
        validate: validateCommitments,
      },
      {
        key: "relevant_experience",
        minChars: 30,
        label:
          "Please briefly describe any relevant employment, volunteer, caregiving, educational, or internship experience.",
        type: "textarea",
        required: true,
        sectionBreak: true,
        placeholder:
          "Include experience that may help you support adults with developmental disabilities or succeed in this position.",
        group: "Commitments and Experience",
      },
      {
        key: "prev_commitments",
        label: "Commitments during your previous schooling",
        type: "select",
        sectionBreak: true,
        placeholder: "Select one",
        help: "While attending your previous institution, did you maintain a job, internship, religious or faith-based commitment, family or caregiving responsibility, athletic commitment, or another regular obligation?",
        options: [HISTORY_NO, HISTORY_YES],
        group: "Education and Career Goals",
        visibleIf: (v) => showEducation(v) && isTransfer(v),
        requiredIf: (v) => showEducation(v) && isTransfer(v),
      },
      {
        key: "prev_commitment_entries",
        label: "Commitments you maintained while enrolled there",
        type: "history",
        help: "Add each commitment you maintained while attending your previous institution.",
        group: "Education and Career Goals",
        visibleIf: (v) =>
          showEducation(v) && isTransfer(v) && str(v, "prev_commitments") === HISTORY_YES,
        requiredIf: (v) =>
          showEducation(v) && isTransfer(v) && str(v, "prev_commitments") === HISTORY_YES,
        validate: validateHistory,
      },
      {
        key: "hs_gpa",
        reviewLabel: "High-School GPA",
        label: "What was your cumulative high-school GPA?",
        type: "number",
        numMin: 0,
        numMax: 4,
        decimals: 2,
        placeholder: "Example: 3.50",
        emptyMsg: "Please enter your cumulative high-school GPA.",
        rangeMsg: "Please enter a GPA between 0.00 and 4.00.",
        sectionBreak: true,
        sectionTitle: "High-School GPA",
        group: "Education and Career Goals",
        visibleIf: showEducation,
        requiredIf: showEducation,
      },
      {
        key: "career_goal",
        label: "Which career path are you currently pursuing or most interested in?",
        type: "select",
        sectionBreak: true,
        sectionTitle: "Career Path",
        placeholder: "Select your current career interest",
        options: CAREER_GOALS,
        group: "Education and Career Goals",
        visibleIf: showEducation,
        requiredIf: showEducation,
      },
      {
        key: "career_goal_other",
        label: "Please describe your current career goal.",
        type: "text",
        placeholder: "Enter the career or professional field you are pursuing",
        group: "Education and Career Goals",
        visibleIf: (v) =>
          showEducation(v) &&
          (str(v, "career_goal") === CAREER_OTHER_HEALTH ||
            str(v, "career_goal") === CAREER_OTHER_FIELD),
        requiredIf: (v) =>
          showEducation(v) &&
          (str(v, "career_goal") === CAREER_OTHER_HEALTH ||
            str(v, "career_goal") === CAREER_OTHER_FIELD),
      },
      {
        key: "major",
        label: "What is your current major, program, or area of study?",
        type: "text",
        sectionBreak: true,
        sectionTitle: "Current Major or Area of Study",
        placeholder: "Example: Nursing, Psychology, Biology, Social Work, or Human Services",
        group: "Education and Career Goals",
        visibleIf: showEducation,
        requiredIf: showEducation,
      },
      {
        key: "transfer_gpa",
        reviewLabel: "Transfer GPA",
        label:
          "What was your cumulative GPA at the college or institution from which you transferred?",
        type: "number",
        numMin: 0,
        numMax: 4,
        decimals: 2,
        placeholder: "Example: 3.40",
        emptyMsg: "Please enter your cumulative GPA from your previous institution.",
        rangeMsg: "Please enter a GPA between 0.00 and 4.00.",
        sectionBreak: true,
        sectionTitle: "Transfer GPA",
        group: "Education and Career Goals",
        visibleIf: gpaPathIs("transfer"),
        requiredIf: gpaPathIs("transfer"),
      },
      {
        key: "college_gpa_none",
        reviewLabel: "College GPA",
        label: "College GPA",
        type: "info",
        note: "A college GPA is not required because you indicated that this is your first college term and you have not yet received a college GPA.",
        sectionBreak: true,
        sectionTitle: "College GPA",
        group: "Education and Career Goals",
        visibleIf: gpaPathIs("first_term"),
      },
      {
        key: "current_gpa",
        reviewLabel: "Current College GPA",
        label: "What is your current cumulative college or university GPA?",
        type: "number",
        numMin: 0,
        numMax: 4,
        decimals: 2,
        placeholder: "Example: 3.50",
        emptyMsg: "Please enter your current cumulative college or university GPA.",
        rangeMsg: "Please enter a GPA between 0.00 and 4.00.",
        sectionBreak: true,
        sectionTitle: "Current College Cumulative GPA",
        group: "Education and Career Goals",
        visibleIf: gpaPathIs("current"),
        requiredIf: gpaPathIs("current"),
      },
      {
        key: "career_connection",
        minChars: 30,
        label: "How would working or interning with Elev8 support your educational or career goals?",
        type: "textarea",
        sectionBreak: true,
        sectionTitle: "Connection to Career Goals",
        placeholder:
          "Briefly explain the experience, skills, or professional growth you hope to gain.",
        group: "Education and Career Goals",
        visibleIf: showEducation,
        requiredIf: showEducation,
      },


      {
        key: "max_weekly_hours",
        label:
          "If selected, what is the maximum number of hours you would prefer to work or intern each week?",
        type: "select",
        required: true,
        sectionBreak: true,
        placeholder: "Select one",
        help: "Minimum weekly commitment: All team members are required to work at least 16 hours per week.",
        options: ["16–20 hours", "20–24 hours", "24–28+ hours", "32+ hours"],
        group: "Commitments and Experience",
      },
    ],
  },
  {
    title: "Review, Optional Uploads & Submit",
    short: "Review",
    intro:
      "Review your answers, attach your résumé, and confirm your information is accurate.",
    fields: [
      {
        key: "resume",
        label: "R\u00e9sum\u00e9 (PDF or image, up to 10 MB)",
        type: "file",
        help: "Optional. Helpful, but never required.",
      },
      {
        key: "sms_consent",
        reviewLabel: SMS_CONSENT_QUESTION,
        label: SMS_CONSENT_PROMPT,
        // An optional, unchecked checkbox rather than a required yes/no: text
        // messages are a convenience, not a condition of applying, and carrier
        // review expects consent to be separately and freely given.
        type: "checkboxes",
        custom: "smsConsent",
        required: false,
        sectionBreak: true,
        sectionTitle: SMS_CONSENT_QUESTION,
        help: SMS_CONSENT_RATES,
        options: [SMS_CONSENT_AGREE],
        group: "Review and Submit",
      },
      {
        key: "typed_name",
        label: "Type your full legal name",
        type: "text",
        required: true,
        help: "Typing your name confirms that the information in this application is complete and accurate to the best of your knowledge. The submission date and time are recorded by our system.",
      },
    ],
  },
];


/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const isVisible = (f: FieldDef, v: Values) => (f.visibleIf ? f.visibleIf(v) : true);
const isRequired = (f: FieldDef, v: Values) =>
  f.requiredIf ? f.requiredIf(v) : !!f.required;

const ALL_FIELDS = STEPS.flatMap((s) => s.fields);
const DISQUALIFIER_KEYS = new Set(DISQUALIFIERS.map((rule) => rule.key));

/**
 * Removes answers belonging to fields that are not currently visible (for
 * example, expiration dates for a certification format the applicant has not
 * selected). Hidden fields must never render, validate, reserve space, or be
 * submitted — this guarantees stale answers can never linger in a restored
 * draft or reach the submission payload.
 */
function pruneHiddenValues(v: Values): Values {
  const next: Values = { ...v };
  for (const f of ALL_FIELDS) {
    if (!isVisible(f, v)) delete next[f.key];
  }
  // The "no classes", "units not determined", and "no major" alternatives are
  // stored under their own keys, so they are pruned with their sections.
  if (!isStudent(v)) {
    delete next["classes_none"];
    delete next["upcoming_units_tbd"];
  }

  return next;

}

/**
 * Repeatedly prunes until the value set is stable, so a hidden answer can never
 * keep a downstream conditional question "visible". Validation and submission
 * therefore only ever see questions that are actually on screen right now.
 */
function settleValues(v: Values): Values {
  let current = v;
  for (let i = 0; i < 5; i += 1) {
    const next = pruneHiddenValues(current);
    if (Object.keys(next).length === Object.keys(current).length) return next;
    current = next;
  }
  return current;
}


/**
 * Single source of truth for disqualification review. Evaluates only the
 * questions' current answers, and only while the question is actually visible.
 * Missing answers are never disqualifying — they use required-field validation.
 */
/**
 * First-three-weeks onboarding availability: the applicant must pick at least
 * two weekdays, or explicitly state they cannot meet the requirement (which is
 * handled separately as a disqualification review, not a validation error).
 */
function validateOnboardingAvailability(v: Values) {
  const selected = arr(v, "onboarding_availability");
  if (selected.includes(ONBOARDING_CANNOT)) return undefined;
  const dayCount = selected.filter((d) => (WEEKDAY_DAYS as string[]).includes(d)).length;
  if (dayCount < 2)
    return "Please select at least two weekdays when you can be available from 2:00 PM\u201310:00 PM during your first three weeks.";
  return undefined;
}

function ruleMatches(rule: OutcomeRule, v: Values) {
  const selected =
    rule.match === "includes"
      ? arr(v, rule.key).includes(rule.answer)
      : str(v, rule.key) === rule.answer;
  if (!selected) return false;
  const field = ALL_FIELDS.find((f) => f.key === rule.key);
  if (field && !isVisible(field, v)) return false;
  return true;
}

function findDisqualifier(v: Values) {
  for (const rule of DISQUALIFIERS) {
    if (ruleMatches(rule, v)) return rule;
  }
  return null;
}

/**
 * Every HR-review response currently selected. Each becomes its own private
 * flag; they are never combined and never affect the applicant's experience.
 */
function collectHrReviews(v: Values) {
  const ruleFlags = HR_REVIEW_RULES.filter((rule) => ruleMatches(rule, v)).map((rule) => {
    const detail = rule.detail?.(v).trim();
    return {
      question: rule.question,
      answer: detail ? `${rule.answer}\n\nApplicant explanation: ${detail}` : rule.answer,
    };
  });
  // One flag per anticipated housing-related absence, in addition to the
  // housing responses matched by the rules above.
  return [...ruleFlags, ...housingReviewFlags(v)];
}




function fieldError(f: FieldDef, v: Values): string | undefined {
  if (!isVisible(f, v)) return undefined;
  const required = isRequired(f, v);
  const value = v[f.key];

  if (f.type === "certupload") {
    if (required && !parseCertFile(str(v, f.key)))
      return "Please upload this certification to continue.";
    return undefined;
  }

  if (f.validate) return f.validate(v);


  if (f.type === "ack") {
    if (required && value !== true) return "Please check this box to continue.";
    return undefined;
  }
  if (f.type === "availability") {
    if (required && arr(v, f.key).length === 0)
      return f.key === "overnight_availability"
        ? "Please select at least one overnight shift or indicate that you are not available for overnight shifts."
        : "Please select at least one available day or indicate that you are not available during this time.";
    return undefined;
  }
  if (f.type === "checkboxes") {
    const list = arr(v, f.key);
    const min = f.min ?? 1;
    if (required && list.length < min)
      return min > 1
        ? `Please confirm all ${min} statements to continue.`
        : "Please select at least one option.";
    return undefined;
  }

  if (f.type === "info") return undefined;

  if (f.type === "multiselect") {
    return required && arr(v, f.key).length === 0
      ? "This answer is required."
      : undefined;
  }
  if (f.type === "file") {
    if (required && !str(v, f.key))
      return "Please choose a file, or check \u201cMy schedule is still pending.\u201d";
    return undefined;
  }

  // A selected alternative ("not yet determined", "no major selected")
  // completes the question, so no value is required and no error is shown.
  if (f.altKey && bool(v, f.altKey)) return undefined;

  if (f.type === "number") {
    const raw = str(v, f.key).trim();
    if (!raw) return required ? (f.emptyMsg ?? "This answer is required.") : undefined;
    const decimals = f.decimals ?? 0;
    const pattern =
      decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/;
    if (!pattern.test(raw))
      return (
        f.rangeMsg ??
        (decimals > 0
          ? `Please enter a number using up to ${decimals} decimal place${decimals === 1 ? "" : "s"}.`
          : "Please enter a whole number.")
      );
    const amount = Number(raw);
    const low = f.numMin ?? 0;
    const high = f.numMax ?? Number.MAX_SAFE_INTEGER;
    if (amount < low || amount > high)
      return f.rangeMsg ?? `Please enter a number between ${low} and ${high}.`;
    return undefined;
  }

  const text = str(v, f.key).trim();
  if (!text) return required ? "This answer is required." : undefined;

  // Substantive written responses need enough detail to be reviewable.
  if (f.minChars && text.length < f.minChars)
    return `Please provide at least ${f.minChars} characters so we can review your response (${text.length} of ${f.minChars}).`;


  if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text))
    return "Please enter a valid email address, for example name@example.com.";
  if (f.type === "phone" && text.replace(/\D/g, "").length !== 10)
    return "Please enter a 10-digit US phone number.";



  if (text.length > 1000) return "Please shorten this answer.";
  return undefined;
}

const step = (i: number) => STEPS[i] as StepDef;

function stepErrors(stepIndex: number, rawValues: Values) {
  // Only currently visible, currently applicable questions are evaluated.
  const v = settleValues(rawValues);
  const out: Record<string, string> = {};
  for (const f of step(stepIndex).fields) {
    if (!isVisible(f, v)) continue;
    const err = fieldError(f, v);
    if (err) out[f.key] = err;
  }
  return out;
}


/**
 * Keeps numeric input to digits, a single decimal point, and the precision the
 * question allows (units accept one decimal place, GPA two).
 */
function limitDecimals(raw: string, decimals: number) {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (!rest.length) return whole ?? "";
  if (decimals === 0) return whole ?? "";
  return `${whole ?? ""}.${rest.join("").slice(0, decimals)}`;
}

function formatPhone(raw: string) {

  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** One item per line, prefixed with a bullet, so lists read vertically. */
function bulletLines(items: string[]) {
  return items.map((line) => `\u2022 ${line}`).join("\n");
}

/** MM/DD/YY for review and ATS display; unparsable values pass through. */
function shortDate(raw: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw ?? "").trim());
  if (!m) return raw;
  return `${m[2]}/${m[3]}/${(m[1] as string).slice(2)}`;
}

function displayValue(f: FieldDef, v: Values) {
  if (f.type === "ack") return bool(v, f.key) ? "Acknowledged" : "\u2014";
  if (f.type === "timeoff") {
    const list = timeOffList(v, f.key);
    if (!list.length) return "\u2014";
    return bulletLines(
      list.map(
        (r) =>
          `${r.start ? shortDate(r.start) : "start pending"} \u2013 ${r.end ? shortDate(r.end) : "end pending"}${r.details.trim() ? ` \u2014 ${r.details.trim()}` : ""}`,
      ),
    );
  }
  if (f.type === "history") {
    const list = historyList(v, f.key);
    if (!list.length) return "\u2014";
    return bulletLines(
      list.map(
        (h) =>
          `${h.type || "type pending"} \u2014 ${h.org.trim() || "description pending"}, ${h.hours || "?"} hrs/week, ${h.terms || "?"} term(s)`,
      ),
    );
  }
  if (f.type === "commitments") {
    const list = commitmentList(v, f.key);
    if (!list.length) return "\u2014";
    const wknd = f.commitVariant === "weekend";
    const regular = wknd ? WKEND_SCHED_REGULAR : SCHED_REGULAR;
    const varies = wknd ? WKEND_SCHED_VARIES : SCHED_VARIES;
    return bulletLines(
      list.map((c) => {
        const schedule =
          c.scheduleType === regular
            ? c.blocks
                .map(
                  (b) =>
                    `${b.days.map((d) => d.slice(0, 3)).join("/") || "days pending"} ${timeLabel(b.startTime)}–${timeLabel(b.endTime)}`,
                )
                .join(", ")
            : c.scheduleType === varies
              ? c.varies.trim()
              : c.tbd.trim();
        return `${c.type || "type pending"} (${c.status || "status pending"}) — ${c.org.trim() || "description pending"}, ${c.hours || "?"} hrs/week${schedule ? ` — ${schedule}` : ""}${c.jobPlan ? ` — Plan: ${c.jobPlan}` : ""}${c.manage.trim() ? ` — Management: ${c.manage.trim()}` : ""}`;
      }),
    );
  }
  if (f.type === "scheduleupload") {
    const files = parseFileList(str(v, f.key));
    return files.length ? bulletLines(files.map((x) => x.name)) : "\u2014";
  }
  if (f.type === "certupload") {
    const ref = parseCertFile(str(v, f.key));
    return ref ? ref.name : "\u2014";
  }
  if (f.type === "classes") {
    if (bool(v, "classes_none")) return "No current or upcoming classes";
    const list = classList(v, f.key);
    if (!list.length) return "\u2014";
    return bulletLines(
      list.map(
        (c) =>
          `${c.name || "Class"} \u2014 ${c.days.length ? c.days.join("/") : "days pending"} (${c.status || "status pending"})`,
      ),
    );
  }
  if (
    f.type === "checkboxes" ||
    f.type === "multiselect" ||
    f.type === "onboarding" ||
    f.type === "availability"
  ) {
    if (f.type === "availability" && arr(v, f.key).includes(NOT_AVAILABLE)) {
      return f.key === "overnight_availability"
        ? "Not available for overnight shifts"
        : "Not available during this time";
    }
    const list = arr(v, f.key);
    return list.length ? list.join(", ") : "\u2014";
  }
  // The informational first-term callout records a status rather than a value.
  if (f.type === "info")
    return f.key === "college_gpa_none" ? COLLEGE_GPA_FIRST_TERM : (f.note ?? "\u2014");
  if (f.altKey && bool(v, f.altKey)) return f.altLabel ?? "Not applicable";
   return str(v, f.key) || "\u2014";

}

/* ---------------- Structured display of a submitted answer ---------------- */

const keep = (label: string, value: string): AnswerField[] =>
  value && value.trim() ? [{ label, value: value.trim() }] : [];

function scheduleFields(c: CommitmentEntry, weekend: boolean): AnswerField[] {
  const regular = weekend ? WKEND_SCHED_REGULAR : SCHED_REGULAR;
  const varies = weekend ? WKEND_SCHED_VARIES : SCHED_VARIES;
  const out: AnswerField[] = [...keep("Schedule type", c.scheduleType)];
  if (c.scheduleType === regular) {
    c.blocks.forEach((b, i) => {
      const label = c.blocks.length > 1 ? `Day/time block ${i + 1}` : "Days and times";
      const days = b.days.length ? b.days.join("\n") : "Days not entered";
      const time =
        b.startTime || b.endTime
          ? `${timeLabel(b.startTime)}\u2013${timeLabel(b.endTime)}`
          : "Times not entered";
      out.push({ label, value: `${days}\n${time}` });
    });
  } else if (c.scheduleType === varies) {
    out.push(...keep("Schedule details", c.varies));
    if (weekend && c.weekendDays.length)
      out.push({ label: "Weekend days affected", value: c.weekendDays.join("\n") });
  } else if (c.scheduleType) {
    out.push(...keep("Schedule details", c.tbd));
    if (weekend && c.weekendDays.length)
      out.push({ label: "Weekend days affected", value: c.weekendDays.join("\n") });
  }
  return out;
}

/**
 * The complete submitted answer, structured so the interface can lay it out
 * cleanly. Multi-selections become one line each; repeated entries such as
 * classes, commitments, and time-off requests become separate labeled blocks.
 * The submitted text itself is never summarized, shortened, or corrected.
 */
function displayRow(f: FieldDef, v: Values): AnswerRow {
  const label = f.reviewLabel ?? f.label;
  const flat = displayValue(f, v);
  const row = (extra: Partial<AnswerRow>): AnswerRow => ({ label, value: flat, ...extra });

  if (f.type === "timeoff") {
    const list = timeOffList(v, f.key);
    if (!list.length) return row({});
    return row({
      blocks: list.map((r, i) => ({
        title: `Time-off request ${i + 1}`,
        fields: [
          { label: "Start date", value: r.start ? shortDate(r.start) : "Not entered" },
          { label: "End date", value: r.end ? shortDate(r.end) : "Not entered" },
          ...keep("Details submitted", r.details),
        ],
      })),
    });
  }

  if (f.type === "history") {
    const list = historyList(v, f.key);
    if (!list.length) return row({});
    return row({
      blocks: list.map((h, i) => ({
        title: `Commitment ${i + 1}`,
        fields: [
          ...keep("Type", h.type),
          ...keep("Organization or description", h.org),
          ...keep("Average hours per week", h.hours),
          ...keep("Terms maintained", h.terms),
        ],
      })),
    });
  }

  if (f.type === "commitments") {
    const list = commitmentList(v, f.key);
    if (!list.length) return row({});
    const weekend = f.commitVariant === "weekend";
    return row({
      blocks: list.map((c, i) => ({
        title: `Commitment ${i + 1}`,
        fields: [
          ...keep("Type", c.type),
          ...keep("Status", c.status),
          ...keep("Organization or description", c.org),
          ...keep("Average hours per week", c.hours),
          ...scheduleFields(c, weekend),
          ...keep("Plan if selected", c.jobPlan),
          ...keep("How both commitments will be managed", c.manage),
        ],
      })),
    });
  }

  if (f.type === "classes") {
    if (bool(v, "classes_none")) return row({});
    const list = classList(v, f.key);
    if (!list.length) return row({});
    return row({
      blocks: list.map((c, i) => ({
        title: `Class ${i + 1}`,
        fields: [
          ...keep("Course name", c.name),
          ...keep("Term", c.term),
          ...keep("Enrollment status", c.status),
          {
            label: "Days",
            value: c.days.length ? c.days.join("\n") : "Not entered",
          },
          {
            label: "Start and end times",
            value: c.timeUnknown
              ? "Schedule not yet announced"
              : c.startTime || c.endTime
                ? `${timeLabel(c.startTime)}\u2013${timeLabel(c.endTime)}`
                : "Not entered",
          },
          {
            label: "Class start date",
            value: c.start ? shortDate(c.start) : "Not entered",
          },
          { label: "Class end date", value: c.end ? shortDate(c.end) : "Not entered" },
          {
            label: "Exam dates",
            value: c.examUnknown
              ? "Not yet announced"
              : c.examDates.length
                ? c.examDates.map(shortDate).join("\n")
                : "Not entered",
          },
          {
            label: "Final-exam date",
            value: c.finalUnknown
              ? "Not yet announced"
              : c.finalExam
                ? shortDate(c.finalExam)
                : "Not entered",
          },
          ...keep("Additional class information submitted", c.explain),
        ],
      })),
    });
  }

  if (f.type === "scheduleupload") {
    const files = parseFileList(str(v, f.key));
    return files.length ? row({ lines: files.map((x) => x.name) }) : row({});
  }

  if (
    f.type === "checkboxes" ||
    f.type === "multiselect" ||
    f.type === "onboarding" ||
    f.type === "availability"
  ) {
    const list = arr(v, f.key);
    if (f.type === "availability" && list.includes(NOT_AVAILABLE)) return row({});
    return list.length > 1 ? row({ lines: list }) : row({});
  }

  return row({});
}


/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ApplyPage() {
  const { fresh, testMode } = Route.useSearch();
  const [stepIdx, setStep] = useState(0);
  /** Review group the applicant left to edit, so we can bring them back. */
  const [reviewReturn, setReviewReturn] = useState<string | null>(null);

  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [dq, setDq] = useState<DqRecord | null>(null);
  const [pendingDq, setPendingDq] = useState<{
    key: string;
    question: string;
    answer: string;
    reason: string;
  } | null>(null);
  // Unconfirmed minimum-requirement statements awaiting the applicant's review.
  const [pendingMinReq, setPendingMinReq] = useState<string[] | null>(null);
  const [pendingDuties, setPendingDuties] = useState<string[] | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  // Human-readable application number returned by the server (FIRST-LAST-####).
  const [applicationReference, setApplicationReference] = useState<string | null>(null);
  // True once the saved draft has been read, so saving never overwrites it with
  // the empty initial state.
  const [hydrated, setHydrated] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const sendApplication = useServerFn(submitApplication);
  const sendDeclineRecord = useServerFn(recordDeclinedTextConsent);
  // Tracks a disqualifying answer the applicant has already reviewed, so the
  // confirmation window does not re-open automatically until they pick the
  // disqualifying answer again.
  const reviewedDqRef = useRef<string | null>(null);

  // Restores the saved draft (current step + every answer) and any latched
  // disqualification. The draft survives code updates, preview refreshes, and
  // ordinary browser refreshes within the same tab; it is cleared only on
  // submission, a confirmed end, or an explicit Start Over.
  useEffect(() => {
    try {
      const currentAttemptId = fresh
        ? createApplicationAttempt()
        : getOrCreateApplicationAttempt();
      setAttemptId(currentAttemptId);

      const draftRaw = fresh ? null : sessionStorage.getItem(APPLICATION_DRAFT_KEY);
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as {
          attemptId?: string;
          stepIdx?: number;
          values?: Values;
        };
        if (draft.attemptId === currentAttemptId && draft.values) {
          // Drop answers to fields that are not visible under the restored
          // answers (e.g. a certification format that was never confirmed), so
          // hidden dates/uploads never reappear from a stale draft.
          const restoredValues = pruneHiddenValues(draft.values);
          valuesRef.current = restoredValues;
          setValues(restoredValues);
          const restoredStep = Math.min(
            Math.max(draft.stepIdx ?? 0, 0),
            STEPS.length - 1,
          );
          setStep(restoredStep);
          // A restored answer never re-opens a stale disqualification warning.
          const rule = findDisqualifier(draft.values);
          if (rule) reviewedDqRef.current = `${rule.key}::${rule.answer}`;
        }
      }

      const saved = sessionStorage.getItem(APPLICATION_DISQUALIFICATION_KEY);
      if (fresh)
        window.history.replaceState(
          window.history.state,
          "",
          testMode ? "/careers/apply?testMode=true" : "/careers/apply",
        );

      if (!saved) {
        setHydrated(true);
        return;
      }
      const savedRecord = JSON.parse(saved) as DqRecord;
      if (savedRecord.attemptId === currentAttemptId) setDq(savedRecord);
    } catch {
      /* ignore */
    } finally {
      setHydrated(true);
    }
  }, [fresh, testMode]);

  // Saves the draft immediately on every answer or step change. A submitted or
  // ended application deletes the draft instead.
  useEffect(() => {
    if (!hydrated || !attemptId) return;
    try {
      if (previewed || dq) {
        sessionStorage.removeItem(APPLICATION_DRAFT_KEY);
        return;
      }
      sessionStorage.setItem(
        APPLICATION_DRAFT_KEY,
        JSON.stringify({ attemptId, stepIdx, values }),
      );
    } catch {
      /* ignore */
    }
  }, [hydrated, attemptId, previewed, dq, stepIdx, values]);

  // Text-message consent is optional: leaving the box unchecked simply means
  // we will contact the applicant by phone or email instead. It no longer ends
  // the application, so there is nothing to record here — the choice is stored
  // on the submitted record either way.


  // When a disqualifying answer is selected, show the confirmation window
  // instead of ending the application immediately. The application only ends
  // after the applicant confirms in the window.
  useEffect(() => {
    if (dq || pendingDq || !attemptId) return;
    const rule = findDisqualifier(values);
    if (!rule) {
      // No question currently holds a disqualifying answer, so nothing is
      // pending review any more.
      reviewedDqRef.current = null;
      return;
    }
    if (reviewedDqRef.current === `${rule.key}::${rule.answer}`) return;
    setPendingDq({
      key: rule.key,
      question: rule.question,
      answer: rule.answer,
      reason: rule.reason,
    });
    window.scrollTo({ top: 0 });
  }, [values, dq, pendingDq, attemptId]);



  const formTop = useRef<HTMLDivElement>(null);
  const valuesRef = useRef<Values>({});

  const resetApplicantState = () => {
    clearApplicantApplicationState();
    valuesRef.current = {};
    setValues({});
    setErrors({});
    setSummary(null);
    setPreviewed(false);
    setDq(null);
    setPendingDq(null);
    setPendingMinReq(null);
    setPendingDuties(null);
    reviewedDqRef.current = null;
    setStep(0);

  };

  /** Explicit Start Over: deletes the saved draft and begins a new attempt. */
  const startOverApplication = () => {
    setStartOverOpen(false);
    resetApplicantState();
    setSubmitError(null);
    setApplicationId(null);
    setApplicationReference(null);
    setAttemptId(createApplicationAttempt());
    window.scrollTo({ top: 0 });
  };




  const returnToCareers = () => {
    resetApplicantState();
    setAttemptId(null);
    window.location.replace("/careers");
  };

  /**
   * Closes the confirmation window, cancels the pending disqualification, and
   * returns the applicant to the exact question that triggered the warning so
   * they can change the answer themselves. No other answer is touched.
   */
  const reviewDisqualifyingAnswer = () => {
    const key = pendingDq?.key;
    if (pendingDq) reviewedDqRef.current = `${pendingDq.key}::${pendingDq.answer}`;
    setPendingDq(null);
    try {
      sessionStorage.removeItem(APPLICATION_DISQUALIFICATION_KEY);
    } catch {
      /* ignore */
    }
    if (!key) return;
    const stepWithField = STEPS.findIndex((s) => s.fields.some((f) => f.key === key));
    if (stepWithField >= 0 && stepWithField !== stepIdx) setStep(stepWithField);
    requestAnimationFrame(() => {
      const container = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
      container?.scrollIntoView({ behavior: "smooth", block: "center" });
      container
        ?.querySelector<HTMLElement>("select, input, textarea")
        ?.focus({ preventScroll: true });
    });
  };

  /**
   * Confirms the disqualifying response and ends the application, latching the
   * standardized disqualification card.
   */
  const confirmDisqualifyingAnswer = () => {
    if (!pendingDq || !attemptId) return;
    const record: DqRecord = {
      attemptId,
      question: pendingDq.question,
      answer: pendingDq.answer,
      reason: pendingDq.reason,
      at: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(
        APPLICATION_DISQUALIFICATION_KEY,
        JSON.stringify(record),
      );
    } catch {
      /* ignore */
    }
    setPendingDq(null);
    setDq(record);
    window.scrollTo({ top: 0 });
  };

  /**
   * Guard for navigation actions (Continue, step tabs, preview). Evaluates only
   * the current answers; if one is still disqualifying, the confirmation window
   * reopens instead of allowing navigation. Returns true when blocked.
   */
  const disqualifierBlocksNavigation = () => {
    const rule = findDisqualifier(valuesRef.current);
    if (!rule) {
      reviewedDqRef.current = null;
      return false;
    }
    reviewedDqRef.current = null;
    setPendingDq({
      key: rule.key,
      question: rule.question,
      answer: rule.answer,
      reason: rule.reason,
    });
    window.scrollTo({ top: 0 });
    return true;
  };


  /**
   * Minimum Position Requirements gate. Returns true when all statements are
   * confirmed. Unconfirmed statements never end the application on their own:
   * they open a confirmation window so an applicant who skipped or
   * misunderstood a checkbox can go back and correct it.
   */
  const requirementsConfirmed = () => {
    const confirmed = arr(values, "eligibility");
    const unchecked = MIN_REQUIREMENTS.filter((item) => !confirmed.includes(item));
    if (!unchecked.length) return true;
    setErrors({});
    setSummary(null);
    setPendingMinReq(unchecked);
    window.scrollTo({ top: 0 });
    return false;
  };

  const reviewMinRequirements = () => {
    setPendingMinReq(null);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[data-field="eligibility"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };


  const confirmMinRequirements = () => {
    if (!pendingMinReq) return;
    const record: DqRecord = {
      attemptId: attemptId ?? "",
      question: "Minimum Position Requirements",
      answer: `${pendingMinReq.length} of ${MIN_REQUIREMENTS.length} requirement statements not confirmed`,
      reason: MIN_REQ_REASON,
      closing: MIN_REQ_CLOSING,
      unchecked: pendingMinReq,
      at: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(APPLICATION_DISQUALIFICATION_KEY, JSON.stringify(record));
    } catch {
      /* ignore */
    }
    setPendingMinReq(null);
    setErrors({});
    setSummary(null);
    setDq(record);
    window.scrollTo({ top: 0 });
  };


  /**
   * Job Responsibilities gate. Every listed responsibility must be selected.
   * Incomplete selections open a review window; the applicant can return to
   * the checklist or end the application.
   */
  const dutiesConfirmed = () => {
    const list = arr(values, "duties_comfort");
    const unchecked = DUTY_OPTIONS.filter((o) => !list.includes(o));
    if (!unchecked.length) return true;
    setErrors({});
    setSummary(null);
    setPendingDuties(unchecked);
    window.scrollTo({ top: 0 });
    return false;
  };

  const reviewDuties = () => {
    setPendingDuties(null);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[data-field="duties_comfort"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const confirmDuties = () => {
    if (!pendingDuties) return;
    const record: DqRecord = {
      attemptId: attemptId ?? "",
      question: "Job responsibilities",
      answer: `${DUTY_OPTIONS.length - pendingDuties.length} of ${DUTY_OPTIONS.length} responsibilities confirmed`,
      reason: DUTIES_REASON,
      closing: DUTIES_CLOSING,
      unchecked: pendingDuties,
      at: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(APPLICATION_DISQUALIFICATION_KEY, JSON.stringify(record));
    } catch {
      /* ignore */
    }
    setPendingDuties(null);
    setErrors({});
    setSummary(null);
    setDq(record);
    window.scrollTo({ top: 0 });
  };


  const set = (
    key: string,
    value: FieldValue,
  ) => {
    const prev = valuesRef.current;
    const next = { ...prev, [key]: value };
      if (key === "opportunity_pref") {
        delete next["internship_interest"];
        delete next["employment_interest"];
        delete next["either_interest"];
      }
      // Answering "No" hides and clears every disclosed commitment entry.
      if (key === "other_commitments") {
        if (value !== COMMIT_YES) delete next["commitment_entries"];
        else if (!commitmentList(next, "commitment_entries").length)
          next["commitment_entries"] = [emptyCommitment()];
      }
      // "Not enrolled" hides every academic-term and class question, so any
      // previously entered school answers are dropped.
      if (key === "enrolled" && value === ENROLL_NO) {
        delete next["school_name"];
        delete next["academic_calendar"];
        delete next["academic_level"];
        delete next["academic_level_other"];
        delete next["first_term_status"];
        delete next["upcoming_units"];
        delete next["upcoming_units_tbd"];
        delete next["class_entries"];
        delete next["class_schedule_files"];
        delete next["classes_none"];
      }
      // Changing the academic level hides and clears the "other level"
      // description; changing the GPA type or career goal clears every field
      // belonging to the previous selection.
      if (key === "academic_level" && value !== LEVEL_OTHER)
        delete next["academic_level_other"];
      // The applicable college-GPA path is derived from these answers, so any
      // previously entered GPA for another path is cleared immediately.
      if (key === "transfer_status" || key === "first_term_status" || key === "enrolled") {
        for (const k of COLLEGE_GPA_KEYS) delete next[k];
      }
      if (key === "career_goal" && value !== CAREER_OTHER_HEALTH && value !== CAREER_OTHER_FIELD)
        delete next["career_goal_other"];
      if (

        key === "enrolled" &&
        (value === ENROLL_CURRENT || value === ENROLL_UPCOMING) &&
        !Array.isArray(prev["class_entries"]) &&
        prev["classes_none"] !== true
      )
        next["class_entries"] = [emptyClass()];
      // Leaving "currently certified" clears both the expiration dates and any
      // certification files attached to the pending application.
      if (key === "first_aid" && value !== CERT_HOLDS) {
        delete next["cert_format"];
        delete next["cert_combined_exp"];
        delete next["cert_fa_exp"];
        delete next["cert_cpr_exp"];
        delete next["cert_upload_combined"];
        delete next["cert_upload_fa"];
        delete next["cert_upload_cpr"];
      }
      if (key === "cert_format" && value === CERT_COMBINED) {
        delete next["cert_fa_exp"];
        delete next["cert_cpr_exp"];
        delete next["cert_upload_fa"];
        delete next["cert_upload_cpr"];
      }
      if (key === "cert_format" && value === CERT_SEPARATE) {
        delete next["cert_combined_exp"];
        delete next["cert_upload_combined"];
      }
      // "I am not sure" keeps every expiration-date and upload field hidden,
      // so any previously entered dates or pending files are cleared.
      if (key === "cert_format" && value !== CERT_COMBINED && value !== CERT_SEPARATE) {
        delete next["cert_combined_exp"];
        delete next["cert_fa_exp"];
        delete next["cert_cpr_exp"];
        delete next["cert_upload_combined"];
        delete next["cert_upload_fa"];
        delete next["cert_upload_cpr"];
      }
      // Selecting any regular weekday hides the conditional onboarding
      // section; the acknowledgment and first-three-weeks selections are kept
      // separate from the regular availability and cleared when hidden.
      if (
        key === "weekday_evening_availability" &&
        !arr(next, "weekday_evening_availability").includes(EVENING_NONE)
      ) {
        delete next["onboarding_ack"];
        delete next["onboarding_availability"];
      }
      // Answering "No" hides and clears every weekend commitment entry, which
      // also removes the private weekend-limitation review flag.
      if (key === "weekend_commitments") {
        if (value !== WEEKEND_YES) delete next["weekend_commitment_entries"];
        else if (!commitmentList(next, "weekend_commitment_entries").length)
          next["weekend_commitment_entries"] = [emptyCommitment()];
      }
      // Switching to "No" clears every disclosed request and its details; the
      // pending review flag is generated from these values, so it disappears
      // with them. Choosing "Yes" starts the list at Time-off request 1.
      if (key === "upcoming_time_off") {
        if (value !== TIMEOFF_YES) {
          delete next["time_off_requests"];
          delete next["upcoming_time_off_details"];
        } else if (!timeOffList(next, "time_off_requests").length) {
          next["time_off_requests"] = [emptyTimeOff()];
        }
      }



    // Keep the stored answers in sync with what is actually on screen, so a
    // stale hidden answer can never re-open a conditional question or count as
    // a missing required answer.
    const settled = settleValues(next);
    if (key in next) settled[key] = next[key] as FieldValue;
    valuesRef.current = settled;
    setValues(settled);


    // A changed answer to a configured disqualifying question is evaluated
    // fresh: an eligible answer immediately cancels any pending warning and
    // clears the stored disqualification trigger.
    if (DISQUALIFIER_KEYS.has(key) && !findDisqualifier(next)) {
      reviewedDqRef.current = null;
      setPendingDq(null);
      try {
        sessionStorage.removeItem(APPLICATION_DISQUALIFICATION_KEY);
      } catch {
        /* ignore */
      }
    }


    setErrors((prev) => {
      const clears = [key];
      if (key === "weekday_evening_availability")
        clears.push("onboarding_ack", "onboarding_availability");
      if (key === "weekend_commitments") clears.push("weekend_commitment_entries");
      if (key === "other_commitments") clears.push("commitment_entries");
      if (key === "upcoming_time_off") clears.push("time_off_requests");
      if (key === "enrolled")
        clears.push(
          "school_name",
          "academic_calendar",
          "academic_level",
          "academic_level_other",
          "first_term_status",
          "upcoming_units",
          "class_entries",
          "class_schedule_files",
        );
      if (key === "academic_level") clears.push("academic_level_other");
      if (key === "transfer_status" || key === "first_term_status")
        clears.push(...COLLEGE_GPA_KEYS);
      if (key === "career_goal") clears.push("career_goal_other");
      if (key === "upcoming_units_tbd") clears.push("upcoming_units");

      if (key === "opportunity_pref")
        clears.push(
          "major",
          "hs_gpa",
          ...COLLEGE_GPA_KEYS,
          "career_goal",
          "career_goal_other",
          "career_connection",
        );
      if (key === "classes_none") clears.push("class_entries");



      if (key === "opportunity_pref")
        clears.push("internship_interest", "employment_interest", "either_interest");
      if (key === "cert_format")
        clears.push(
          "cert_combined_exp",
          "cert_fa_exp",
          "cert_cpr_exp",
          "cert_upload_combined",
          "cert_upload_fa",
          "cert_upload_cpr",
        );
      if (key === "first_aid")
        clears.push(
          "cert_format",
          "cert_combined_exp",
          "cert_fa_exp",
          "cert_cpr_exp",
          "cert_upload_combined",
          "cert_upload_fa",
          "cert_upload_cpr",
        );

      const next = { ...prev };
      for (const k of clears) delete next[k];

      const changedField = STEPS.flatMap((applicationStep) => applicationStep.fields).find(
        (field) => field.key === key,
      );
      // Once a field has been validated, keep its message synchronized with
      // the latest value instead of preserving the error from the prior render.
      if (changedField && (changedField.type === "multiselect" || prev[key])) {
        const error = fieldError(changedField, valuesRef.current);
        if (error) next[key] = error;
      }

      return next;
    });
  };

  const toggleChoice = (f: FieldDef) => (choice: string, checked: boolean) => {
    const current = arr(valuesRef.current, f.key);
    const exclusive = (c: string) =>
      c === "Not available" || c === NOT_AVAILABLE || c === NOT_EMPLOYED;
    let next: string[];
    if (exclusive(choice)) {
      next = checked ? [choice] : [];
    } else {
      next = checked
        ? [...current.filter((c) => !exclusive(c)), choice]
        : current.filter((c) => c !== choice);
    }
    set(f.key, next);
  };

  const focusFirstError = (errs: Record<string, string>, order: FieldDef[]) => {
    const firstKey = order.find((f) => errs[f.key])?.key;
    if (!firstKey) return;
    requestAnimationFrame(() => {
      const container = document.querySelector<HTMLElement>(
        `[data-field="${firstKey}"]`,
      );
      const focusable = container?.querySelector<HTMLElement>(
        "input, select, textarea",
      );
      container?.scrollIntoView({ behavior: "smooth", block: "center" });
      focusable?.focus({ preventScroll: true });
    });
  };

  const incompleteSteps = useMemo(
    () =>
      STEPS.map((_, i) => Object.keys(stepErrors(i, values)).length).map(
        (count, i) => ({ index: i, count }),
      ),
    [values],
  );

  const goNext = () => {
    // Testing mode bypasses page-navigation validation only. Field-level errors
    // and disqualification warnings still fire when a question is answered.
    if (testMode) {
      setErrors({});
      setSummary(null);
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (disqualifierBlocksNavigation()) return;

    if (
      step(stepIdx).fields.some((f) => f.key === "eligibility") &&
      !requirementsConfirmed()
    )
      return;
    if (
      step(stepIdx).fields.some((f) => f.key === "duties_comfort") &&
      !dutiesConfirmed()
    )
      return;
    const errs = stepErrors(stepIdx, values);
    const count = Object.keys(errs).length;
    if (count > 0) {
      setErrors(errs);
      setSummary(
        `${count} required ${count === 1 ? "answer is" : "answers are"} missing or invalid on this step.`,
      );
      focusFirstError(errs, step(stepIdx).fields);
      return;
    }
    setErrors({});
    setSummary(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goBack = () => {
    setErrors({});
    setSummary(null);
    setStep((s) => Math.max(s - 1, 0));
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goToStep = (index: number) => {
    if (!testMode && disqualifierBlocksNavigation()) return;
    setErrors({});
    setSummary(null);
    setStep(Math.min(Math.max(index, 0), STEPS.length - 1));
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /**
   * Review-step "Edit" action: opens the step that now contains the question and
   * scrolls to that exact section. The applicant's answers are untouched, and
   * the review group they came from is remembered so "Return to review" brings
   * them back to the same place in the summary.
   */
  const editFromReview = (index: number, anchorKey: string, group: string) => {
    if (!testMode && disqualifierBlocksNavigation()) return;
    setErrors({});
    setSummary(null);
    setReviewReturn(group);
    setStep(Math.min(Math.max(index, 0), STEPS.length - 1));
    requestAnimationFrame(() => {
      const container = document.querySelector<HTMLElement>(`[data-field="${anchorKey}"]`);
      if (container) container.scrollIntoView({ behavior: "smooth", block: "start" });
      else formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /** Returns to the review step at the group the applicant was editing. */
  const returnToReview = () => {
    const group = reviewReturn;
    setErrors({});
    setSummary(null);
    setStep(STEPS.length - 1);
    setReviewReturn(null);
    requestAnimationFrame(() => {
      const target = group
        ? document.querySelector<HTMLElement>(`[data-review-group="${group}"]`)
        : null;
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };


  /**
   * Steps the applicant may open by clicking the progress navigation. Testing
   * mode unlocks every step; applicants may only revisit steps they already
   * completed.
   */
  const canOpenStep = (index: number) => testMode || index < stepIdx;

  /** Clears the test application and returns to Step 1. */
  const clearTestResponses = () => {
    resetApplicantState();
    setSubmitError(null);
    setApplicationId(null);
    setApplicationReference(null);
    setAttemptId(createApplicationAttempt());
    window.scrollTo({ top: 0 });
  };


  const previewSubmission = async () => {
    if (submitting) return;
    // A testing-mode session is never saved as a real applicant: no database
    // record, no private HR flags, and no applicant notifications.
    if (testMode) {
      setSummary(
        "Testing Mode: submission is blocked. No application record, flag, or notification was created.",
      );
      return;
    }
    if (disqualifierBlocksNavigation()) return;

    const firstIncomplete = incompleteSteps.find((s) => s.count > 0);
    if (firstIncomplete) {
      setSummary(
        `Step ${firstIncomplete.index + 1} still has ${firstIncomplete.count} missing or invalid ${
          firstIncomplete.count === 1 ? "answer" : "answers"
        }.`,
      );
      if (firstIncomplete.index !== stepIdx) {
        setStep(firstIncomplete.index);
        setErrors(stepErrors(firstIncomplete.index, values));
        focusFirstError(
          stepErrors(firstIncomplete.index, values),
          step(firstIncomplete.index).fields,
        );
      } else {
        const errs = stepErrors(stepIdx, values);
        setErrors(errs);
        focusFirstError(errs, step(stepIdx).fields);
      }
      return;
    }
    setErrors({});
    setSummary(null);
    // Private HR Discussion Requested flags — created silently, never shown to
    // the applicant and never disqualifying.
    const reviews = [...collectHrReviews(values), ...classReviewFlags(values), ...timeOffReviewFlags(values), ...commitmentAnswerReviewFlags(values), ...commitmentReviewFlags(values), ...weekendCommitmentReviewFlags(values), ...eveningAvailabilityReviewFlags(values)];
    if (reviews.length && attemptId) {
      recordHrFlags({
        attemptId,
        applicantName:
          `${str(values, "first_name")} ${str(values, "last_name")}`.trim() || "Applicant",
        entries: reviews,
      });
    }

    // Everything not broken out into a dedicated column is stored together.
    // File inputs are intentionally not persisted in this phase. Answers to
    // fields that are not currently visible (such as certification dates and
    // uploads for an unselected issuance format) are never submitted.
    const applicationData: Record<string, unknown> = { ...pruneHiddenValues(values) };
    for (const key of [
      "first_name",
      "last_name",
      "email",
      "phone",
      "opportunity_pref",
      "typed_name",
      "resume",
    ]) {
      delete applicationData[key];
    }

    // Text-communication consent: the selection, the exact language displayed,
    // the mobile number, the timestamp, and the application version are stored.
    // Both answers are recorded — an unchecked box is a documented "no", not a
    // missing value — and neither prevents the application from being sent.
    const smsConsentAt = new Date().toISOString();
    const smsAgreed = arr(values, "sms_consent").includes(SMS_CONSENT_AGREE);
    const smsConsent = {
      selection: smsAgreed ? SMS_CONSENT_AGREE : SMS_CONSENT_NOT_GIVEN,
      agreed: smsAgreed,
      consent_text: SMS_CONSENT_TEXT,
      phone: str(values, "phone"),
      consented_at: smsConsentAt,
      application_version: APPLICATION_VERSION,
    };
    applicationData["sms_consent"] = smsConsent;

    // Certification uploads are stored as private storage paths on the record.
    // Only upload fields visible under the current answers are included.
    const certificationFiles: Record<string, unknown> = {};
    for (const key of ["cert_upload_combined", "cert_upload_fa", "cert_upload_cpr"]) {
      const ref = parseCertFile(str(applicationData as Values, key));
      delete applicationData[key];
      if (ref) certificationFiles[key] = ref;
    }
    // The class schedule is stored as private storage paths on the record.
    const scheduleFiles = parseFileList(str(values, "class_schedule_files"));
    delete applicationData["class_schedule_files"];
    if (scheduleFiles.length) applicationData["class_schedule_files"] = scheduleFiles;

    if (Object.keys(certificationFiles).length)
      applicationData["certification_files"] = certificationFiles;

    // Housing stability metadata, recorded for the private employer dashboard.
    if (showHousing(values) && str(values, "housing_change")) {
      applicationData["housing_remains_in_san_diego"] = housingRemainsInSanDiego(values);
      applicationData["housing_submitted_at"] = new Date().toISOString();
    }



    // Only the applicable college-GPA answer is recorded; obsolete GPA-status
    // and alternative-scale values are no longer written.
    if (collegeGpaPath(values) === "first_term")
      applicationData["college_gpa"] = `College GPA: ${COLLEGE_GPA_FIRST_TERM}`;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await sendApplication({
        data: {
          first_name: str(values, "first_name"),
          last_name: str(values, "last_name"),
          email: str(values, "email"),
          phone: str(values, "phone"),
          opportunity_pref: str(values, "opportunity_pref"),
          typed_name: str(values, "typed_name"),
          application_data: applicationData,
          hr_reviews: reviews,
          sms_consent: smsConsent,
          // Snapshot of the Review page, archived as a private PDF copy.
          pdf: {
            applicant_name:
              `${str(values, "first_name")} ${str(values, "last_name")}`.trim() || "Applicant",
            sections: buildApplicationPdfSections(values),
            acknowledgment: {
              statement: APPLICATION_ACK_STATEMENT,
              typedName: str(values, "typed_name"),
            },
            logo_url: `${window.location.origin}${elev8Logo.url}`,
          },
        },
      });

      setApplicationId(result.id);
      setApplicationReference(result.reference);
      setPreviewed(true);
      try {
        sessionStorage.removeItem(APPLICATION_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setSubmitError(
        "We could not submit your application just now. Your answers are still here — please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };


  const current = step(stepIdx);


  if (dq) {
    return (
      <section className="min-h-[70vh] bg-background">
        <div className="site-shell max-w-3xl py-10 sm:py-16">
          <div
            role="alert"
            className="rounded-2xl border border-border bg-muted p-5 sm:p-6"
          >
            <h1 className="text-xl font-bold text-primary sm:text-2xl">
              Thank you for your interest in Elev8 Services
            </h1>
            <p className="mt-4 text-base leading-relaxed text-primary">
              {dq.reason}
            </p>
            <p className="mt-4 text-base leading-relaxed text-primary">
              {dq.closing ??
                "Based on your response, you do not currently meet this position requirement and cannot continue the application. We appreciate your honesty and interest in Elev8 Services."}
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={returnToCareers}
                className="btn-solid w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
              >
                {dq.buttonLabel ?? "Exit Application"}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }








  const percent = Math.round(((stepIdx + 1) / STEPS.length) * 100);

  if (previewed) {
    return (
      <section className="bg-background">
        <div className="site-shell max-w-2xl py-16 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
            <CheckCircle2 className="h-8 w-8 text-teal" strokeWidth={1.5} />
          </span>
          <p className="eyebrow mt-6">Submission confirmed</p>
          <h1 className="mt-3 text-3xl font-extrabold text-primary">
            Application received
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Thank you, {str(values, "first_name") || "Applicant"}. Your
            application number is{" "}
            <span className="font-semibold text-primary">
              {applicationReference ?? "on file"}
            </span>
            . Our team will review your application and contact you if your
            qualifications and availability match a current opportunity.
          </p>
          <p className="mt-6 rounded-lg border border-teal/40 bg-teal/5 px-4 py-3 text-sm font-semibold text-primary">
            Please keep this application number for your records.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setPreviewed(false);
                setStep(4);
              }}
              className="btn-ghost-navy px-6 py-3"
            >
              Back to review
            </button>
            <Link to="/careers" className="btn-solid px-6 py-3">
              Back to Careers
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background">
      {startOverOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-over-title"
          aria-describedby="start-over-body"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-muted p-5 sm:p-6">
            <h2
              id="start-over-title"
              className="text-xl font-bold text-primary sm:text-2xl"
            >
              Start a new application?
            </h2>
            <p
              id="start-over-body"
              className="mt-3 text-sm leading-relaxed text-primary"
            >
              This will permanently clear all responses entered in this browser
              session.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setStartOverOpen(false)}
                className="btn-solid w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
              >
                Keep My Progress
              </button>
              <button
                type="button"
                onClick={startOverApplication}
                className="btn-ghost-navy w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
              >
                Clear and Start Over
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDq ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dq-confirm-title"
          aria-describedby="dq-confirm-body"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-muted p-5 sm:p-6">
            <h2
              id="dq-confirm-title"
              className="text-xl font-bold text-primary sm:text-2xl"
            >
              Please review your response
            </h2>
            <div id="dq-confirm-body" className="mt-4 space-y-3">
              <p className="text-base leading-relaxed text-primary">
                {pendingDq.key === "onboarding_availability"
                  ? "The response you selected does not meet an essential onboarding requirement for this position and will end your application."
                  : "The response you selected does not meet an essential requirement of this position and will end your application."}
              </p>
              <p className="text-base leading-relaxed text-primary">
                Please reread the question and confirm that your response is accurate.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reviewDisqualifyingAnswer}
                className="btn-solid w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
                autoFocus
              >
                Review My Answer
              </button>
              <button
                type="button"
                onClick={confirmDisqualifyingAnswer}
                className="btn-ghost-navy w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
              >
                Confirm and End Application
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingMinReq ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="minreq-confirm-title"
          aria-describedby="minreq-confirm-body"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-muted p-5 sm:p-6">
            <h2
              id="minreq-confirm-title"
              className="text-xl font-bold text-primary sm:text-2xl"
            >
              Please review your response
            </h2>
            <div id="minreq-confirm-body" className="mt-4 space-y-3">
              <p className="text-base leading-relaxed text-primary">
                {pendingMinReq.length === 1
                  ? "One minimum requirement statement is not confirmed:"
                  : `${pendingMinReq.length} minimum requirement statements are not confirmed:`}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-primary">
                {pendingMinReq.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-base leading-relaxed text-primary">
                Leaving a box unchecked will end your application. If you skipped one by
                accident or were unsure what it meant, go back and review it — nothing has
                been submitted yet.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reviewMinRequirements}
                className="btn-solid w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
                autoFocus
              >
                Review My Answers
              </button>
              <button
                type="button"
                onClick={confirmMinRequirements}
                className="btn-ghost-navy w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
              >
                Confirm and End Application
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDuties ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="duties-confirm-title"
          aria-describedby="duties-confirm-body"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-muted p-5 sm:p-6">
            <h2
              id="duties-confirm-title"
              className="text-xl font-bold text-primary sm:text-2xl"
            >
              Please review your selections
            </h2>
            <div id="duties-confirm-body" className="mt-4 space-y-3">
              <p className="text-base leading-relaxed text-primary">
                One or more required responsibilities has not been selected. All listed
                responsibilities are required for this position after training is provided.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-primary">
                {pendingDuties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-base leading-relaxed text-primary">
                Please review your selections and confirm that your response is accurate.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reviewDuties}
                className="btn-solid w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
                autoFocus
              >
                Review My Selections
              </button>
              <button
                type="button"
                onClick={confirmDuties}
                className="btn-ghost-navy w-full px-6 py-3.5 text-center sm:w-auto sm:py-3"
              >
                Confirm and End Application
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10 lg:py-14">
        <div ref={formTop} />
        <p className="eyebrow">Careers &amp; Internships</p>
        <h1 className="mt-2 text-2xl font-extrabold text-primary lg:text-4xl">
          Support Professional Application
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Five short steps. Your answers are submitted to our hiring team when you
          reach the final step and select Submit Application.
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-primary">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
          <span>
            <span className="font-semibold">Before you start:</span> your answers
            stay in this browser until you submit. Certification and class-schedule
            files you upload are stored securely right away. An optional résumé is
            not stored &mdash; our team will request it if needed.
          </span>

        </div>

        {/* Developer testing mode — only when ?testMode=true is in the URL. */}
        {testMode ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent bg-accent/10 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-accent">
              <FlaskConical className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Testing Mode
            </span>
            <button
              type="button"
              onClick={clearTestResponses}
              className="btn-ghost-navy px-4 py-2 text-sm"
            >
              Clear Test Responses
            </button>
          </div>
        ) : null}

        {/* Progress */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-sm">
            <p className="font-semibold text-primary">
              Step {stepIdx + 1} of {STEPS.length}
            </p>
            <p className="text-muted-foreground">{percent}% complete</p>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIdx + 1}
            aria-label={`Step ${stepIdx + 1} of ${STEPS.length}: ${current.title}`}
          >
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {STEPS.map((s, i) => {
              const active = i === stepIdx;
              const label = `${i + 1}. ${s.short}`;
              return (
                <li key={s.short}>
                  {canOpenStep(i) && !active ? (
                    <button
                      type="button"
                      onClick={() => goToStep(i)}
                      className="rounded text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-primary"
                    >
                      {label}
                    </button>
                  ) : (
                    <span
                      aria-current={active ? "step" : undefined}
                      className={active ? "font-semibold text-primary" : "text-muted-foreground"}
                    >
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>


        <div className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-bold text-primary lg:text-2xl">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {current.intro}
          </p>
          <div className="mt-3">
            <RequiredLegend />
          </div>

          <div aria-live="polite" className="min-h-0">
            {summary ? (
              <p className="mt-4 rounded-lg border border-accent bg-accent/5 px-4 py-3 text-sm font-semibold text-primary">
                {summary}
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-7">
            {stepIdx === 4 ? (
              <ReviewSummary values={values} onEdit={editFromReview} />
            ) : null}


            {current.fields
              .filter((f) => isVisible(f, values))
              .map((f) => (
                <div
                  key={f.key}
                  className={
                    f.sectionBreak ? "border-t border-border pt-7 first:border-0 first:pt-0" : ""
                  }
                >
                  {f.sectionTitle ? (
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-teal">
                      {f.sectionTitle}
                    </p>
                  ) : null}

                  <FieldRenderer
                    field={f}
                    values={values}
                    error={errors[f.key] ?? undefined}
                    set={set}
                    toggleChoice={toggleChoice}
                  />
                </div>
              ))}
            {submitError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"
              >
                {submitError}
              </p>
            ) : null}

          </div>
          <div className="mt-9 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            {stepIdx > 0 ? (
              <button type="button" onClick={goBack} className="btn-ghost-navy w-full px-5 py-3.5 sm:w-auto sm:py-3">
                <ChevronLeft className="mr-1 inline h-4 w-4" aria-hidden="true" />
                Back
              </button>
            ) : (
              <Link to="/careers" className="btn-ghost-navy w-full px-5 py-3.5 text-center sm:w-auto sm:py-3">
                Cancel
              </Link>
            )}
            {stepIdx < STEPS.length - 1 ? (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                {reviewReturn ? (
                  <button
                    type="button"
                    onClick={returnToReview}
                    className="btn-ghost-navy w-full px-5 py-3.5 sm:w-auto sm:py-3"
                  >
                    Return to review
                  </button>
                ) : null}
                <button type="button" onClick={goNext} className="btn-solid w-full px-6 py-3.5 sm:w-auto sm:py-3">
                  Continue
                  <ChevronRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (

              <button
                type="button"
                onClick={previewSubmission}
                disabled={submitting}
                className="btn-solid w-full px-6 py-3.5 disabled:opacity-70 sm:w-auto sm:py-3"
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            )}
          </div>

          <div className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">
            <p>
              Your answers are saved in this browser tab, so a refresh returns you
              to this step.
            </p>
            <button
              type="button"
              onClick={() => setStartOverOpen(true)}
              className="mt-2 font-semibold text-accent underline underline-offset-4"
            >
              Start Over
            </button>
          </div>



        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Review groups, derived from the field definitions so a question can move
 * between steps without the summary drifting out of sync. Each group records
 * the step that now owns it and the first field to scroll to when editing.
 */
const REVIEW_GROUPS: { label: string; stepIndex: number; fields: FieldDef[] }[] = (() => {
  const groups: { label: string; stepIndex: number; fields: FieldDef[] }[] = [];
  STEPS.slice(0, STEPS.length - 1).forEach((s, stepIndex) => {
    for (const f of s.fields) {
      const label = f.group ?? s.title;
      const existing = groups.find((g) => g.label === label);
      if (existing) existing.fields.push(f);
      else groups.push({ label, stepIndex, fields: [f] });
    }
  });
  const order = [
    "Applicant Information",
    "Opportunity Preferences",
    "Position Requirements",
    "School and Class Schedule",
    "Academic Information",
    "Housing and San Diego Availability",

    "Regular Availability",
    "Weekend Availability",
    "Holiday and Time-Off Information",
    "Commitments and Experience",
    "Education and Career Goals",

  ];
  return groups.sort((a, b) => {
    const ai = order.indexOf(a.label);
    const bi = order.indexOf(b.label);
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
  });
})();

/**
 * Review-page snapshot handed to the server for the archived PDF copy. The
 * groups, order, labels, and formatted answers come from the same definitions
 * that render Step 5, so the PDF cannot drift from what the applicant saw.
 */
export function buildApplicationPdfSections(values: Values): AnswerSection[] {
  return REVIEW_GROUPS.map((g) => ({
    label: g.label,
    rows: g.fields
      .filter((f) => isVisible(f, values))
      .map((f) => displayRow(f, values)),
  })).filter((g) => g.rows.length > 0);
}

export const APPLICATION_ACK_STATEMENT =
  "Typing your name confirms that the information in this application is complete and accurate to the best of your knowledge. The submission date and time are recorded by our system.";


function ReviewSummary({
  values,
  onEdit,
}: {
  values: Values;
  onEdit: (index: number, anchorKey: string, group: string) => void;
}) {
  return (
    <div className="space-y-4">
      {REVIEW_GROUPS.map((g) => {
        const visible = g.fields.filter((f) => isVisible(f, values));
        const count = visible.filter((f) => !!fieldError(f, values)).length;
        const anchor = visible[0]?.key ?? g.fields[0]?.key ?? "";
        return (
          <div
            key={g.label}
            data-review-group={g.label}
            className="rounded-xl border border-border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-primary">{g.label}</h3>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    count > 0
                      ? "border border-accent bg-accent/10 text-primary"
                      : "border border-teal bg-teal/10 text-primary"
                  }`}
                >
                  {count > 0 ? `${count} incomplete` : "Complete"}
                </span>
                <button
                  type="button"
                  onClick={() => onEdit(g.stepIndex, anchor, g.label)}
                  className="text-xs font-semibold text-teal underline underline-offset-4"
                >
                  Edit
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {visible.map((f) => (
                <SubmittedAnswerRow key={f.key} row={normalizeAnswerRow(displayRow(f, values))} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/**
 * Highlighted category panel for the "Other regular commitments" question.
 * Keeps the disclosure categories prominent with restrained Elev8 colors and
 * consistently sized professional icons (no multicolored cards).
 */
function CommitmentIntroPanel() {
  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-primary">
        Other regular commitments
        <span className="ml-1 text-accent" aria-hidden="true">
          *
        </span>
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {COMMIT_INTRO}
      </p>
      <div className="rounded-xl border border-teal/30 bg-teal/5 p-4 sm:p-5">
        <ul
          aria-label="Commitment types to disclose"
          className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-2.5"
        >
          {COMMIT_CATEGORIES.map(({ label, icon: Icon }) => (
            <li
              key={label}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2.5 text-center sm:flex-row sm:justify-start sm:gap-2 sm:px-2.5 sm:py-2 sm:text-left"
            >
              <Icon
                className="h-3.5 w-3.5 shrink-0 text-teal sm:h-4 sm:w-4"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="min-w-0 hyphens-auto break-words text-[11px] font-bold leading-tight text-primary sm:text-[13px]">
                {label}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-teal/20 pt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {COMMIT_INSTRUCTION}
        </p>
      </div>
    </div>
  );
}

function HolidayCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm font-semibold text-primary">
        Holiday schedule and school-break policy
        <span className="ml-1 text-accent" aria-hidden="true">
          *
        </span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Our residential services operate every day. When school is not in
        session&mdash;including holidays and academic breaks&mdash;team members
        whose regular availability is limited by a class schedule are expected to
        have expanded availability and be available to work at any time of day,
        based on staffing needs. This may include morning, afternoon, evening,
        weekend, and holiday shifts.
      </p>
      <div className="mt-3 rounded-lg border-l-4 border-teal bg-teal/5 px-4 py-3">
        <p className="text-sm font-semibold text-primary">
          Available to work at any time of day
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          This may include morning, afternoon, evening, weekend, and holiday
          shifts, based on staffing needs.
        </p>
      </div>

      {/* Availability expectation */}
      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
          Availability expectation
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          During holidays and school breaks, you are expected to be available
          for scheduling at any time across both{" "}
          <span className="font-semibold text-primary">AM and PM shifts</span>,
          unless you have submitted a specific availability restriction or
          time-off request and received approval in advance.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your regular class schedule cannot be used as an availability
          restriction while{" "}
          <span className="font-semibold text-primary">
            school is not in session
          </span>
          .
        </p>
      </div>

      {/* Holiday list */}
      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
          This includes AM and PM availability on
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {OBSERVED_HOLIDAYS.map((h) => (
            <li
              key={h}
              className="flex items-center gap-2.5 border-b border-border/70 py-2.5 text-sm text-foreground last:border-0 sm:last:border-b"
            >
              <CalendarDays
                className="h-4 w-4 shrink-0 text-teal"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>{h}</span>
            </li>
          ))}
          {SCHOOL_BREAKS.map((b) => (
            <li
              key={b}
              className="flex items-center gap-2.5 border-b border-border/70 py-2.5 text-sm text-foreground last:border-0 sm:last:border-b"
            >
              <CalendarDays
                className="h-4 w-4 shrink-0 text-teal"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Approval requirement */}
      <div className="mt-5 rounded-lg border border-border bg-secondary p-4">
        <p className="text-sm font-semibold text-primary">
          Approval requirement
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Requests for limited availability or time off must be submitted and
          approved in advance. A request is not considered approved until the
          team member receives confirmation.
        </p>
      </div>
    </div>
  );
}

const BREAK_LIMITS = [
  {
    term: "Spring break",
    detail: "Team members may request up to 3 total days of approved time off.",
  },
  {
    term: "Summer break",
    detail: "Team members may request up to 14 total days of approved time off.",
  },
  {
    term: "Fall/Thanksgiving break",
    detail: "Team members may request up to one week of approved time off.",
  },
  {
    term: "Winter break",
    detail: "Team members may request up to one week of approved time off.",
  },
];

const PRIMARY_HOLIDAYS = [
  "Thanksgiving Day",
  "Christmas Eve",
  "Christmas Day",
];

function BreaksCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm font-semibold text-primary">
        School-break and holiday availability requirement
        <span className="ml-1 text-accent" aria-hidden="true">
          *
        </span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        To support consistent client care and distribute holiday coverage
        fairly, team members may request time off during school breaks within
        the limits below.
      </p>

      <dl className="mt-4 grid gap-3">
        {BREAK_LIMITS.map((b) => (
          <div key={b.term} className="rounded-lg border border-border p-4">
            <dt className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
              {b.term}
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {b.detail}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-lg border border-border bg-secondary p-4">
        <p className="text-sm font-semibold text-primary">
          There are three primary holiday dates:
        </p>
        <ul className="mt-2 space-y-1.5">
          {PRIMARY_HOLIDAYS.map((h) => (
            <li
              key={h}
              className="flex items-center gap-2.5 text-sm text-foreground"
            >
              <CalendarDays
                className="h-4 w-4 shrink-0 text-teal"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Of these three holidays, only one may be included in an approved
          time-off request. Team members must remain available to work the
          other two holidays.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Applicants may select their preferred holiday below. Preferences
          will be considered based on staffing needs but cannot be guaranteed.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          All time off must be requested and approved in advance before travel
          arrangements are finalized.
        </p>
      </div>
    </div>
  );
}

/**
 * Text-message disclosure shown immediately above the consent question.
 *
 * A2P 10DLC campaign review expects the applicant to see what they are
 * agreeing to, how often, that rates may apply, and both keywords -- with the
 * Privacy Policy and Terms reachable from beside the opt-in itself rather than
 * only from the footer. The links open in a new tab so a half-finished
 * application is never navigated away from.
 */
function SmsConsentCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
        Text messages about your application
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {SMS_PROGRAM_DESCRIPTION}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
        <li>{SMS_MESSAGE_FREQUENCY}</li>
        <li>{SMS_RATES_NOTICE}</li>
        <li>
          <span className="font-semibold text-primary">{SMS_STOP_REPLY}</span>{" "}
          <span className="font-semibold text-primary">{SMS_HELP_REPLY}</span>
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We never sell or share your mobile number, and we do not send marketing
        text messages.
      </p>
      <p className="mt-3 rounded-lg bg-secondary px-3.5 py-3 text-sm font-semibold leading-relaxed text-primary">
        This is optional. Leave it unchecked and we will contact you by phone or
        email instead — your application is considered exactly the same way.
      </p>
      <p className="mt-3 text-sm">
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline hover:text-accent"
        >
          Privacy Policy
        </a>
        <span className="px-2 text-muted-foreground">|</span>
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline hover:text-accent"
        >
          Terms &amp; Conditions
        </a>
      </p>
    </div>
  );
}

function PayCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
            Starting pay
          </p>
          <p className="mt-2 text-2xl font-extrabold text-primary lg:text-3xl">
            <span>$17.75</span>{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              per hour
            </span>
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Support Professional positions
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Growth opportunities
          </p>
          <p className="mt-2 text-2xl font-extrabold text-primary lg:text-3xl">
            <span>Up to $25.00</span>{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              per hour
            </span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            May apply to supervisor and manager positions based on role,
            responsibilities, qualifications, performance, and promotion.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-secondary p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal" strokeWidth={2} aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-primary">Important note</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Performance reviews provide an opportunity to discuss progress and
            compensation but do not guarantee a promotion or pay increase.
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldNote({ f, values }: { f: FieldDef; values: Values }) {
  if (!f.note) return null;
  if (f.noteIf && !f.noteIf(values)) return null;
  return (
    <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{f.note}</p>
  );
}

const WEEKEND_SHIFTS: { title: string; accent: string; shifts: string[] }[] = [
  {
    title: "Shorter shifts",
    accent: "text-teal",
    shifts: [
      "Morning: 7:00 AM–12:00 PM",
      "Afternoon: 12:00 PM–6:00 PM",
      "Evening: 6:00 PM–11:30 PM",
    ],
  },
  {
    title: "Longer shifts",
    accent: "text-accent",
    shifts: [
      "Morning: 7:00 AM–3:00 PM",
      "Afternoon/evening: 3:00 PM–11:00 PM",
    ],
  },
];

function WeekendCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-primary">Weekend availability</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Elev8&rsquo;s residential services operate 24 hours a day, seven days a week.
        Weekend availability is an essential scheduling requirement for Support
        Professional positions.
      </p>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-teal">
        Typical weekend shift rotation
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Weekend shifts rotate between morning, afternoon, and evening coverage. Some
        weekends may include shorter shifts, while others may include shifts lasting up
        to eight hours.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {WEEKEND_SHIFTS.map((group) => (
          <div
            key={group.title}
            className="rounded-lg border border-border bg-secondary/60 p-4 shadow-sm"
          >
            <p className={`text-xs font-bold uppercase tracking-[0.14em] ${group.accent}`}>
              {group.title}
            </p>
            <ul className="mt-2 space-y-2">
              {group.shifts.map((shift) => (
                <li key={shift} className="flex items-start gap-2">
                  <Clock
                    aria-hidden="true"
                    strokeWidth={2}
                    className="mt-0.5 h-4 w-4 shrink-0 text-teal"
                  />
                  <span className="min-w-0 break-words text-sm leading-relaxed text-foreground">
                    {shift}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}



/* ---------------- Unified class list ------------------------------- */

const CLASS_DAY_OPTIONS = [...ALL_DAYS, DAYS_TBA];

const CLASS_COLUMNS = [
  "Course or class name",
  "Academic term",
  "Class days",
  "Start time",
  "End time",
  "Current status",
  "Class start date",
  "Class end date",
  "Exam dates",
  "Final-exam date",
];

const CLASS_TOP_GRID = "1.35fr 0.85fr 1.1fr 1fr 1fr";
const CLASS_BOTTOM_GRID = "1.1fr 0.75fr 0.75fr 1.2fr 1.2fr";

/** Every 15-minute slot from 6:00 AM through 10:00 PM. */
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let mins = 6 * 60; mins <= 22 * 60; mins += 15) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    out.push({
      value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      label: `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`,
    });
  }
  return out;
})();

/** Every 15-minute slot from 6:00 AM through 11:45 PM. */
const LATE_TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let mins = 6 * 60; mins <= 23 * 60 + 45; mins += 15) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    out.push({
      value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      label: `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`,
    });
  }
  return out;
})();

/** Human-readable label for a stored 24-hour time value. */
function timeLabel(value: string) {
  if (!value) return "time pending";
  return LATE_TIME_OPTIONS.find((t) => t.value === value)?.label ?? value;
}


const cellCls = (invalid?: boolean, disabled?: boolean) =>
  `block w-full min-w-0 rounded-lg border bg-card px-2.5 py-2.5 text-base text-foreground outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/30 xl:px-1.5 xl:py-1.5 xl:text-sm ${
    invalid ? "border-accent" : "border-border"
  } ${disabled ? "opacity-50" : ""}`;

function TimeSelect({
  value,
  disabled,
  invalid,
  placeholder,
  label,
  late,
  onChange,
}: {
  value: string;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  placeholder: string;
  label: string;
  /** Extends the choices through 11:45 PM for late-evening commitments. */
  late?: boolean | undefined;
  onChange: (value: string) => void;
}) {
  const choices = late ? LATE_TIME_OPTIONS : TIME_OPTIONS;
  return (
    <select
      value={disabled ? "" : value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.currentTarget.value)}
      className={cellCls(invalid, disabled)}
    >
      <option value="">{placeholder}</option>
      {choices.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

/** Ordering and range problems, surfaced inline as soon as both values exist. */
function classComparisonIssue(c: ClassEntry): string | undefined {
  if (c.startTime && c.endTime && c.endTime <= c.startTime)
    return "Class end time must be later than the start time.";
  if (c.start && c.end && c.end <= c.start)
    return "The class end date must be later than the class start date. Please review both dates.";
  if (
    !c.examUnknown &&
    c.examDates.some((d) => (c.start && d < c.start) || (c.end && d > c.end))
  )
    return "Exam dates must fall between the class start and end dates.";
  if (!c.finalUnknown && c.finalExam) {
    if (c.start && c.finalExam < c.start)
      return "The final-exam date cannot be earlier than the class start date.";
    const latestExam = c.examUnknown ? "" : ([...c.examDates].sort().pop() ?? "");
    if (latestExam && c.finalExam < latestExam)
      return "The final-exam date cannot be earlier than the other known exam dates.";
  }
  return undefined;
}

/** Everything required before the applicant can continue. */
function classIssue(c: ClassEntry): string | undefined {
  return classIssues(c)[0];
}

function classIssues(c: ClassEntry): string[] {
  const issues: string[] = [];
  if (!c.name.trim()) issues.push("Please enter the course or class name.");
  if (!c.term) issues.push("Please select the academic term for this class.");
  if (!c.status) issues.push("Please select the current status.");
  if (!c.start || !c.end) issues.push("Please enter the expected class start and end dates.");
  if (c.days.length === 0) issues.push("Please select the class days.");
  if (!c.startTime || !c.endTime) issues.push("Please enter the class start and end times.");
  const comparison = classComparisonIssue(c);
  if (comparison) issues.push(comparison);
  if (CLASS_EXPLAIN_STATUSES.includes(c.status) && !c.explain.trim())
    issues.push("Please briefly explain your current status.");
  if (c.explain.length > EXPLAIN_LIMIT)
    issues.push(`Please keep the explanation under ${EXPLAIN_LIMIT} characters.`);
  return issues;
}

function MiniCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-start gap-1.5 text-[11px] leading-tight text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="mt-px h-3.5 w-3.5 shrink-0 accent-[color:var(--teal)]"
      />
      <span className="min-w-0">{label}</span>
    </label>
  );
}

function DateChip({ value, onRemove }: { value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {value}
      <button
        type="button"
        onClick={onRemove}
        className="text-primary/60 hover:text-primary"
        aria-label={`Remove ${value}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ClassDaysPicker({
  value,
  onChange,
  label,
  options = CLASS_DAY_OPTIONS,
  invalid,
}: {
  value: string[];
  onChange: (days: string[]) => void;
  label: string;
  options?: string[];
  invalid?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const tba = value.includes(DAYS_TBA);

  const toggle = (day: string, on: boolean) => {
    // "Schedule not yet announced" clears and disables the weekday choices.
    if (day === DAYS_TBA) return onChange(on ? [DAYS_TBA] : []);
    const next = on
      ? [...value.filter((d) => d !== DAYS_TBA), day]
      : value.filter((d) => d !== day);
    onChange(ALL_DAYS.filter((d) => next.includes(d)));
  };

  return (
    <div className="relative" ref={ref}>
      <div className={cellCls(invalid) + " flex min-h-9 items-center gap-1 p-1"}>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {value.length ? (
            value.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d, false)}
                className="inline-flex min-w-0 items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
                aria-label={`Remove ${d}`}
              >
                <span>{d === DAYS_TBA ? "Not announced" : d.slice(0, 3)}</span>
                <X className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              </button>
            ))
          ) : (
            <span className="px-1 text-sm text-muted-foreground">Select days</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={label}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-primary"
        >
          <ChevronDown
            className={"h-3.5 w-3.5 transition-transform " + (open ? "rotate-180" : "")}
          />
        </button>
      </div>

      {open ? (
        <div className="absolute z-30 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
          {options.map((d) => {
            const on = value.includes(d);
            const disabled = tba && d !== DAYS_TBA;
            return (
              <label
                key={d}
                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted ${
                  disabled ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={(e) => toggle(d, e.currentTarget.checked)}
                  className="h-4 w-4 accent-[color:var(--teal)]"
                />
                <span className="min-w-0">{d}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const prettyDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return `${MONTH_NAMES[m - 1]?.slice(0, 3)} ${d}, ${y}`;
};

/** Lightweight multi-date month calendar; keeps ISO strings, no extra deps. */
function MultiDateCalendar({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const initial = selected[0] ?? todayISO();
  const [y0, m0] = initial.split("-").map(Number);
  const [cursor, setCursor] = useState({
    y: y0 ?? new Date().getFullYear(),
    m: (m0 ?? 1) - 1,
  });

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = first.getDay();
  const step = (delta: number) => {
    const next = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: next.getFullYear(), m: next.getMonth() });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 pb-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="rounded border border-border px-2 py-0.5 text-xs font-bold text-primary hover:border-teal"
        >
          &lsaquo;
        </button>
        <span className="text-xs font-bold text-primary">
          {MONTH_NAMES[cursor.m]} {cursor.y}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="rounded border border-border px-2 py-0.5 text-xs font-bold text-primary hover:border-teal"
        >
          &rsaquo;
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold uppercase text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const value = iso(cursor.y, cursor.m, i + 1);
          const on = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              aria-label={prettyDate(value)}
              onClick={() => onToggle(value)}
              className={`h-7 rounded text-xs font-semibold transition ${
                on
                  ? "border border-teal bg-teal/15 text-primary"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExamDatesPicker({
  c,
  invalid,
  onChange,
}: {
  c: ClassEntry;
  invalid?: boolean;
  onChange: (patch: Partial<ClassEntry>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = (value: string) =>
    onChange({
      examDates: c.examDates.includes(value)
        ? c.examDates.filter((d) => d !== value)
        : [...c.examDates, value].sort(),
    });

  const count = c.examDates.length;

  return (
    <div ref={ref}>
      <div className="relative">
        <button
          type="button"
          disabled={c.examUnknown}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Select exam dates"
          className={
            cellCls(invalid, c.examUnknown) +
            " flex items-center justify-between gap-1 text-left"
          }
        >
          <span
            className={
              "min-w-0 flex-1 truncate " + (count ? "" : "text-muted-foreground")
            }
          >
            {c.examUnknown
              ? "Not yet known"
              : count
                ? `${count} date${count === 1 ? "" : "s"} selected`
                : "Select dates"}
          </span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {open && !c.examUnknown ? (
          <div className="absolute left-0 z-40 mt-1 w-[16.5rem] max-w-[85vw] rounded-lg border border-border bg-card p-2 shadow-lg xl:left-auto xl:right-0">
            <MultiDateCalendar selected={c.examDates} onToggle={toggle} />
            {count ? (
              <div className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
                {c.examDates.map((d) => (
                  <DateChip
                    key={d}
                    value={prettyDate(d)}
                    onRemove={() =>
                      onChange({ examDates: c.examDates.filter((x) => x !== d) })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                Select every known exam date for this class.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClassExplain({
  c,
  onChange,
  invalid,
}: {
  c: ClassEntry;
  onChange: (text: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-sm font-semibold text-primary">
        Briefly explain your current status
        <span className="ml-1 text-accent" aria-hidden="true">
          *
        </span>
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        If you are waitlisted, describe generally where you stand and how likely you
        believe enrollment is. You do not need to provide an exact waitlist number. If
        the class is tentative, describe the uncertainty and whether it could affect
        your availability.
      </p>
      <textarea
        rows={2}
        maxLength={EXPLAIN_LIMIT}
        value={c.explain}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder="Waitlisted near the top of the list and likely to be enrolled before the term begins."
        className={`mt-2 ${cellCls(invalid)}`}
      />
      <span className="mt-1 block text-xs text-muted-foreground">
        {c.explain.length}/{EXPLAIN_LIMIT} characters
      </span>
    </div>
  );
}

/** Auto-expanding compact details field for a time-off request. */
function AutoTextarea({
  value,
  onChange,
  invalid,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean | undefined;
  ariaLabel: string;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    resize(ref.current);
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      maxLength={EXPLAIN_LIMIT}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.currentTarget.value)}
      className={`block w-full min-w-0 resize-none overflow-hidden rounded-lg border bg-card px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/30 ${
        invalid ? "border-accent" : "border-border"
      }`}
    />
  );
}

const TIMEOFF_GRID =
  "md:grid md:grid-cols-[4.5rem_9.5rem_9.5rem_minmax(0,1fr)_2.5rem] md:items-start md:gap-2";

/**
 * Repeatable list of anticipated time-off requests. Each request is stored as
 * its own structured entry; requests are never merged into one paragraph.
 */
function TimeOffField({
  f,
  values,
  error,
  set,
  synced,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  set: (key: string, value: FieldValue) => void;
  /** Rendered as the synchronized copy inside Upcoming time-off requests. */
  synced?: boolean;
}) {
  // The housing variant collects anticipated housing-related absences. It is
  // the single source for those dates: the copy shown inside Upcoming time-off
  // requests edits the very same entries, so nothing is entered twice.
  const housing = f.timeoffVariant === "housing";
  const noun = housing ? "Anticipated absence" : "Time-off request";
  const startLabel = housing ? "Anticipated departure date*" : "Anticipated start date*";
  const endLabel = housing ? "Anticipated return date*" : "Anticipated end date*";
  const addLabel = housing
    ? "Add another anticipated absence"
    : "Add another time-off request";
  const detailsPlaceholder = housing
    ? HOUSING_ABSENCE_DETAILS_PLACEHOLDER
    : TIMEOFF_DETAILS_PLACEHOLDER;

  const entries = timeOffList(values, f.key);
  const list = entries.length ? entries : [emptyTimeOff()];
  const syncedAbsences = !housing ? housingAbsenceList(values) : [];

  const update = (i: number, patch: Partial<TimeOffEntry>) =>
    set(
      f.key,
      list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );

  const remove = (i: number) =>
    set(
      f.key,
      list.filter((_, idx) => idx !== i),
    );

  const dateCls = (bad?: string | undefined) =>
    `block w-full min-w-0 rounded-lg border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/30 ${
      bad ? "border-accent" : "border-border"
    }`;

  return (
    <div className="space-y-3" data-field={synced ? `${f.key}-synced` : f.key}>
      <p className="text-sm font-semibold text-primary">
        {synced ? HOUSING_SYNC_FLAG : f.label}
        {synced ? null : (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        )}
      </p>
      {synced ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Added automatically from your housing answers. Editing it here also
          updates the housing section.
        </p>
      ) : null}

      {/* Column labels appear once, above the first request. */}
      <div className={`hidden ${TIMEOFF_GRID} md:!grid`}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {housing ? "Absence" : "Request"}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {startLabel}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {endLabel}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Relevant details*
        </span>
        <span className="sr-only">Remove</span>
      </div>

      <div className="space-y-3">
        {list.map((r, i) => {
          const issues = housing ? housingAbsenceIssues(r) : timeOffIssues(r);
          // Date-logic messages appear as soon as they apply; required-field
          // messages appear once the step has been validated.
          const show = (key: keyof TimeOffEntry) => {
            const message = issues[key];
            if (!message) return undefined;
            if (message === "This answer is required.") return error ? message : undefined;
            return message;
          };
          const startError = show("start");
          const endError = show("end");
          const detailsError = show("details");
          const rowMessages = [startError, endError, detailsError].filter(Boolean) as string[];

          return (
            <div
              key={i}
              className={`relative rounded-xl border border-border bg-card p-4 md:border-0 md:bg-transparent md:p-0 ${TIMEOFF_GRID}`}
            >
              <p className="pr-10 text-sm font-semibold text-primary md:pr-0 md:pt-2">
                {noun} {i + 1}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 md:col-span-2 md:mt-0 md:grid md:grid-cols-2 md:gap-2">
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-primary md:hidden">
                    {startLabel}
                  </span>
                  <input
                    type="date"
                    value={r.start}
                    min={todayISO()}
                    {...(housing ? {} : { max: eightMonthsOutISO() })}
                    aria-label={`${noun} ${i + 1} ${startLabel.replace("*", "")}`}
                    onChange={(e) => update(i, { start: e.currentTarget.value })}
                    className={dateCls(startError)}
                  />
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-primary md:hidden">
                    {endLabel}
                  </span>
                  <input
                    type="date"
                    value={r.end}
                    min={r.start || todayISO()}
                    {...(housing ? {} : { max: eightMonthsOutISO() })}
                    aria-label={`${noun} ${i + 1} ${endLabel.replace("*", "")}`}
                    onChange={(e) => update(i, { end: e.currentTarget.value })}
                    className={dateCls(endError)}
                  />
                </label>
              </div>

              <div className="mt-3 min-w-0 md:mt-0">
                <span className="mb-1 block text-xs font-semibold text-primary md:hidden">
                  Relevant details*
                </span>
                <AutoTextarea
                  value={r.details}
                  invalid={detailsError ? true : undefined}
                  ariaLabel={`${noun} ${i + 1} relevant details`}
                  placeholder={detailsPlaceholder}
                  onChange={(details) => update(i, { details })}
                />
              </div>

              {/* The first request cannot be removed while "Yes" is selected. */}
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-accent hover:text-accent md:static md:mt-0 md:h-9 md:w-9"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : (
                <span className="hidden md:block md:h-9 md:w-9" aria-hidden="true" />
              )}

              {rowMessages.length ? (
                <div className="mt-2 md:col-span-5">
                  {rowMessages.map((m) => (
                    <p key={m} className="text-sm font-medium text-accent">
                      {m}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => set(f.key, [...list, emptyTimeOff()])}
        className="inline-flex items-center gap-2 rounded-lg border border-teal px-3 py-2 text-sm font-semibold text-teal transition hover:bg-teal/5"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        {addLabel}
      </button>

      {housing ? (
        <div className="rounded-lg border-l-4 border-teal bg-teal/5 px-4 py-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {HOUSING_LIMIT_NOTE}
          </p>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">{TIMEOFF_NOTE}</p>
      )}

      {error ? (
        <p id={`${f.key}-error`} className="text-sm font-medium text-accent">
          {error}
        </p>
      ) : null}

      {/* Housing-related absences are synchronized here so the applicant never
          enters the same dates twice and no duplicate request is created. */}
      {syncedAbsences.length ? (
        <div className="mt-6 border-t border-border pt-5">
          <TimeOffField f={HOUSING_SYNC_FIELD} values={values} set={set} synced />
        </div>
      ) : null}
    </div>
  );
}

/** The housing absences, rendered inside Upcoming time-off requests. */
const HOUSING_SYNC_FIELD: FieldDef = {
  key: "housing_absences",
  label: HOUSING_SYNC_FLAG,
  type: "timeoff",
  timeoffVariant: "housing",
};


const COMMIT_LABEL_CLS =
  "mb-1 block whitespace-normal break-words text-xs font-semibold leading-snug text-primary";

/**
 * Repeatable list of commitments a transfer applicant maintained while enrolled
 * at a previous institution. Each entry records its own type, organization,
 * average weekly hours, and number of academic terms maintained.
 */
function HistoryField({
  f,
  values,
  error,
  set,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  set: (key: string, value: FieldValue) => void;
}) {
  const entries = historyList(values, f.key);
  const list = entries.length ? entries : [emptyHistory()];
  const write = (next: HistoryEntry[]) => set(f.key, next as unknown as FieldValue);
  const update = (i: number, patch: Partial<HistoryEntry>) =>
    write(list.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));

  return (
    <div className="space-y-4" data-field={f.key}>
      {list.map((h, i) => {
        const issues = error ? historyIssues(h) : [];
        return (
          <div
            key={i}
            className="w-full max-w-full space-y-4 rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-primary">Previous commitment {i + 1}</p>
              {list.length > 1 ? (
                <button
                  type="button"
                  onClick={() => write(list.filter((_, idx) => idx !== i))}
                  className="text-xs font-semibold text-accent underline"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-[1.6fr_1.6fr_0.8fr_0.9fr]">
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>Type of commitment*</span>
                <select
                  value={h.type}
                  onChange={(e) => update(i, { type: e.currentTarget.value })}
                  className={cellCls(!!error && !h.type)}
                >
                  <option value="">Select one</option>
                  {COMMIT_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>Organization, program, or description*</span>
                <input
                  type="text"
                  value={h.org}
                  onChange={(e) => update(i, { org: e.currentTarget.value })}
                  placeholder="Example: Campus bookstore"
                  className={cellCls(!!error && !h.org.trim())}
                />
              </label>
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>Average hours per week*</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={h.hours}
                  onChange={(e) => update(i, { hours: limitDecimals(e.currentTarget.value, 0) })}
                  placeholder="Example: 12"
                  className={cellCls(!!error && !/^\d+$/.test(h.hours.trim()))}
                />
              </label>
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>Academic terms maintained*</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={h.terms}
                  onChange={(e) => update(i, { terms: limitDecimals(e.currentTarget.value, 0) })}
                  placeholder="Example: 3"
                  className={cellCls(!!error && !/^\d+$/.test(h.terms.trim()))}
                />
              </label>
            </div>

            {issues.length ? (
              <ul className="space-y-1 text-sm font-medium text-accent">
                {issues.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => write([...list, emptyHistory()])}
        className="rounded-lg border border-teal px-3 py-2 text-sm font-semibold text-teal transition hover:bg-teal/5"
      >
        Add another commitment
      </button>
    </div>
  );
}


/**
 * Repeatable list of current or planned outside commitments. Each commitment is
 * stored as its own structured entry with the complete set of applicable fields.
 */
function CommitmentsField({
  f,
  values,
  error,
  set,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  set: (key: string, value: FieldValue) => void;
}) {
  const entries = commitmentList(values, f.key);
  const list = entries.length ? entries : [emptyCommitment()];
  // The weekend variant reuses this layout with weekend-specific wording,
  // a single weekend-day dropdown, and late-evening time choices.
  const wknd = f.commitVariant === "weekend";
  const noun = wknd ? "Weekend commitment" : "Regular commitment";
  const schedOptions = wknd ? WKEND_SCHEDULE_OPTIONS : COMMIT_SCHEDULE_OPTIONS;
  const S_REG = wknd ? WKEND_SCHED_REGULAR : SCHED_REGULAR;
  const S_VAR = wknd ? WKEND_SCHED_VARIES : SCHED_VARIES;
  const S_TBD = wknd ? WKEND_SCHED_TBD : SCHED_TBD;

  const write = (next: CommitmentEntry[]) => set(f.key, next);
  const update = (i: number, patch: Partial<CommitmentEntry>) =>
    write(list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const updateBlock = (i: number, bi: number, patch: Partial<CommitmentBlock>) =>
    update(i, {
      blocks: (list[i] as CommitmentEntry).blocks.map((b, idx) =>
        idx === bi ? { ...b, ...patch } : b,
      ),
    });

  return (
    <div className="space-y-4" data-field={f.key}>
      {list.map((c, i) => {
        const issues = error
          ? wknd
            ? weekendCommitmentIssues(c)
            : commitmentIssues(c)
          : [];
        const jobLike = isJobLike(c.type);
        return (
          <div
            key={i}
            className="w-full max-w-full space-y-4 overflow-visible rounded-xl border border-border bg-muted/30 p-4"
          >
            <p className="text-sm font-semibold text-primary">
              {noun} {i + 1}
            </p>

            {/* Type, status, and description share one desktop row. */}
            <div className="grid gap-3 md:grid-cols-[1.6fr_0.8fr_1.4fr]">
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>Type of commitment*</span>
                <select
                  value={c.type}
                  onChange={(e) => {
                    const type = e.currentTarget.value;
                    update(i, isJobLike(type) ? { type } : { type, jobPlan: "" });
                  }}
                  className={cellCls()}
                >
                  <option value="">{wknd ? "Select type" : "Select one"}</option>
                  {COMMIT_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>Status*</span>
                <select
                  value={c.status}
                  onChange={(e) => update(i, { status: e.currentTarget.value })}
                  className={cellCls()}
                >
                  <option value="">{wknd ? "Select status" : "Select one"}</option>
                  {COMMIT_STATUS_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>
                  Organization, program, or description*
                </span>
                <input
                  type="text"
                  value={c.org}
                  placeholder={COMMIT_ORG_PLACEHOLDER}
                  onChange={(e) => update(i, { org: e.currentTarget.value })}
                  className={cellCls()}
                />
              </label>
            </div>

            {/* Weekly hours and schedule type share the next desktop row. */}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>Average hours per week*</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={c.hours}
                  onChange={(e) =>
                    update(i, { hours: e.currentTarget.value.replace(/[^\d]/g, "") })
                  }
                  className={cellCls()}
                />
              </label>
              <label className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>
                  {wknd
                    ? "Does this weekend commitment follow a regular schedule?*"
                    : "Does this commitment follow a regular schedule?*"}
                </span>
                <select
                  value={c.scheduleType}
                  onChange={(e) => {
                    const scheduleType = e.currentTarget.value;
                    // Hidden schedule answers are cleared so they never linger.
                    update(i, {
                      scheduleType,
                      blocks:
                        scheduleType === S_REG
                          ? c.blocks.length
                            ? c.blocks
                            : [emptyCommitBlock()]
                          : [emptyCommitBlock()],
                      varies: scheduleType === S_VAR ? c.varies : "",
                      tbd: scheduleType === S_TBD ? c.tbd : "",
                      weekendDays:
                        scheduleType === S_VAR || scheduleType === S_TBD
                          ? c.weekendDays
                          : [],
                    });
                  }}
                  className={cellCls()}
                >
                  <option value="">Select one</option>
                  {schedOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {c.scheduleType === S_REG ? (
              <div className="space-y-3">
                {c.blocks.map((b, bi) => (
                  <div
                    key={bi}
                    className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_2.5rem] md:items-end"
                  >
                    <div className="min-w-0">
                      <span className={COMMIT_LABEL_CLS}>
                        {wknd ? "Weekend day*" : "Days*"}
                      </span>
                      {wknd ? (
                        <select
                          value={b.days[0] ?? ""}
                          aria-label={`Weekend commitment ${i + 1} day/time block ${bi + 1} weekend day`}
                          onChange={(e) =>
                            updateBlock(i, bi, {
                              days: e.currentTarget.value ? [e.currentTarget.value] : [],
                            })
                          }
                          className={cellCls()}
                        >
                          <option value="">Select day</option>
                          {WKEND_DAY_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <ClassDaysPicker
                          value={b.days}
                          options={ALL_DAYS}
                          label={`${noun} ${i + 1} day/time block ${bi + 1} days`}
                          onChange={(days) => updateBlock(i, bi, { days })}
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-2">
                      <label className="min-w-0">
                        <span className={COMMIT_LABEL_CLS}>Start time*</span>
                        <TimeSelect
                          value={b.startTime}
                          placeholder="Start"
                          late={wknd}
                          label={`${noun} ${i + 1} block ${bi + 1} start time`}
                          onChange={(startTime) => updateBlock(i, bi, { startTime })}
                        />
                      </label>
                      <label className="min-w-0">
                        <span className={COMMIT_LABEL_CLS}>End time*</span>
                        <TimeSelect
                          value={b.endTime}
                          placeholder="End"
                          late={wknd}
                          label={`${noun} ${i + 1} block ${bi + 1} end time`}
                          onChange={(endTime) => updateBlock(i, bi, { endTime })}
                        />
                      </label>
                    </div>
                    {bi > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          update(i, { blocks: c.blocks.filter((_, idx) => idx !== bi) })
                        }
                        aria-label={`Remove day/time block ${bi + 1}`}
                        className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-lg border border-border text-muted-foreground transition hover:border-accent hover:text-accent"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="hidden md:block md:h-10 md:w-10" aria-hidden="true" />
                    )}
                    {b.startTime && b.endTime && b.endTime <= b.startTime ? (
                      <p className="text-sm font-medium text-accent md:col-span-4">
                        {wknd ? WKEND_TIME_ERROR : COMMIT_TIME_ERROR}
                      </p>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => update(i, { blocks: [...c.blocks, emptyCommitBlock()] })}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal px-3 py-2 text-sm font-semibold text-teal transition hover:bg-teal/5"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {wknd ? "Add another weekend day/time block" : "Add another day/time block"}
                </button>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {wknd
                    ? "Add a separate block when Saturday and Sunday have different hours. For example, Saturday 8:00 AM\u20131:00 PM and Sunday 5:00 PM\u20139:00 PM. If both days share the same hours, select \u201cSaturday and Sunday\u201d in one block."
                    : "Add a separate block only when different days have different hours. For example, Monday and Wednesday 4:00 PM\u20137:00 PM, and Saturday 9:00 AM\u20131:00 PM."}
                </p>
              </div>
            ) : null}

            {wknd && (c.scheduleType === S_VAR || c.scheduleType === S_TBD) ? (
              <div className="min-w-0">
                <span className={COMMIT_LABEL_CLS}>
                  {c.scheduleType === S_VAR
                    ? "Which weekend days may be affected?*"
                    : "Which weekend days could potentially be affected?*"}
                </span>
                <div className="flex flex-wrap gap-2">
                  {[WKEND_SAT, WKEND_SUN].map((d) => {
                    const on = c.weekendDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          update(i, {
                            weekendDays: on
                              ? c.weekendDays.filter((x) => x !== d)
                              : [...c.weekendDays, d],
                          })
                        }
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          on
                            ? "border-teal bg-teal/10 text-teal"
                            : "border-border text-muted-foreground hover:border-teal"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {c.scheduleType === S_VAR ? (
              <label className="block min-w-0">
                <span className={COMMIT_LABEL_CLS}>
                  {wknd
                    ? "Please describe the typical weekend schedule, the times that may be affected, the frequency of the commitment, and how frequently the schedule changes.*"
                    : "Please describe the typical schedule and how frequently it changes.*"}
                </span>
                <AutoTextarea
                  value={c.varies}
                  ariaLabel={`${noun} ${i + 1} varying schedule description`}
                  placeholder={wknd ? WKEND_VARIES_PLACEHOLDER : COMMIT_VARIES_PLACEHOLDER}
                  onChange={(varies) => update(i, { varies })}
                />
              </label>
            ) : null}

            {c.scheduleType === S_TBD ? (
              <label className="block min-w-0">
                <span className={COMMIT_LABEL_CLS}>
                  {wknd
                    ? "Please explain when the weekend schedule is expected to become available and what you currently know.*"
                    : "Please explain when the schedule is expected to become available and what you currently know.*"}
                </span>
                <AutoTextarea
                  value={c.tbd}
                  ariaLabel={`${noun} ${i + 1} pending schedule explanation`}
                  placeholder={
                    wknd
                      ? WKEND_TBD_PLACEHOLDER
                      : "Example: My work schedule is posted two weeks in advance."
                  }
                  onChange={(tbd) => update(i, { tbd })}
                />
              </label>
            ) : null}

            {jobLike ? (
              <label className="block min-w-0">
                <span className={COMMIT_LABEL_CLS}>
                  What do you plan to do with this job or internship if selected by Elev8?*
                </span>
                <select
                  value={c.jobPlan}
                  onChange={(e) => update(i, { jobPlan: e.currentTarget.value })}
                  className={cellCls()}
                >
                  <option value="">Select one</option>
                  {JOB_PLAN_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block min-w-0">
              <span className={COMMIT_LABEL_CLS}>
                {wknd
                  ? "How would you manage this commitment alongside Elev8\u2019s weekend scheduling requirements?*"
                  : "How will you manage this commitment alongside Elev8\u2019s scheduling requirements?*"}
              </span>
              <AutoTextarea
                value={c.manage}
                ariaLabel={`${noun} ${i + 1} management plan`}
                placeholder={wknd ? WKEND_MANAGE_PLACEHOLDER : COMMIT_MANAGE_PLACEHOLDER}
                onChange={(manage) => update(i, { manage })}
              />
            </label>

            {issues.length ? (
              <div className="space-y-1">
                {issues.map((m) => (
                  <p key={m} className="text-sm font-medium text-accent">
                    {m}
                  </p>
                ))}
              </div>
            ) : null}

            {/* The first commitment stays while the main answer remains "Yes". */}
            {i > 0 ? (
              <button
                type="button"
                onClick={() => write(list.filter((_, idx) => idx !== i))}
                className="inline-flex items-center gap-2 rounded-lg border border-accent/60 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/5"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {wknd ? "Remove this weekend commitment" : "Remove this commitment"}
              </button>
            ) : null}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => write([...list, emptyCommitment()])}
        className="inline-flex items-center gap-2 rounded-lg border border-teal px-3 py-2 text-sm font-semibold text-teal transition hover:bg-teal/5"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        {wknd ? "Add another weekend commitment" : "Add another regular commitment"}
      </button>
    </div>
  );
}

function ClassesField({
  f,
  values,
  error,
  set,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  set: (key: string, value: FieldValue) => void;
}) {
  const none = bool(values, "classes_none");
  const stored = classList(values, f.key);
  const entries = none ? [] : stored.length ? stored : [emptyClass()];
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const classKeys = useRef<string[]>([]);
  const nextClassKey = useRef(0);
  while (classKeys.current.length < entries.length) {
    classKeys.current.push(`class-card-${nextClassKey.current++}`);
  }

  const update = (i: number, patch: Partial<ClassEntry>) =>
    set(
      f.key,
      entries.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );

  const hasEnteredClassInformation = (c: ClassEntry) =>
    Boolean(
      c.name.trim() ||
        c.term ||
        c.days.length ||
        c.startTime ||
        c.endTime ||
        c.status ||
        c.start ||
        c.end ||
        c.examDates.length ||
        c.finalExam ||
        c.explain.trim(),
    );

  const removeClass = (i: number) => {
    classKeys.current.splice(i, 1);
    if (entries.length === 1) {
      set("classes_none", true);
      set(f.key, []);
      return;
    }
    set(
      f.key,
      entries.filter((_, idx) => idx !== i),
    );
  };

  const requestRemove = (i: number) => {
    if (hasEnteredClassInformation(entries[i] ?? emptyClass())) {
      setRemoveIndex(i);
      return;
    }
    removeClass(i);
  };

  const addClass = () => {
    classKeys.current.push(`class-card-${nextClassKey.current++}`);
    set(f.key, [...entries, emptyClass()]);
  };

  const cells = (c: ClassEntry, i: number) => {
    const bad = !!classComparisonIssue(c);
    const n = i + 1;
    return [
      <input
        key="name"
        value={c.name}
        onChange={(e) => update(i, { name: e.currentTarget.value })}
        placeholder="Biology 101"
        aria-label={`Class ${n} course or class name`}
        className={cellCls()}
      />,
      <select
        key="term"
        value={c.term}
        onChange={(e) => update(i, { term: e.currentTarget.value })}
        aria-label={`Class ${n} academic term`}
        className={cellCls()}
      >
        <option value="">Select term</option>
        {CLASS_TERMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>,
      <ClassDaysPicker
        key="days"
        value={c.days}
        onChange={(days) => update(i, { days })}
        label={`Class ${n} class days`}
      />,
       <TimeSelect
        key="st"
        value={c.startTime}
        invalid={bad}
        placeholder="Start"
        label={`Class ${n} start time`}
        onChange={(startTime) => update(i, { startTime })}
      />,
      <div key="et">
        <TimeSelect
          value={c.endTime}
          invalid={bad}
          placeholder="End"
          label={`Class ${n} end time`}
          onChange={(endTime) => update(i, { endTime })}
        />
      </div>,
      <select
        key="status"
        value={c.status}
        onChange={(e) => update(i, { status: e.currentTarget.value })}
        aria-label={`Class ${n} current status`}
        className={cellCls()}
      >
        <option value="">Select status</option>
        {CLASS_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>,
      <input
        key="cs"
        type="date"
        value={c.start}
        onChange={(e) => update(i, { start: e.currentTarget.value })}
        aria-label={`Class ${n} start date`}
        className={cellCls(bad)}
      />,
      <input
        key="ce"
        type="date"
        value={c.end}
        onChange={(e) => update(i, { end: e.currentTarget.value })}
        aria-label={`Class ${n} end date`}
        className={cellCls(bad)}
      />,
      <ExamDatesPicker
        key="ex"
        c={c}
        invalid={bad}
        onChange={(patch) => update(i, patch)}
      />,
      <div key="fe">
        <input
          type="date"
          value={c.finalUnknown ? "" : c.finalExam}
          disabled={c.finalUnknown}
          onChange={(e) => update(i, { finalExam: e.currentTarget.value })}
          aria-label={`Class ${n} final-exam date`}
          className={cellCls(bad, c.finalUnknown)}
        />
      </div>,
    ];
  };

  const rowExtras = (c: ClassEntry, i: number) => {
    const issues = error ? classIssues(c) : classComparisonIssue(c) ? [classComparisonIssue(c) as string] : [];
    return (
      <>
        {CLASS_EXPLAIN_STATUSES.includes(c.status) ? (
          <ClassExplain
            c={c}
            invalid={false}
            onChange={(text) => update(i, { explain: text })}
          />
        ) : null}
        {issues.length ? (
          <div className="mt-2 space-y-1" role="alert">
            {issues.map((issue) => (
              <p key={issue} className="text-sm font-medium text-accent">
                Class {i + 1} — {issue}
              </p>
            ))}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div
      className="box-border w-full max-w-full space-y-4"
      data-field={f.key}
    >
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">
          {f.label}
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        </p>
        {f.help ? (
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {f.help}
          </p>
        ) : null}
      </div>

      {none ? (
        <div className="rounded-xl border border-border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            You confirmed that you have no current or upcoming classes for this
            academic term.
          </p>
          <button
            type="button"
            onClick={() => {
              set("classes_none", false);
              set(f.key, [emptyClass()]);
            }}
            className="btn-ghost-navy mt-3 px-4 py-2 text-sm"
          >
            Add a class
          </button>
        </div>
      ) : (
        <>
          {/* Wide screens: two compact rows per class, contained by the form. */}
          <div className="hidden lg:block">
            <div className="space-y-5">
              {entries.map((c, i) => {
                const nodes = cells(c, i);
                const topFields = [0, 1, 5, 6, 7];
                const bottomFields = [2, 3, 4, 8, 9];
                return (
                <div key={classKeys.current[i]}>
                  <p className="mb-2 text-sm font-bold text-primary">Class {i + 1}</p>
                  <div className="box-border w-full max-w-full overflow-visible rounded-lg border border-border bg-muted/30 p-3" data-class-card={i + 1}>
                  <div
                    className="grid items-start gap-3"
                    style={{ gridTemplateColumns: CLASS_TOP_GRID }}
                  >
                    {topFields.map((idx) => (
                      <div key={CLASS_COLUMNS[idx]} className="min-w-0">
                        <p className="mb-1.5 text-[11px] font-bold uppercase leading-tight text-muted-foreground">
                          {CLASS_COLUMNS[idx]}
                        </p>
                        {nodes[idx]}
                      </div>
                    ))}
                  </div>
                  <div
                    className="mt-3 grid items-start gap-3 border-t border-border/70 pt-3"
                    style={{ gridTemplateColumns: CLASS_BOTTOM_GRID }}
                  >
                    {bottomFields.map((idx) => (
                      <div key={CLASS_COLUMNS[idx]} className="min-w-0">
                        <p className="mb-1.5 text-[11px] font-bold uppercase leading-tight text-muted-foreground">
                          {CLASS_COLUMNS[idx]}
                        </p>
                        {nodes[idx]}
                        {idx === 8 ? (
                          <div className="mt-2">
                            <MiniCheck
                              checked={c.examUnknown}
                              onChange={(on) =>
                                update(i, on ? { examUnknown: true, examDates: [] } : { examUnknown: false })
                              }
                              label="Exam dates not yet known"
                            />
                          </div>
                        ) : null}
                        {idx === 9 ? (
                          <div className="mt-2">
                            <MiniCheck
                              checked={c.finalUnknown}
                              onChange={(on) =>
                                update(i, on ? { finalUnknown: true, finalExam: "" } : { finalUnknown: false })
                              }
                              label="Final-exam date not yet known"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {rowExtras(c, i)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" onClick={addClass} className="bg-teal text-teal-foreground hover:bg-teal/90">
                      <Plus aria-hidden="true" />
                      Add another class
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => requestRemove(i)}
                      className="border-destructive/40 bg-background text-destructive hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
                    >
                      Remove class
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Tablet & mobile: one compact card per class with no horizontal overflow. */}
          <div className="space-y-4 lg:hidden">
            {entries.map((c, i) => {
              const nodes = cells(c, i);
              const mobileFields = [0, 1, 5, 6, 7, 2, 3, 4, 8, 9];
              return (
                <div key={classKeys.current[i]} className="rounded-xl border border-border p-3 sm:p-4" data-class-card={i + 1}>
                  <p className="text-sm font-bold text-primary">Class {i + 1}</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3">
                    {mobileFields.map((idx) => (
                      <div
                        key={CLASS_COLUMNS[idx]}
                        className={
                          "min-w-0 " +
                          (idx === 0 || idx === 1 || idx === 2 || idx === 5 || idx === 8 || idx === 9
                            ? "col-span-2"
                            : "")
                        }
                      >
                        <p className="text-[11px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
                          {CLASS_COLUMNS[idx]}
                        </p>
                        <div className="mt-1">{nodes[idx]}</div>
                        {idx === 8 ? (
                          <div className="mt-1.5">
                            <MiniCheck
                              checked={c.examUnknown}
                              onChange={(on) =>
                                update(i, on ? { examUnknown: true, examDates: [] } : { examUnknown: false })
                              }
                              label="Exam dates not yet known"
                            />
                          </div>
                        ) : null}
                        {idx === 9 ? (
                          <div className="mt-1.5">
                            <MiniCheck
                              checked={c.finalUnknown}
                              onChange={(on) =>
                                update(i, on ? { finalUnknown: true, finalExam: "" } : { finalUnknown: false })
                              }
                              label="Final-exam date not yet known"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {rowExtras(c, i)}
                   <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                     <Button type="button" size="sm" onClick={addClass} className="bg-teal text-teal-foreground hover:bg-teal/90">
                       <Plus aria-hidden="true" />
                       Add another class
                     </Button>
                     <Button
                       type="button"
                       size="sm"
                       variant="outline"
                       onClick={() => requestRemove(i)}
                       className="border-destructive/40 bg-background text-destructive hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
                     >
                       Remove class
                     </Button>
                   </div>
                </div>
              );
            })}
          </div>

        </>
      )}

      {removeIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/45 p-4" role="dialog" aria-modal="true" aria-labelledby="remove-class-title">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <p id="remove-class-title" className="text-lg font-bold text-primary">Remove this class?</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The information entered for this class will be deleted.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setRemoveIndex(null)}>
                Keep Class
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const index = removeIndex;
                  setRemoveIndex(null);
                  removeClass(index);
                }}
              >
                Remove Class
              </Button>
          </div>
        </div>
        </div>
      ) : null}

      {error && (entries.length === 0 || none) ? (
        <p id={`${f.key}-error`} className="text-sm font-medium text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MultiSelectField({
  f,
  values,
  error,
  set,
  toggleChoice,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  set: (key: string, value: FieldValue) => void;
  toggleChoice: (f: FieldDef) => (choice: string, checked: boolean) => void;
}) {
  const id = f.key;
  const required = isRequired(f, values);
  const selected = arr(values, f.key);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const exclusive = (c: string) =>
    c === "Not available" || c === NOT_AVAILABLE || c === NOT_EMPLOYED;

  const filteredOptions = (f.options ?? []).filter((opt) =>
    query.trim()
      ? opt.toLowerCase().includes(query.toLowerCase())
      : true,
  );

  const removeTag = (choice: string) => {
    toggleChoice(f)(choice, false);
  };

  const placeholder = f.placeholder ?? "Select an option";

  return (
    <Field id={id} label={f.label} help={f.help} required={required} error={error}>
      <div className="relative" ref={containerRef} data-field={id}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={inputClass(error) + " flex items-center justify-between gap-2 text-left"}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, !!f.help)}
        >
          <span className={"min-w-0 flex-1 truncate " + (selected.length === 0 ? "text-muted-foreground" : "")}>
            {selected.length === 0 ? placeholder : `${selected.length} selected`}
          </span>
          <ChevronDown
            className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")}
          />
        </button>

        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-primary/60 hover:text-primary"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {open && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
            <div className="border-b border-border p-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <ul
              ref={listRef}
              role="listbox"
              aria-multiselectable="true"
              className="max-h-56 overflow-auto py-1"
            >
              {filteredOptions.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
              )}
              {filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                const isDisabled =
                  !isChecked &&
                  selected.some((s) => exclusive(s)) &&
                  !exclusive(opt);
                return (
                  <li key={opt} role="option" aria-selected={isChecked}>
                    <label
                      className={
                        "flex cursor-pointer items-start gap-2.5 px-3 py-3 text-sm sm:py-2 hover:bg-muted/60 " +
                        (isDisabled ? "pointer-events-none opacity-40" : "")
                      }
                    >
                      <span
                        className={
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border " +
                          (isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background")
                        }
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={(e) => toggleChoice(f)(opt, e.currentTarget.checked)}
                      />
                      <span className="min-w-0 break-words">{opt}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
}

function OptionInfo({ info }: { info: { title: string; body: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        aria-label={`More information: ${info.title}`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-teal transition hover:bg-teal/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-0 top-7 z-30 w-64 max-w-[78vw] rounded-lg border border-border bg-card p-3 shadow-lg"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-primary">{info.title}</span>
            <button
              type="button"
              aria-label="Close"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }}
              className="-mr-1 -mt-1 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
            {info.body}
          </span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * Certification document upload. Files go straight into the private
 * certifications bucket; nothing is ever exposed through a public URL.
 */
function CertUploadField({
  f,
  values,
  error,
  required,
  set,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  required: boolean;
  set: (key: string, value: string) => void;
}) {
  const id = f.key;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const current = parseCertFile(str(values, f.key));

  useEffect(() => {
    if (!current) setPreview(null);
  }, [current]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateCertFile(file);
    if (invalid) {
      setLocalError(invalid);
      return;
    }
    setLocalError(null);
    setBusy(true);
    try {
      const attemptId = getOrCreateApplicationAttempt();
      const ref = await uploadCertificationFile(file, attemptId, f.key);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
      set(f.key, JSON.stringify(ref));
    } catch {
      setLocalError("That file could not be uploaded. Please check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Field
      id={id}
      label={f.label}
      help={f.help ?? CERT_UPLOAD_HELP}
      required={required}
      error={error ?? localError ?? undefined}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={CERT_ACCEPT}
        capture={undefined}
        onChange={(e) => void handleFile(e.currentTarget.files?.[0])}
        className={`${inputClass(error ?? localError ?? undefined)} file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground`}
        aria-invalid={error || localError ? true : undefined}
        aria-describedby={describedBy(id, error ?? localError ?? undefined, true)}
        disabled={busy}
      />
      <p className="text-sm text-muted-foreground">
        Accepted files: JPG, PNG, HEIC, or PDF, up to 10 MB. On a phone you can take a photo
        or choose an existing file.
      </p>
      {busy ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
      {current ? (
        <div className="mt-2 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center">
          {preview ? (
            <img
              src={preview}
              alt={`Preview of ${current.name}`}
              className="h-20 w-20 rounded-md object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{current.name}</p>
            <p className="text-sm text-muted-foreground">Uploaded securely</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-background"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setLocalError(null);
                set(f.key, "");
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </Field>
  );
}

/**
 * Class-schedule upload. Accepts one or more images/PDFs (including a photo
 * taken on a phone), stores them in the private certifications bucket, and
 * never exposes a public URL. Files persist with the saved draft, so moving
 * between steps or refreshing keeps them attached.
 */
function ScheduleUploadField({
  f,
  values,
  error,
  required,
  set,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  required: boolean;
  set: (key: string, value: string) => void;
}) {
  const id = f.key;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const files = parseFileList(str(values, f.key));

  const handleFiles = async (picked: FileList | null, replaceIndex?: number) => {
    const list = picked ? Array.from(picked) : [];
    if (!list.length) return;
    for (const file of list) {
      const invalid = validateCertFile(file);
      if (invalid) {
        setLocalError(invalid);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }
    setLocalError(null);
    setBusy(true);
    try {
      const attemptId = getOrCreateApplicationAttempt();
      const uploaded: CertFileRef[] = [];
      for (const file of list) {
        uploaded.push(await uploadCertificationFile(file, attemptId, f.key));
      }
      const next =
        typeof replaceIndex === "number"
          ? files.map((existing, i) => (i === replaceIndex ? uploaded[0]! : existing))
          : [...files, ...uploaded];
      set(f.key, JSON.stringify(next));
    } catch {
      setLocalError(
        "That file could not be uploaded. Please check your connection and try again.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setLocalError(null);
    set(f.key, next.length ? JSON.stringify(next) : "");
  };

  return (
    <>
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-primary">
          {f.label}
          {required ? (
            <span className="ml-1 text-accent" aria-hidden="true">
              *
            </span>
          ) : null}
        </h3>
        {f.help ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {f.help}
          </p>
        ) : null}
      </div>
      <Field
      id={id}
      label="Upload class schedule"
      required={required}
      error={error ?? localError ?? undefined}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={CERT_ACCEPT}
        onChange={(e) => void handleFiles(e.currentTarget.files)}
        className={`${inputClass(error ?? localError ?? undefined)} file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground`}
        aria-invalid={error || localError ? true : undefined}
        aria-describedby={describedBy(id, error ?? localError ?? undefined, true)}
        disabled={busy}
      />
      <p className="text-sm text-muted-foreground">
        Accepted files: JPG, PNG, HEIC, or PDF, up to 10 MB each. You can add more than one
        page or screenshot. On a phone you can take a photo or choose an existing file.
      </p>
      {busy ? <p className="text-sm text-muted-foreground">Uploading\u2026</p> : null}
      {files.length ? (
        <ul className="mt-2 space-y-2">
          {files.map((file, i) => (
            <li
              key={file.path}
              className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">Uploaded securely</p>
              </div>
              <div className="flex gap-2">
                <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-background">
                  Replace
                  <input
                    type="file"
                    accept={CERT_ACCEPT}
                    className="hidden"
                    onChange={(e) => void handleFiles(e.currentTarget.files, i)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      </Field>
    </>
  );
}

const DAY_ABBR: Record<string, string> = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
};

const OVERNIGHT_SPANS: Record<string, string> = {
  Monday: "10 PM \u2192 Tue 8 AM",
  Tuesday: "10 PM \u2192 Wed 8 AM",
  Wednesday: "10 PM \u2192 Thu 8 AM",
  Thursday: "10 PM \u2192 Fri 8 AM",
  Friday: "10 PM \u2192 Sat 8 AM",
  Saturday: "10 PM \u2192 Sun 8 AM",
  Sunday: "10 PM \u2192 Mon 8 AM",
};

/** Diagonal slash overlay — lucide has no *-off variant for moon or clock. */
function SlashedIcon({
  Icon,
  className,
}: {
  Icon: LucideIcon;
  className?: string;
}) {
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <Icon className={className} strokeWidth={2} />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={`absolute inset-0 ${className ?? ""}`}
      >
        <line x1="3" y1="21" x2="21" y2="3" />
      </svg>
    </span>
  );
}

type AvailabilityConfig = {
  /** Time window shown in the heading and inside every weekday tile. */
  window: string;
  /** Tailwind text color class for the accent time text. */
  accent: string;
  tileTime: (day: string) => string;
  DayIcon: LucideIcon;
  NoneIcon: LucideIcon;
  noneHelp: string;
  /** Short label for the "none" tile (defaults to "Not available"). */
  noneLabel?: string;
  /** Status-line text when the "none" tile is selected. */
  noneSelected?: string;
  tileWidth: string;
};

const AVAILABILITY_CONFIG: Record<string, AvailabilityConfig> = {
  overnight_availability: {
    window: "10:00 PM\u20138:00 AM",
    accent: "text-shift-purple",
    tileTime: (day) => OVERNIGHT_SPANS[day] ?? "",
    DayIcon: Moon,
    NoneIcon: Moon,
    noneHelp: "I am not available for any overnight shifts.",
    tileWidth: "w-[118px]",
  },
  early_morning_availability: {
    window: "7:00 AM\u201311:30 AM",
    accent: "text-shift-gold",
    tileTime: () => "7:00\u201311:30 AM",
    DayIcon: CalendarDays,
    NoneIcon: CalendarDays,
    noneHelp: "I am not available during this time.",
    tileWidth: "w-[118px]",
  },
  mid_afternoon_availability: {
    window: "11:30 AM\u20132:30 PM",
    accent: "text-shift-orange",
    tileTime: () => "11:30 AM\u20132:30 PM",
    DayIcon: CalendarDays,
    NoneIcon: CalendarDays,
    noneHelp: "I am not available during this time.",
    tileWidth: "w-[132px]",
  },
  weekday_evening_availability: {
    window: "2:15 PM\u201310:00 PM",
    accent: "text-shift-teal",
    tileTime: () => "2:15\u201310:00 PM",
    DayIcon: Clock,
    NoneIcon: Clock,
    noneHelp: "I am not regularly available during this shift period.",
    noneLabel: "Not regularly available",
    noneSelected: "Selected: Not regularly available during this shift period",
    tileWidth: "w-[118px]",
  },
};

function AvailabilityField({
  f,
  values,
  error,
  required,
  set,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  required: boolean;
  set: (key: string, value: string[]) => void;
}) {
  const cfg = AVAILABILITY_CONFIG[f.key] as AvailabilityConfig;
  // The mutually exclusive "none" option is the one option that is not a day
  // of the week (its wording differs per section).
  const noneOption =
    (f.options ?? []).find((o) => !(o in DAY_ABBR)) ?? NOT_AVAILABLE;
  const days = (f.options ?? []).filter((o) => o !== noneOption);
  const selected = arr(values, f.key);
  const notAvailable = selected.includes(noneOption);
  const selectedDays = selected.filter((c) => c !== noneOption);

  const toggleDay = (day: string) => {
    const base = selectedDays;
    const next = base.includes(day)
      ? base.filter((c) => c !== day)
      : days.filter((d) => [...base, day].includes(d));
    set(f.key, next);
  };

  const legend = (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{f.label}</span>
      <span
        className={`rounded-md border border-border bg-secondary px-2 py-0.5 text-sm font-bold tracking-tight ${cfg.accent}`}
      >
        {cfg.window}
      </span>
    </span>
  );

  return (
    <Fieldset id={f.key} legend={legend} help={f.help} required={required} error={error}>
      <div
        role="group"
        aria-label={`${f.label} ${cfg.window}`}
        className="w-full max-w-full overflow-x-hidden pb-1 pt-1"
      >
        <div
          className={`grid w-full max-w-full min-w-0 items-stretch gap-0.5 md:flex md:gap-1.5 ${
            days.length > 5 ? "grid-cols-8" : "grid-cols-6"
          }`}
        >
          {days.map((day) => {
            const active = !notAvailable && selectedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={`${day}, ${cfg.tileTime(day)}`}
                onClick={() => toggleDay(day)}
                className={`relative flex min-h-[72px] w-full min-w-0 max-w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border px-0.5 py-1.5 text-center shadow-sm transition md:min-h-[96px] md:min-w-[78px] md:flex-1 md:basis-0 md:rounded-lg md:px-1.5 md:py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
                  active
                    ? "border-teal bg-teal/10"
                    : "border-border bg-card hover:border-teal/50 hover:bg-teal/5"
                }`}
              >
                {active ? (
                  <span className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-teal md:right-1 md:top-1 md:h-4 md:w-4">
                    <Check className="h-2 w-2 text-white md:h-3 md:w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                ) : null}
                <cfg.DayIcon
                  className="h-2.5 w-2.5 text-muted-foreground md:h-3.5 md:w-3.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span className="whitespace-normal text-[10px] font-bold tracking-wide text-primary md:text-xs">
                  {DAY_ABBR[day] ?? day}
                </span>
                <span className={`whitespace-normal break-words text-[9px] font-bold leading-tight md:text-[13px] ${cfg.accent}`}>
                  {cfg.tileTime(day)}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={notAvailable}
            onClick={() => set(f.key, notAvailable ? [] : [noneOption])}
            className={`relative flex min-h-[72px] w-full min-w-0 max-w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border px-0.5 py-1.5 text-center shadow-sm transition md:min-h-[96px] md:min-w-[78px] md:flex-1 md:basis-0 md:rounded-lg md:px-1.5 md:py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
              notAvailable
                ? "border-accent bg-accent/10"
                : "border-border bg-card hover:border-accent/50 hover:bg-accent/5"
            }`}
          >
            {notAvailable ? (
              <span className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-accent md:right-1 md:top-1 md:h-4 md:w-4">
                <Check className="h-2 w-2 text-white md:h-3 md:w-3" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : null}
            <SlashedIcon
              Icon={cfg.NoneIcon}
              className={`h-2.5 w-2.5 md:h-3.5 md:w-3.5 ${notAvailable ? "text-accent" : "text-muted-foreground"}`}
            />
            <span
              className={`whitespace-normal break-words text-[9px] font-bold leading-tight md:text-xs ${
                notAvailable ? "text-accent" : "text-primary"
              }`}
            >
              {cfg.noneLabel ?? "Not available"}
            </span>
            <span className="hidden text-[11px] leading-tight text-muted-foreground md:block">
              {cfg.noneHelp}
            </span>
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {notAvailable
          ? (cfg.noneSelected ??
            `Selected: Not available${f.key === "overnight_availability" ? " for overnight shifts" : " during this time"}`)
          : selectedDays.length
            ? `Selected: ${selectedDays.join(", ")}`
            : "No response selected"}
      </p>
    </Fieldset>
  );
}

const ONBOARDING_WINDOW = "2:00 PM\u201310:00 PM";
/** Non-breaking time range: may wrap only at the en dash on tiny screens. */
const ONBOARDING_TIME = "2:00\u00A0PM\u201310:00\u00A0PM";

/**
 * First-three-weeks onboarding availability selector: five weekday tiles in a
 * single row, with the disqualifying "cannot meet" option rendered separately
 * as a full-width outlined choice beneath them.
 */
function OnboardingAvailabilityField({
  f,
  values,
  error,
  required,
  set,
}: {
  f: FieldDef;
  values: Values;
  error?: string | undefined;
  required: boolean;
  set: (key: string, value: string[]) => void;
}) {
  const days = (f.options ?? []).filter((o) => o in DAY_ABBR);
  const selected = arr(values, f.key);
  const cannotMeet = selected.includes(ONBOARDING_CANNOT);
  const selectedDays = selected.filter((c) => c !== ONBOARDING_CANNOT);

  const toggleDay = (day: string) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((c) => c !== day)
      : days.filter((d) => [...selectedDays, day].includes(d));
    set(f.key, next);
  };

  return (
    <Fieldset
      id={f.key}
      legend={
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Initial onboarding availability</span>
          <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-sm font-bold tracking-tight text-shift-teal">
            {ONBOARDING_WINDOW}
          </span>
        </span>
      }
      required={required}
      error={error}
    >
      <p className="text-sm font-semibold text-primary">
        {f.label}
        {required ? (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        ) : null}
      </p>
      {f.help ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{f.help}</p>
      ) : null}
      <div
        role="group"
        aria-label={`${f.label} ${ONBOARDING_WINDOW}`}
        className="w-full max-w-full overflow-x-hidden pb-1 pt-1"
      >
        <div className="grid w-full max-w-full min-w-0 grid-cols-5 items-stretch gap-1 md:gap-1.5">
          {days.map((day) => {
            const active = !cannotMeet && selectedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={`${day}, ${ONBOARDING_WINDOW}`}
                onClick={() => toggleDay(day)}
                className={`relative flex min-h-[72px] w-full min-w-0 max-w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border px-0.5 py-1.5 text-center shadow-sm transition md:min-h-[88px] md:rounded-lg md:px-1.5 md:py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
                  active
                    ? "border-teal bg-teal/10"
                    : "border-border bg-card hover:border-teal/50 hover:bg-teal/5"
                }`}
              >
                {active ? (
                  <span className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-teal md:right-1 md:top-1 md:h-4 md:w-4">
                    <Check className="h-2 w-2 text-white md:h-3 md:w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                ) : null}
                <span className="text-[10px] font-bold tracking-wide text-primary md:text-xs">
                  {DAY_ABBR[day] ?? day}
                </span>
                <span className="flex items-center justify-center gap-0.5 md:gap-1">
                  <Clock
                    className="h-2 w-2 shrink-0 text-muted-foreground md:h-3 md:w-3"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="whitespace-normal break-words text-[8px] font-bold leading-tight text-shift-teal min-[375px]:text-[9px] md:whitespace-nowrap md:text-[11px]">
                    {ONBOARDING_TIME}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-pressed={cannotMeet}
          onClick={() => set(f.key, cannotMeet ? [] : [ONBOARDING_CANNOT])}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-center text-xs font-bold leading-tight shadow-sm transition md:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
            cannotMeet
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-card text-primary hover:border-accent/50 hover:bg-accent/5"
          }`}
        >
          {cannotMeet ? (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden="true" />
            </span>
          ) : null}
          <TriangleAlert
            className={`h-3.5 w-3.5 shrink-0 ${cannotMeet ? "text-accent" : "text-muted-foreground"}`}
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{ONBOARDING_CANNOT}</span>
        </button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {cannotMeet
          ? "Selected: I cannot meet this initial onboarding requirement."
          : selectedDays.length
            ? `Selected: ${selectedDays.join(", ")}`
            : "No response selected"}
      </p>
    </Fieldset>
  );
}

function FieldRenderer({
  field: f,
  values,
  error,
  set,
  toggleChoice,
}: {
  field: FieldDef;
  values: Values;
  error?: string | undefined;
  set: (key: string, value: FieldValue) => void;
  toggleChoice: (f: FieldDef) => (choice: string, checked: boolean) => void;
}) {
  const required = isRequired(f, values);
  const id = f.key;

  if (f.type === "certupload") {
    return (
      <CertUploadField
        f={f}
        values={values}
        error={error}
        required={required}
        set={(key, value) => set(key, value)}
      />
    );
  }

  if (f.type === "scheduleupload") {
    return (
      <ScheduleUploadField
        f={f}
        values={values}
        error={error}
        required={required}
        set={(key, value) => set(key, value)}
      />
    );
  }

  if (f.type === "timeoff") {
    return (
      <TimeOffField
        f={f}
        values={values}
        error={error}
        set={(key, value) => set(key, value)}
      />
    );
  }

  if (f.type === "classes") {
    return (
      <ClassesField
        f={f}
        values={values}
        error={error}
        set={(key, value) => set(key, value)}
      />
    );
  }

  if (f.type === "history") {
    return (
      <HistoryField
        f={f}
        values={values}
        error={error}
        set={(key, value) => set(key, value)}
      />
    );
  }

  if (f.type === "commitments") {
    return (
      <CommitmentsField
        f={f}
        values={values}
        error={error}
        set={(key, value) => set(key, value)}
      />
    );
  }

  if (f.type === "multiselect") {
    return (
      <MultiSelectField
        f={f}
        values={values}
        error={error}
        set={set}
        toggleChoice={toggleChoice}
      />
    );
  }


  if (f.type === "ack") {
    return (
      <div className="space-y-3" data-field={id}>
        {f.custom === "weekend" ? <WeekendCard /> : null}

        {f.policy ? (
          <div className="rounded-lg border border-border bg-muted/60 p-4">

            <p className="text-sm font-semibold text-primary">{f.label}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {f.policy}
            </p>
          </div>
        ) : null}
        <label
          className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-3.5 text-sm leading-relaxed break-words sm:py-2.5 ${
            error ? "border-accent" : "border-border"
          }`}
        >
          <input
            id={id}
            type="checkbox"
            checked={values[id] === true}
            onChange={(e) => set(id, e.currentTarget.checked)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--teal)]"
          />
          <span className="min-w-0 break-words text-foreground">
            {f.help ?? f.label}
            {required ? (
              <span className="ml-1 text-accent" aria-hidden="true">
                *
              </span>
            ) : null}
          </span>
        </label>
        {error ? (
          <p id={`${id}-error`} className="text-sm font-medium text-accent">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (f.type === "cards") {
    const selected = str(values, f.key);
    return (
      <Fieldset id={id} legend={f.label} help={f.help} required={required} error={error}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(f.cards ?? []).map((c) => {
            const Icon = c.icon;
            const on = selected === c.value;
            return (
              <label
                key={c.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition focus-within:ring-2 focus-within:ring-teal/30 ${
                  on
                    ? "border-teal bg-teal/5"
                    : error
                      ? "border-accent"
                      : "border-border hover:border-teal/60"
                }`}
              >
                <input
                  type="radio"
                  name={id}
                  value={c.value}
                  checked={on}
                  onChange={() => set(f.key, c.value)}
                  aria-invalid={error ? true : undefined}
                  className="mt-1 h-5 w-5 shrink-0 accent-[color:var(--teal)]"
                />
                {Icon ? (
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="mt-0.5 h-5 w-5 shrink-0 text-teal"
                  />
                ) : null}
                <span className="min-w-0 space-y-1 break-words">
                  <span className="block text-sm font-semibold text-primary">
                    {c.value}
                  </span>
                  <span className="block text-sm leading-relaxed text-muted-foreground">
                    {c.desc}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </Fieldset>
    );
  }


  if (f.type === "onboarding") {
    return (
      <OnboardingAvailabilityField
        f={f}
        values={values}
        error={error}
        required={required}
        set={(key, value) => set(key, value)}
      />
    );
  }

  if (f.type === "availability") {
    return (
      <AvailabilityField
        f={f}
        values={values}
        error={error}
        required={required}
        set={(key, value) => set(key, value)}
      />
    );
  }

  if (f.type === "info") {
    return (
      <div
        className="rounded-xl border border-teal/30 bg-teal/5 p-4 sm:p-5"
        data-field={id}
        role="note"
      >
        <p className="text-sm font-bold text-primary">{f.label}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.note}</p>
      </div>
    );
  }

  if (f.type === "radio" || f.type === "checkboxes") {
    const selected = f.type === "radio" ? str(values, f.key) : arr(values, f.key);
    return (
      <div className="space-y-4" data-field={id}>
        {f.custom === "holiday" ? <HolidayCard /> : null}
        {f.custom === "breaks" ? <BreaksCard /> : null}
        {f.custom === "pay" ? <PayCard /> : null}
        {f.custom === "smsConsent" ? <SmsConsentCard /> : null}
        <Fieldset id={id} legend={f.label} help={f.help} required={required} error={error}>
        {(f.options ?? []).map((opt) => {
          const info = f.optionInfo?.[opt];
          return (
            <Choice
              key={opt}
              type={f.type === "radio" ? "radio" : "checkbox"}
              name={id}
              value={opt}
              invalid={!!error}
              checked={
                f.type === "radio"
                  ? selected === opt
                  : (selected as string[]).includes(opt)
              }
              onChange={
                f.type === "radio"
                  ? (value) => set(f.key, value)
                  : toggleChoice(f)
              }
            >
              <span className="inline">{opt}</span>
              {info ? <OptionInfo info={info} /> : null}
            </Choice>
          );
        })}
      </Fieldset>
      </div>
    );
  }

  if (f.type === "select") {
    return (
      <div className="space-y-4" data-field={id}>
        {f.custom === "holiday" ? <HolidayCard /> : null}
        {f.custom === "breaks" ? <BreaksCard /> : null}
        {f.custom === "pay" ? <PayCard /> : null}
        {f.custom === "commitmentsIntro" ? <CommitmentIntroPanel /> : null}
        <Field id={id} label={f.label} help={f.help} required={required} error={error}>
          <select
            id={id}
            value={str(values, f.key)}
            onChange={(e) => set(f.key, e.currentTarget.value)}
            className={inputClass(error)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, error, !!f.help)}
          >
            <option value="">{f.placeholder ?? "Select an option"}</option>
            {(f.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <FieldNote f={f} values={values} />
        </Field>
      </div>
    );
  }


  if (f.type === "textarea") {
    const written = str(values, f.key).trim().length;
    return (
      <Field id={id} label={f.label} help={f.help} required={required} error={error}>
        <textarea
          id={id}
          rows={4}
          value={str(values, f.key)}
          onChange={(e) => set(f.key, e.currentTarget.value)}
          placeholder={f.placeholder}
          className={inputClass(error)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, !!f.help)}
        />
        {f.minChars ? (
          <p
            className={`text-xs ${written >= f.minChars ? "text-muted-foreground" : "text-accent"}`}
            aria-live="polite"
          >
            {written >= f.minChars
              ? `${written} characters`
              : `${written} of ${f.minChars} characters minimum`}
          </p>
        ) : null}
        <FieldNote f={f} values={values} />
      </Field>
    );

  }


  if (f.type === "file") {
    const name = str(values, f.key);
    return (
      <Field
        id={id}
        label={f.label}
        help={f.help ?? "File uploads are not stored yet; our team will request documents if needed."}
        required={required}
        error={error}
      >
        <input
          id={id}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => set(f.key, e.currentTarget.files?.[0]?.name ?? "")}
          className={`${inputClass(error)} file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, true)}
        />
        {name ? (
          <p className="text-sm text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{name}</span> (not
            uploaded)
          </p>
        ) : null}
      </Field>
    );
  }

  if (f.type === "number") {
    const altOn =
      (f.altKey ? bool(values, f.altKey) : false) || (f.disabledIf?.(values) ?? false);
    return (
      <Field id={id} label={f.label} help={f.help} required={required} error={error}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder={f.placeholder}
          value={altOn ? "" : str(values, f.key)}
          disabled={altOn}
          onChange={(e) => {
            // Letters and negative signs are never accepted; a typed value
            // automatically clears the "not determined" alternative.
            const raw = limitDecimals(e.currentTarget.value, f.decimals ?? 0);
            if (f.altKey && raw) set(f.altKey, false);
            set(f.key, raw);
          }}
          className={`${inputClass(error)}${altOn ? " cursor-not-allowed opacity-60" : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, !!f.help)}
        />
        {f.altKey && f.altLabel ? (
          <AltCheckbox
            id={`${id}-alt`}
            label={f.altLabel}
            checked={altOn}
            onChange={(checked) => {
              if (checked) set(f.key, "");
              set(f.altKey as string, checked);
            }}
          />
        ) : null}
        <FieldNote f={f} values={values} />
      </Field>
    );
  }

  const textAltOn = f.altKey ? bool(values, f.altKey) : false;
  return (
    <Field id={id} label={f.label} help={f.help} required={required} error={error}>
      <input
        id={id}
        type={f.type === "email" ? "email" : f.type === "date" ? "date" : "text"}
        inputMode={f.type === "phone" ? "tel" : undefined}
        autoComplete={
          f.key === "first_name"
            ? "given-name"
            : f.key === "last_name"
              ? "family-name"
              : f.type === "email"
                ? "email"
                : f.type === "phone"
                  ? "tel"
                  : undefined
        }
        placeholder={f.type === "phone" ? "(619) 555-0142" : f.placeholder}
        value={textAltOn ? "" : str(values, f.key)}
        disabled={textAltOn}
        onChange={(e) => {
          const raw =
            f.type === "phone" ? formatPhone(e.currentTarget.value) : e.currentTarget.value;
          if (f.altKey && raw.trim()) set(f.altKey, false);
          set(f.key, raw);
        }}
        className={`${inputClass(error)}${textAltOn ? " cursor-not-allowed opacity-60" : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, !!f.help)}
      />
      {f.altKey && f.altLabel ? (
        <AltCheckbox
          id={`${id}-alt`}
          label={f.altLabel}
          checked={textAltOn}
          onChange={(checked) => {
            if (checked) set(f.key, "");
            set(f.altKey as string, checked);
          }}
        />
      ) : null}
      <FieldNote f={f} values={values} />
    </Field>
  );
}

/**
 * "None of these apply" alternative rendered beneath a text or numeric field.
 * Selecting it clears and disables the input and completes the question.
 */
function AltCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-foreground"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input text-primary"
      />
      <span>{label}</span>
    </label>
  );
}

