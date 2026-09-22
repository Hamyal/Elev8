export const CERT_BUCKET = "certifications" as const;
export const CERT_MAX_BYTES = 10 * 1024 * 1024;
export const CERT_ACCEPT = ".jpg,.jpeg,.png,.heic,.pdf,image/jpeg,image/png,image/heic,application/pdf";
const ALLOWED_EXT = ["jpg", "jpeg", "png", "heic", "pdf"];

export const CERT_UPLOAD_HELP =
  "Upload a clear image or PDF showing your name, certification type, and expiration date.";

export type CertFileRef = {
  path: string;
  name: string;
  type: string;
  size: number;
};

export function parseCertFile(raw: string): CertFileRef | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CertFileRef>;
    if (!parsed || typeof parsed.path !== "string" || typeof parsed.name !== "string") return null;
    return {
      path: parsed.path,
      name: parsed.name,
      type: typeof parsed.type === "string" ? parsed.type : "",
      size: typeof parsed.size === "number" ? parsed.size : 0,
    };
  } catch {
    return null;
  }
}

export function extensionOf(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() as string) : "";
}

export function validateCertFile(file: File): string | undefined {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXT.includes(ext))
    return "Please upload a JPG, PNG, HEIC, or PDF file.";
  if (file.size > CERT_MAX_BYTES) return "This file is larger than 10 MB. Please upload a smaller file.";
  if (file.size === 0) return "This file appears to be empty. Please choose another file.";
  return undefined;
}

/**
 * Uploads a certification document into the private certifications bucket.
 * Files live under pending/<attemptId>/ and are never publicly readable —
 * only internal staff tooling can retrieve them.
 *
 * The file now goes to the application's own upload endpoint rather than
 * straight to object storage, so the server decides the stored path and
 * re-checks the type and size limits.
 */
export async function uploadCertificationFile(
  file: File,
  attemptId: string,
  fieldKey: string,
): Promise<CertFileRef> {
  const body = new FormData();
  body.append("file", file);
  body.append("attemptId", attemptId);
  body.append("fieldKey", fieldKey);

  const response = await fetch("/api/upload-certification", {
    method: "POST",
    credentials: "same-origin",
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<CertFileRef> & {
    error?: string;
  };
  if (!response.ok || typeof payload.path !== "string") {
    throw new Error(payload.error ?? "The file could not be uploaded. Please try again.");
  }

  return {
    path: payload.path,
    name: payload.name ?? file.name,
    type: payload.type ?? file.type,
    size: payload.size ?? file.size,
  };
}

/** Parses a stored JSON array of private file references. */
export function parseFileList(raw: string): CertFileRef[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const f = item as Partial<CertFileRef>;
      if (!f || typeof f.path !== "string" || typeof f.name !== "string") return [];
      return [
        {
          path: f.path,
          name: f.name,
          type: typeof f.type === "string" ? f.type : "",
          size: typeof f.size === "number" ? f.size : 0,
        },
      ];
    });
  } catch {
    return [];
  }
}
