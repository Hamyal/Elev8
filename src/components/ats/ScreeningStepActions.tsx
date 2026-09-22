/**
 * Screening-stage actions shown inside View Progress, directly under the
 * applicant's current step.
 *
 * Design rules this component enforces:
 *  - Staff never type an applicant's name, date, or time into a message. They
 *    pick a date (and a calling window where one is needed) and the approved
 *    wording is generated for them, ending in the shared team signoff.
 *  - "Record as Sent" is blocked until every required date field is filled in.
 *  - Sending the phone-interview proposal always completes the outreach step —
 *    it is never gated on the applicant replying.
 *  - What the applicant said is recorded separately, as its own decision.
 *  - Missed call attempts are capped at two, and only then does the no-answer
 *    follow-up unlock; closing for no response unlocks after that is sent.
 * Nothing outside the Screening stage is touched here.
 */
import { useMemo, useRef, useState } from "react";
import {
  MAX_CALL_ATTEMPTS,
  SCREENING_TEMPLATE_DRAFT,
  SCREENING_TEMPLATE_LABELS,
  buildScreeningTemplate,
  formatDateLong,
  formatTime12,
  milestoneLabel,
  milestoneOrdinal,
  normalizeMilestone,
  MILESTONES,
  type ScreeningTemplateKey,
} from "@/lib/ats-workflow";
import type { ApplicantDetail } from "@/lib/ats.functions";

export type ScreeningActions = {
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
  saveScheduling: (input: {
    kind: "phone";
    proposedDate: string | null;
    windowStart: string | null;
    windowEnd: string | null;
  }) => Promise<unknown>;
  setConfirmation: (input: { kind: "phone"; state: string }) => Promise<unknown>;
};

const PHONE_WINDOW_START = "09:00";
const PHONE_WINDOW_END = "11:00";

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

