/**
 * Interview #1 actions shown inside View Progress, directly under the
 * candidate's current step. Mirrors the Screening pattern:
 *
 *  - Staff never type a candidate's name, date, or time into a message. They
 *    pick days, times, a facility, and a deadline, and the approved wording is
 *    generated, always ending in the shared team signoff.
 *  - Nothing can be sent, confirmed, booked, or recorded while its inputs are
 *    incomplete, and the reason is always shown rather than silently disabled.
 *  - Parsed availability is a suggestion only: it stays editable and needs an
 *    explicit human confirmation before it is recorded.
 *  - Interview times are scheduled on the board, never re-typed by hand.
 */
import { useMemo, useRef, useState } from "react";
import {
  ADVANCEMENT_CALL_REMINDERS,
  ADVANCEMENT_CALL_SCRIPT,
  CONFIRM_BY_DEFAULT,
  CONFIRM_BY_HOURS,
  FOLLOWUP_DEADLINE_HOURS,
  INTERVIEW_FACILITIES,
  INTERVIEW_TIME_OPTIONS,
  INTERVIEW2_MATERIALS_VIDEOS,
  INTERVIEW2_TIME_OPTIONS,
  INTERVIEW1_TEMPLATE_LABELS,
  MAX_REQUESTED_SLOTS,
  buildInterview1Template,
  buildInterview2AvailabilityMessage,
  buildInterview2MaterialsMessage,
  facilityByName,
  formatDateShort,
  formatTime12,
  milestoneLabel,
  milestoneOrdinal,
  normalizeMilestone,
  sortInterviewDays,
  MILESTONES,
  type InterviewDay,
  type InterviewFacilityKey,
  type Interview1TemplateKey,
} from "@/lib/ats-workflow";
import { parseInterviewReply, sortSlots, type OfferedSlot } from "@/lib/interview-reply-parser";
import type { ApplicantDetail, ConfirmedSlotRow } from "@/lib/ats.functions";
import { ScheduleBoard, type BookInput } from "@/components/ats/ScheduleBoard";

export type InterviewActions = {
  completeAndAdvance: (input: {
    milestone: string;
    nextAction?: string;
    dueAt?: string;
    staffId?: string | null;
  }) => Promise<unknown>;
  setMilestone: (input: {
    milestone: string;
    nextAction?: string;
    overrideReason?: string;
    closedOtherReason?: string;
  }) => Promise<unknown>;
  recordCommunication: (input: {
    type: string;
    milestone?: string;
    template?: string;
    message?: string;
    privateNote?: string;
  }) => Promise<unknown>;
  saveSlotOffer: (input: {
    kind: "interview_1" | "interview_2";
    selectionsRequested: number;
    slots: { date: string; time: string }[];
  }) => Promise<unknown>;
  saveConfirmedSlots: (input: {
    kind: "interview_1";
    slots: { date: string; time: string }[];
  }) => Promise<unknown>;
  bookSlot: (input: {
    applicationId: string;
    date: string;
    time: string;
    facility: string;
    confirmBy: string;
  }) => Promise<unknown>;
  unbookSlot: (input: { applicationId: string }) => Promise<unknown>;
  /** Deliberate Admin/HR move into Interview #2, recorded in the activity history. */
  advanceToInterview2: () => Promise<unknown>;
  /** Every candidate's confirmed availability, for the board. */
  boardRows: ConfirmedSlotRow[];
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
      {children}
    </span>
  );
}

