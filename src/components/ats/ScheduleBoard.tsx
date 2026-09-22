/**
 * Schedule Interviews board.
 *
 * A calendar grid of every candidate's confirmed Interview #1 availability:
 * dates across the top, times down the side, candidate name chips in the cells.
 * Staff finalize a slot from the chip itself — the facility and the confirm-by
 * time are picked from dropdowns and the wording is generated, so no date or
 * time is ever typed by hand.
 *
 * Booking locks a candidate to one slot and removes them from every other cell;
 * undoing a booking restores them to all of their confirmed slots.
 */
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import {
  CONFIRM_BY_DEFAULT,
  CONFIRM_BY_HOURS,
  INTERVIEW_FACILITIES,
  buildInterview1Template,
  facilityByName,
  formatDateShort,
  formatTime12,
  type InterviewFacilityKey,
} from "@/lib/ats-workflow";
import type { ConfirmedSlotRow } from "@/lib/ats.functions";
import { cn } from "@/lib/utils";

export type BookInput = {
  applicationId: string;
  date: string;
  time: string;
  facility: string;
  confirmBy: string;
  isCurrentRecord: boolean;
  name: string;
};

type Chip = {
  applicationId: string;
  name: string;
  reference: string;
  booked: boolean;
  facility: string | null;
  confirmBy: string | null;
};

function inputClass() {
  return "mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30";
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
      {children}
    </span>
  );
}

export function ScheduleBoard({
  rows,
  currentApplicationId = null,
  busy = false,
  onBook,
  onUnbook,
}: {
  rows: ConfirmedSlotRow[];
  currentApplicationId?: string | null;
  busy?: boolean;
  onBook: (input: BookInput) => void | Promise<void>;
  onUnbook: (input: { applicationId: string; isCurrentRecord: boolean }) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<{ date: string; time: string; chip: Chip } | null>(null);

  const { dates, times, cells } = useMemo(() => {
    const cellMap = new Map<string, Chip[]>();
    const dateSet = new Set<string>();
    const timeSet = new Set<string>();

    for (const row of rows) {
      // A booked candidate only appears in the slot they were booked into.
      const date = row.booked ? (row.bookedDate ?? row.date) : row.date;
      const time = row.booked ? (row.bookedTime ?? row.time) : row.time;

      dateSet.add(date);
      timeSet.add(time);
      const key = `${date}|${time}`;
      const list = cellMap.get(key) ?? [];
      if (!list.some((c) => c.applicationId === row.applicationId)) {
        list.push({
          applicationId: row.applicationId,
          name: row.name,
          reference: row.reference,
          booked: row.booked,
          facility: row.facility,
          confirmBy: row.confirmBy,
        });
      }
      cellMap.set(key, list);
    }

    return {
      dates: [...dateSet].sort(),
      times: [...timeSet].sort(),
      cells: cellMap,
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-status-neutral">
        No confirmed interview availability yet. Candidate availability appears here once it has
        been recorded on their record.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border bg-card p-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-teal">
                Time
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className="border border-border bg-card p-2 text-left text-xs font-semibold text-primary"
                >
                  {formatDateShort(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time}>
                <th className="border border-border bg-card p-2 text-left text-xs font-semibold text-primary">
                  {formatTime12(time)}
                </th>
                {dates.map((date) => {
                  const chips = cells.get(`${date}|${time}`) ?? [];
                  return (
                    <td key={date} className="border border-border p-1.5 align-top">
                      <div className="flex flex-col gap-1">
                        {chips.map((chip) => {
                          const mine = chip.applicationId === currentApplicationId;
                          return (
                            <button
                              key={chip.applicationId}
                              type="button"
                              onClick={() => setSelected({ date, time, chip })}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-left text-xs font-semibold",
                                chip.booked
                                  ? "border-milestone-done bg-milestone-done/10 text-milestone-done"
                                  : mine
                                    ? "border-teal bg-teal/15 text-primary"
                                    : "border-border bg-card text-status-neutral",
                              )}
                            >
                              {chip.booked ? <Lock className="size-3" aria-hidden /> : null}
                              {chip.name}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-status-neutral">
        Teal chips are this candidate. Locked chips are already booked. Click a name to finalize or
        undo their booking.
      </p>

      {selected ? (
        selected.chip.booked ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-bold text-primary">
              {selected.chip.name} is booked for {formatDateShort(selected.date)} at{" "}
              {formatTime12(selected.time)}
              {selected.chip.facility ? ` — ${selected.chip.facility}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void onUnbook({
                    applicationId: selected.chip.applicationId,
                    isCurrentRecord: selected.chip.applicationId === currentApplicationId,
                  });
                  setSelected(null);
                }}
                className="w-fit rounded-full border border-teal px-5 py-2 text-sm font-semibold text-primary disabled:opacity-60"
              >
                Undo booking
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-fit rounded-full border border-border px-5 py-2 text-sm font-semibold text-status-neutral"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <FinalizePanel
            key={`${selected.chip.applicationId}-${selected.date}-${selected.time}`}
            chip={selected.chip}
            date={selected.date}
            time={selected.time}
            busy={busy}
            isCurrentRecord={selected.chip.applicationId === currentApplicationId}
            onCancel={() => setSelected(null)}
            onBook={(input) => {
              void onBook(input);
              setSelected(null);
            }}
          />
        )
      ) : null}
    </div>
  );
}

function FinalizePanel({
  chip,
  date,
  time,
  busy,
  isCurrentRecord,
  onBook,
  onCancel,
}: {
  chip: Chip;
  date: string;
  time: string;
  busy: boolean;
  isCurrentRecord: boolean;
  onBook: (input: BookInput) => void;
  onCancel: () => void;
}) {
  const [facility, setFacility] = useState<InterviewFacilityKey>(
    facilityByName(chip.facility)?.key ?? "neuro_care",
  );
  const [confirmBy, setConfirmBy] = useState(chip.confirmBy ?? CONFIRM_BY_DEFAULT);

  const message = buildInterview1Template("i1_finalize", {
    applicantName: chip.name,
    date,
    time,
    facility,
    confirmBy,
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-primary">
        Finalize {chip.name} — {formatDateShort(date)} at {formatTime12(time)}
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
      <div>
        <Label>Message that will be sent</Label>
        <p className="mt-1 whitespace-pre-line rounded-lg border border-border bg-background p-3 text-sm text-foreground">
          {message}
        </p>
      </div>
      {!isCurrentRecord ? (
        <p className="text-xs text-status-neutral">
          This is another candidate. Booking blocks the slot on the board and does not change this
          record&rsquo;s own progress.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onBook({
              applicationId: chip.applicationId,
              date,
              time,
              facility: INTERVIEW_FACILITIES.find((f) => f.key === facility)!.name,
              confirmBy,
              isCurrentRecord,
              name: chip.name,
            })
          }
          className="btn-solid w-fit px-5 py-2 text-sm disabled:opacity-60"
        >
          {busy ? "Saving…" : "Book this slot"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-fit rounded-full border border-border px-5 py-2 text-sm font-semibold text-status-neutral"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
