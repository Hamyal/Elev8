/**
 * Shared helpers for locating the private files attached to an application.
 * Paths live inside application_data as JSON file references written by the
 * applicant form; nothing here ever produces a public URL.
 */

export type AtsFileRef = {
  /** Storage bucket the object lives in. */
  bucket: "certifications" | "application-pdfs";
  path: string;
  name: string;
  /** Human-readable category recorded in the activity history. */
  category: string;
  /** Field key the file came from, for display grouping. */
  fieldKey: string;
  /** Top-level application_data key the file was found under. */
  rootKey: string;
};


const SCHEDULE_HINTS = ["schedule"];

function categoryFor(fieldKey: string) {
  const key = fieldKey.toLowerCase();
  if (SCHEDULE_HINTS.some((hint) => key.includes(hint))) return "Class schedule";
  if (key.includes("cert")) return "Certification";
  return "Uploaded document";
}

function isFileRef(value: unknown): value is { path: string; name?: unknown } {
  const f = value as { path?: unknown } | null;
  return !!f && typeof f === "object" && typeof f.path === "string" && f.path.length > 0;
}

function toRefs(fieldKey: string, value: unknown): AtsFileRef[] {
  if (Array.isArray(value)) return value.flatMap((item) => toRefs(fieldKey, item));
  if (isFileRef(value)) {
    return [
      {
        bucket: "certifications" as const,
        path: value.path,
        name:
          typeof value.name === "string" && value.name
            ? value.name
            : value.path.split("/").pop()!,
        category: categoryFor(fieldKey),
        fieldKey,
        rootKey: fieldKey,
      },
    ];
  }
  // Maps such as { cert_upload_fa: {...}, cert_upload_cpr: {...} }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([nestedKey, nested]) =>
      toRefs(nestedKey, nested),
    );
  }
  return [];
}

function refsFromValue(fieldKey: string, raw: unknown): AtsFileRef[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  return toRefs(fieldKey, value);
}


/** Every private upload referenced by a submitted application. */
export function collectApplicationFiles(
  applicationData: Record<string, unknown> | null | undefined,
): AtsFileRef[] {
  if (!applicationData) return [];
  return Object.entries(applicationData).flatMap(([key, value]) =>
    refsFromValue(key, value).map((ref) => ({ ...ref, rootKey: key })),
  );
}

