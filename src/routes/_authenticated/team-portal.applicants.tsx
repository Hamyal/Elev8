import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronDown, Loader2, LogOut, Search, ShieldCheck } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { CommunicationLog } from "@/components/ats/CommunicationLog";
import { SchedulingPanel } from "@/components/ats/SchedulingPanel";
import { ApplicantRecordPanel } from "@/components/ats/ApplicantRecordPanel";
import {
  AtsActivityPanel,
  AtsApplicationPanel,
  AtsFilesPanel,
  AtsProgressPanel,
} from "@/components/ats/RecordPanels";

import { AtsQueueNav } from "@/components/ats/QueueNav";
import { AtsApplicantWorkspace } from "@/components/ats/ApplicantWorkspace";
import { ScheduleBoard } from "@/components/ats/ScheduleBoard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { applyView, isOverdue, type StageView } from "@/lib/ats-views";
import {
  emptyFilters,
  filtersActive,
  relevantAvailability,
  type FilterState,
} from "@/lib/ats-availability";
import { STATUS_KEYS, milestoneLabel, normalizeStatus, statusLabel } from "@/lib/ats-workflow";

import {
  acknowledgeInterviewMaterials,
  addApplicantNote,
  advanceToInterview2,
  assignApplicant,
  bookInterviewSlot,
  changeApplicantStatus,
  completeAndAdvanceMilestone,
  completeMilestone,
  createFileLink,
  getApplicant,
  getStaffAccess,
  jumpToMilestone,
  listApplicants,
  listAssignableStaff,
  listConfirmedInterviewSlots,
  recordCommunication,
  reviewHrFlag,
  reopenApplication,
  saveConfirmedSlots,
  saveScheduling,
  saveSlotOffer,
  sendInterviewMaterials,
  setConfirmationState,
  setMilestone as setMilestoneFn,
  setMilestoneDeadline,
  unbookInterviewSlot,
  type ApplicantDetail,
  type ApplicantRow,
} from "@/lib/ats.functions";

