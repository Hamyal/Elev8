/**
 * Signed-in applicant workspace, matching the approved design preview.
 *
 * One applicant is open at a time: a compact summary answers who they are,
 * where they are, the next action, who owns it and when it is due. Every
 * detailed panel (progress, application, communications, scheduling, files,
 * activity) opens in its own overlay instead of stacking down the page. The
 * panels themselves are passed in unchanged, so permissions and workflow logic
 * are untouched.
 */
import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MILESTONE_BY_KEY, normalizeMilestone, normalizeStatus, statusLabel } from "@/lib/ats-workflow";
import type { ApplicantDetail } from "@/lib/ats.functions";
import type { FlagStatus } from "@/components/ats/ApplicantRecordPanel";
import {
  HrReviewModal,
  flagStatusLabel,
  flagStatusTextClass,
} from "@/components/ats/HrReviewModal";
import {
  AtsCompleteStepModal,
  AtsDecisionModal,
  AtsReopenModal,
  DECISION_CHOICES,
  type CompleteStepActions,
  type DecisionActions,
  type ReopenActions,
} from "@/components/ats/WorkflowModals";

type Overlay =
  | "progress"
  | "complete"
  | "decision"
  | "reopen"
  | "application"
  | "communications"
  | "scheduling"
  | "files"
  | "activity"
  | "record"
  | null;



