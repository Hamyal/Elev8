import { useState } from "react";
import { CalendarClock, Lock, Plus, Trash2 } from "lucide-react";
import {
  CONFIRMATION_STATES,
  PHONE_WINDOW_DEFAULT,
  SCHEDULING_KINDS,
  buildSlotOfferMessage,
  canReschedule,
  confirmationLabel,
  countSlots,
  formatDateLong,
  formatTime12,
  type SlotDate,
} from "@/lib/ats-workflow";
import type { ApplicantDetail } from "@/lib/ats.functions";

type Kind = "phone" | "interview_1" | "interview_2";

export type SchedulingActions = {
  save: (input: {
    kind: Kind;
    proposedDate: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    applicantAvailability: string;
    finalWindowStart?: string | null;
    finalWindowEnd?: string | null;
    completedAt?: string | null;
  }) => Promise<unknown>;
  setConfirmation: (input: { kind: Kind; state: string }) => Promise<unknown>;
  saveSlots: (input: {
    kind: Kind;
    selectionsRequested: number;
    slots: { date: string; time: string }[];
  }) => Promise<unknown>;
  sendMaterials: (url: string) => Promise<unknown>;
  acknowledgeMaterials: (input: { materialsId: string; note: string }) => Promise<unknown>;
};

/** Phone-interview windows, the interview slot builder, and confirmation state. */
export function SchedulingPanel({
  data,
  canReview,
  actions,
}: {
  data: ApplicantDetail;
  canReview: boolean;
  actions: SchedulingActions;
}) {
  const [kind, setKind] = useState<Kind>("phone");
  const existing = data.scheduling.find((s) => s.kind === kind);

  const [proposedDate, setProposedDate] = useState(existing?.proposedDate ?? "");
  const [windowStart, setWindowStart] = useState(
    existing?.windowStart ?? PHONE_WINDOW_DEFAULT.start,
  );
  const [windowEnd, setWindowEnd] = useState(existing?.windowEnd ?? PHONE_WINDOW_DEFAULT.end);
  const [availability, setAvailability] = useState(existing?.applicantAvailability ?? "");
  const [slots, setSlots] = useState<SlotDate[]>([{ date: "", times: ["10:00"] }]);
  const [asked, setAsked] = useState(1);
  const [materialsUrl, setMaterialsUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchKind(next: Kind) {
    setKind(next);
    const record = data.scheduling.find((s) => s.kind === next);
    setProposedDate(record?.proposedDate ?? "");
    setWindowStart(record?.windowStart ?? (next === "phone" ? PHONE_WINDOW_DEFAULT.start : "10:00"));
    setWindowEnd(record?.windowEnd ?? (next === "phone" ? PHONE_WINDOW_DEFAULT.end : "11:00"));
    setAvailability(record?.applicantAvailability ?? "");
    setError(null);
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const locked = !canReschedule(existing?.confirmationState);
  const flatSlots = slots.flatMap((d) =>
    d.date ? d.times.filter(Boolean).map((time) => ({ date: d.date, time })) : [],
  );
  const totalSlots = countSlots(slots);
  const interview2Locked = !data.interview1Completed;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
        <CalendarClock className="h-4 w-4 text-teal" aria-hidden="true" />
        Scheduling
      </h3>

      <div className="mt-3 flex flex-wrap gap-2">
        {SCHEDULING_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => switchKind(k.key as Kind)}
            aria-pressed={kind === k.key}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              kind === k.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-primary hover:border-teal"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {existing ? (
        <p className="mt-3 text-sm text-primary">
          <span className="font-semibold">Current:</span>{" "}
          {existing.proposedDate ? formatDateLong(existing.proposedDate) : "no date set"}
          {existing.windowStart
            ? ` · ${formatTime12(existing.windowStart)}${
                existing.windowEnd ? `–${formatTime12(existing.windowEnd)}` : ""
              }`
            : ""}{" "}
          &middot; {confirmationLabel(existing.confirmationState)}
          {existing.confirmationDueAt
            ? ` · confirm by ${new Date(existing.confirmationDueAt).toLocaleString()}`
            : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled yet.</p>
      )}

      {kind === "interview_2" && interview2Locked ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-xs font-semibold text-primary">
          <Lock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Interview #2 unlocks once Interview #1 is marked complete.
        </p>
      ) : null}

      {canReview && !(kind === "interview_2" && interview2Locked) ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-primary">
              Date
              <input
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.currentTarget.value)}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
              />
            </label>
            <label className="text-xs font-semibold text-primary">
              {kind === "phone" ? "Calling window starts" : "Start time"}
              <input
                type="time"
                step={900}
                value={windowStart}
                onChange={(e) => setWindowStart(e.currentTarget.value)}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
              />
            </label>
            <label className="text-xs font-semibold text-primary">
              {kind === "phone" ? "Calling window ends" : "End time"}
              <input
                type="time"
                step={900}
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.currentTarget.value)}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
              />
            </label>
            <label className="text-xs font-semibold text-primary sm:col-span-3">
              Availability the applicant gave us
              <textarea
                value={availability}
                onChange={(e) => setAvailability(e.currentTarget.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || locked}
              onClick={() =>
                void run(() =>
                  actions.save({
                    kind,
                    proposedDate: proposedDate || null,
                    windowStart: windowStart || null,
                    windowEnd: windowEnd || null,
                    applicantAvailability: availability,
                  }),
                )
              }
              className="btn-solid px-5 py-2 text-sm disabled:opacity-60"
            >
              Save and start the 24-hour confirmation
            </button>
            {locked ? (
              <span className="text-xs font-semibold text-muted-foreground">
                Confirmed interviews cannot be rescheduled.
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {CONFIRMATION_STATES.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={busy || !existing}
                onClick={() => void run(() => actions.setConfirmation({ kind, state: s.key }))}
                className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60 ${
                  existing?.confirmationState === s.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-teal"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {kind !== "phone" ? (
            <div className="mt-5 rounded-lg border border-border p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-primary">
                Interview slot builder
              </h4>
              {slots.map((day, dayIndex) => (
                <div key={dayIndex} className="mt-3 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs font-semibold text-primary">
                      Date
                      <input
                        type="date"
                        value={day.date}
                        onChange={(e) => {
                          const value = e.currentTarget.value;
                          setSlots((prev) =>
                            prev.map((d, i) => (i === dayIndex ? { ...d, date: value } : d)),
                          );
                        }}
                        className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                      />
                    </label>
                    {slots.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setSlots((prev) => prev.filter((_, i) => i !== dayIndex))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove day
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {day.times.map((time, timeIndex) => (
                      <div key={timeIndex} className="flex items-end gap-1">
                        <input
                          type="time"
                          step={900}
                          value={time}
                          onChange={(e) => {
                            const value = e.currentTarget.value;
                            setSlots((prev) =>
                              prev.map((d, i) =>
                                i === dayIndex
                                  ? {
                                      ...d,
                                      times: d.times.map((t, ti) =>
                                        ti === timeIndex ? value : t,
                                      ),
                                    }
                                  : d,
                              ),
                            );
                          }}
                          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                        />
                        {day.times.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Remove time"
                            onClick={() =>
                              setSlots((prev) =>
                                prev.map((d, i) =>
                                  i === dayIndex
                                    ? { ...d, times: d.times.filter((_, ti) => ti !== timeIndex) }
                                    : d,
                                ),
                              )
                            }
                            className="pb-2 text-accent"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setSlots((prev) =>
                          prev.map((d, i) =>
                            i === dayIndex ? { ...d, times: [...d.times, "10:00"] } : d,
                          ),
                        )
                      }
                      className="inline-flex items-center gap-1 pb-2 text-xs font-semibold text-teal"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Add time
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setSlots((prev) => [...prev, { date: "", times: ["10:00"] }])}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add another day
              </button>

              <label className="mt-3 block text-xs font-semibold text-primary">
                Preferences to ask for (1–{Math.max(1, totalSlots)})
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, totalSlots)}
                  value={asked}
                  onChange={(e) => setAsked(Number(e.currentTarget.value) || 1)}
                  className="mt-1 w-28 rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                />
              </label>

              <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-teal/40 bg-teal/5 p-3 text-xs text-primary">
                {buildSlotOfferMessage({
                  applicantName: data.name || "Applicant Name",
                  slots,
                  selectionsRequested: asked,
                })}
              </pre>

              <button
                type="button"
                disabled={busy || !flatSlots.length || asked > flatSlots.length}
                onClick={() =>
                  void run(() =>
                    actions.saveSlots({ kind, selectionsRequested: asked, slots: flatSlots }),
                  )
                }
                className="btn-solid mt-3 px-5 py-2 text-sm disabled:opacity-60"
              >
                Save this slot offer
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <p className="mt-2 text-sm font-semibold text-accent">{error}</p> : null}

      {data.slotOffers.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-teal">
            Slot offers sent ({data.slotOffers.length})
          </summary>
          <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
            {data.slotOffers.map((o) => (
              <li key={o.id}>
                {new Date(o.createdAt).toLocaleString()} — {o.kind.replace("_", " ")}, asked for{" "}
                {o.selectionsRequested} of {o.slots.length}:{" "}
                {o.slots.map((s) => `${s.date} ${formatTime12(s.time)}`).join(", ")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-primary">
          Interview #2 materials
        </h4>
        {interview2Locked ? (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Locked until Interview #1 is marked complete.
          </p>
        ) : canReview ? (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-primary">
              Secure materials link
              <input
                value={materialsUrl}
                onChange={(e) => setMaterialsUrl(e.currentTarget.value)}
                placeholder="https://"
                className="mt-1 block w-72 rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
              />
            </label>
            <button
              type="button"
              disabled={busy || !materialsUrl.trim()}
              onClick={() => void run(() => actions.sendMaterials(materialsUrl.trim()))}
              className="rounded-full border border-teal px-5 py-2 text-sm font-semibold text-primary disabled:opacity-60"
            >
              Record materials sent
            </button>
          </div>
        ) : null}

        <ul className="mt-2 space-y-2 text-sm">
          {data.materials.map((m) => (
            <li key={m.id} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Sent {new Date(m.sentAt).toLocaleString()} by {m.sentBy}
              </p>
              {m.url ? (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-teal underline underline-offset-4"
                >
                  Open materials
                </a>
              ) : null}
              {m.acknowledgedAt ? (
                <p className="mt-1 text-xs text-primary">
                  Applicant confirmed review {new Date(m.acknowledgedAt).toLocaleString()}
                  {m.acknowledgedNote ? ` — ${m.acknowledgedNote}` : ""}
                </p>
              ) : canReview ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      actions.acknowledgeMaterials({ materialsId: m.id, note: "Applicant replied" }),
                    )
                  }
                  className="mt-1 text-xs font-semibold text-teal underline underline-offset-4 disabled:opacity-60"
                >
                  Record the applicant's confirmation
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
