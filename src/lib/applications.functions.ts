import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pdfField = z.object({ label: z.string(), value: z.string() });
const pdfBlock = z.object({ title: z.string(), fields: z.array(pdfField) });
/** Rows may carry line-per-selection or block structure for repeated entries. */
const pdfRow = z.object({
  label: z.string(),
  value: z.string(),
  lines: z.array(z.string()).optional(),
  blocks: z.array(pdfBlock).optional(),
});
const pdfSection = z.object({ label: z.string(), rows: z.array(pdfRow) });

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        email: z.string().min(1),
        phone: z.string().min(1),
        opportunity_pref: z.string().optional().default(""),
        typed_name: z.string().optional().default(""),
        application_data: z.record(z.string(), z.unknown()).default({}),
        hr_reviews: z
          .array(z.object({ question: z.string(), answer: z.string() }))
          .default([]),
        // Text-message consent, documented exactly as displayed. A submission
        // is only accepted when the applicant agreed.
        sms_consent: z
          .object({
            selection: z.string().min(1),
            agreed: z.boolean(),
            consent_text: z.string().min(1),
            phone: z.string().optional().default(""),
            consented_at: z.string().min(1),
            application_version: z.string().optional().default(""),
          })
          .optional(),
        // Review-page snapshot used verbatim for the archived PDF copy.
        pdf: z
          .object({
            applicant_name: z.string().default(""),
            sections: z.array(pdfSection).default([]),
            acknowledgment: z
              .object({ statement: z.string(), typedName: z.string() })
              .optional(),
            logo_url: z.string().optional(),
          })
          .optional(),
        // Developer testing sessions must never become applicant records.
        test_mode: z.boolean().optional().default(false),
      })
      .parse(data),
  )

  .handler(async ({ data }) => {
    if (data.test_mode)
      throw new Error(
        "Testing-mode submissions are not accepted: no application record or notification is created.",
      );
    // Text-message consent is optional. Both answers are accepted and stored;
    // canTextApplicant() in src/lib/sms-consent.ts is what decides whether a
    // message may actually be sent.
    const { adminDb: supabaseAdmin } = await import("@/server/admin");
    const { buildApplicationReference, nextAvailableReference } = await import(
      "@/lib/application-reference"
    );

    // Human-readable application number, unique across applications.
    const base = buildApplicationReference(data);
    const { data: existing } = await supabaseAdmin
      .from("applications")
      .select("reference")
      .like("reference", `${base}%`);
    const reference = nextAvailableReference(
      base,
      ((existing ?? []) as { reference: string | null }[])
        .map((row) => row.reference)
        .filter((value): value is string => !!value),
    );

    const { data: inserted, error } = await supabaseAdmin
      .from("applications")
      .insert({
        reference,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        opportunity_pref: data.opportunity_pref || null,
        typed_name: data.typed_name || null,
        sms_consent: data.sms_consent ? data.sms_consent.agreed : null,
        sms_consent_at: data.sms_consent?.consented_at ?? null,
        sms_consent_text: data.sms_consent?.consent_text ?? null,
        sms_consent_phone: data.sms_consent?.phone || data.phone,
        sms_consent_version: data.sms_consent?.application_version || null,
        application_data: {
          ...data.application_data,
          // Reviewer-facing snapshot: the exact Step 5 grouping, order, labels,
          // and formatted answers the applicant saw.
          review_sections: data.pdf?.sections ?? [],
        } as never,
      })
      .select("id")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Application could not be saved.");

    if (data.hr_reviews.length) {
      const { error: flagError } = await supabaseAdmin.from("hr_review_flags").insert(
        data.hr_reviews.map((entry) => ({
          application_id: inserted.id,
          question: entry.question,
          answer: entry.answer,
        })),
      );
      // A flag failure must not discard a received application.
      if (flagError) console.error("[applications] hr_review_flags insert failed", flagError.message);
    }

    // Archived PDF copy of the Review page. Generated only after the record is
    // saved; a failure is logged and never reported to the applicant as saved.

    let pdfSaved = false;
    if (data.pdf) {
      try {
        const { renderApplicationPdf, APPLICATION_PDF_BUCKET, applicationPdfPath } = await import(
          "@/lib/application-pdf.server"
        );
        // Internal HR-review flags are appended so the archived copy is
        // self-contained; they are not shown on the applicant-facing page.
        const flagSection = {
          label: "Internal HR review flags",
          rows: data.hr_reviews.length
            ? data.hr_reviews.map((entry) => ({ label: entry.question, value: entry.answer }))
            : [{ label: "HR review flags", value: "No HR-review flags" }],
        };
        const applicantName = data.pdf.applicant_name || `${data.first_name} ${data.last_name}`.trim();
        const bytes = await renderApplicationPdf({
          reference,
          submittedAt: new Date().toISOString(),
          applicantName,
          sections: [...data.pdf.sections, flagSection],
          acknowledgment: data.pdf.acknowledgment,
          logoUrl: data.pdf.logo_url,
        });
        const path = applicationPdfPath(reference, applicantName);
        const { putObject } = await import("@/server/storage");
        await putObject(APPLICATION_PDF_BUCKET, path, Buffer.from(bytes), { upsert: true });
        const { error: pathError } = await supabaseAdmin
          .from("applications")
          .update({ application_pdf_path: path })
          .eq("id", inserted.id);
        if (pathError) throw new Error(pathError.message);
        pdfSaved = true;
      } catch (pdfError) {
        console.error(
          `[applications] PDF generation failed for ${reference}`,
          pdfError instanceof Error ? pdfError.message : pdfError,
        );
      }
    }

    return { id: inserted.id, reference, pdf_saved: pdfSaved };
  });
