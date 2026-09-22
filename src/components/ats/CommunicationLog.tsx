import { useState } from "react";
import { MessageSquare } from "lucide-react";
import {
  COMMUNICATION_TYPES,
  buildTemplate,
  communicationLabel,
  milestoneLabel,
  type TemplateKey,
} from "@/lib/ats-workflow";
import type { ApplicantDetail } from "@/lib/ats.functions";

/**
 * The four superseded Screening messages are deliberately absent: Screening
 * wording is now generated inside View Progress. They stay in ats-workflow.ts so
 * messages already recorded still display their original wording.
 */
const TEMPLATES: { key: TemplateKey; label: string }[] = [
  { key: "interview_confirmation", label: "Interview confirmation" },
  { key: "interview2_materials", label: "Interview #2 materials" },
  { key: "verbal_offer", label: "Verbal offer" },
  { key: "not_selected", label: "Not selected" },
];

/**
 * Every outreach attempt and applicant response is recorded by hand. Nothing is
 * sent automatically; the approved wording is generated for staff to copy.
 */
export function CommunicationLog({
  data,
  canReview,
  onRecord,
}: {
  data: ApplicantDetail;
  canReview: boolean;
  onRecord: (input: {
    type: string;
    occurredAt?: string;
    milestone?: string;
    template?: string;
    message: string;
    privateNote: string;
  }) => Promise<unknown>;
}) {
  const [type, setType] = useState<string>(COMMUNICATION_TYPES[0]?.key ?? "text_attempted");
  const [template, setTemplate] = useState<TemplateKey | "">("");
  const [message, setMessage] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(key: TemplateKey | "") {
    setTemplate(key);
    if (!key) return;
    setMessage(buildTemplate(key, { applicantName: data.name || "Applicant Name" }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onRecord({
        type,
        milestone: data.milestone,
        ...(template ? { template } : {}),
        message,
        privateNote,
      });
      setMessage("");
      setPrivateNote("");
      setTemplate("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This entry could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
        <MessageSquare className="h-4 w-4 text-teal" aria-hidden="true" />
        Communication log
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Texting is not connected yet. Copy the approved wording, send it yourself, then
        record it here so the history stays complete.
      </p>

      {canReview ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-primary">
            What happened
            <select
              value={type}
              onChange={(e) => setType(e.currentTarget.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            >
              {COMMUNICATION_TYPES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-primary">
            Approved wording
            <select
              value={template}
              onChange={(e) => applyTemplate(e.currentTarget.value as TemplateKey | "")}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            >
              <option value="">None — free text</option>
              {TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-primary sm:col-span-2">
            Message or summary
            <textarea
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              rows={6}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            />
          </label>
          <label className="text-xs font-semibold text-primary sm:col-span-2">
            Private staff note (Admin and HR only)
            <textarea
              value={privateNote}
              onChange={(e) => setPrivateNote(e.currentTarget.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={busy || (!message.trim() && !privateNote.trim())}
              onClick={() => void submit()}
              className="btn-solid px-5 py-2 text-sm disabled:opacity-60"
            >
              Record this outreach
            </button>
            {error ? <p className="mt-2 text-sm font-semibold text-accent">{error}</p> : null}
          </div>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {data.communications.length ? (
          data.communications.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">
                {communicationLabel(c.type)} &middot; {new Date(c.occurredAt).toLocaleString()}{" "}
                &middot; {c.staff}
                {c.milestone ? ` · ${milestoneLabel(c.milestone)}` : ""}
              </p>
              {c.message ? (
                <p className="mt-1 whitespace-pre-wrap text-foreground">{c.message}</p>
              ) : null}
              {c.privateNote ? (
                <p className="mt-1.5 rounded border border-accent/40 bg-accent/5 px-2 py-1 text-xs text-primary">
                  Private note: {c.privateNote}
                </p>
              ) : null}
            </li>
          ))
        ) : (
          <li className="text-sm text-muted-foreground">No outreach recorded yet.</li>
        )}
      </ul>
    </div>
  );
}
