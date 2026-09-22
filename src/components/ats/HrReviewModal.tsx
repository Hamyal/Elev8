/**
 * Focused HR-review modal for the signed-in ATS, mirroring the approved
 * design preview: one flag at a time, opened over the applicant's workspace.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FlagStatus } from "@/components/ats/ApplicantRecordPanel";
import type { ApplicantDetail } from "@/lib/ats.functions";

const STATUS_OPTIONS: { value: FlagStatus; label: string }[] = [
  { value: "Needs Review", label: "Needs Review" },
  { value: "Discussed", label: "Discussed — Follow-Up Needed" },
  { value: "Resolved", label: "Resolved" },
];

export function flagStatusTextClass(status: string) {
  if (status === "Resolved") return "text-review-resolved";
  if (status === "Discussed") return "text-review-discussed";
  return "text-review-needs";
}

export function flagStatusLabel(status: string) {
  return status === "Discussed" ? "Discussed — Follow-Up Needed" : status;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">{children}</p>
  );
}

type Flag = ApplicantDetail["flags"][number];

export function HrReviewModal({
  open,
  flags,
  index,
  applicantName,
  reviewAll,
  canReview,
  onIndex,
  onClose,
  onSave,
  onDirtyChange,
}: {
  open: boolean;
  flags: Flag[];
  index: number;
  applicantName: string;
  reviewAll: boolean;
  canReview: boolean;
  onIndex: (next: number) => void;
  onClose: () => void;
  onSave: (input: { flagId: string; status: FlagStatus; notes: string }) => Promise<unknown>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const flag = flags[index] ?? null;
  const [status, setStatus] = useState<FlagStatus>((flag?.status as FlagStatus) ?? "Needs Review");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus((flag?.status as FlagStatus) ?? "Needs Review");
    setNote(flag?.hrNotes ?? "");
    setError(null);
  }, [flag?.id, flag?.status, flag?.hrNotes]);

  const storedStatus = (flag?.status as FlagStatus) ?? "Needs Review";
  const storedNote = flag?.hrNotes ?? "";
  useEffect(() => {
    onDirtyChange?.(open && (status !== storedStatus || note !== storedNote));
  }, [open, status, note, storedStatus, storedNote, onDirtyChange]);

  if (!flag) return null;


  const requiresNote = status !== "Needs Review";

  const save = async () => {
    if (requiresNote && !note.trim()) {
      setError("A Private HR Note is required before this status can be saved.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({ flagId: flag.id, status, notes: note.trim() });
      if (reviewAll && index < flags.length - 1) onIndex(index + 1);
      else onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold text-primary">
            {reviewAll ? `Flag ${index + 1} of ${flags.length}` : "HR review"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {applicantName} — an HR-review item never disqualifies an applicant automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold text-primary">{flag.question}</h2>
            <p className={cn("mt-1 text-sm font-semibold", flagStatusTextClass(flag.status))}>
              {flag.status === "Resolved" ? "✓ " : ""}
              {flagStatusLabel(flag.status)}
            </p>
          </div>

          <section className="flex flex-col gap-1">
            <SectionLabel>Original application question</SectionLabel>
            <p className="text-sm text-primary">{flag.question}</p>
          </section>

          <section className="flex flex-col gap-1">
            <SectionLabel>Applicant's exact submitted answer</SectionLabel>
            <p className="whitespace-pre-line rounded-md border border-border bg-secondary/50 p-3 text-sm text-primary">
              {flag.answer}
            </p>
          </section>

          <section className="flex flex-col gap-1">
            <SectionLabel>Why this was flagged</SectionLabel>
            <p className="text-sm text-status-neutral">
              Flagged automatically from the submitted application for HR review.
            </p>
          </section>

          <fieldset className="flex flex-col gap-2" disabled={!canReview || saving}>
            <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
              Review status
            </legend>
            {STATUS_OPTIONS.map((s) => (
              <label
                key={s.value}
                className="flex items-center gap-2 border-b border-border/70 py-2 text-sm text-primary"
              >
                <input
                  type="radio"
                  name={`flag-status-${flag.id}`}
                  checked={status === s.value}
                  onChange={() => setStatus(s.value)}
                  className="size-4 accent-[var(--accent)]"
                />
                <span className={cn(status === s.value && "font-semibold", flagStatusTextClass(s.value))}>
                  {s.label}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor={`hr-note-${flag.id}`} className="text-sm font-medium text-primary">
              Private HR Note{requiresNote ? " (required)" : " (optional)"}
            </label>
            <textarea
              id={`hr-note-${flag.id}`}
              rows={3}
              value={note}
              disabled={!canReview || saving}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-border p-2 text-sm"
              placeholder="Not shown to the applicant."
            />
            {error ? <p className="text-sm font-medium text-review-needs">{error}</p> : null}
            <p className="text-xs text-status-neutral">
              Selecting a status does not save it. Choose Save Review to record it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!canReview || saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save Review"}
            </Button>
            {reviewAll ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => onIndex(Math.max(0, index - 1))}
                  disabled={index === 0}
                >
                  Previous Flag
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onIndex(Math.min(flags.length - 1, index + 1))}
                  disabled={index >= flags.length - 1}
                >
                  Next Flag
                </Button>
              </>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              {reviewAll ? "Close" : "Cancel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
