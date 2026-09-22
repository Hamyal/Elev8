/**
 * Overlay panel bodies for the signed-in applicant workspace, mirroring the
 * approved design preview's separate View Application / View Progress / Files /
 * Activity panels. Read-only: nothing here changes an applicant record.
 */
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  MILESTONES,
  STATUSES,
  eventLabel,
  isScreeningStep,
  isInterview1Step,
  milestoneLabel,
  milestoneOrdinal,
  normalizeMilestone,
  normalizeStatus,
  statusLabel,
  type StatusKey,
} from "@/lib/ats-workflow";
import type { ApplicantDetail } from "@/lib/ats.functions";
import { SubmittedAnswers } from "@/components/ats/SubmittedAnswers";
import {
  ScreeningStepActions,
  type ScreeningActions,
} from "@/components/ats/ScreeningStepActions";
import {
  InterviewStepActions,
  type InterviewActions,
} from "@/components/ats/InterviewStepActions";
import { JumpToStep, type JumpActions } from "@/components/ats/JumpToStep";
import { cn } from "@/lib/utils";

function fmt(iso: string | null) {
  if (!iso) return "—";
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

/** Complete submitted application, in the applicant's own wording. */
export function AtsApplicationPanel({ data }: { data: ApplicantDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-status-neutral">
        The complete submitted application, read-only, in the applicant&rsquo;s own wording.
        Submitted {fmt(data.submittedAt)}.
      </p>
      {data.answerSections.length > 0 ? (
        <SubmittedAnswers sections={data.answerSections} />
      ) : (
        <dl className="space-y-2">
          {data.answers.map((row) => (
            <div key={row.label} className="border-t border-border pt-2 text-sm">
              <dt className="font-semibold text-primary">{row.label}</dt>
              <dd className="whitespace-pre-line text-foreground">{row.value}</dd>
            </div>
          ))}
          {data.answers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stored answers.</p>
          ) : null}
        </dl>
      )}
    </div>
  );
}

/**
 * Every stage and milestone. Screening steps carry their own actions under the
 * current step; every other stage stays read-only as before.
 */
