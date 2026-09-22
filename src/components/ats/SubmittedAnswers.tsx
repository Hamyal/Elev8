/**
 * Read-only rendering of a submitted application: section heading, question
 * label, and the complete submitted answer directly underneath, one answer per
 * row. Structured entries appear as separate labeled blocks. Nothing here
 * edits, shortens, or reformats the applicant's words.
 */
import {
  normalizeAnswerSections,
  type AnswerRow,
  type AnswerSection,
} from "@/lib/answer-display";

export function SubmittedAnswerRow({ row }: { row: AnswerRow }) {
  return (
    <div className="border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs text-muted-foreground">{row.label}</p>
      {row.blocks?.length ? (
        <div className="mt-2 space-y-2">
          {row.blocks.map((block, i) => (
            <div
              key={`${block.title}-${i}`}
              className="rounded-lg border border-border bg-muted/30 p-3"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-teal">{block.title}</p>
              <div className="mt-2 space-y-2">
                {block.fields.map((field, j) => (
                  <div key={`${field.label}-${j}`}>
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <p className="whitespace-pre-line break-words text-sm font-medium text-foreground">
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : row.lines?.length ? (
        <div className="mt-0.5 space-y-0.5">
          {row.lines.map((line, i) => (
            <p
              key={`${line}-${i}`}
              className="whitespace-pre-line break-words text-sm font-medium text-foreground"
            >
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-0.5 whitespace-pre-line break-words text-sm font-medium text-foreground">
          {row.value}
        </p>
      )}
    </div>
  );
}

export function SubmittedAnswers({ sections }: { sections: AnswerSection[] }) {
  const normalized = normalizeAnswerSections(sections);
  return (
    <div className="space-y-3">
      {normalized.map((section, index) => (
        <section
          key={`${section.label}-${index}`}
          className="rounded-xl border border-border p-3"
        >
          <h4 className="text-xs font-bold uppercase tracking-wide text-teal">{section.label}</h4>
          <div className="mt-2 space-y-3">
            {section.rows.map((row, i) => (
              <SubmittedAnswerRow key={`${row.label}-${i}`} row={row} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
