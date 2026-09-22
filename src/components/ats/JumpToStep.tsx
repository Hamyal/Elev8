/**
 * "Jump to step" — a deliberate staff override that moves a record straight to
 * any milestone, forward or backward, without satisfying the guided step
 * validation on the way there. A one-line private reason and an explicit
 * confirm are required, and the move is logged as a manual move.
 */
import { useState } from "react";
import { CornerUpRight } from "lucide-react";
import {
  MILESTONE_BY_KEY,
  milestoneLabel,
  milestonesByStage,
  normalizeMilestone,
} from "@/lib/ats-workflow";

export type JumpActions = {
  jumpToStep: (input: { milestone: string; reason: string }) => Promise<unknown>;
};

export function JumpToStep({
  currentMilestone,
  actions,
}: {
  currentMilestone: string | null | undefined;
  actions: JumpActions;
}) {
  const current = normalizeMilestone(currentMilestone);
  const groups = milestonesByStage();
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const requiresExplanation = !!(target && MILESTONE_BY_KEY.get(target)?.requiresExplanation);
  const selectBlocked = !target
    ? "Choose the step you want to move this record to."
    : target === current
      ? "This record is already on that step."
      : null;
  const reasonBlocked =
    reason.trim().length < 5
      ? requiresExplanation
        ? "A short private explanation is required for this closed outcome."
        : "Type a one-line reason for this manual move."
      : null;

  const startConfirm = () => {
    setError(null);
    setDone(null);
    if (selectBlocked) return;
    setConfirming(true);
  };

  const submit = async () => {
    if (selectBlocked || reasonBlocked) return;
    setBusy(true);
    setError(null);
    try {
      await actions.jumpToStep({ milestone: target, reason: reason.trim() });
      setDone(milestoneLabel(target));
      setConfirming(false);
      setReason("");
      setTarget("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This record could not be moved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-status-neutral">
        Jump to step
      </p>
      <p className="mt-1 text-xs text-status-neutral">
        A deliberate override for records that are already partway through in real life, or that
        are sitting on the wrong step. It skips every step in between and is recorded in the
        activity history.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.currentTarget.value);
            setConfirming(false);
            setDone(null);
            setError(null);
          }}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30 sm:max-w-sm"
          aria-label="Step to move this record to"
        >
          <option value="">Select a step…</option>
          {groups.map((group) => (
            <optgroup key={group.status} label={group.label}>
              {group.milestones.map((m) => (
                <option key={m.key} value={m.key} disabled={m.key === current}>
                  {m.label}
                  {m.key === current ? " (current step)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          onClick={startConfirm}
          disabled={!!selectBlocked || busy}
          className="btn-ghost-navy inline-flex w-fit items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-60"
        >
          <CornerUpRight className="size-3.5" aria-hidden />
          Move
        </button>
      </div>

      {selectBlocked && target ? (
        <p className="mt-2 text-xs font-semibold text-review-needs">{selectBlocked}</p>
      ) : null}

      {confirming ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
          <p className="text-sm font-semibold text-primary">
            Move this record to {milestoneLabel(target)}?
          </p>
          <p className="text-xs text-status-neutral">
            Currently on {milestoneLabel(current)}. Every step in between is skipped.
          </p>
          <label className="text-xs font-semibold text-primary">
            Reason for this move* (private)
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="For example: record created after the phone interview already happened."
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={busy}
              className="btn-ghost-navy px-4 py-2 text-sm disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!!reasonBlocked || busy}
              className="btn-solid px-5 py-2 text-sm disabled:opacity-60"
            >
              {busy ? "Moving…" : "Confirm move"}
            </button>
          </div>
          {reasonBlocked ? (
            <p className="text-xs font-semibold text-review-needs">{reasonBlocked}</p>
          ) : null}
          {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
        </div>
      ) : null}

      {done ? (
        <p className="mt-2 text-xs font-semibold text-milestone-done">
          Moved to {done}. The move is recorded in the activity history.
        </p>
      ) : null}
      {!confirming && error ? (
        <p className="mt-2 text-sm font-semibold text-review-needs">{error}</p>
      ) : null}
    </section>
  );
}
