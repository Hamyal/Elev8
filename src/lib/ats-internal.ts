/**
 * Helpers shared by the ATS server functions. Kept out of `ats.functions.ts`
 * so that file stays a thin wrapper of server-function declarations.
 */

/**
 * The generated Database types are refreshed after the draft is accepted, so
 * the new staff tables are addressed through a loosely typed client view.
 */
export type LooseClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export const FLAG_STATUSES = ["Needs Review", "Discussed", "Resolved"] as const;

export async function requireStaff(supabase: LooseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Your staff access could not be verified.");
  const roles = ((data ?? []) as { role: string }[]).map((row) => row.role);
  if (!roles.length) throw new Error("This account does not have Team Portal access.");
  return roles;
}

export function reviewer(roles: string[]) {
  return roles.includes("admin") || roles.includes("hr");
}

export async function requireReviewer(supabase: LooseClient, userId: string) {
  const roles = await requireStaff(supabase, userId);
  if (!reviewer(roles)) throw new Error("Viewer access is read-only.");
  return roles;
}

export function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bHr\b/g, "HR");
}

export function displayValue(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (Array.isArray(raw)) return raw.map((item) => displayValue(item)).filter(Boolean).join("; ");
  if (typeof raw === "object") {
    const file = raw as { name?: unknown };
    if (typeof file.name === "string") return file.name;
    return JSON.stringify(raw);
  }
  const text = String(raw);
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      return displayValue(JSON.parse(text));
    } catch {
      return text;
    }
  }
  return text;
}

/** Resolves staff display names for a set of user ids. */
export async function staffNames(supabase: LooseClient, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase
    .from("staff_profiles")
    .select("user_id, full_name, email")
    .in("user_id", unique);
  return new Map(
    ((data ?? []) as { user_id: string; full_name: string; email: string }[]).map((row) => [
      row.user_id,
      row.full_name || row.email,
    ]),
  );
}
