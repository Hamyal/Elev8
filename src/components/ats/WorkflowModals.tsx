/**
 * Complete This Step and Decision modals for the signed-in workspace, matching
 * the approved design preview. Every action here runs through the existing
 * server functions, so permissions, activity history, and workflow rules are
 * unchanged — only the presentation matches the preview.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MILESTONES, milestoneLabel, milestoneOrdinal, normalizeMilestone } from "@/lib/ats-workflow";
import type { ApplicantDetail } from "@/lib/ats.functions";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">{children}</p>
  );
}

function Shell({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold text-primary">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-xs">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function defaultDue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The milestone the workflow moves to next, for display only. */
function nextMilestoneOf(current: string) {
  const index = milestoneOrdinal(current);
  if (index < 0) return null;
  const next = MILESTONES[index + 1];
  if (!next || next.status === "not_selected") return null;
  return next;
}

/** Plain-language next action for the newly activated milestone. */
const NEXT_ACTIONS: Record<string, string> = {
  initial_outreach: "Copy and send the approved initial outreach message.",
  applicant_response_received: "Watch for the applicant's response.",
  phone_interview_scheduled_v2: "Schedule the phone interview.",
  phone_interview_confirmed_v2: "Request and record the applicant's confirmation.",
  phone_interview_completed_v2: "Hold the phone interview, then record it as completed.",
  screening_decision_recorded: "Record the screening decision.",
  i1_availability_requested: "Request the applicant's availability for Interview #1.",
  i1_availability_received: "Watch for the applicant's availability.",
  i1_interview_scheduled: "Schedule Interview #1.",
  i1_interview_confirmed: "Request and record the applicant's confirmation.",
  i1_interview_completed: "Hold Interview #1, then record it as completed.",
  i1_decision_recorded: "Record the Interview #1 decision.",
  i1_advancement_call: "Hold the advancement call with the applicant.",
  i2_materials_sent: "Send the approved Interview #2 materials message to the applicant.",
  i2_availability_requested: "Request the applicant's availability for Interview #2.",
  i2_availability_received: "Watch for the applicant's availability.",
  i2_interview_scheduled: "Schedule Interview #2.",
  i2_interview_confirmed: "Request and record the applicant's confirmation.",
  i2_interview_completed: "Hold Interview #2, then record it as completed.",
  i2_decision_recorded: "Record the Interview #2 decision.",
  offer_call_scheduled: "Schedule the verbal offer call.",
  offer_extended: "Extend the verbal offer.",
  offer_decision_received: "Record the applicant's response to the offer.",
  offer_handoff_completed: "Complete the onboarding handoff.",
  hired_onboarding_initiated: "Initiate onboarding.",
  hired_onboarding_in_progress: "Update onboarding progress.",
  hired_cleared_to_work: "Confirm the applicant is cleared to begin work.",
  hired_start_date_scheduled: "Schedule the start date.",
  hired_onboarding_completed: "Confirm onboarding is complete.",
};


export type CompleteStepActions = {
  completeMilestone: (detail?: string) => Promise<unknown>;
  completeAndAdvance: (input: {
    milestone: string;
    nextAction?: string;
    dueAt?: string;
    staffId?: string | null;
  }) => Promise<unknown>;
  setMilestone: (input: {
    milestone: string;
    nextAction?: string;
    dueAt?: string;
  }) => Promise<unknown>;
  assign: (staffId: string | null) => Promise<unknown>;
  setDeadline: (dueAt: string | null) => Promise<unknown>;
};