/** A message card: pick the values, review the generated wording, record it. */
function MessageCard({
  title,
  templateKey,
  applicantName,
  needsWindow,
  dateLabel,
  fixedDate,
  fixedWindow,
  busy,
  onSend,
}: {
  title: string;
  templateKey: ScreeningTemplateKey;
  applicantName: string;
  needsWindow: boolean;
  dateLabel: string;
  /** Set when the window on file is reused instead of picked again. */
  fixedDate?: string | null;
  fixedWindow?: { start: string | null; end: string | null };
  busy: boolean;
  onSend: (input: {
    message: string;
    date: string;
    windowStart: string | null;
    windowEnd: string | null;
  }) => void;
}) {
  const locked = !!fixedDate;
  const [date, setDate] = useState(fixedDate ?? "");
  const [start, setStart] = useState(fixedWindow?.start ?? PHONE_WINDOW_START);
  const [end, setEnd] = useState(fixedWindow?.end ?? PHONE_WINDOW_END);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveDate = fixedDate ?? date;
  const effectiveStart = locked ? (fixedWindow?.start ?? null) : start;
  const effectiveEnd = locked ? (fixedWindow?.end ?? null) : end;

  const message = useMemo(
    () =>
      buildScreeningTemplate(templateKey, {
        applicantName,
        date: effectiveDate || null,
        ...(needsWindow ? { windowStart: effectiveStart, windowEnd: effectiveEnd } : {}),
      }),
    [templateKey, applicantName, effectiveDate, effectiveStart, effectiveEnd, needsWindow],
  );

  const submit = () => {
    if (!effectiveDate) return setError(`${dateLabel} is required before this can be recorded.`);
    if (needsWindow && (!effectiveStart || !effectiveEnd))
      return setError("A start time and an end time are both required.");
    if (needsWindow && effectiveStart && effectiveEnd && effectiveEnd <= effectiveStart)
      return setError("The window has to end after it starts.");
    setError(null);
    onSend({
      message,
      date: effectiveDate,
      windowStart: needsWindow ? effectiveStart : null,
      windowEnd: needsWindow ? effectiveEnd : null,
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-primary">{title}</p>
        <span className="rounded-full border border-teal bg-teal/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          {SCREENING_TEMPLATE_LABELS[templateKey]}
        </span>
        {SCREENING_TEMPLATE_DRAFT[templateKey] ? (
          <span className="rounded-full border border-review-needs px-2.5 py-0.5 text-[11px] font-semibold text-review-needs">
            Draft wording — not final
          </span>
        ) : null}
      </div>

      {locked ? (
        <p className="text-sm text-primary">
          Using the window already on file:{" "}
          <span className="font-semibold">
            {formatDateLong(effectiveDate)}
            {effectiveStart && effectiveEnd
              ? `, ${formatTime12(effectiveStart)}–${formatTime12(effectiveEnd)}`
              : ""}
          </span>
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-primary sm:col-span-1">
            <Label>{dateLabel}</Label>
            <input
              type="date"
              min={todayIso()}
              value={date}
              onChange={(e) => setDate(e.currentTarget.value)}
              className={inputClass()}
            />
          </label>
          {needsWindow ? (
            <>
              <label className="text-xs font-semibold text-primary">
                <Label>Window starts</Label>
                <input
                  type="time"
                  step={900}
                  value={start}
                  onChange={(e) => setStart(e.currentTarget.value)}
                  className={inputClass()}
                />
              </label>
              <label className="text-xs font-semibold text-primary">
                <Label>Window ends</Label>
                <input
                  type="time"
                  step={900}
                  value={end}
                  onChange={(e) => setEnd(e.currentTarget.value)}
                  className={inputClass()}
                />
              </label>
            </>
          ) : null}
        </div>
      )}

      <div>
        <Label>Message that will be sent</Label>
        <p className="mt-1 whitespace-pre-line rounded-lg border border-border bg-background p-3 text-sm text-foreground">
          {message}
        </p>
        <p className="mt-1 text-xs text-status-neutral">
          The wording is generated and cannot be edited. Copy it and send it to the applicant, then
          record it here.
        </p>
      </div>

      {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Secondary onClick={() => void copy()}>Copy Message</Secondary>
        {copied ? (
          <span className="text-xs font-semibold text-status-neutral" role="status">
            Copied
          </span>
        ) : null}
        <Primary onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Record as Sent"}
        </Primary>
      </div>
    </div>
  );
}

/** Just a new date and window — used when the applicant asks for another time. */
function ReschedulePicker({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (input: { date: string; start: string; end: string }) => void;
}) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState(PHONE_WINDOW_START);
  const [end, setEnd] = useState(PHONE_WINDOW_END);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!date) return setError("A new date is required.");
    if (!start || !end) return setError("A start time and an end time are both required.");
    if (end <= start) return setError("The window has to end after it starts.");
    setError(null);
    onSave({ date, start, end });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-primary">New date and calling window</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-primary">
          <Label>New date</Label>
          <input
            type="date"
            min={todayIso()}
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
            className={inputClass()}
          />
        </label>
        <label className="text-xs font-semibold text-primary">
          <Label>Window starts</Label>
          <input
            type="time"
            step={900}
            value={start}
            onChange={(e) => setStart(e.currentTarget.value)}
            className={inputClass()}
          />
        </label>
        <label className="text-xs font-semibold text-primary">
          <Label>Window ends</Label>
          <input
            type="time"
            step={900}
            value={end}
            onChange={(e) => setEnd(e.currentTarget.value)}
            className={inputClass()}
          />
        </label>
      </div>
      {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
      <Primary onClick={submit} disabled={busy}>
        {busy ? "Saving…" : "Save new window"}
      </Primary>
    </div>
  );
}

export function ScreeningStepActions({
  data,
  actions,
}: {
  data: ApplicantDetail;
  actions: ScreeningActions;
}) {
  const current = normalizeMilestone(data.milestone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<null | "nonresponse" | "reschedule" | "noanswer">(null);

  const phone = data.scheduling.find((s) => s.kind === "phone") ?? null;
  const attempts = data.communications.filter(
    (c) => c.type === "call_attempted" && c.milestone === "phone_interview_completed_v2",
  ).length;
  const noAnswerSent = data.communications.some(
    (c) => c.template === "screening_call_noanswer_followup",
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

  /** Pass-throughs are logged, then the applicant lands on the next real step. */
  const advanceThroughScheduled = async () => {
    await actions.completeAndAdvance({
      milestone: "phone_interview_scheduled_v2",
      nextAction: "Send the phone interview confirmation message.",
    });
    await actions.completeAndAdvance({
      milestone: "phone_interview_confirmed_v2",
      nextAction: "Send the phone interview confirmation message.",
    });
  };

  const closeNoResponse = () =>
    run(() =>
      actions.setMilestone({
        milestone: "closed_no_response",
        nextAction: "No further action — closed for no response.",
      }),
    );

  return (
    <div className="mt-3 flex flex-col gap-3">
      {current === "application_received" ? (
        <Primary
          disabled={busy}
          onClick={() =>
            void run(() =>
              actions.completeAndAdvance({
                milestone: "initial_outreach",
                nextAction: "Send the phone interview proposal to the applicant.",
              }),
            )
          }
        >
          Start Screening
        </Primary>
      ) : null}

      {current === "initial_outreach" ? (
        <MessageCard
          title="Propose the phone interview"
          templateKey="screening_propose"
          applicantName={data.name}
          needsWindow
          dateLabel="Phone interview date"
          busy={busy}
          onSend={({ message, date, windowStart, windowEnd }) =>
            void run(async () => {
              // A record sent back to this step can still carry a confirmed phone
              // window; the backend refuses to change a confirmed time, so release
              // it first before proposing the new one.
              if (phone && phone.confirmationState === "confirmed") {
                await actions.setConfirmation({ kind: "phone", state: "awaiting_confirmation" });
              }
              await actions.saveScheduling({
                kind: "phone",
                proposedDate: date,
                windowStart,
                windowEnd,
              });

              await actions.recordCommunication({
                type: "text_sent",
                milestone: "initial_outreach",
                template: "screening_propose",
                message,
              });
              await actions.setConfirmation({ kind: "phone", state: "awaiting_confirmation" });
              await actions.completeAndAdvance({
                milestone: "applicant_response_received",
                nextAction: "Record what the applicant said about the proposed window.",
              });
            })
          }
        />
      ) : null}

      {current === "applicant_response_received" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-primary">
            Record what the applicant said. This is independent of the message you already sent.
          </p>
          <Primary
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await actions.recordCommunication({
                  type: "applicant_responded",
                  milestone: "applicant_response_received",
                  privateNote: "Applicant confirmed availability for the proposed window.",
                });
                await actions.setConfirmation({ kind: "phone", state: "confirmed" });
                await advanceThroughScheduled();
              })
            }
          >
            Confirmed — available for this window
          </Primary>
          <Secondary disabled={busy} onClick={() => setOpen(open === "reschedule" ? null : "reschedule")}>
            Requested a different day/time
          </Secondary>
          {open === "reschedule" ? (
            <ReschedulePicker
              busy={busy}
              onSave={({ date, start, end }) =>
                void run(async () => {
                  await actions.saveScheduling({
                    kind: "phone",
                    proposedDate: date,
                    windowStart: start,
                    windowEnd: end,
                  });
                  await actions.recordCommunication({
                    type: "reschedule_requested",
                    milestone: "applicant_response_received",
                    privateNote: `Applicant asked for a different time. New window saved: ${formatDateLong(date)}, ${formatTime12(start)}–${formatTime12(end)}.`,
                  });
                  await advanceThroughScheduled();
                })
              }
            />
          ) : null}
          <Secondary disabled={busy} onClick={() => setOpen(open === "nonresponse" ? null : "nonresponse")}>
            Send Nonresponse Follow-up
          </Secondary>
          {open === "nonresponse" ? (
            <MessageCard
              title="Final follow-up before closing"
              templateKey="screening_nonresponse"
              applicantName={data.name}
              needsWindow={false}
              dateLabel="Response deadline"
              busy={busy}
              onSend={({ message }) =>
                void run(() =>
                  actions.recordCommunication({
                    type: "text_sent",
                    milestone: "applicant_response_received",
                    template: "screening_nonresponse",
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

      {current === "phone_interview_scheduled_v2" ? (
        <Primary disabled={busy} onClick={() => void run(advanceThroughScheduled)}>
          Continue to confirmation
        </Primary>
      ) : null}

      {current === "phone_interview_confirmed_v2" ? (
        phone?.proposedDate ? (
          <MessageCard
            title="Confirm the phone interview"
            templateKey="screening_confirm"
            applicantName={data.name}
            needsWindow
            dateLabel="Phone interview date"
            fixedDate={phone.proposedDate}
            fixedWindow={{ start: phone.windowStart, end: phone.windowEnd }}
            busy={busy}
            onSend={({ message }) =>
              void run(async () => {
                await actions.recordCommunication({
                  type: "text_sent",
                  milestone: "phone_interview_confirmed_v2",
                  template: "screening_confirm",
                  message,
                });
                await actions.setConfirmation({ kind: "phone", state: "confirmed" });
                await actions.completeAndAdvance({
                  milestone: "phone_interview_completed_v2",
                  nextAction: "Hold the phone interview, then record the outcome.",
                });
              })
            }
          />
        ) : (
          <p className="text-sm text-primary">
            No calling window on file yet. Go back a step and send the phone interview proposal
            first.
          </p>
        )
      ) : null}

      {current === "phone_interview_completed_v2" ? (
        <div className="flex flex-col gap-3">
          <Primary
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await actions.recordCommunication({
                  type: "call_completed",
                  milestone: "phone_interview_completed_v2",
                  privateNote: "Phone interview held.",
                });
                await actions.completeAndAdvance({
                  milestone: "screening_decision_recorded",
                  nextAction: "Record the screening decision.",
                });
              })
            }
          >
            Phone interview completed
          </Primary>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-bold text-primary">
              Missed call attempts: {attempts} of {MAX_CALL_ATTEMPTS}
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <Secondary
                disabled={busy || attempts >= MAX_CALL_ATTEMPTS}
                onClick={() =>
                  void run(() =>
                    actions.recordCommunication({
                      type: "call_attempted",
                      milestone: "phone_interview_completed_v2",
                      privateNote: `Missed call attempt ${attempts + 1} of ${MAX_CALL_ATTEMPTS}.`,
                    }),
                  )
                }
              >
                {attempts >= MAX_CALL_ATTEMPTS
                  ? "Both attempts logged"
                  : "Log a missed call attempt"}
              </Secondary>
              {attempts >= MAX_CALL_ATTEMPTS ? (
                <Secondary disabled={busy} onClick={() => setOpen(open === "noanswer" ? null : "noanswer")}>
                  Send No-Answer Follow-up
                </Secondary>
              ) : (
                <p className="text-xs text-status-neutral">
                  The no-answer follow-up unlocks after {MAX_CALL_ATTEMPTS} attempts are logged.
                </p>
              )}
              {open === "noanswer" ? (
                <MessageCard
                  title="No-answer follow-up"
                  templateKey="screening_call_noanswer_followup"
                  applicantName={data.name}
                  needsWindow={false}
                  dateLabel="Response deadline"
                  busy={busy}
                  onSend={({ message }) =>
                    void run(() =>
                      actions.recordCommunication({
                        type: "text_sent",
                        milestone: "phone_interview_completed_v2",
                        template: "screening_call_noanswer_followup",
                        message,
                      }),
                    )
                  }
                />
              ) : null}
              {noAnswerSent ? (
                <Secondary disabled={busy} onClick={() => void closeNoResponse()}>
                  No Response — Close Application
                </Secondary>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {current === "screening_decision_recorded" ? (
        <div className="flex flex-col gap-3">
          <Primary
            disabled={busy}
            onClick={() =>
              void run(() =>
                actions.setMilestone({
                  milestone: "i1_availability_requested",
                  nextAction: "Request the applicant's availability for Interview #1.",
                }),
              )
            }
          >
            Advance to Interview #1
          </Primary>
          <Secondary
            disabled={busy}
            onClick={() =>
              void run(() =>
                actions.setMilestone({
                  milestone: "closed_phone_interview_outcome",
                  nextAction: "No further action — closed after the phone interview.",
                }),
              )
            }
          >
            Do Not Move Forward
          </Secondary>
        </div>
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
