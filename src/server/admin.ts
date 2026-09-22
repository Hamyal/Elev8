/**
 * The service-role database client -- the replacement for `supabaseAdmin`.
 *
 * Bypasses row-level security, exactly as the Supabase service key did, so it
 * belongs only in trusted server-side code: the public application intake, the
 * contact form, and the admin-only staff management functions. Each statement
 * runs in its own short transaction under the `service_role` database role.
 *
 * Server-only. Load it inside a handler with a dynamic import, never at the
 * top level of a route or a *.functions.ts module -- those are bundled for the
 * browser.
 */
import { pgRestAuto } from "./pgrest";

export const adminDb = pgRestAuto("service_role");

/** Kept under the old name so existing call sites read unchanged. */
export const supabaseAdmin = adminDb;
