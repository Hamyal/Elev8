/**
 * File storage, replacing Supabase Storage.
 *
 * Two buckets are in use: "certifications" for documents applicants attach to
 * their application, and "application-pdfs" for the generated PDF of each
 * submission. Neither was ever publicly readable under Supabase, and neither
 * is here.
 *
 * Files are written under STORAGE_DIR (default: ./storage, beside the
 * project). Staff reach them through short-lived signed links, exactly as
 * before -- but the signature is now an HMAC this application issues and
 * verifies itself, checked by the route in src/routes/files.$.tsx.
 *
 * Swapping in S3 or any other object store means reimplementing putObject and
 * getObject; the signing scheme and every caller can stay as they are.
 *
 * Server-only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";

export const BUCKETS = ["certifications", "application-pdfs"] as const;
export type Bucket = (typeof BUCKETS)[number];

const storageRoot = () => resolve(process.env["STORAGE_DIR"] ?? "storage");

function signingSecret(): string {
  const secret = process.env["STORAGE_SIGNING_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error(
      "STORAGE_SIGNING_SECRET must be set to a random string of at least 32 characters.",
    );
  }
  return secret;
}

/**
 * Resolves a bucket and object path to a location on disk, refusing anything
 * that would escape the bucket directory. The path comes from stored
 * application data, so it is checked rather than trusted.
 */
function resolveObjectPath(bucket: string, path: string): string {
  if (!(BUCKETS as readonly string[]).includes(bucket)) {
    throw new Error(`Unknown storage bucket: ${bucket}`);
  }
  if (!path || path.includes("\0")) throw new Error("Invalid file path.");

  const bucketRoot = join(storageRoot(), bucket);
  const resolved = resolve(bucketRoot, normalize(path));
  if (resolved !== bucketRoot && !resolved.startsWith(bucketRoot + sep)) {
    throw new Error("Invalid file path.");
  }
  return resolved;
}

export async function putObject(
  bucket: Bucket,
  path: string,
  body: Buffer | Uint8Array,
  options?: { upsert?: boolean },
): Promise<{ bucket: Bucket; path: string }> {
  const target = resolveObjectPath(bucket, path);
  await mkdir(dirname(target), { recursive: true });
  // Default to refusing an overwrite, matching the upsert:false that applicant
  // uploads always used; the generated PDF opts in to replacing its own file.
  await writeFile(target, body, { flag: options?.upsert ? "w" : "wx" });
  return { bucket, path };
}

export async function getObject(bucket: string, path: string): Promise<Buffer> {
  return readFile(resolveObjectPath(bucket, path));
}

export async function objectExists(bucket: string, path: string): Promise<boolean> {
  try {
    await stat(resolveObjectPath(bucket, path));
    return true;
  } catch {
    return false;
  }
}

// --- signed links -----------------------------------------------------------

function sign(bucket: string, path: string, expiresAt: number): string {
  return createHmac("sha256", signingSecret())
    .update(`${bucket}:${path}:${expiresAt}`, "utf8")
    .digest("base64url");
}

/**
 * Builds a link that grants read access to one object until it expires.
 * Returned as a root-relative URL so it works on any host the app is served
 * from.
 */
export function createSignedUrl(bucket: string, path: string, expiresInSeconds = 600): string {
  resolveObjectPath(bucket, path); // reject a bad path before handing out a link
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const query = new URLSearchParams({
    bucket,
    expires: String(expiresAt),
    signature: sign(bucket, path, expiresAt),
  });
  return `/files/${path.split("/").map(encodeURIComponent).join("/")}?${query}`;
}

/** Constant-time check of a signed link, including its expiry. */
export function verifySignature(
  bucket: string,
  path: string,
  expires: string | null,
  signature: string | null,
): boolean {
  if (!expires || !signature) return false;

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(sign(bucket, path, expiresAt), "base64url");
  } catch {
    return false;
  }
  const actual = Buffer.from(signature, "base64url");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