/** "Complete This Step" — the next milestone is determined automatically. */
export function AtsCompleteStepModal({
  open,
  onClose,
  data,
  staff,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  data: ApplicantDetail;
  staff: { userId: string; name: string }[];
  actions: CompleteStepActions;
}) {
  const current = normalizeMilestone(data.milestone);
  const next = nextMilestoneOf(current);
  const [assignedTo, setAssignedTo] = useState(data.assignedTo ?? "");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (next) {
        await actions.completeAndAdvance({
          milestone: next.key,
          nextAction: NEXT_ACTIONS[next.key] ?? `Complete “${next.label}.”`,
          staffId: assignedTo || null,
          ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        });
      } else {
        await actions.completeMilestone();
      }

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This step could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Complete This Step"
      description="The next milestone is determined automatically."
    >
      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel>Completing</FieldLabel>
          <p className="text-sm font-semibold text-primary">{milestoneLabel(current)}</p>
        </div>
        <div>
          <FieldLabel>Next milestone</FieldLabel>
          <p className="text-sm font-semibold text-primary">
            {next ? next.label : "This is the final milestone."}
          </p>
        </div>
        {next ? (
          <>
            <div className="flex flex-col gap-1">
              <FieldLabel>Who is responsible for the next milestone?</FieldLabel>
              <select
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.currentTarget.value)}
              >
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>When should the next milestone be completed?</FieldLabel>
              <input
                type="datetime-local"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                value={dueAt}
                onChange={(e) => setDueAt(e.currentTarget.value)}
              />
            </div>
          </>
        ) : null}
        {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Saving…" : "Complete and Continue"}
          </Button>
        </div>
      </div>
    </Shell>
  );
}

const REASONS: { label: string; milestone: string }[] = [
  { label: "No response", milestone: "closed_no_response" },
  { label: "Qualifications", milestone: "closed_qualifications" },
  { label: "Availability", milestone: "closed_availability" },
  { label: "Phone interview outcome", milestone: "closed_phone_interview_outcome" },
  { label: "Interview #1 outcome", milestone: "closed_interview1_outcome" },
  { label: "Interview #2 outcome", milestone: "closed_interview2_outcome" },
  { label: "Offer declined", milestone: "closed_offer_declined" },
  { label: "Other", milestone: "closed_other" },
];

export type DecisionChoice = {
  label: string;
  /** Milestone to move to when this decision advances the applicant. */
  advanceTo?: string;
  /** Interview #2 is only reachable through the recorded advance decision. */
  advanceToInterview2?: boolean;
  /** Keeps the applicant on the current step (for example, more time to decide). */
  stay?: boolean;
};

export const DECISION_CHOICES: Record<string, DecisionChoice[]> = {
  /** Second outreach exhausted with no reply — a terminal No Response decision. */
  applicant_response_received: [
    { label: "Applicant Responded — Continue", advanceTo: "phone_interview_scheduled_v2" },
    { label: "No Response — Do Not Move Forward" },
  ],
  screening_decision_recorded: [
    { label: "Advance to Interview #1", advanceTo: "i1_availability_requested" },
    { label: "Do Not Move Forward" },
  ],
  i1_decision_recorded: [
    { label: "Advance — hold the advancement call", advanceTo: "i1_advancement_call" },
    { label: "Do Not Move Forward" },
  ],
  i1_advancement_call: [
    { label: "Confirmed — proceeding to Interview #2", advanceTo: "i2_materials_sent" },
    { label: "Do Not Move Forward" },
  ],
  i2_decision_recorded: [
    { label: "Advance to Offer", advanceTo: "offer_call_scheduled" },
    { label: "Do Not Move Forward" },
  ],
  offer_decision_received: [
    { label: "Offer Accepted", advanceTo: "offer_handoff_completed" },
    { label: "Offer Declined" },
    { label: "Applicant Requested More Time", stay: true },
  ],
};


export type DecisionActions = {
  setMilestone: (input: {
    milestone: string;
    nextAction?: string;
    overrideReason?: string;
    closedOtherReason?: string;
  }) => Promise<unknown>;
  advanceToInterview2: () => Promise<unknown>;
};

