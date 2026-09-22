import { useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { STATUSES, eventLabel, normalizeStatus, statusLabel, type StatusKey } from "@/lib/ats-workflow";
import type { ApplicantDetail } from "@/lib/ats.functions";
import { SubmittedAnswers } from "@/components/ats/SubmittedAnswers";

const FLAG_STATUSES = ["Needs Review", "Discussed", "Resolved"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export type RecordActions = {
  setStatus: (status: StatusKey) => Promise<unknown>;
  addNote: (body: string) => Promise<unknown>;
  reviewFlag: (input: { flagId: string; status: FlagStatus; notes: string }) => Promise<unknown>;
  openFile: (input: { kind: "pdf" | "upload"; path?: string }) => Promise<unknown>;
};

function formatDateTime(iso: string) {
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

/** Submitted answers, documents, status, HR flags, private notes, and activity history. */
export function ApplicantRecordPanel({
  data,
  canReview,
  actions,
}: {
  data: ApplicantDetail;
  canReview: boolean;
  actions: RecordActions;
}) {
  const [noteBody, setNoteBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function run(
    promise: () => Promise<unknown>,
    onError: (message: string | null) => void,
    onDone?: () => void,
  ) {
    setBusy(true);
    onError(null);
    try {
      await promise();
      onDone?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="text-sm font-bold text-primary">Submitted answers</h3>

        {data.answerSections.length > 0 ? (
          <div className="mt-1.5">
            <SubmittedAnswers sections={data.answerSections} />
          </div>
        ) : (
          <dl className="mt-1.5 space-y-2">
            {data.answers.map((row) => (
              <div key={row.label} className="text-sm">
                <dt className="font-semibold text-primary">{row.label}</dt>
                <dd className="text-foreground">{row.value}</dd>
              </div>
            ))}
            {data.answers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stored answers.</p>
            ) : null}
          </dl>
        )}

        <h3 className="mt-4 text-sm font-bold text-primary">Documents</h3>
        <div className="mt-1.5 space-y-2">
          {data.hasPdf ? (
            <button
              type="button"
              onClick={() => void run(() => actions.openFile({ kind: "pdf" }), setFileError)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal underline underline-offset-4"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Submitted application PDF
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">No archived PDF for this record.</p>
          )}
          {data.files.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() =>
                void run(() => actions.openFile({ kind: "upload", path: f.key }), setFileError)
              }
              className="block text-left text-sm font-semibold text-teal underline underline-offset-4"
            >
              {f.category}: {f.name}
            </button>
          ))}
          <p className="text-xs text-muted-foreground">
            Files open through a private link that expires in 10 minutes. Resumes are not stored.
          </p>
          {fileError ? (
            <p className="text-sm font-semibold text-accent">{fileError}</p>
          ) : null}
        </div>

        <h3 className="mt-4 text-sm font-bold text-primary">Status (person-made decision)</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {STATUSES.map((s) =>
            canReview ? (
              <button
                key={s.key}
                type="button"
                disabled={busy}
                onClick={() => void run(() => actions.setStatus(s.key), setStatusError)}
                className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60 ${
                  s.key === normalizeStatus(data.status)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-teal"
                }`}
              >
                {s.label}
              </button>
            ) : (
              <span
                key={s.key}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  s.key === normalizeStatus(data.status)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            ),
          )}
        </div>
        {data.closedOtherReason ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Closing reason on file: {data.closedOtherReason}
          </p>
        ) : null}
        {statusError ? (
          <p className="mt-2 text-sm font-semibold text-accent">{statusError}</p>
        ) : null}
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
          <AlertTriangle className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          HR review flags
        </h3>
        {data.flags.length ? (
          <ul className="mt-1.5 space-y-3">
            {data.flags.map((flag) => (
              <FlagCard
                key={flag.id}
                flag={flag}
                canReview={canReview}
                onSave={(status, notes) => actions.reviewFlag({ flagId: flag.id, status, notes })}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">No HR review flags.</p>
        )}

        <h3 className="mt-4 text-sm font-bold text-primary">Private staff notes</h3>
        {canReview ? (
          <>
            {data.notes.length ? (
              <ul className="mt-1.5 space-y-2">
                {data.notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {n.author} &middot; {formatDateTime(n.createdAt)}
                    </p>
                    <p className="mt-1 text-foreground">{n.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">No notes yet.</p>
            )}
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const body = noteBody.trim();
                if (!body) return;
                void run(() => actions.addNote(body), setNoteError, () => setNoteBody(""));
              }}
            >
              <label className="text-xs font-semibold text-primary">
                Add a note (permanent, cannot be edited or deleted)
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.currentTarget.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                />
              </label>
              <button
                type="submit"
                disabled={!noteBody.trim() || busy}
                className="btn-solid mt-2 px-5 py-2 text-sm disabled:opacity-60"
              >
                Save note
              </button>
              {noteError ? (
                <p className="mt-2 text-sm font-semibold text-accent">{noteError}</p>
              ) : null}
            </form>
          </>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Private notes are visible to Admin and HR only.
          </p>
        )}

        <h3 className="mt-4 text-sm font-bold text-primary">Activity history</h3>
        <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
          {data.events.length ? (
            data.events.map((e) => (
              <li key={e.id}>
                {formatDateTime(e.createdAt)} —{" "}
                {e.type === "status_changed"
                  ? `status changed ${statusLabel(e.fromStatus)} → ${statusLabel(e.toStatus)}`
                  : e.type === "file_accessed"
                    ? `${e.detail} opened`
                    : e.detail || eventLabel(e.type)}{" "}
                by {e.actor}
              </li>
            ))
          ) : (
            <li>Submitted {formatDateTime(data.submittedAt)} by applicant</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function FlagCard({
  flag,
  canReview,
  onSave,
}: {
  flag: ApplicantDetail["flags"][number];
  canReview: boolean;
  onSave: (status: FlagStatus, notes: string) => Promise<unknown>;
}) {
  const [status, setStatus] = useState(flag.status as FlagStatus);
  const [notes, setNotes] = useState(flag.hrNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextStatus: FlagStatus = status, nextNotes: string = notes) {
    setSaving(true);
    setError(null);
    try {
      await onSave(nextStatus, nextNotes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This flag could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-lg border border-accent/50 bg-accent/5 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">HR review required</p>
      <p className="mt-1.5 text-sm font-semibold text-primary">{flag.question}</p>
      <p className="mt-1 text-sm text-foreground">{flag.answer}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Created {formatDateTime(flag.createdAt)}
      </p>

      {canReview ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr]">
          <label className="text-xs font-semibold text-primary">
            Status
            <select
              value={status}
              onChange={(e) => {
                const next = e.currentTarget.value as FlagStatus;
                setStatus(next);
                void save(next, notes);
              }}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            >
              {FLAG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-primary">
            Private HR notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              onBlur={() => void save(status, notes)}
              rows={2}
              placeholder="Internal notes for the hiring team"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            />
          </label>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Flag status: {flag.status}. Private HR notes are visible to Admin and HR only.
        </p>
      )}
      {saving ? <p className="mt-2 text-xs text-muted-foreground">Saving…</p> : null}
      {error ? <p className="mt-2 text-sm font-semibold text-accent">{error}</p> : null}
    </li>
  );
}
