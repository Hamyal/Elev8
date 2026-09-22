import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email is required"),
        phone: z.string().optional().default(""),
        interest: z.string().default("general"),
        message: z.string().min(1, "Message is required"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { adminDb: supabaseAdmin } = await import("@/server/admin");
    const { error } = await supabaseAdmin.from("contact_submissions").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      interest: data.interest,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
