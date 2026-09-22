/**
 * Far-left navigation for the signed-in ATS.
 *
 * Three navigation rows whose flyouts open immediately to the right of the
 * navigation column on desktop, and as full-screen right-entering panels on
 * mobile. Everything here is display-only: choosing a stage, opening a work
 * queue, or filtering by availability never changes an applicant record.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeStatus, statusLabel } from "@/lib/ats-workflow";
import {
  AVAILABILITY_CATEGORIES,
  emptyFilters,
  filterSummary,
  filtersActive,
  type AvailabilityCategoryKey,
  type FilterState,
} from "@/lib/ats-availability";
import {
  ALERT_OPTIONS,
  applyView,
  matchesAlert,
  STAGE_ORDER,
  type AlertKey,
  type AlertView,
  type StageView,
  type ViewRow,
} from "@/lib/ats-views";

type MenuKey = "all" | "alerts" | "filter";

export function AtsLeftNav<T extends ViewRow>({
  className,
  applicants,
  stage,
  alert,
  filters,
  query,
  myId,
  onQuery,
  onStage,
  onAlert,
  onFilters,
}: {
  className?: string;
  applicants: T[];
  stage: StageView;
  alert: AlertView;
  filters: FilterState;
  query: string;
  myId: string;
  onQuery: (v: string) => void;
  onStage: (v: StageView) => void;
  onAlert: (v: AlertView) => void;
  onFilters: (v: FilterState) => void;
}) {
  const [menu, setMenu] = useState<MenuKey | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggers = useRef<Record<MenuKey, HTMLButtonElement | null>>({
    all: null,
    alerts: null,
    filter: null,
  });
  const ids = { all: useId(), alerts: useId(), filter: useId() };

  const close = (returnFocusTo?: MenuKey | null) => {
    const key = returnFocusTo ?? menu;
    setMenu(null);
    if (key) triggers.current[key]?.focus();
  };

  const toggle = (key: MenuKey) => setMenu((m) => (m === key ? null : key));

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const alertCounts = ALERT_OPTIONS.map((o) => ({
    ...o,
    count: applicants.filter((a) => matchesAlert(a, o.key, myId)).length,
  }));
  const alertTotal = alertCounts.reduce((n, o) => n + o.count, 0);

  const stageCount = (key: StageView) =>
    applicants.filter((a) => (key === "all" ? true : normalizeStatus(a.status) === key)).length;

  const stageName = stage === "all" ? "All Applicants" : statusLabel(stage);
  const activeAlert = alert ? ALERT_OPTIONS.find((o) => o.key === alert) : null;
  const availabilityOn = filtersActive(filters);

  return (
    <aside
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === "Escape" && menu) {
          e.stopPropagation();
          close();
        }
      }}
      className={cn(
        "flex flex-col gap-4 border-b border-border px-1 py-5 lg:relative lg:border-b-0 lg:border-r lg:px-4",
        className,
      )}
    >
      <p className="text-sm font-semibold tracking-tight text-primary">Elev8 Services ATS</p>

      <label className="relative block">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <span className="sr-only">Search applicants by name, email, or application number</span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search applicants"
          className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
      </label>

      <nav className="flex flex-col gap-1" aria-label="Applicant views">
        <NavRow
          label={stageName}
          hint={stage === "all" ? undefined : "Stage view"}
          count={stageCount(stage)}
          open={menu === "all"}
          controls={ids.all}
          onClick={() => toggle("all")}
          buttonRef={(el) => {
            triggers.current.all = el;
          }}
        />
        <NavRow
          label="Alerts & Overdue"
          hint={activeAlert ? `Showing: ${activeAlert.label}` : undefined}
          count={alertTotal}
          accent
          open={menu === "alerts"}
          controls={ids.alerts}
          onClick={() => toggle("alerts")}
          buttonRef={(el) => {
            triggers.current.alerts = el;
          }}
        />
        <NavRow
          label="Filter Applicants"
          open={menu === "filter"}
          controls={ids.filter}
          onClick={() => toggle("filter")}
          buttonRef={(el) => {
            triggers.current.filter = el;
          }}
        />
        {availabilityOn ? (
          <div className="px-1 pt-1">
            <p className="text-xs text-muted-foreground">{filterSummary(filters)}</p>
            <button
              type="button"
              onClick={() => onFilters(emptyFilters())}
              className="mt-1 text-xs text-teal underline"
            >
              Clear availability filter
            </button>
          </div>
        ) : null}
      </nav>

      {/* All Applicants — direct stage navigation */}
      <Flyout id={ids.all} open={menu === "all"} title="All Applicants" onClose={() => close("all")}>
        <ul className="flex flex-col">
          {(["all", ...STAGE_ORDER] as StageView[]).map((key) => {
            const label = key === "all" ? "All Applicants" : statusLabel(key);
            const selected = stage === key;
            return (
              <li key={String(key)}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    onStage(key);
                    close("all");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-secondary/70",
                    selected ? "bg-secondary font-semibold text-primary" : "text-primary",
                  )}
                >
                  <span className="truncate">{label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {stageCount(key)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Choosing a stage only changes what is displayed. It never changes an applicant&rsquo;s
          hiring stage or record.
        </p>
      </Flyout>

      {/* Alerts & Overdue — work queues */}
      <Flyout
        id={ids.alerts}
        open={menu === "alerts"}
        title="Alerts & Overdue"
        onClose={() => close("alerts")}
      >
        <ul className="flex flex-col">
          {alertCounts.map((o) => {
            const selected = alert === o.key;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    onAlert(selected ? null : (o.key as AlertKey));
                    close("alerts");
                  }}
                  className={cn(
                    "w-full rounded-md px-3 py-2.5 text-left hover:bg-secondary/70",
                    selected && "bg-secondary",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className={cn("truncate text-sm text-primary", selected && "font-semibold")}>
                      {o.label}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                      {o.count}
                      <ChevronRight className="size-3.5" aria-hidden />
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{o.help}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {alert ? (
          <button
            type="button"
            onClick={() => {
              onAlert(null);
              close("alerts");
            }}
            className="mt-3 text-xs text-teal underline"
          >
            Clear alert view
          </button>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Opening a work queue only changes what is displayed. Nothing is completed, resolved,
          reassigned, or rescheduled.
        </p>
      </Flyout>

      {/* Filter Applicants — submitted availability only */}
      <AvailabilityFlyout
        id={ids.filter}
        open={menu === "filter"}
        applicants={applicants}
        stage={stage}
        alert={alert}
        query={query}
        myId={myId}
        filters={filters}
        onApply={(next) => {
          onFilters(next);
          close("filter");
        }}
        onClose={() => close("filter")}
      />
    </aside>
  );
}

function NavRow({
  label,
  hint,
  count,
  accent,
  open,
  controls,
  onClick,
  buttonRef,
}: {
  label: string;
  hint?: string | undefined;
  count?: number | undefined;
  accent?: boolean | undefined;
  open: boolean;
  controls: string;
  onClick: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-secondary/70",
        open && "bg-secondary",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-primary">{label}</span>
        {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {typeof count === "number" ? (
          <span
            className={cn(
              "text-xs tabular-nums",
              accent ? "font-semibold text-accent" : "text-muted-foreground",
            )}
          >
            {count}
          </span>
        ) : null}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </span>
    </button>
  );
}

/** Anchored to the navigation column on desktop; full-screen from the right on mobile. */
function Flyout({
  id,
  open,
  title,
  onClose,
  children,
  wide,
}: {
  id: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return <div id={id} hidden />;

  return (
    <div
      id={id}
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className={cn(
        "fixed inset-0 z-50 flex max-w-full animate-in slide-in-from-right flex-col overflow-y-auto border-border bg-background outline-none",
        "lg:absolute lg:inset-auto lg:left-full lg:top-4 lg:z-40 lg:max-h-[80vh] lg:rounded-lg lg:border lg:shadow-lg",
        wide ? "lg:w-[380px]" : "lg:w-[300px]",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-primary">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-xs text-teal"
          aria-label={`Close ${title}`}
        >
          <X className="size-4" aria-hidden />
          Close
        </button>
      </div>
      <div className="flex-1 px-3 py-3">{children}</div>
    </div>
  );
}

function AvailabilityFlyout<T extends ViewRow>({
  id,
  open,
  applicants,
  stage,
  alert,
  query,
  myId,
  filters,
  onApply,
  onClose,
}: {
  id: string;
  open: boolean;
  applicants: T[];
  stage: StageView;
  alert: AlertView;
  query: string;
  myId: string;
  filters: FilterState;
  onApply: (next: FilterState) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterState>(filters);
  const [expanded, setExpanded] = useState<AvailabilityCategoryKey[]>([]);
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) setDraft(filters);
  }

  const matching = applyView(applicants, { stage, alert, filters: draft, query, myId }).length;

  const toggleSection = (key: AvailabilityCategoryKey) =>
    setExpanded((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  const setRule = (key: AvailabilityCategoryKey, patch: Partial<FilterState[typeof key]>) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  return (
    <Flyout id={id} open={open} title="Filter Applicants" onClose={onClose} wide>
      <p className="px-1 text-xs text-muted-foreground">
        Filter by submitted availability only. Filtering never changes an application, stage,
        milestone, or HR-review flag.
      </p>

      <div className="mt-2 flex flex-col">
        {AVAILABILITY_CATEGORIES.map((cat) => {
          const rule = draft[cat.key];
          const isOpen = expanded.includes(cat.key);
          const panelId = `${id}-${cat.key}`;
          return (
            <div key={cat.key} className="border-t border-border">
              <button
                type="button"
                onClick={() => toggleSection(cat.key)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-start justify-between gap-3 px-1 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-primary">{cat.label}</span>
                  <span className="block text-xs text-muted-foreground">{cat.window}</span>
                  {rule.days.length ? (
                    <span className="block text-xs text-teal">
                      {rule.days
                        .map((d) => d.slice(0, 3))
                        .join(rule.mode === "every" ? " + " : " or ")}
                    </span>
                  ) : null}
                </span>
                {isOpen ? (
                  <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>

              {isOpen ? (
                <div id={panelId} className="px-1 pb-4">
                  <fieldset className="flex flex-col gap-2">
                    <legend className="sr-only">{cat.label} days</legend>
                    {cat.days.map((day) => (
                      <label key={day} className="flex items-center gap-2 text-sm text-primary">
                        <input
                          type="checkbox"
                          checked={rule.days.includes(day)}
                          onChange={() =>
                            setRule(cat.key, {
                              days: rule.days.includes(day)
                                ? rule.days.filter((d) => d !== day)
                                : [...cat.days.filter((d) => rule.days.includes(d) || d === day)],
                            })
                          }
                          className="size-4 accent-[hsl(var(--accent))]"
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </fieldset>

                  <fieldset className="mt-3 flex flex-col gap-2">
                    <legend className="text-xs font-medium text-muted-foreground">
                      How should selected days match?
                    </legend>
                    {(
                      [
                        ["every", "Available on every selected day"],
                        ["any", "Available on any selected day"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm text-primary">
                        <input
                          type="radio"
                          name={`${panelId}-mode`}
                          checked={rule.mode === value}
                          onChange={() => setRule(cat.key, { mode: value })}
                          className="size-4 accent-[hsl(var(--accent))]"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </fieldset>
                </div>
              ) : (
                <div id={panelId} hidden />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 px-1 text-xs text-muted-foreground">
        A missing answer is never read as &ldquo;Not available.&rdquo; Older applications show
        &ldquo;Not captured on this application version.&rdquo;
      </p>

      <div className="mt-4 flex flex-col gap-2 border-t border-border px-1 pt-4">
        <Button variant="outline" className="w-full" onClick={() => setDraft(emptyFilters())}>
          Reset
        </Button>
        <Button
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => onApply(draft)}
        >
          Show {matching} Applicant{matching === 1 ? "" : "s"}
        </Button>
      </div>
    </Flyout>
  );
}