/** Records an advance, decline, or closure decision on the current step. */
export function AtsDecisionModal({
  open,
  onClose,
  data,
  choices,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  data: ApplicantDetail;
  choices: DecisionChoice[];
  actions: DecisionActions;
}) {
  const current = normalizeMilestone(data.milestone);
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choice = choices.find((c) => c.label === picked) ?? null;
  const needsReason = !!choice && choice.label === "Do Not Move Forward";

  const submit = async () => {
    if (!choice) return setError("Select a decision.");
    if (needsReason && !reason) return setError("Select one reason.");
    if (needsReason && reason === "Other" && explanation.trim().length < 5)
      return setError("A private explanation is required for “Other.”");
    setError(null);
    setBusy(true);
    try {
      if (choice.advanceToInterview2) {
        await actions.advanceToInterview2();
      } else if (choice.stay) {
        await actions.setMilestone({
          milestone: current,
          nextAction: "Applicant requested more time to decide. Follow up on the agreed date.",
        });
      } else if (choice.advanceTo) {
        await actions.setMilestone({ milestone: choice.advanceTo });
      } else {
        const target = REASONS.find((r) => r.label === reason);
        await actions.setMilestone({
          milestone: target?.milestone ?? "closed_other",
          ...(reason === "Other" ? { closedOtherReason: explanation.trim() } : {}),
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This decision could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell open={open} onClose={onClose} title={milestoneLabel(current)}>
      <div className="flex flex-col gap-3">
        {choices.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setPicked(c.label)}
            className={cn(
              "w-full rounded-md border px-3 py-2 text-left text-sm",
              picked === c.label
                ? "border-accent text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}

        {needsReason ? (
          <div className="flex flex-col gap-2">
            <FieldLabel>Reason*</FieldLabel>
            {REASONS.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setReason(r.label)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-sm",
                  reason === r.label
                    ? "border-accent text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
            {reason === "Other" ? (
              <textarea
                rows={3}
                className="w-full rounded-md border border-border bg-card p-2 text-sm"
                placeholder="Private explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.currentTarget.value)}
              />
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Saving…" : "Save decision"}
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export type ReopenActions = {
  reopen: (input: { reason: string; milestone?: string }) => Promise<unknown>;
};

/** Steps a reopened application can return to (Not Selected excluded). */
const REOPEN_STEPS = MILESTONES.filter((m) => m.status !== "not_selected");

/**
 * Reopens an application that was closed by mistake. The step defaults to the
 * last step the applicant was on before the closure; a private reason is
 * required and the closing history stays intact.
 */
export function AtsReopenModal({
  open,
  onClose,
  data,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  data: ApplicantDetail;
  actions: ReopenActions;
}) {
  // milestoneTrail is newest-first, so the first match is the last step
  // the applicant was on before being closed.
  const lastOpenStep =
    data.milestoneTrail
      .map((m) => normalizeMilestone(m.milestone))
      .find((key) => REOPEN_STEPS.some((s) => s.key === key)) ?? "application_received";

  const [milestone, setMilestone] = useState(lastOpenStep);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 5) return setError("A short private reason is required.");
    setError(null);
    setBusy(true);
    try {
      await actions.reopen({ reason: reason.trim(), milestone });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This application could not be reopened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Reopen application"
      description="Use this when an application was closed by mistake. The closing entry stays in the activity history."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel>Return the applicant to</FieldLabel>
          <select
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            value={milestone}
            onChange={(e) => setMilestone(e.currentTarget.value)}
          >
            {REOPEN_STEPS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Defaults to the last step before this application was closed:{" "}
            {milestoneLabel(lastOpenStep)}.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>Reason for reopening* (private)</FieldLabel>
          <textarea
            rows={3}
            className="w-full rounded-md border border-border bg-card p-2 text-sm"
            placeholder="For example: closed by mistake during screening review."
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
        </div>

        {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Reopening…" : "Reopen Application"}
          </Button>
        </div>
      </div>
    </Shell>
  );
}