export function AtsProgressPanel({
  data,
  canReview = false,
  screeningActions,
  interview1Actions,
  jumpActions,
}: {
  data: ApplicantDetail;
  canReview?: boolean;
  screeningActions?: ScreeningActions;
  interview1Actions?: InterviewActions;
  jumpActions?: JumpActions;
}) {
  const status = normalizeStatus(data.status);
  const current = normalizeMilestone(data.milestone);
  const currentOrdinal = milestoneOrdinal(current);
  const stages = STATUSES.filter((s) => s.key !== "not_selected");
  const currentStageIndex = stages.findIndex((s) => s.key === status);
  const completedTrail = new Set(
    data.milestoneTrail.filter((t) => t.completedAt).map((t) => normalizeMilestone(t.milestone)),
  );
  const showScreening =
    canReview && !!screeningActions && isScreeningStep(current) && status !== "not_selected";
  const showInterviewActions =
    canReview &&
    !!interview1Actions &&
    (isInterview1Step(current) ||
      current === "i2_materials_sent" ||
      current === "i2_availability_requested") &&
    status !== "not_selected";

  return (
    <div className="flex flex-col gap-5">
      {status === "not_selected" ? (
        <p className="text-sm text-primary">This application is closed — Not Selected.</p>
      ) : null}
      {stages.map((stage, stageIndex) => {
        const done = currentStageIndex >= 0 && stageIndex < currentStageIndex;
        const isCurrentStage = stage.key === status;
        return (
          <section key={stage.key} className="flex flex-col">
            <h3
              className={cn(
                "text-sm font-semibold",
                done && "text-milestone-done",
                isCurrentStage && "text-milestone-current",
                !done && !isCurrentStage && "text-status-neutral",
              )}
            >
              {done ? "✓ " : ""}
              {stage.label}
              {isCurrentStage ? " — Current stage" : done ? "" : " — Locked"}
            </h3>
            <div className="mt-1 flex flex-col">
              {MILESTONES.filter((m) => m.status === (stage.key as StatusKey)).map((m) => {
                const mCurrent = m.key === current;
                const mDone =
                  !mCurrent && (completedTrail.has(m.key) || milestoneOrdinal(m.key) < currentOrdinal);
                return (
                  <div key={m.key}>
                    <div
                      className={cn(
                        "flex items-center gap-2 border-t border-border/70 py-2 text-sm",
                        mDone && "text-milestone-done",
                        mCurrent && "font-semibold text-milestone-current",
                        !mDone && !mCurrent && "text-status-neutral",
                      )}
                    >
                      <span aria-hidden>{mDone ? "✓" : mCurrent ? "●" : "○"}</span>
                      <span className="flex-1">{m.label}</span>
                      <span className="text-xs">
                        {mDone ? "Completed" : mCurrent ? "Current step" : "Locked"}
                      </span>
                    </div>
                    {mCurrent && showScreening && screeningActions ? (
                      <ScreeningStepActions data={data} actions={screeningActions} />
                    ) : null}
                    {mCurrent && showInterviewActions && interview1Actions ? (
                      <InterviewStepActions data={data} actions={interview1Actions} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="text-xs text-status-neutral">
        Not Selected is a terminal outcome recorded by a decision, not a sequential milestone.
      </p>
      {canReview && jumpActions ? (
        <JumpToStep currentMilestone={current} actions={jumpActions} />
      ) : null}
    </div>
  );
}

/** Stored documents. Files open through a private link that expires shortly. */
export function AtsFilesPanel({
  data,
  onOpenFile,
}: {
  data: ApplicantDetail;
  onOpenFile: (input: { kind: "pdf" | "upload"; path?: string }) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);

  const open = async (input: { kind: "pdf" | "upload"; path?: string }) => {
    setError(null);
    try {
      await onOpenFile(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be opened.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {data.hasPdf ? (
        <button
          type="button"
          onClick={() => void open({ kind: "pdf" })}
          className="inline-flex items-center gap-1.5 border-t border-border pt-3 text-left text-sm font-semibold text-teal underline underline-offset-4"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Submitted application PDF
        </button>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          No archived PDF for this record.
        </p>
      )}
      {data.files.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => void open({ kind: "upload", path: f.key })}
          className="block border-t border-border pt-3 text-left text-sm text-teal underline underline-offset-4"
        >
          <span className="block font-semibold">{f.name}</span>
          <span className="block text-xs text-status-neutral no-underline">{f.category}</span>
        </button>
      ))}
      <p className="pt-2 text-xs text-status-neutral">
        Files open through a private link that expires in 10 minutes. Resumes are not stored.
      </p>
      {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
    </div>
  );
}

/** Append-only activity history plus private staff notes. */
export function AtsActivityPanel({
  data,
  canReview,
  onAddNote,
}: {
  data: ApplicantDetail;
  canReview: boolean;
  onAddNote: (body: string) => Promise<unknown>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await onAddNote(text);
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That note could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-status-neutral">
          System entries are append-only and cannot be edited or deleted.
        </p>
        {data.events.length ? (
          data.events.map((e) => (
            <div key={e.id} className="border-t border-border pt-3">
              <p className="text-sm text-primary">
                {e.type === "status_changed"
                  ? `Status changed ${statusLabel(e.fromStatus)} → ${statusLabel(e.toStatus)}`
                  : e.type === "file_accessed"
                    ? `${e.detail} opened`
                    : e.detail || eventLabel(e.type)}
              </p>
              <p className="text-xs text-status-neutral">
                {e.actor} · {fmt(e.createdAt)}
              </p>
            </div>
          ))
        ) : (
          <div className="border-t border-border pt-3">
            <p className="text-sm text-primary">Application submitted</p>
            <p className="text-xs text-status-neutral">Applicant · {fmt(data.submittedAt)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
          Private staff notes
        </p>
        {canReview ? (
          <>
            {data.notes.length ? (
              <ul className="flex flex-col gap-2">
                {data.notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="text-xs font-semibold text-status-neutral">
                      {n.author} · {fmt(n.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-foreground">{n.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-status-neutral">No notes yet.</p>
            )}
            <label className="mt-1 text-xs font-semibold text-primary">
              Add a note (permanent, cannot be edited or deleted)
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.currentTarget.value)}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
              />
            </label>
            <button
              type="button"
              disabled={!body.trim() || busy}
              onClick={() => void submit()}
              className="btn-solid w-fit px-5 py-2 text-sm disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save note"}
            </button>
            {error ? <p className="text-sm font-semibold text-review-needs">{error}</p> : null}
          </>
        ) : (
          <p className="text-sm text-status-neutral">
            Private notes are visible to Admin and HR only.
          </p>
        )}
      </div>

      {data.milestoneTrail.length ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
            Milestone trail
          </p>
          {data.milestoneTrail.map((t) => (
            <div key={t.id} className="border-t border-border/70 pt-2">
              <p className="text-sm text-primary">{milestoneLabel(t.milestone)}</p>
              <p className="text-xs text-status-neutral">
                {t.completedAt ? `Completed ${fmt(t.completedAt)}` : `Due ${fmt(t.dueAt)}`}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
