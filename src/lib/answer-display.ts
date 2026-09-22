/**
 * One shared shape for a submitted application answer, used by the applicant's
 * Step 5 review page, the archived PDF, the staff ATS record, and the design
 * preview, so the same complete answers appear everywhere.
 *
 * Nothing in this module summarizes, shortens, rewrites, or corrects an
 * applicant's response. It only carries structure so the interface can lay the
 * answer out cleanly: one answer per row, multi-selections one per line, and
 * structured entries (classes, commitments, time-off requests) as separate
 * labeled blocks.
 */

export type AnswerField = { label: string; value: string };

/** A structured entry, e.g. "Commitment 1" or "Class 2", with labeled fields. */
export type AnswerBlock = { title: string; fields: AnswerField[] };

export type AnswerRow = {
  label: string;
  /** Flat text form, kept for legacy records and plain single answers. */
  value: string;
  /** Multiple selections or repeated values, one per line. */
  lines?: string[];
  /** Structured entries rendered as separate blocks. */
  blocks?: AnswerBlock[];
};

export type AnswerSection = { label: string; rows: AnswerRow[] };

const BULLET = /^[\u2022\u25CF\-\u2013]\s+/;

/**
 * Restores line structure for records archived before rows carried `lines` or
 * `blocks`: bulleted or newline-joined values become one line per item, and
 * legacy semicolon-joined selections are split back apart. The text of each
 * item is preserved exactly as the applicant submitted it.
 */
export function normalizeAnswerRow(row: AnswerRow): AnswerRow {
  if (row.blocks?.length || row.lines?.length) return row;
  const value = row.value ?? "";
  if (value.includes("\n")) {
    const lines = value
      .split("\n")
      .map((line) => line.replace(BULLET, "").trim())
      .filter(Boolean);
    return lines.length > 1 ? { ...row, lines } : row;
  }
  if (value.includes("; ")) {
    const lines = value
      .split("; ")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length > 1 ? { ...row, lines } : row;
  }
  return row;
}

export function normalizeAnswerSections(sections: AnswerSection[]): AnswerSection[] {
  return sections.map((section) => ({
    label: section.label,
    rows: section.rows.map(normalizeAnswerRow),
  }));
}

/** Flat text form of a structured row, for the legacy `answers` list and search. */
export function flattenAnswerRow(row: AnswerRow): string {
  if (row.blocks?.length) {
    return row.blocks
      .map((b) => [b.title, ...b.fields.map((f) => `${f.label}: ${f.value}`)].join("\n"))
      .join("\n\n");
  }
  if (row.lines?.length) return row.lines.join("\n");
  return row.value ?? "";
}