function inputClass() {
  return "mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30";
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-solid w-fit px-5 py-2 text-sm disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Secondary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-fit rounded-full border border-teal px-5 py-2 text-sm font-semibold text-primary disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Advancement call — a live conversation, so the card is a reference script with
 * three recorded outcomes and deliberately no date, time, or slot input.
 */
function AdvancementCallCard({
  busy,
  recorded,
  onConfirm,
  onWantsTime,
  onCouldNotReach,
}: {
  busy: boolean;
  recorded: string | null;
  onConfirm: () => void;
  onWantsTime: () => void;
  onCouldNotReach: () => void;
}) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-primary">Advancement call</h4>
          <span className="rounded-full border border-teal bg-teal/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Phone call — not a text message
          </span>
        </div>
        <p className="text-xs text-status-neutral">
          This is a live conversation. The script below is a reference guide to follow on the call —
          there&rsquo;s nothing here to copy and send.
        </p>
      </div>

      <div className="flex flex-col">
        {ADVANCEMENT_CALL_SCRIPT.map((section) => {
          const isOpen = openSection === section.title;
          return (
            <div key={section.title} className="border-t border-border/70">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenSection(isOpen ? null : section.title)}
                className="flex w-full items-center gap-2 py-2 text-left text-sm font-semibold text-primary"
              >
                <span aria-hidden className="text-xs text-status-neutral">
                  {isOpen ? "▾" : "▸"}
                </span>
                {section.title}
              </button>
              {isOpen ? (
                <div className="flex flex-col gap-2 pb-3">
                  {section.lines.map((line, i) =>
                    line.kind === "note" ? (
                      <p
                        key={i}
                        className="rounded-lg border border-border bg-background p-2 text-xs font-semibold text-status-neutral"
                      >
                        Note: {line.text}
                      </p>
                    ) : (
                      <p key={i} className="text-sm text-foreground">
                        <span className="font-semibold text-teal">{line.speaker}:</span>{" "}
                        {line.text}
                      </p>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-review-needs/60 bg-review-needs/10 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-review-needs">
          Reminders for this call
        </p>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
          {ADVANCEMENT_CALL_REMINDERS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <Label>Record the outcome of this call</Label>
        <Primary disabled={busy} onClick={onConfirm}>
          Confirmed — proceeding to Interview #2
        </Primary>
        <Secondary disabled={busy} onClick={onWantsTime}>
          Wants time to think
        </Secondary>
        <Secondary disabled={busy} onClick={onCouldNotReach}>
          Could not reach — will try again
        </Secondary>
        {recorded ? (
          <p className="text-sm font-semibold text-review-needs" role="status">
            {recorded}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Copy button with a short "Copied" flash, used on every message card. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <>
      <Secondary
        onClick={() => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopied(false), 1200);
            } catch {
              setCopied(false);
            }
          })();
        }}
      >
        Copy Message
      </Secondary>
      {copied ? (
        <span className="text-xs font-semibold text-status-neutral" role="status">
          Copied
        </span>
      ) : null}
    </>
  );
}

function MessageBody({
  templateKey,
  message,
  label,
  preview,
}: {
  templateKey?: Interview1TemplateKey;
  message: string;
  label?: string;
  preview?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Label>Message that will be sent</Label>
        <span className="rounded-full border border-teal bg-teal/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          {label ?? (templateKey ? INTERVIEW1_TEMPLATE_LABELS[templateKey] : "Approved message")}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-line rounded-lg border border-border bg-background p-3 text-sm text-foreground">
        {preview ?? message}
      </p>
      <p className="mt-1 text-xs text-status-neutral">
        The wording is generated and cannot be edited. Copy it and send it to the candidate, then
        record it here.
      </p>
    </div>
  );
}

function Interview2MaterialsPreview({ message }: { message: string }) {
  const videoNames = new Set<string>(INTERVIEW2_MATERIALS_VIDEOS.map((video) => video.name));
  const lines = message.split("\n");

  return lines.map((line, index) => {
    const match = line.match(/^\d+\. ([^:]+): (https:\/\/\S+)$/);
    const name = match?.[1];
    return (
      <span key={`${index}-${line}`}>
        {name && videoNames.has(name) ? (
          <>
            {line.slice(0, line.indexOf(name))}
            <strong>{name}</strong>
            {line.slice(line.indexOf(name) + name.length)}
          </>
        ) : (
          line
        )}
        {index < lines.length - 1 ? "\n" : null}
      </span>
    );
  });
}

function Interview2MaterialsCard({
  applicantName,
  busy,
  onSend,
}: {
  applicantName: string;
  busy: boolean;
  onSend: (message: string) => void;
}) {
  const message = buildInterview2MaterialsMessage(applicantName);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-primary">Send Interview #2 materials</p>
      <MessageBody
        label="Interview #2 materials"
        message={message}
        preview={<Interview2MaterialsPreview message={message} />}
      />
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={message} />
        <Primary disabled={busy} onClick={() => onSend(message)}>
          {busy ? "Saving…" : "Record as Sent"}
        </Primary>
      </div>
    </div>
  );
}

/**
 * Interview #2 availability request. Times are picked from 7:00 AM – 8:00 PM
 * dropdowns (one row per offered time), and the message carries no commute or
 * facility block — this step is purely about scheduling.
 */
function Interview2AvailabilityCard({
  applicantName,
  busy,
  onSend,
}: {
  applicantName: string;
  busy: boolean;
  onSend: (input: {
    message: string;
    days: InterviewDay[];
    choicesRequested: number;
    deadline: string;
  }) => void;
}) {
  const [days, setDays] = useState<InterviewDay[]>([{ date: "", times: [""] }]);
  const [choicesRequested, setChoicesRequested] = useState(1);
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cleaned = days.map((d) => ({
    date: d.date,
    times: [...new Set(d.times.filter((t) => t))],
  }));
  const ordered = sortInterviewDays(cleaned);
  const earliest = ordered[0]?.date ?? null;
  const offeredCount = ordered.reduce((sum, d) => sum + d.times.length, 0);

  const message = useMemo(
    () =>
      buildInterview2AvailabilityMessage({
        applicantName,
        days: ordered,
        choicesRequested,
        deadlineDate: deadline || null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applicantName, JSON.stringify(ordered), choicesRequested, deadline],
  );

  const today = todayIso();
  const pastDay = days.find((d) => d.date && d.date < today)?.date ?? null;

  const blockedReason = (() => {
    if (pastDay)
      return `You cannot offer a day before today (${formatDateShort(today)}) — remove or correct the past date.`;
    if (ordered.length === 0)
      return "Pick a date and at least one time on at least one day before this can be sent.";
    if (choicesRequested > offeredCount)
      return `You are asking the candidate to rank ${choicesRequested} choice${choicesRequested === 1 ? "" : "s"} but only ${offeredCount} time${offeredCount === 1 ? " is" : "s are"} offered — offer more times or lower the number requested.`;
    if (!deadline) return "A response deadline is required.";
    if (earliest && deadline > earliest)
      return `The response deadline (${formatDateShort(deadline)}) is after the earliest offered day (${formatDateShort(earliest)}) — move the deadline earlier.`;
    return null;
  })();

  const setDay = (index: number, next: InterviewDay) =>
    setDays((prev) => prev.map((d, i) => (i === index ? next : d)));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-primary">Offer Interview #2 times</p>

      {days.map((day, index) => (
        <div key={index} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="text-xs font-semibold text-primary">
              <Label>Day {index + 1}</Label>
              <input
                type="date"
                min={todayIso()}
                value={day.date}
                onChange={(e) => setDay(index, { ...day, date: e.currentTarget.value })}
                className={inputClass()}
              />
            </label>
            {days.length > 1 ? (
              <button
                type="button"
                onClick={() => setDays((prev) => prev.filter((_, i) => i !== index))}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-status-neutral"
              >
                Remove day
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex flex-col gap-2">
            {day.times.map((time, timeIndex) => (
              <div key={timeIndex} className="flex flex-wrap items-end gap-2">
                <label className="min-w-[10rem] flex-1 text-xs font-semibold text-primary">
                  <Label>Time {timeIndex + 1}</Label>
                  <select
                    value={time}
                    onChange={(e) =>
                      setDay(index, {
                        ...day,
                        times: day.times.map((t, i) =>
                          i === timeIndex ? e.currentTarget.value : t,
                        ),
                      })
                    }
                    className={inputClass()}
                  >
                    <option value="">Select a time</option>
                    {INTERVIEW2_TIME_OPTIONS.map((option) => {
                      const taken =
                        option !== time &&
                        day.times.some((t, i) => i !== timeIndex && t === option);
                      return (
                        <option key={option} value={option} disabled={taken}>
                          {formatTime12(option)}
                          {taken ? " (already selected)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {day.times.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDay(index, {
                        ...day,
                        times: day.times.filter((_, i) => i !== timeIndex),
                      })
                    }
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-status-neutral"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDay(index, { ...day, times: [...day.times, ""] })}
              className="w-fit text-xs font-semibold text-teal underline underline-offset-4"
            >
              + Add another time
            </button>
          </div>
        </div>
      ))}

      <Secondary onClick={() => setDays((prev) => [...prev, { date: "", times: [""] }])}>
        Add another day
      </Secondary>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-primary">
          <Label>Choices requested</Label>
          <select
            value={choicesRequested}
            onChange={(e) => setChoicesRequested(Number(e.currentTarget.value))}
            className={inputClass()}
          >
            {Array.from({ length: MAX_REQUESTED_SLOTS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary">
          <Label>Response deadline</Label>
          <input
            type="date"
            min={todayIso()}
            value={deadline}
            onChange={(e) => setDeadline(e.currentTarget.value)}
            className={inputClass()}
          />
        </label>
      </div>

      <MessageBody label="Interview #2 availability request" message={message} />

      {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
      {blockedReason ? (
        <p className="text-xs font-semibold text-review-needs">{blockedReason}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={message} />
        <Primary
          disabled={busy || !!blockedReason}
          onClick={() => {
            if (blockedReason) return setError(blockedReason);
            setError(null);
            onSend({ message, days: ordered, choicesRequested, deadline });
          }}
        >
          {busy ? "Saving…" : "Record as Sent"}
        </Primary>
      </div>
    </div>
  );
}



/** Step 1 — the availability request: days, times, how many slots, a deadline. */
function AvailabilityRequestCard({
  applicantName,
  busy,
  onSend,
}: {
  applicantName: string;
  busy: boolean;
  onSend: (input: {
    message: string;
    days: InterviewDay[];
    requiredSlots: number;
    deadline: string;
  }) => void;
}) {
  const [days, setDays] = useState<InterviewDay[]>([{ date: "", times: [] }]);
  const [requiredSlots, setRequiredSlots] = useState(3);
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ordered = sortInterviewDays(days);
  const earliest = ordered[0]?.date ?? null;

  const message = useMemo(
    () =>
      buildInterview1Template("i1_availability_request", {
        applicantName,
        days: ordered,
        requiredSlots,
        deadlineDate: deadline || null,
      }),
    [applicantName, ordered, requiredSlots, deadline],
  );

  const offeredCount = ordered.reduce((sum, d) => sum + d.times.length, 0);

  const blockedReason = (() => {
    if (ordered.length === 0) return "Pick a date and at least one time on at least one day.";
    if (requiredSlots > offeredCount)
      return `You are asking the candidate to pick ${requiredSlots} time${requiredSlots === 1 ? "" : "s"} but only ${offeredCount} ${offeredCount === 1 ? "is" : "are"} offered — offer more times or lower the number requested.`;
    if (!deadline) return "A response deadline is required.";
    if (earliest && deadline > earliest)
      return `The response deadline (${formatDateShort(deadline)}) is after the earliest offered day (${formatDateShort(earliest)}) — move the deadline earlier.`;
    return null;
  })();


  const setDay = (index: number, next: InterviewDay) =>
    setDays((prev) => prev.map((d, i) => (i === index ? next : d)));

  const toggleTime = (index: number, time: string) =>
    setDays((prev) =>
      prev.map((d, i) =>
        i === index
          ? {
              ...d,
              times: d.times.includes(time)
                ? d.times.filter((t) => t !== time)
                : [...d.times, time],
            }
          : d,
      ),
    );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-primary">Offer interview times</p>

      {days.map((day, index) => (
        <div key={index} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="text-xs font-semibold text-primary">
              <Label>Day {index + 1}</Label>
              <input
                type="date"
                min={todayIso()}
                value={day.date}
                onChange={(e) => setDay(index, { ...day, date: e.currentTarget.value })}
                className={inputClass()}
              />
            </label>
            {days.length > 1 ? (
              <button
                type="button"
                onClick={() => setDays((prev) => prev.filter((_, i) => i !== index))}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-status-neutral"
              >
                Remove day
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERVIEW_TIME_OPTIONS.map((time) => {
              const on = day.times.includes(time);
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => toggleTime(index, time)}
                  aria-pressed={on}
                  className={
                    on
                      ? "rounded-full border border-teal bg-teal/15 px-3 py-1 text-xs font-semibold text-primary"
                      : "rounded-full border border-border px-3 py-1 text-xs font-semibold text-status-neutral"
                  }
                >
                  {formatTime12(time)}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <Secondary onClick={() => setDays((prev) => [...prev, { date: "", times: [] }])}>
        Add another day
      </Secondary>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-primary">
          <Label>Slots the candidate must pick</Label>
          <select
            value={requiredSlots}
            onChange={(e) => setRequiredSlots(Number(e.currentTarget.value))}
            className={inputClass()}
          >
            {Array.from({ length: MAX_REQUESTED_SLOTS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary">
          <Label>Response deadline</Label>
          <input
            type="date"
            min={todayIso()}
            value={deadline}
            onChange={(e) => setDeadline(e.currentTarget.value)}
            className={inputClass()}
          />
        </label>
      </div>

      <MessageBody templateKey="i1_availability_request" message={message} />

      {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
      {blockedReason ? (
        <p className="text-xs font-semibold text-review-needs">{blockedReason}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={message} />
        <Primary
          disabled={busy || !!blockedReason}
          onClick={() => {
            if (blockedReason) return setError(blockedReason);
            setError(null);
            onSend({ message, days: ordered, requiredSlots, deadline });
          }}
        >
          {busy ? "Saving…" : "Record as Sent"}
        </Primary>
      </div>
    </div>
  );
}

/** The nonresponse follow-up: its own date plus an hourly deadline time. */
function NonresponseCard({
  applicantName,
  busy,
  onSend,
}: {
  applicantName: string;
  busy: boolean;
  onSend: (input: { message: string }) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const message = buildInterview1Template("i1_nonresponse_followup", {
    applicantName,
    deadlineDate: date || null,
    deadlineTime: time || null,
  });

  const blockedReason = !date
    ? "A response deadline date is required."
    : !time
      ? "A deadline time is required."
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-primary">Nonresponse follow-up</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-primary">
          <Label>Deadline date</Label>
          <input
            type="date"
            min={todayIso()}
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
            className={inputClass()}
          />
        </label>
        <label className="text-xs font-semibold text-primary">
          <Label>Deadline time</Label>
          <select
            value={time}
            onChange={(e) => setTime(e.currentTarget.value)}
            className={inputClass()}
          >
            <option value="">Pick a time</option>
            {FOLLOWUP_DEADLINE_HOURS.map((h) => (
              <option key={h} value={h}>
                {formatTime12(h)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MessageBody templateKey="i1_nonresponse_followup" message={message} />
      {blockedReason ? (
        <p className="text-xs font-semibold text-review-needs">{blockedReason}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={message} />
        <Primary disabled={busy || !!blockedReason} onClick={() => onSend({ message })}>
          {busy ? "Saving…" : "Record as Sent"}
        </Primary>
      </div>
    </div>
  );
}

/** Step 2 — paste the reply, review the suggested matches, confirm. */
function AvailabilityReceivedCard({
  applicantName,
  offered,
  requiredSlots,
  checked,
  onCheckedChange,
  busy,
  onConfirm,
}: {
  applicantName: string;
  offered: OfferedSlot[];
  requiredSlots: number;
  checked: OfferedSlot[];
  onCheckedChange: (next: OfferedSlot[]) => void;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [reply, setReply] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsedOnce, setParsedOnce] = useState(false);

  const keyOf = (slot: OfferedSlot) => `${slot.date}|${slot.time}`;
  const checkedKeys = new Set(checked.map(keyOf));

  const parse = () => {
    if (!reply.trim()) return; // no-op: nothing pasted
    const result = parseInterviewReply(reply, offered);
    const merged = sortSlots([
      ...checked,
      ...result.matched.filter((m) => !checkedKeys.has(keyOf(m))),
    ]);
    onCheckedChange(merged);
    setWarnings(result.warnings);
    setParsedOnce(true);
    setReply("");
  };

  const toggle = (slot: OfferedSlot) => {
    const key = keyOf(slot);
    onCheckedChange(
      checkedKeys.has(key) ? checked.filter((c) => keyOf(c) !== key) : sortSlots([...checked, slot]),
    );
  };

  const reminder = buildInterview1Template("i1_availability_reminder", {
    applicantName,
    requiredSlots,
    identified: checked.length,
  });

  const byDate = new Map<string, string[]>();
  offered.forEach((slot) => {
    const list = byDate.get(slot.date) ?? [];
    list.push(slot.time);
    byDate.set(slot.date, list);
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-primary">
        Times offered to this candidate — check what they confirmed
      </p>

      <div className="flex flex-col gap-2">
        {[...byDate.entries()]
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([date, times]) => (
            <div key={date} className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold text-primary">{formatDateShort(date)}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {[...times].sort().map((time) => (
                  <label
                    key={time}
                    className="flex items-center gap-2 text-xs font-semibold text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={checkedKeys.has(`${date}|${time}`)}
                      onChange={() => toggle({ date, time })}
                      className="size-4 accent-teal"
                    />
                    {formatTime12(time)}
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>

      <label className="text-xs font-semibold text-primary">
        <Label>Paste the candidate&rsquo;s reply</Label>
        <textarea
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.currentTarget.value)}
          className={inputClass()}
          placeholder="e.g. September 17 at 3:20pm works, or Friday any time"
        />
      </label>
      <Secondary onClick={parse}>Parse response</Secondary>
      <p className="text-xs text-status-neutral">
        Parsing only suggests matches. Every box stays editable, and matches from more than one
        paste add up.
      </p>

      {warnings.map((w) => (
        <p key={w} className="text-xs font-semibold text-review-needs">
          {w}
        </p>
      ))}
      {parsedOnce && checked.length === 0 ? (
        <p className="text-xs font-semibold text-review-needs">
          Nothing in that reply matched the offered times — check the boxes by hand.
        </p>
      ) : null}

      {checked.length > 0 && checked.length < requiredSlots ? (
        <div className="rounded-lg border border-review-needs p-3">
          <p className="text-sm font-semibold text-review-needs">
            Only {checked.length} of {requiredSlots} requested slots identified so far.
          </p>
          <p className="mt-2 whitespace-pre-line rounded-lg border border-border bg-background p-3 text-sm text-foreground">
            {reminder}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CopyButton text={reminder} />
          </div>
        </div>
      ) : null}

      {checked.length === 0 ? (
        <p className="text-xs font-semibold text-review-needs">
          Check at least one confirmed time before recording.
        </p>
      ) : null}
      <Primary disabled={busy || checked.length === 0} onClick={onConfirm}>
        {busy ? "Saving…" : "Confirm and record"}
      </Primary>
    </div>
  );
}

/** Step 4 — the confirmation message, built from the booked slot. */
function FinalizeMessageCard({
  applicantName,
  date,
  time,
  initialFacility,
  busy,
  title,
  actionLabel,
  onSend,
}: {
  applicantName: string;
  date: string;
  time: string;
  initialFacility: InterviewFacilityKey;
  busy: boolean;
  title: string;
  actionLabel: string;
  onSend: (input: { message: string; facility: string; confirmBy: string }) => void;
}) {
  const [facility, setFacility] = useState<InterviewFacilityKey>(initialFacility);
  const [confirmBy, setConfirmBy] = useState(CONFIRM_BY_DEFAULT);

  const message = buildInterview1Template("i1_finalize", {
    applicantName,
    date,
    time,
    facility,
    confirmBy,
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-primary">{title}</p>
      <p className="text-sm text-primary">
        Scheduled for{" "}
        <span className="font-semibold">
          {formatDateShort(date)}, {formatTime12(time)}
        </span>{" "}
        — carried over from the schedule board.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-primary">
          <Label>Facility</Label>
          <select
            value={facility}
            onChange={(e) => setFacility(e.currentTarget.value as InterviewFacilityKey)}
            className={inputClass()}
          >
            {INTERVIEW_FACILITIES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary">
          <Label>Confirm by</Label>
          <select
            value={confirmBy}
            onChange={(e) => setConfirmBy(e.currentTarget.value)}
            className={inputClass()}
          >
            {CONFIRM_BY_HOURS.map((h) => (
              <option key={h} value={h}>
                {formatTime12(h)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MessageBody templateKey="i1_finalize" message={message} />
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={message} />
        <Primary
          disabled={busy}
          onClick={() =>
            onSend({
              message,
              facility:
                INTERVIEW_FACILITIES.find((f) => f.key === facility)?.name ??
                INTERVIEW_FACILITIES[0]?.name ??
                "Neuro Care",
              confirmBy,
            })
          }
        >
          {busy ? "Saving…" : actionLabel}
        </Primary>
      </div>
    </div>
  );
}

export function InterviewStepActions({
  data,
  actions,
}: {
  data: ApplicantDetail;
  actions: InterviewActions;
}) {
  const current = normalizeMilestone(data.milestone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<null | "nonresponse" | "resend" | "sentMessage">(null);
  const [callOutcome, setCallOutcome] = useState<string | null>(null);
  const [checked, setChecked] = useState<OfferedSlot[]>(
    data.confirmedSlots.filter((s) => s.kind === "interview_1").map((s) => ({
      date: s.date,
      time: s.time,
    })),
  );

  const offer = data.slotOffers.find((o) => o.kind === "interview_1") ?? null;
  const offered: OfferedSlot[] = offer?.slots ?? [];
  const requiredSlots = offer?.selectionsRequested ?? 1;
  const booking = data.bookings.find((b) => b.kind === "interview_1") ?? null;
  const sentFinalize = [...data.communications]
    .filter((c) => c.template === "i1_finalize")
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))[0];
  const resent = data.communications.some(
    (c) => c.template === "i1_finalize" && c.milestone === "i1_confirmation_received",
  );

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const previous = useMemo(() => {
    const index = milestoneOrdinal(current);
    if (index <= 0) return null;
    const prior = MILESTONES[index - 1];
    return prior && prior.status !== "not_selected" ? prior : null;
  }, [current]);

  const closeNoResponse = () =>
    run(() =>
      actions.setMilestone({
        milestone: "closed_no_response",
        nextAction: "No further action — closed for no response.",
      }),
    );

  const onBook = (input: BookInput) =>
    run(async () => {
      await actions.bookSlot({
        applicationId: input.applicationId,
        date: input.date,
        time: input.time,
        facility: input.facility,
        confirmBy: input.confirmBy,
      });
      if (input.isCurrentRecord) {
        await actions.completeAndAdvance({
          milestone: "i1_interview_confirmed",
          nextAction: "Send the interview confirmation message.",
        });
      }
    });

  const onUnbook = (input: { applicationId: string; isCurrentRecord: boolean }) =>
    run(async () => {
      await actions.unbookSlot({ applicationId: input.applicationId });
      if (input.isCurrentRecord) {
        await actions.setMilestone({
          milestone: "i1_interview_scheduled",
          nextAction: "Book an interview slot on the schedule board.",
        });
      }
    });

  return (
    <div className="mt-3 flex flex-col gap-3">
      {current === "i1_availability_requested" ? (
        <AvailabilityRequestCard
          applicantName={data.name}
          busy={busy}
          onSend={({ message, days, requiredSlots: required }) =>
            void run(async () => {
              await actions.saveSlotOffer({
                kind: "interview_1",
                selectionsRequested: required,
                slots: days.flatMap((d) => d.times.map((t) => ({ date: d.date, time: t }))),
              });
              await actions.recordCommunication({
                type: "text_sent",
                milestone: "i1_availability_requested",
                template: "i1_availability_request",
                message,
              });
              await actions.completeAndAdvance({
                milestone: "i1_availability_received",
                nextAction: "Record the availability the candidate confirmed.",
              });
            })
          }
        />
      ) : null}

      {current === "i1_availability_received" ? (
        <div className="flex flex-col gap-3">
          {offered.length === 0 ? (
            <p className="text-sm text-primary">
              No offered times on file yet. Go back a step and send the availability request first.
            </p>
          ) : (
            <AvailabilityReceivedCard
              applicantName={data.name}
              offered={offered}
              requiredSlots={requiredSlots}
              checked={checked}
              onCheckedChange={setChecked}
              busy={busy}
              onConfirm={() =>
                void run(async () => {
                  await actions.saveConfirmedSlots({ kind: "interview_1", slots: checked });
                  await actions.recordCommunication({
                    type: "applicant_responded",
                    milestone: "i1_availability_received",
                    privateNote: `Confirmed availability recorded: ${checked
                      .map((s) => `${formatDateShort(s.date)} ${formatTime12(s.time)}`)
                      .join("; ")}.`,
                  });
                  await actions.completeAndAdvance({
                    milestone: "i1_interview_scheduled",
                    nextAction: "Book an interview slot on the schedule board.",
                  });
                })
              }
            />
          )}

          <Secondary
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await actions.saveConfirmedSlots({ kind: "interview_1", slots: [] });
                setChecked([]);
                await actions.recordCommunication({
                  type: "reschedule_requested",
                  milestone: "i1_availability_received",
                  privateNote: "Candidate asked for different days or times — offering again.",
                });
                await actions.setMilestone({
                  milestone: "i1_availability_requested",
                  nextAction: "Offer a new set of interview times.",
                });
              })
            }
          >
            Requested a different day/time
          </Secondary>
          <Secondary
            disabled={busy}
            onClick={() => setOpen(open === "nonresponse" ? null : "nonresponse")}
          >
            Send Nonresponse Follow-up
          </Secondary>
          {open === "nonresponse" ? (
            <NonresponseCard
              applicantName={data.name}
              busy={busy}
              onSend={({ message }) =>
                void run(() =>
                  actions.recordCommunication({
                    type: "text_sent",
                    milestone: "i1_availability_received",
                    template: "i1_nonresponse_followup",
                    message,
                  }),
                )
              }
            />
          ) : null}
          <Secondary disabled={busy} onClick={() => void closeNoResponse()}>
            No response after deadline — close application
          </Secondary>
        </div>
      ) : null}

      {current === "i1_interview_scheduled" ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-bold text-primary">Schedule Interviews</p>
          <ScheduleBoard
            rows={actions.boardRows}
            currentApplicationId={data.id}
            busy={busy}
            onBook={onBook}
            onUnbook={onUnbook}
          />
        </div>
      ) : null}

      {current === "i1_interview_confirmed" ? (
        booking ? (
          <FinalizeMessageCard
            applicantName={data.name}
            date={booking.date}
            time={booking.time}
            initialFacility={facilityByName(booking.facility)?.key ?? "neuro_care"}
            busy={busy}
            title="Confirm the interview"
            actionLabel="Record as Sent"
            onSend={({ message, facility, confirmBy }) =>
              void run(async () => {
                await actions.bookSlot({
                  applicationId: data.id,
                  date: booking.date,
                  time: booking.time,
                  facility,
                  confirmBy,
                });
                await actions.recordCommunication({
                  type: "confirmation_requested",
                  milestone: "i1_interview_confirmed",
                  template: "i1_finalize",
                  message,
                });
                await actions.completeAndAdvance({
                  milestone: "i1_confirmation_received",
                  nextAction: "Record whether the candidate confirmed.",
                });
              })
            }
          />
        ) : (
          <p className="text-sm text-primary">
            No booked slot on file yet. Go back a step and book a slot on the schedule board first.
          </p>
        )
      ) : null}

      {current === "i1_confirmation_received" ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-bold text-primary">Did the candidate confirm?</p>
          {booking ? (
            <p className="text-sm text-primary">
              <span className="font-semibold">
                {formatDateShort(booking.date)}, {formatTime12(booking.time)}
              </span>{" "}
              — {booking.facility}
              {booking.confirmBy
                ? ` · Confirm by ${formatTime12(booking.confirmBy)} on the day of the interview`
                : ""}
            </p>
          ) : null}
          {sentFinalize ? (
            <div>
              <Secondary onClick={() => setOpen(open === "sentMessage" ? null : "sentMessage")}>
                {open === "sentMessage" ? "Hide the message that was sent" : "View the message that was sent"}
              </Secondary>
              {open === "sentMessage" ? (
                <p className="mt-2 whitespace-pre-line rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                  {sentFinalize.message}
                </p>
              ) : null}
            </div>
          ) : null}
          {resent ? (
            <p className="text-sm font-semibold text-review-needs">
              Message resent — still waiting on their reply.
            </p>
          ) : null}

          <Primary
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await actions.recordCommunication({
                  type: "confirmation_received",
                  milestone: "i1_confirmation_received",
                  privateNote: "Candidate confirmed they are attending.",
                });
                await actions.completeAndAdvance({
                  milestone: "i1_interview_completed",
                  nextAction: "Hold the interview, then record the outcome.",
                });
              })
            }
          >
            Confirmed — attending
          </Primary>

          <Secondary disabled={busy} onClick={() => setOpen(open === "resend" ? null : "resend")}>
            No response yet — resend the message
          </Secondary>
          {open === "resend" && booking ? (
            <FinalizeMessageCard
              applicantName={data.name}
              date={booking.date}
              time={booking.time}
              initialFacility={facilityByName(booking.facility)?.key ?? "neuro_care"}
              busy={busy}
              title="Resend the confirmation message"
              actionLabel="Record as resent"
              onSend={({ message }) =>
                void run(() =>
                  actions.recordCommunication({
                    type: "confirmation_requested",
                    milestone: "i1_confirmation_received",
                    template: "i1_finalize",
                    message,
                    privateNote: "Confirmation message resent — still awaiting a reply.",
                  }),
                )
              }
            />
          ) : null}

          <Secondary
            disabled={busy}
            onClick={() =>
              void run(() =>
                actions.setMilestone({
                  milestone: "closed_no_response",
                  nextAction:
                    "No further action — no confirmation received, appointment offered to the waitlist.",
                }),
              )
            }
          >
            No confirmation received by deadline — offer to waitlist
          </Secondary>
        </div>
      ) : null}

      {current === "i1_interview_completed" ? (
        <Primary
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await actions.recordCommunication({
                type: "call_completed",
                milestone: "i1_interview_completed",
                privateNote: "Interview #1 held.",
              });
              await actions.completeAndAdvance({
                milestone: "i1_decision_recorded",
                nextAction: "Record the Interview #1 decision.",
              });
            })
          }
        >
          Interview completed
        </Primary>
      ) : null}

      {current === "i1_decision_recorded" ? (
        <div className="flex flex-col gap-3">
          <Primary
            disabled={busy}
            onClick={() =>
              void run(() =>
                actions.setMilestone({
                  milestone: "i1_advancement_call",
                  nextAction: "Hold the advancement call with the applicant.",
                }),
              )
            }
          >
            Advance — hold the advancement call
          </Primary>
          <Secondary
            disabled={busy}
            onClick={() =>
              void run(() =>
                actions.setMilestone({
                  milestone: "closed_interview1_outcome",
                  nextAction: "No further action — closed after Interview #1.",
                }),
              )
            }
          >
            Do Not Move Forward
          </Secondary>
        </div>
      ) : null}

      {current === "i1_advancement_call" ? (
        <AdvancementCallCard
          busy={busy}
          recorded={callOutcome}
          onConfirm={() =>
            void run(async () => {
              setCallOutcome(null);
              await actions.recordCommunication({
                type: "call_completed",
                milestone: "i1_advancement_call",
                privateNote:
                  "Advancement call held — applicant confirmed they are proceeding to Interview #2.",
              });
              await actions.advanceToInterview2();
              await actions.setMilestone({
                milestone: "i2_materials_sent",
                nextAction: "Send the Interview #2 materials.",
              });
            })
          }
          onWantsTime={() =>
            void run(async () => {
              await actions.recordCommunication({
                type: "applicant_responded",
                milestone: "i1_advancement_call",
                privateNote:
                  "Applicant asked for time to think. Do not send Interview #2 prep until they confirm.",
              });
              setCallOutcome(
                "Recorded — the applicant asked for time to think. Nothing is sent until they confirm.",
              );
            })
          }
          onCouldNotReach={() =>
            void run(async () => {
              await actions.recordCommunication({
                type: "call_attempted",
                milestone: "i1_advancement_call",
                privateNote: "Advancement call attempted — no answer. Will try again.",
              });
              setCallOutcome("Recorded — call attempted, no answer. Try again later.");
            })
          }
        />
      ) : null}

      {current === "i2_materials_sent" ? (
        <Interview2MaterialsCard
          applicantName={data.name}
          busy={busy}
          onSend={(message) =>
            void run(async () => {
              await actions.recordCommunication({
                type: "text_sent",
                milestone: "i2_materials_sent",
                template: "i2_materials_sent",
                message,
              });
              await actions.completeAndAdvance({
                milestone: "i2_availability_requested",
                nextAction: "Request the applicant's availability for Interview #2.",
              });
            })
          }
        />
      ) : null}

      {current === "i2_availability_requested" ? (
        <Interview2AvailabilityCard
          applicantName={data.name}
          busy={busy}
          onSend={({ message, days, choicesRequested }) =>
            void run(async () => {
              await actions.saveSlotOffer({
                kind: "interview_2",
                selectionsRequested: choicesRequested,
                slots: days.flatMap((d) => d.times.map((t) => ({ date: d.date, time: t }))),
              });
              await actions.recordCommunication({
                type: "text_sent",
                milestone: "i2_availability_requested",
                template: "i2_availability_request",
                message,
              });
              await actions.completeAndAdvance({
                milestone: "i2_availability_received",
                nextAction: "Record the Interview #2 availability the candidate ranked.",
              });
            })
          }
        />
      ) : null}



      {previous ? (
        <Secondary
          disabled={busy}
          onClick={() =>
            void run(() =>
              actions.setMilestone({
                milestone: previous.key,
                nextAction: `Back on “${previous.label}.”`,
              }),
            )
          }
        >
          Go back a step — {milestoneLabel(previous.key)}
        </Secondary>
      ) : null}

      {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
    </div>
  );
}
