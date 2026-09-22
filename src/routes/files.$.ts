import { createFileRoute } from "@tanstack/react-router";

/**
 * Serves a stored file to whoever holds a valid signed link, replacing the
 * Supabase Storage signed-URL endpoint.
 *
 * Authorisation is the signature itself: createFileLink() issues one only
 * after checking that the caller is staff and that the file belongs to the
 * application they asked about. Links expire in ten minutes.
 */
export const Route = createFileRoute("/files/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { getObject, verifySignature } = await import("@/server/storage");
        const url = new URL(request.url);
        const bucket = url.searchParams.get("bucket") ?? "";
        const path = (params as { _splat?: string })._splat ?? "";

        const valid = verifySignature(
          bucket,
          path,
          url.searchParams.get("expires"),
          url.searchParams.get("signature"),
        );
        // One message for a bad signature, an expired link and a missing file,
        // so the endpoint reveals nothing about what is stored.
        if (!valid) return new Response("Not found", { status: 404 });

        let body: Buffer;
        try {
          body = await getObject(bucket, path);
        } catch {
          return new Response("Not found", { status: 404 });
        }

        const filename = path.split("/").pop() ?? "file";
        return new Response(new Uint8Array(body), {
          headers: {
            "content-type": contentTypeFor(filename),
            "content-length": String(body.byteLength),
            // inline so staff can read a PDF without downloading it first.
            "content-disposition": `inline; filename="${filename.replace(/["\\]/g, "")}"`,
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});

function contentTypeFor(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const types: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    heic: "image/heic",
  };
  return types[ext] ?? "application/octet-stream";
}
