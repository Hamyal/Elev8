import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { submitContact } from "@/lib/contact.functions";

const INTERESTS = [
  { value: "general", label: "General Inquiry" },
  { value: "residential", label: "Residential Living" },
  { value: "sls", label: "Supported Living (SLS)" },
  { value: "day-program", label: "Day Program" },
  { value: "careers", label: "Careers" },
];

export function ContactForm() {
  const submit = useServerFn(submitContact);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    try {
      await submit({
        data: {
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          interest: String(formData.get("interest") ?? "general"),
          message: String(formData.get("message") ?? ""),
        },
      });
      toast.success("Thank you! We'll be in touch soon.");
      form.reset();
    } catch {
      toast.error("Something went wrong. Please try again or call us.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="contact" className="bg-primary py-16 text-primary-foreground">
      <div className="site-shell max-w-3xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold lg:text-4xl">Request Information</h2>
          <p className="mt-3 text-primary-foreground/80">
            Have questions about our services or want to learn more? Reach out
            and our team will respond within two business days.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl bg-white p-6 text-foreground shadow-lg md:p-8"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Full Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label
                htmlFor="interest"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                I'm interested in
              </label>
              <select
                id="interest"
                name="interest"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {INTERESTS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="message"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Message *
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-pill btn-accent inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </section>
  );
}
