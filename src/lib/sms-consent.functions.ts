import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Records an incomplete attempt that ended at the text-consent question. Only
 * the minimum needed to document the decline is stored: the choice, the exact
 * language shown, the mobile number, the application version, and the time.
 * No applicant record is created and nothing is ever texted.
 */
export const recordDeclinedTextConsent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        attempt_id: z.string().max(120).optional().default(""),
        phone: z.string().max(40).optional().default(""),
        selection: z.string().min(1).max(500),
        consent_text: z.string().min(1).max(4000),
        application_version: z.string().max(40).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { adminDb: supabaseAdmin } = await import("@/server/admin");
    const { error } = await supabaseAdmin.from("sms_consent_declines").insert({
      attempt_id: data.attempt_id || null,
      phone: data.phone || null,
      selection: data.selection,
      consent_text: data.consent_text,
      application_version: data.application_version || null,
    });
    if (error) throw new Error(error.message);
    return { recorded: true };
  });

/**
 * Opt-out (STOP reply or any other reasonable method). Stamps the opt-out time
 * on every application for that mobile number so prior consent is no longer
 * treated as continuing. Only a legally permitted one-time confirmation may be
 * sent after this point.
 */
export const recordTextOptOut = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ phone: z.string().min(4).max(40) }).parse(data))
  .handler(async ({ data }) => {
    const { adminDb: supabaseAdmin } = await import("@/server/admin");
    const digits = data.phone.replace(/\D/g, "").slice(-10);
    const optedOutAt = new Date().toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("applications")
      .select("id, phone, sms_consent_phone, sms_opt_out_at");
    if (error) throw new Error(error.message);
    type ConsentRow = {
      id: string;
      phone: string | null;
      sms_consent_phone: string | null;
      sms_opt_out_at: string | null;
    };
    const matches = ((rows ?? []) as ConsentRow[]).filter((row) => {
      const candidates = [row.phone, row.sms_consent_phone];
      return candidates.some(
        (value) => (value ?? "").replace(/\D/g, "").slice(-10) === digits,
      );
    });
    const pending = matches.filter((row) => !row.sms_opt_out_at).map((row) => row.id);
    if (pending.length) {
      const { error: updateError } = await supabaseAdmin
        .from("applications")
        .update({ sms_opt_out_at: optedOutAt })
        .in("id", pending);
      if (updateError) throw new Error(updateError.message);
    }
    return { opted_out: pending.length, at: optedOutAt };
  });