export const Route = createFileRoute("/_authenticated/team-portal/applicants")({
  head: () => ({
    meta: [
      { title: "Applicant Tracking — Elev8 Services" },
      {
        name: "description",
        content:
          "Staff workspace for reviewing submitted Elev8 Services Support Professional applications, hiring milestones, HR review flags, and private notes.",
      },
      { property: "og:title", content: "Applicant Tracking — Elev8 Services" },
      {
        property: "og:description",
        content: "Staff workspace for reviewing submitted Elev8 Services applications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplicantsDashboard,
});

type MobileScreen = "summary" | "list" | "applicant";
type QueueMode =
  | "urgent"
  | "attention"
  | "overdue"
  | "today"
  | "awaiting"
  | "mine"
  | "newest"
  | "oldest"
  | "name"
  | "due"
  | "stage";
type QueueGroup = "Needs attention" | "Later";

const QUEUE_GROUPS: QueueGroup[] = ["Needs attention", "Later"];

const QUEUE_LABELS: Record<QueueMode, string> = {
  urgent: "Most urgent",
  attention: "Needs attention",
  overdue: "Overdue",
  today: "Due today",
  awaiting: "Awaiting confirmation",
  mine: "Assigned to me",
  newest: "Newest applications",
  oldest: "Oldest applications",
  name: "Applicant name A–Z",
  due: "Due date",
  stage: "Hiring stage",
};

function startOfDay(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dueDayOffset(row: ApplicantRow) {
  if (!row.dueAt) return null;
  const due = startOfDay(new Date(row.dueAt));
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((due.getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

function isDueToday(row: ApplicantRow) {
  return !row.completedAt && dueDayOffset(row) === 0;
}

function queueGroup(row: ApplicantRow): QueueGroup {
  if (isOverdue(row) || isDueToday(row) || row.confirmationPending || row.openFlagCount > 0) {
    return "Needs attention";
  }
  return "Later";
}

function urgencyScore(row: ApplicantRow) {
  if (isOverdue(row)) return 0;
  if (row.openFlagCount > 0) return 1;
  if (row.confirmationPending) return 2;
  if (normalizeStatus(row.status) === "not_selected") return 5;
  return 4;
}

function dueTime(row: ApplicantRow) {
  return row.dueAt ? new Date(row.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
}

function queueTiming(row: ApplicantRow): { label: string; urgent: boolean } {
  if (normalizeStatus(row.status) === "not_selected") return { label: "No action due", urgent: false };
  if (!row.dueAt) return { label: "No due date", urgent: false };
  const due = new Date(row.dueAt);
  const days = dueDayOffset(row);
  const time = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (isOverdue(row)) {
    const late = Math.abs(days ?? 0);
    return { label: late <= 0 ? "Overdue" : `${late} day${late === 1 ? "" : "s"} overdue`, urgent: true };
  }
  if (days === 0) return { label: `Due today, ${time}`, urgent: true };
  if (days === 1) return { label: `Due tomorrow, ${time}`, urgent: true };
  return {
    label: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    urgent: false,
  };
}

function ApplicantsDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchAccess = useServerFn(getStaffAccess);
  const fetchList = useServerFn(listApplicants);
  const fetchStaff = useServerFn(listAssignableStaff);

  const access = useQuery({ queryKey: ["ats", "access"], queryFn: () => fetchAccess() });
  const list = useQuery({ queryKey: ["ats", "applicants"], queryFn: () => fetchList() });
  const staff = useQuery({ queryKey: ["ats", "staff-options"], queryFn: () => fetchStaff() });

  const [stage, setStage] = useState<StageView>("all");
  const [filters, setFilters] = useState<FilterState>(() => emptyFilters());
  const [query, setQuery] = useState("");
  const [queueMode, setQueueMode] = useState<QueueMode>("urgent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>("summary");
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardBusy, setBoardBusy] = useState(false);

  const fetchBoard = useServerFn(listConfirmedInterviewSlots);
  const bookSlot = useServerFn(bookInterviewSlot);
  const unbookSlot = useServerFn(unbookInterviewSlot);
  const board = useQuery({
    queryKey: ["ats", "interview-board", "interview_1"],
    queryFn: () => fetchBoard({ data: { kind: "interview_1" } }),
    enabled: boardOpen,
  });
  const refreshBoard = async () => {
    await queryClient.invalidateQueries({ queryKey: ["ats", "interview-board"] });
    await queryClient.invalidateQueries({ queryKey: ["ats", "applicants"] });
  };
  const queueScrollPosition = useRef(0);

  const rows: ApplicantRow[] = list.data ?? [];
  const myId = access.data?.userId ?? "";

  const visible = useMemo(() => {
    const filtered = applyView(rows, { stage, alert: null, filters, query, myId }).filter((row) => {
      if (queueMode === "attention") return queueGroup(row) === "Needs attention";
      if (queueMode === "overdue") return isOverdue(row);
      if (queueMode === "today") return isDueToday(row) && !isOverdue(row);
      if (queueMode === "awaiting") return row.confirmationPending;
      if (queueMode === "mine") return !!myId && row.assignedTo === myId;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (queueMode === "newest")
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      if (queueMode === "oldest")
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      if (queueMode === "name") return a.name.localeCompare(b.name);
      if (queueMode === "due") return dueTime(a) - dueTime(b);
      if (queueMode === "stage")
        return (
          STATUS_KEYS.indexOf(normalizeStatus(a.status)) -
          STATUS_KEYS.indexOf(normalizeStatus(b.status))
        );
      return urgencyScore(a) - urgencyScore(b) || dueTime(a) - dueTime(b);
    });
  }, [rows, stage, filters, query, myId, queueMode]);

  const selected = (selectedId ? rows.find((r) => r.id === selectedId) : null) ?? visible[0] ?? null;
  const selectedIndex = selected ? visible.findIndex((r) => r.id === selected.id) : -1;

  const openApplicant = (id: string) => {
    if (mobileScreen === "list" && typeof window !== "undefined") {
      queueScrollPosition.current = window.scrollY;
    }
    setSelectedId(id);
    setMobileScreen("applicant");
  };

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/team-portal", replace: true });
  }

  const accessError = access.error instanceof Error ? access.error.message : null;
  const listError = list.error instanceof Error ? list.error.message : null;
  const canReview = access.data?.canReview ?? false;
  const availabilityOn = filtersActive(filters);
  const workspaceOpen = mobileScreen === "applicant";

  const groupedVisible = QUEUE_GROUPS.map((group) => ({
    group,
    applicants: visible.filter((row) => queueGroup(row) === group),
  })).filter(({ applicants }) => applicants.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-secondary/60 px-4 py-2">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to="/team-portal" className="inline-flex items-center gap-1 font-semibold text-teal">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Team Portal
            </Link>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="size-3.5 text-teal" aria-hidden="true" />
              {access.data?.roles.length
                ? access.data.roles.map((r) => r.toUpperCase()).join(" · ")
                : "checking access…"}
            </span>
            {access.data?.isAdmin ? (
              <Link to="/team-portal/admin" className="font-semibold text-teal underline underline-offset-4">
                Admin
              </Link>
            ) : null}
            <Link to="/team-portal/account" className="font-semibold text-teal underline underline-offset-4">
              My account
            </Link>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 font-semibold text-primary"
          >
            <LogOut className="size-3.5 text-teal" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>

      {accessError ? (
        <p className="border-b border-accent/50 bg-accent/5 px-4 py-3 text-sm font-semibold text-primary">
          {accessError}
        </p>
      ) : null}

      <div className="mx-auto min-h-[calc(100vh-41px)] max-w-[1600px] lg:grid lg:grid-cols-[220px_340px_minmax(0,1fr)]">
        <AtsQueueNav
          className={mobileScreen === "summary" ? "flex" : "hidden lg:flex"}
          applicants={rows}
          stage={stage}
          filters={filters}
          query={query}
          onQuery={setQuery}
          onStage={setStage}
          onFilters={setFilters}
          onShowList={() => setMobileScreen("list")}
          onShowBoard={() => setBoardOpen(true)}
          boardActive={boardOpen}
          focusMuted={!!selectedId}
        />

        {/* Middle applicant queue */}
        <section
          className={cn(
            "min-w-0 flex-col border-b border-border bg-secondary/30 px-4 py-5 lg:flex lg:border-b-0 lg:border-r",
            mobileScreen === "list" ? "flex" : "hidden lg:flex",
            boardOpen && "!hidden",
          )}
        >
          <button
            type="button"
            onClick={() => setMobileScreen("summary")}
            className="mb-3 flex items-center gap-1 text-xs text-teal lg:hidden"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back to applicants
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-primary">Applicant Queue</h1>
            <p className="text-xs text-muted-foreground">
              {visible.length} applicant{visible.length === 1 ? "" : "s"}
            </p>
          </div>

          <label className="relative mt-4 hidden lg:block">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <span className="sr-only">Search name, email, or phone</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, or phone"
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mt-3 w-full justify-between bg-background font-medium">
                Queue: {QUEUE_LABELS[queueMode]}
                <ChevronDown className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" align="start">
              <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                Work queues
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={queueMode}
                onValueChange={(value) => setQueueMode(value as QueueMode)}
              >
                {(["urgent", "attention", "overdue", "today", "awaiting", "mine"] as QueueMode[]).map(
                  (mode) => (
                    <DropdownMenuRadioItem key={mode} value={mode}>
                      {QUEUE_LABELS[mode]}
                    </DropdownMenuRadioItem>
                  ),
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                  Other ordering
                </DropdownMenuLabel>
                {(["newest", "oldest", "name", "due", "stage"] as QueueMode[]).map((mode) => (
                  <DropdownMenuRadioItem key={mode} value={mode}>
                    {QUEUE_LABELS[mode]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mt-4 flex flex-col">
            {list.isPending ? (
              <p className="inline-flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading applications…
              </p>
            ) : null}
            {listError ? (
              <p className="rounded-lg border border-accent/50 bg-accent/5 p-4 text-sm font-semibold text-primary">
                {listError}
              </p>
            ) : null}
            {!list.isPending && !listError && visible.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No applicants match this view.</p>
            ) : (
              groupedVisible.map(({ group, applicants: groupApplicants }) => (
                <div key={group}>
                  <div className="flex items-center justify-between border-b border-border pb-1 pt-4">
                    <p
                      className={cn(
                        "text-[11px] font-semibold uppercase",
                        group === "Needs attention" ? "text-review-needs" : "text-status-neutral",
                      )}
                    >
                      {group}
                    </p>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {groupApplicants.length}
                    </span>
                  </div>
                  {groupApplicants.map((row) => {
                    const selectedRow = selected?.id === row.id;
                    const timing = queueTiming(row);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => openApplicant(row.id)}
                        aria-current={selectedRow ? "true" : undefined}
                        className={cn(
                          "block w-full border-b border-l-[3px] border-border border-l-transparent px-3 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                          selectedRow
                            ? "border-l-milestone-current bg-focus-selected opacity-100"
                            : "bg-transparent text-primary hover:bg-background focus-visible:bg-background lg:text-focus-faded",
                        )}
                      >
                        <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                          <span
                            className={cn(
                              "min-w-0 text-sm font-semibold",
                              selectedRow
                                ? "text-focus-selected-name"
                                : "text-primary lg:text-focus-faded",
                            )}
                          >
                            {row.name}
                          </span>
                          <span
                            className={cn(
                              "text-right text-[11px] font-medium",
                              selectedRow && timing.urgent
                                ? "text-review-needs"
                                : "text-status-neutral lg:text-focus-faded",
                            )}
                          >
                            {timing.label}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-1 block text-xs leading-4",
                            selectedRow
                              ? "text-status-neutral"
                              : "text-status-neutral lg:text-focus-faded-supporting",
                          )}
                        >
                          {statusLabel(row.status)} · {milestoneLabel(row.milestone)}
                          {row.confirmationPending ? " · Awaiting confirmation" : ""}
                          {row.openFlagCount ? (
                            <span
                              className={cn(
                                selectedRow ? "text-review-needs" : "lg:text-focus-faded-supporting",
                              )}
                            >
                              {` · ${row.openFlagCount} HR review${row.openFlagCount === 1 ? "" : "s"}`}
                            </span>
                          ) : null}
                          {availabilityOn
                            ? ` · ${relevantAvailability(row.availability, filters).join(" · ")}`
                            : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Schedule Interviews — display-only board across every applicant */}
        {boardOpen ? (
          <section className="min-w-0 px-4 py-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-primary">Schedule Interviews</h1>
                <p className="text-xs text-muted-foreground">
                  Every candidate&rsquo;s confirmed Interview #1 availability. Booking or undoing a
                  slot is the only thing here that changes a record.
                </p>
              </div>
              <Button variant="outline" onClick={() => setBoardOpen(false)}>
                Back to applicants
              </Button>
            </div>
            <div className="mt-4">
              {board.isPending ? (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading confirmed availability…
                </p>
              ) : (
                <ScheduleBoard
                  rows={board.data ?? []}
                  busy={boardBusy}
                  onBook={(input) =>
                    void (async () => {
                      setBoardBusy(true);
                      try {
                        await bookSlot({
                          data: {
                            id: input.applicationId,
                            kind: "interview_1",
                            date: input.date,
                            time: input.time,
                            facility: input.facility,
                            confirmBy: input.confirmBy,
                          },
                        });
                        await refreshBoard();
                      } finally {
                        setBoardBusy(false);
                      }
                    })()
                  }
                  onUnbook={(input) =>
                    void (async () => {
                      setBoardBusy(true);
                      try {
                        await unbookSlot({
                          data: { id: input.applicationId, kind: "interview_1" },
                        });
                        await refreshBoard();
                      } finally {
                        setBoardBusy(false);
                      }
                    })()
                  }
                />
              )}
            </div>
          </section>
        ) : null}

        {/* Selected applicant workspace */}
        <div
          className={cn(
            "min-w-0",
            workspaceOpen ? "block" : "hidden lg:block",
            boardOpen && "!hidden",
          )}
        >
          {selected ? (
            <ApplicantDetailPanel
              key={selected.id}
              id={selected.id}
              canReview={canReview}
              staff={staff.data ?? []}
              onBack={() => {
                setMobileScreen("list");
                if (typeof window !== "undefined") {
                  requestAnimationFrame(() =>
                    window.scrollTo({ top: queueScrollPosition.current }),
                  );
                }
              }}
              onPrev={
                selectedIndex > 0 ? () => openApplicant(visible[selectedIndex - 1]!.id) : null
              }
              onNext={
                selectedIndex >= 0 && selectedIndex < visible.length - 1
                  ? () => openApplicant(visible[selectedIndex + 1]!.id)
                  : null
              }
            />
          ) : (
            <p className="px-6 py-10 text-sm text-muted-foreground">
              Select an applicant from the queue to open their record.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ApplicantDetailPanel({
  id,
  canReview,
  staff,
  onBack,
  onPrev,
  onNext,
}: {
  id: string;
  canReview: boolean;
  staff: { userId: string; name: string }[];
  onBack: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getApplicant);
  const jumpStep = useServerFn(jumpToMilestone);
  const setStatus = useServerFn(changeApplicantStatus);
  const addNote = useServerFn(addApplicantNote);
  const setFlag = useServerFn(reviewHrFlag);
  const fileLink = useServerFn(createFileLink);
  const saveMilestone = useServerFn(setMilestoneFn);
  const finishMilestone = useServerFn(completeMilestone);
  const completeAndAdvance = useServerFn(completeAndAdvanceMilestone);
  const saveDeadline = useServerFn(setMilestoneDeadline);
  const assign = useServerFn(assignApplicant);
  const advance = useServerFn(advanceToInterview2);
  const reopen = useServerFn(reopenApplication);
  const logCommunication = useServerFn(recordCommunication);
  const saveSchedule = useServerFn(saveScheduling);
  const saveConfirmation = useServerFn(setConfirmationState);
  const saveSlots = useServerFn(saveSlotOffer);
  const saveConfirmed = useServerFn(saveConfirmedSlots);
  const bookSlot = useServerFn(bookInterviewSlot);
  const unbookSlot = useServerFn(unbookInterviewSlot);
  const fetchBoard = useServerFn(listConfirmedInterviewSlots);
  const sendMaterials = useServerFn(sendInterviewMaterials);
  const ackMaterials = useServerFn(acknowledgeInterviewMaterials);

  const detail = useQuery({
    queryKey: ["ats", "applicant", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const board = useQuery({
    queryKey: ["ats", "interview-board", "interview_1"],
    queryFn: () => fetchBoard({ data: { kind: "interview_1" } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ats", "applicant", id] });
    queryClient.invalidateQueries({ queryKey: ["ats", "interview-board"] });
    queryClient.invalidateQueries({ queryKey: ["ats", "applicants"] });
  };

  const after = async (promise: Promise<unknown>) => {
    const result = await promise;
    invalidate();
    return result;
  };

  const backToQueue = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 text-sm font-semibold text-primary lg:hidden"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to applicants
    </button>
  );

  if (detail.isPending)
    return (
      <div className="flex flex-col gap-4 px-6 py-10">
        {backToQueue}
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading application…
        </p>
      </div>
    );

  if (detail.error)
    return (
      <div className="flex flex-col gap-4 px-6 py-10">
        {backToQueue}
        <p className="text-sm font-semibold text-accent">
          {detail.error instanceof Error ? detail.error.message : "This record could not be loaded."}
        </p>
      </div>
    );


  const data = detail.data as ApplicantDetail;

  return (
    <AtsApplicantWorkspace
      data={data}
      onBack={onBack}
      onPrev={onPrev}
      onNext={onNext}
      canReview={canReview}
      onReviewFlag={(input) => after(setFlag({ data: input }))}
      staff={staff}
      workflowActions={{
        completeMilestone: (detailText) =>
          after(finishMilestone({ data: { id, ...(detailText ? { detail: detailText } : {}) } })),
        completeAndAdvance: (input) => after(completeAndAdvance({ data: { id, ...input } })),
        assign: (staffId) => after(assign({ data: { id, staffId } })),
        setDeadline: (dueAt) => after(saveDeadline({ data: { id, dueAt } })),
        setMilestone: (input) => after(saveMilestone({ data: { id, ...input } })),
        advanceToInterview2: () => after(advance({ data: { id } })),
        reopen: (input) => after(reopen({ data: { id, ...input } })),
      }}
      workflowPanel={
        <AtsProgressPanel
          data={data}
          canReview={canReview}
          jumpActions={{
            jumpToStep: (input) => after(jumpStep({ data: { id, ...input } })),
          }}
          screeningActions={{
            completeAndAdvance: (input) => after(completeAndAdvance({ data: { id, ...input } })),
            setMilestone: (input) => after(saveMilestone({ data: { id, ...input } })),
            recordCommunication: (input) =>
              after(
                logCommunication({
                  data: {
                    id,
                    type: input.type,
                    ...(input.milestone ? { milestone: input.milestone } : {}),
                    ...(input.template ? { template: input.template } : {}),
                    message: input.message ?? "",
                    privateNote: input.privateNote ?? "",
                  },
                }),
              ),
            saveScheduling: (input) => after(saveSchedule({ data: { id, ...input } })),
            setConfirmation: (input) => after(saveConfirmation({ data: { id, ...input } })),
          }}
          interview1Actions={{
            completeAndAdvance: (input) => after(completeAndAdvance({ data: { id, ...input } })),
            advanceToInterview2: () => after(advance({ data: { id } })),
            setMilestone: (input) => after(saveMilestone({ data: { id, ...input } })),
            recordCommunication: (input) =>
              after(
                logCommunication({
                  data: {
                    id,
                    type: input.type,
                    ...(input.milestone ? { milestone: input.milestone } : {}),
                    ...(input.template ? { template: input.template } : {}),
                    message: input.message ?? "",
                    privateNote: input.privateNote ?? "",
                  },
                }),
              ),
            saveSlotOffer: (input) => after(saveSlots({ data: { id, ...input } })),
            saveConfirmedSlots: (input) => after(saveConfirmed({ data: { id, ...input } })),
            bookSlot: (input) =>
              after(
                bookSlot({
                  data: {
                    id: input.applicationId,
                    kind: "interview_1",
                    date: input.date,
                    time: input.time,
                    facility: input.facility,
                    confirmBy: input.confirmBy,
                  },
                }),
              ),
            unbookSlot: (input) =>
              after(unbookSlot({ data: { id: input.applicationId, kind: "interview_1" } })),
            boardRows: board.data ?? [],
          }}
        />
      }


      schedulingPanel={
        <SchedulingPanel
          data={data}
          canReview={canReview}
          actions={{
            save: (input) => after(saveSchedule({ data: { id, ...input } })),
            setConfirmation: (input) => after(saveConfirmation({ data: { id, ...input } })),
            saveSlots: (input) => after(saveSlots({ data: { id, ...input } })),
            sendMaterials: (url) => after(sendMaterials({ data: { id, url } })),
            acknowledgeMaterials: (input) => after(ackMaterials({ data: input })),
          }}
        />
      }
      communicationsPanel={
        <CommunicationLog
          data={data}
          canReview={canReview}
          onRecord={(input) => after(logCommunication({ data: { id, ...input } }))}
        />
      }
      applicationPanel={<AtsApplicationPanel data={data} />}
      filesPanel={
        <AtsFilesPanel
          data={data}
          onOpenFile={async (input) => {
            const result = await fileLink({ data: { id, ...input } });
            if (result?.url) window.open(result.url, "_blank", "noopener,noreferrer");
            invalidate();
            return result;
          }}
        />
      }
      activityPanel={
        <AtsActivityPanel
          data={data}
          canReview={canReview}
          onAddNote={(body) => after(addNote({ data: { id, body } }))}
        />
      }
      recordPanel={
        <ApplicantRecordPanel
          data={data}
          canReview={canReview}
          actions={{
            setStatus: (status) => after(setStatus({ data: { id, status } })),
            addNote: (body) => after(addNote({ data: { id, body } })),
            reviewFlag: (input) => after(setFlag({ data: input })),
            openFile: async (input) => {
              const result = await fileLink({ data: { id, ...input } });
              if (result?.url) window.open(result.url, "_blank", "noopener,noreferrer");
              invalidate();
              return result;
            },
          }}
        />
      }

    />
  );
}
