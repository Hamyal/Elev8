import { createFileRoute } from "@tanstack/react-router";
import { CERT_BUCKET, CERT_MAX_BYTES, extensionOf } from "@/lib/certification-upload";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "pdf"]);

/**
 * Receives a certification document from the public application form,
 * replacing the applicant's direct upload to the Supabase Storage bucket.
 *
 * Applicants are not signed in, so this endpoint is open by necessity -- as
 * the Supabase policy it replaces was. The same three limits apply: the file
 * lands under pending/ and nowhere else, the extension is on the allow-list,
 * and the size is capped. Nothing here can be read back; retrieval is
 * staff-only, through a signed link.
 */
export const Route = createFileRoute("/api/upload-certification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { putObject } = await import("@/server/storage");
        const form = await request.formData().catch(() => null);
        if (!form) return Response.json({ error: "Invalid upload." }, { status: 400 });

        const file = form.get("file");
        const attemptId = String(form.get("attemptId") ?? "");
        const fieldKey = String(form.get("fieldKey") ?? "");

        if (!(file instanceof File)) {
          return Response.json({ error: "No file was received." }, { status: 400 });
        }
        // The path is built from these, so they are restricted to characters
        // that cannot traverse out of the pending folder.
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(attemptId) || !/^[A-Za-z0-9_-]{1,64}$/.test(fieldKey)) {
          return Response.json({ error: "Invalid upload." }, { status: 400 });
        }

        const ext = extensionOf(file.name);
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return Response.json(
            { error: "Please upload a JPG, PNG, HEIC, or PDF file." },
            { status: 400 },
          );
        }
        if (file.size === 0) {
          return Response.json({ error: "This file appears to be empty." }, { status: 400 });
        }
        if (file.size > CERT_MAX_BYTES) {
          return Response.json(
            { error: "This file is larger than 10 MB. Please upload a smaller file." },
            { status: 413 },
          );
        }

        const path = `pending/${attemptId}/${fieldKey}-${crypto.randomUUID()}.${ext}`;
        try {
          await putObject(CERT_BUCKET, path, Buffer.from(await file.arrayBuffer()));
        } catch (error) {
          console.error("[upload] certification upload failed", error);
          return Response.json({ error: "The file could not be saved." }, { status: 500 });
        }

        return Response.json({ path, name: file.name, type: file.type, size: file.size });
      },
    },
  },
});
