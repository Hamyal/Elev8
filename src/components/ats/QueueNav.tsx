/**
 * Signed-in ATS left navigation, ported from the approved design preview.
 *
 * Display-only: choosing a stage or an availability filter never changes an
 * applicant record.
 */
import { useId, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
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
import { STAGE_ORDER, type StageView, type ViewRow } from "@/lib/ats-views";

export function AtsQueueNav<T extends ViewRow>({
  className,
  applicants,
  stage,
  filters,
  query,
  onQuery,
  onStage,
  onFilters,
  onShowList,
  onShowBoard,
  boardActive = false,
  focusMuted,
}: {
  className?: string;
  applicants: T[];
  stage: StageView;
  filters: FilterState;
  query: string;
  onQuery: (value: string) => void;
  onStage: (value: StageView) => void;
  onFilters: (value: FilterState) => void;
  onShowList: () => void;
  /** Opens the display-only Schedule Interviews board. */
  onShowBoard?: () => void;
  boardActive?: boolean;
  focusMuted: boolean;
}) {
  const [stagesOpen, setStagesOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const stagesId = useId();
  const filterId = useId();
  const activeFilters = filtersActive(filters);
  const stageCount = (key: StageView) =>
    applicants.filter((a) => key === "all" || normalizeStatus(a.status) === key).length;

  return (
    <aside
      className={cn(
        "min-w-0 flex-col border-b border-border bg-background px-4 py-5 lg:flex lg:border-b-0 lg:border-r",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-base font-semibold text-primary",
              focusMuted && "lg:text-focus-faded",
            )}
          >
            Elev8 Services
          </p>
          <p
            className={cn(
              "text-xs text-muted-foreground",
              focusMuted && "lg:text-focus-faded-supporting",
            )}
          >
            Applicant tracking
          </p>
        </div>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold text-teal",
            focusMuted && "lg:text-focus-faded",
          )}
        >
          EO
        </span>
      </div>

      <label className="relative mt-5 block lg:hidden">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <span className="sr-only">Search name, email, or phone</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search name, email, or phone"
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
        />
      </label>

      <nav className="mt-5 flex flex-col" aria-label="Applicant stages and filters">
        <button
          type="button"
          onClick={() => setStagesOpen((open) => !open)}
          aria-expanded={stagesOpen}
          aria-controls={stagesId}
          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border py-3 text-left"
        >
          <span
            className={cn(
              "truncate text-sm font-semibold text-primary",
              focusMuted && "lg:text-focus-faded",
            )}
          >
            All Applicants
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground",
              focusMuted && "lg:text-focus-faded-supporting",
            )}
          >
            {applicants.length}
            {stagesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </span>
        </button>

        {stagesOpen ? (
          <ul id={stagesId} className="border-b border-border py-2">
            {STAGE_ORDER.map((key) => {
              const selected = stage === key;
              return (
                <li
                  key={key}
                  className={key === "not_selected" ? "mt-2 border-t border-border pt-2" : undefined}
                >
                  <button
                    type="button"
                    aria-current={selected ? "page" : undefined}
                    onClick={() => {
                      onStage(selected ? "all" : key);
                      onShowList();
                    }}
                    className={cn(
                      "grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      selected
                        ? "bg-secondary font-semibold text-teal"
                        : cn(
                            "text-primary hover:bg-secondary/70 hover:text-primary focus-visible:text-primary",
                            focusMuted && "lg:text-focus-faded",
                          ),
                    )}
                  >
                    <span className="flex size-4 items-center justify-center">
                      {selected ? <Check className="size-4 text-teal" aria-hidden /> : null}
                    </span>
                    <span className="truncate">{statusLabel(key)}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums text-muted-foreground",
                        focusMuted && "lg:text-focus-faded-supporting",
                      )}
                    >
                      {stageCount(key)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={() => setFilterOpen((open) => !open)}
          aria-expanded={filterOpen}
          aria-controls={filterId}
          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border py-3 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <SlidersHorizontal
              className={cn("size-4 shrink-0 text-teal", focusMuted && "lg:text-focus-faded")}
              aria-hidden
            />
            <span
              className={cn(
                "truncate text-sm font-semibold text-primary",
                focusMuted && "lg:text-focus-faded",
              )}
            >
              Filter by Availability
            </span>
          </span>
          {filterOpen ? (
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground",
                focusMuted && "lg:text-focus-faded-supporting",
              )}
            />
          ) : (
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-muted-foreground",
                focusMuted && "lg:text-focus-faded-supporting",
              )}
            />
          )}
        </button>

        {filterOpen ? (
          <AvailabilityFilter
            id={filterId}
            total={applicants.length}
            filters={filters}
            onApply={onFilters}
            focusMuted={focusMuted}
          />
        ) : null}

        {onShowBoard ? (
          <button
            type="button"
            onClick={onShowBoard}
            aria-current={boardActive ? "page" : undefined}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border py-3 text-left"
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays
                className={cn("size-4 shrink-0 text-teal", focusMuted && "lg:text-focus-faded")}
                aria-hidden
              />
              <span
                className={cn(
                  "truncate text-sm font-semibold",
                  boardActive ? "text-teal" : "text-primary",
                  focusMuted && !boardActive && "lg:text-focus-faded",
                )}
              >
                Schedule Interviews
              </span>
            </span>
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-muted-foreground",
                focusMuted && "lg:text-focus-faded-supporting",
              )}
            />
          </button>
        ) : null}
      </nav>

      {activeFilters ? (
        <div className="mt-3 border-l-2 border-teal pl-3">
          <p className="text-xs leading-5 text-muted-foreground">{filterSummary(filters)}</p>
          <button
            type="button"
            onClick={() => onFilters(emptyFilters())}
            className="mt-1 text-xs font-medium text-teal underline"
          >
            Clear availability filter
          </button>
        </div>
      ) : null}

      <Button variant="outline" className="mt-5 w-full lg:hidden" onClick={onShowList}>
        View applicant queue <ChevronRight className="size-4" aria-hidden />
      </Button>
    </aside>
  );
}