function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function overdueBy(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Overdue by less than an hour";
  if (hours < 24) return `Overdue by ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
}

function WorkspaceModal({
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
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-3xl">
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

export function AtsApplicantWorkspace({
  data,
  onBack,
  onPrev,
  onNext,
  staff,
  workflowActions,
  workflowPanel,
  schedulingPanel,
  communicationsPanel,
  recordPanel,
  applicationPanel,
  filesPanel,
  activityPanel,
  canReview,
  onReviewFlag,
}: {
  data: ApplicantDetail;
  onBack: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  staff: { userId: string; name: string }[];
  workflowActions: CompleteStepActions & DecisionActions & ReopenActions;
  workflowPanel: ReactNode;
  schedulingPanel: ReactNode;
  communicationsPanel: ReactNode;
  recordPanel: ReactNode;
  applicationPanel: ReactNode;
  filesPanel: ReactNode;
  activityPanel: ReactNode;
  canReview: boolean;
  onReviewFlag: (input: { flagId: string; status: FlagStatus; notes: string }) => Promise<unknown>;
}) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [flagIndex, setFlagIndex] = useState<number | null>(null);
  const [reviewAll, setReviewAll] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const active = data.flags.filter((f) => f.status !== "Resolved");
  const resolved = data.flags.filter((f) => f.status === "Resolved");
  const needsCount = active.filter((f) => f.status === "Needs Review").length;
  const discussedCount = active.length - needsCount;
  const overdueNow =
    !!data.dueAt && !data.completedAt && new Date(data.dueAt).getTime() < Date.now();
  const status = normalizeStatus(data.status);
  const currentMilestone = normalizeMilestone(data.milestone);
  /**
   * Second outreach stays inside "Applicant response received" as a
   * communication attempt rather than a milestone of its own.
   */
  const decisionChoices = DECISION_CHOICES[currentMilestone] ?? null;
  const awaitingApplicant = MILESTONE_BY_KEY.get(currentMilestone)?.awaitingApplicant ?? false;

  const pendingConfirmation = [...data.scheduling]
    .reverse()
    .find((s) => !s.completedAt && s.confirmationState && s.confirmationState !== "confirmed");

  /** Warns before leaving the applicant with unsaved review work. */
  const guard = (go: () => void) => () => {
    if (dirty) setPendingNav(() => go);
    else go();
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl min-w-0 flex-col px-4 py-5 lg:max-w-none lg:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <button
          type="button"
          onClick={guard(onBack)}
          className="flex items-center gap-1 text-sm text-teal underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to Applicants
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-9"
            disabled={!onPrev}
            onClick={onPrev ? guard(onPrev) : undefined}
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span className="hidden xl:inline">Previous Applicant</span>
            <span className="xl:hidden">Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-9"
            disabled={!onNext}
            onClick={onNext ? guard(onNext) : undefined}
          >
            <span className="hidden xl:inline">Next Applicant</span>
            <span className="xl:hidden">Next</span>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Applicant header */}
      <header className="mt-5">
        <h1 className="text-2xl font-semibold text-primary">{data.name}</h1>
        <p className="text-xs text-status-neutral">{data.reference}</p>
        <p className="mt-1 break-words text-sm text-status-neutral">
          {data.email} · {data.phone}
        </p>
        <p className="mt-3 inline-flex rounded-full border border-teal/40 bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
          {statusLabel(data.status)}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-sm text-status-neutral">
        <span>
          <span className="font-semibold text-primary">Assigned to</span>{" "}
          {data.assignedName || "Unassigned"}
        </span>
        <span aria-hidden className="text-border">·</span>
        <span>
          <span className="font-semibold text-primary">Due</span>{" "}
          {data.dueAt ? formatDateTime(data.dueAt) : "No due date"}
          {overdueNow && data.dueAt ? (
            <span className="ml-1 font-semibold text-review-needs">
              ({overdueBy(data.dueAt)})
            </span>
          ) : null}
        </span>
      </div>
      {status === "not_selected" ? (
        <div className="mt-5 flex flex-col items-start gap-3">
          <p className="text-sm text-status-neutral">
            This application is closed. No further action is required.
          </p>
          {canReview ? (
            <Button
              className="bg-milestone-current text-accent-foreground hover:bg-milestone-current/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => setOverlay("reopen")}
            >
              Reopen Application
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <button
          type="button"
          onClick={() => setOverlay("progress")}
          className="text-teal underline"
        >
          View Progress
        </button>
        <button
          type="button"
          onClick={() => setOverlay("application")}
          className="text-teal underline"
        >
          View Application
        </button>
        <button
          type="button"
          onClick={() => setOverlay("communications")}
          className="text-teal underline"
        >
          Communications
        </button>
        <button
          type="button"
          onClick={() => setOverlay("scheduling")}
          className="text-teal underline"
        >
          Scheduling
        </button>
        <button type="button" onClick={() => setOverlay("files")} className="text-teal underline">
          Files
        </button>
        <button type="button" onClick={() => setOverlay("activity")} className="text-teal underline">
          Activity
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="text-teal underline">More</DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setOverlay("activity")}>
              Activity history
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOverlay("record")}>
              Full record (all sections)
            </DropdownMenuItem>
            {status === "not_selected" ? (
              canReview ? (
                <DropdownMenuItem onSelect={() => setOverlay("reopen")}>
                  Reopen application
                </DropdownMenuItem>
              ) : null
            ) : (
              <DropdownMenuItem onSelect={() => setOverlay("decision")}>
                Close application
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {awaitingApplicant || pendingConfirmation ? (
        <p className="mt-5 text-xs text-status-neutral">
          {pendingConfirmation
            ? `Awaiting confirmation — ${pendingConfirmation.kind} proposed for ${
                pendingConfirmation.proposedDate
                  ? formatDateTime(pendingConfirmation.proposedDate)
                  : "a time on file"
              }.${
                pendingConfirmation.confirmationDueAt
                  ? ` Confirm by ${formatDateTime(pendingConfirmation.confirmationDueAt)}.`
                  : ""
              }`
            : "Awaiting the applicant's response on this step."}
        </p>
      ) : null}

      {/* HR review summary */}
      <div className="mt-8 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-base font-semibold text-review-needs">
              <AlertTriangle className="size-4 text-review-needs" aria-hidden />
              {active.length} active HR-review item{active.length === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-status-neutral">
              {needsCount} Needs Review · {discussedCount} Discussed — Follow-Up Needed
            </p>
          </div>
          {active.length ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReviewAll(true);
                setFlagIndex(0);
              }}
            >
              Review All
            </Button>
          ) : null}
        </div>

        {active.length === 0 ? (
          <p className="mt-3 text-sm text-status-neutral">No active HR-review items.</p>
        ) : (
          <ul className="mt-4 flex flex-col">
            {active.map((f, i) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    setReviewAll(false);
                    setFlagIndex(i);
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-border py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-primary">{f.question}</span>
                    <span className="block text-xs text-status-neutral">{f.answer}</span>
                    <span
                      className={cn("block text-xs font-semibold", flagStatusTextClass(f.status))}
                    >
                      {flagStatusLabel(f.status)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-status-neutral" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-review-resolved"
        >
          <Check className="size-4" aria-hidden /> Resolved HR-Review History ({resolved.length})
          <ChevronRight
            className={cn("size-4 transition-transform", historyOpen && "rotate-90")}
            aria-hidden
          />
        </button>
        {historyOpen ? (
          <ul className="mt-3 flex flex-col gap-4">
            {resolved.length === 0 ? (
              <li className="text-sm text-status-neutral">Nothing resolved yet.</li>
            ) : (
              resolved.map((f) => (
                <li key={f.id} className="border-t border-border pt-3">
                  <p className="text-sm font-semibold text-review-resolved">✓ {f.question}</p>
                  <p className="mt-1 text-xs text-status-neutral">Submitted answer</p>
                  <p className="whitespace-pre-line text-sm text-primary">{f.answer}</p>
                  {f.hrNotes ? (
                    <p className="mt-1 text-sm text-primary">Resolution note: {f.hrNotes}</p>
                  ) : null}
                  {canReview ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        void onReviewFlag({
                          flagId: f.id,
                          status: "Needs Review",
                          notes:
                            f.hrNotes ??
                            "Review reopened. The earlier resolution is preserved above.",
                        })
                      }
                    >
                      Reopen Review
                    </Button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <HrReviewModal
        open={flagIndex !== null}
        flags={active}
        index={flagIndex ?? 0}
        applicantName={data.name}
        reviewAll={reviewAll}
        canReview={canReview}
        onIndex={(next) => setFlagIndex(next)}
        onClose={() => {
          setFlagIndex(null);
          setDirty(false);
        }}
        onSave={onReviewFlag}
        onDirtyChange={setDirty}
      />

      <WorkspaceModal
        open={overlay === "progress"}
        onClose={() => setOverlay(null)}
        title="View Progress"
        description="Every stage and milestone. Only the current milestone can be completed."

      >
        {workflowPanel}
      </WorkspaceModal>

      <WorkspaceModal
        open={overlay === "application"}
        onClose={() => setOverlay(null)}
        title="View Application"
        description={`${data.name} · ${data.reference}`}
      >
        {applicationPanel}
      </WorkspaceModal>

      <WorkspaceModal
        open={overlay === "scheduling"}
        onClose={() => setOverlay(null)}
        title="Scheduling"
        description="Interview windows, applicant availability, and confirmation state."
      >
        {schedulingPanel}
      </WorkspaceModal>

      <WorkspaceModal
        open={overlay === "communications"}
        onClose={() => setOverlay(null)}
        title="Communications"
        description="Approved messages and what staff recorded as sent."
      >
        {communicationsPanel}
      </WorkspaceModal>

      <WorkspaceModal
        open={overlay === "files"}
        onClose={() => setOverlay(null)}
        title="Files"
        description="Certifications and schedules stored privately. Resumes are not stored."
      >
        {filesPanel}
      </WorkspaceModal>

      <WorkspaceModal
        open={overlay === "activity"}
        onClose={() => setOverlay(null)}
        title="Activity history"
        description="System entries are append-only and cannot be edited or deleted."
      >
        {activityPanel}
      </WorkspaceModal>

      <WorkspaceModal
        open={overlay === "record"}
        onClose={() => setOverlay(null)}
        title="Application, documents, HR review, notes and activity"
        description={`${data.name} · ${data.reference}`}
      >
        {recordPanel}
      </WorkspaceModal>

      <AtsCompleteStepModal
        open={overlay === "complete"}
        onClose={() => setOverlay(null)}
        data={data}
        staff={staff}
        actions={workflowActions}
      />

      <AtsDecisionModal
        open={overlay === "decision"}
        onClose={() => setOverlay(null)}
        data={data}
        choices={decisionChoices ?? [{ label: "Do Not Move Forward" }]}
        actions={workflowActions}
      />

      <AtsReopenModal
        open={overlay === "reopen"}
        onClose={() => setOverlay(null)}
        data={data}
        actions={workflowActions}
      />

      <WorkspaceModal
        open={pendingNav !== null}
        onClose={() => setPendingNav(null)}
        title="Leave this applicant?"
        description="You have unsaved review information on this applicant. Incomplete entries are never saved automatically."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setPendingNav(null)}>
            Stay on this applicant
          </Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => {
              const go = pendingNav;
              setPendingNav(null);
              setDirty(false);
              setFlagIndex(null);
              go?.();
            }}
          >
            Discard and leave
          </Button>
        </div>
      </WorkspaceModal>
    </section>
  );
}
