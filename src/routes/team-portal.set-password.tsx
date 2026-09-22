import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { setPassword as submitPassword } from "@/lib/auth-client";

/**
 * Public landing page for administrator invitations and password resets.
 * The single-use token arrives as a ?token= query parameter, so this route
 * stays outside the staff-only subtree — it must be reachable while signed out.
 */
export const Route = createFileRoute("/team-portal/set-password")({
  head: () => ({
    meta: [
      { title: "Set Your Team Portal Password — Elev8 Services California" },
      {
        name: "description",
        content:
          "Finish setting up your Elev8 Services California Team Portal staff account by choosing a password.",
      },
      { property: "og:title", content: "Set Your Team Portal Password — Elev8 Services California" },
      {
        property: "og:description",
        content: "Choose a password to finish activating your Elev8 Services staff account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    // Read the token once, then drop it from the address bar so it does not
    // linger in history or get copied into a support message.
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("token");
    if (!fromQuery) return;

    setToken(fromQuery);
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Choose a password of at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those two passwords do not match.");
      return;
    }
    if (!token) {
      setError("This page needs the link from your invitation email.");
      return;
    }
    setBusy(true);
    const submitError = await submitPassword(token, password);
    setBusy(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    setDone(true);
  }

  return (
    <section className="bg-background">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
          <KeyRound className="h-8 w-8 text-teal" strokeWidth={1.5} />
        </span>
        <p className="eyebrow mt-6">Staff Account Setup</p>
        <h1 className="mt-3 text-3xl font-extrabold text-primary lg:text-4xl">
          Set your password
        </h1>

        {done ? (
          <>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Your password is saved and your staff account is active.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/team-portal/applicants" })}
              className="btn-solid mt-8 px-7 py-3.5 text-base"
            >
              Open Applicant Tracking
            </button>
          </>
        ) : !token ? (
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Open this page from the invitation link in your email. If you arrived here
            directly, ask an administrator to send a new invitation.
          </p>
        ) : (
          <>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Choose a password for your staff account. Use at least 12
              characters and do not reuse a password from another service.
            </p>
            <form
              onSubmit={handleSubmit}
              className="mt-8 w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-left"
            >
              <label className="block text-sm font-semibold text-primary">
                New password
                <input
                  type={showPasswords ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                />
              </label>
              <label className="block text-sm font-semibold text-primary">
                Confirm password
                <input
                  type={showPasswords ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-teal"
              >
                {showPasswords ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
                {showPasswords ? "Hide passwords" : "Show passwords"}
              </button>
              {error ? (
                <p role="alert" className="text-sm font-semibold text-accent">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="btn-solid inline-flex w-full items-center justify-center gap-2 px-7 py-3.5 text-base disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Save password
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