function AvailabilityFilter({
  id,
  total,
  filters,
  onApply,
  focusMuted,
}: {
  id: string;
  total: number;
  filters: FilterState;
  onApply: (value: FilterState) => void;
  focusMuted: boolean;
}) {
  const [draft, setDraft] = useState(filters);
  const [expanded, setExpanded] = useState<AvailabilityCategoryKey[]>([]);
  const setRule = (key: AvailabilityCategoryKey, patch: Partial<FilterState[typeof key]>) =>
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  return (
    <div id={id} className="border-b border-border pb-3 pt-1">
      <p
        className={cn(
          "py-2 text-xs leading-5 text-muted-foreground",
          focusMuted && "lg:text-focus-faded-supporting",
        )}
      >
        Match submitted schedule availability. Missing answers never count as available.
      </p>
      {AVAILABILITY_CATEGORIES.map((category) => {
        const open = expanded.includes(category.key);
        const rule = draft[category.key];
        const panelId = `${id}-${category.key}`;
        return (
          <div key={category.key} className="border-t border-border/70">
            <button
              type="button"
              onClick={() =>
                setExpanded((keys) =>
                  keys.includes(category.key)
                    ? keys.filter((key) => key !== category.key)
                    : [...keys, category.key],
                )
              }
              aria-expanded={open}
              aria-controls={panelId}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 py-2 text-left"
            >
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-xs font-semibold text-primary",
                    focusMuted && "lg:text-focus-faded",
                  )}
                >
                  {category.label}
                </span>
                <span
                  className={cn(
                    "block text-[11px] text-muted-foreground",
                    focusMuted && "lg:text-focus-faded-supporting",
                  )}
                >
                  {category.window}
                </span>
              </span>
              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
            {open ? (
              <div id={panelId} className="pb-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {category.days.map((day) => (
                    <label
                      key={day}
                      className={cn(
                        "flex min-w-0 items-center gap-1.5 text-xs text-primary",
                        focusMuted && "lg:text-focus-faded",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={rule.days.includes(day)}
                        onChange={() =>
                          setRule(category.key, {
                            days: rule.days.includes(day)
                              ? rule.days.filter((value) => value !== day)
                              : [...rule.days, day],
                          })
                        }
                        className="size-3.5 shrink-0 accent-[var(--color-teal)]"
                      />
                      <span className="truncate">{day.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 grid gap-1">
                  {(["any", "every"] as const).map((mode) => (
                    <label
                      key={mode}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] text-primary",
                        focusMuted && "lg:text-focus-faded",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${panelId}-mode`}
                        checked={rule.mode === mode}
                        onChange={() => setRule(category.key, { mode })}
                        className="size-3.5 accent-[var(--color-teal)]"
                      />
                      {mode === "any" ? "Any selected day" : "Every selected day"}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => setDraft(emptyFilters())}>
          Reset
        </Button>
        <Button
          size="sm"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => onApply(draft)}
        >
          Apply
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        {total} applicants available to filter
      </p>
    </div>
  );
}
