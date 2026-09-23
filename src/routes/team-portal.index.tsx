import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LogOut, UserRound } from "lucide-react";
import { getSessionUser, signIn, signOut } from "@/lib/auth-client";
import { getMyAccount } from "@/lib/ats.functions";
import { homeFor } from "@/lib/permissions";

export const Route = createFileRoute("/team-portal/")({
  head: () => ({
    meta: [
      { title: "Team Portal Sign In — Elev8 Services California" },
      {
        name: "description",
        content:
          "Secure staff sign-in for the Elev8 Services California Team Portal. Accounts are created by an administrator.",
      },
      { property: "og:title", content: "Team Portal Sign In — Elev8 Services California" },
      {
        property: "og:description",
        content: "Secure staff sign-in for the Elev8 Services California Team Portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPortalSignIn,
});

function TeamPortalSignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;
    getSessionUser().then((user) => {
      if (active) setSignedInEmail(user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const signInError = await signIn(email.trim(), password);
    setBusy(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    // An Employee or Caretaker has no applicant access, so send each role to
    // the first page it can actually open.
    try {
      const me = await getMyAccount();
      navigate({ to: homeFor(me.roles) });
    } catch {
      navigate({ to: "/team-portal/account" });
    }
  }

  async function handleSignOut() {
    await signOut();
    setSignedInEmail(null);
  }

  return (
    <section className="bg-background">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
          <UserRound className="h-8 w-8 text-teal" strokeWidth={1.5} />
        </span>
        <p className="eyebrow mt-6">For Our Team</p>
        <h1 className="mt-3 text-3xl font-extrabold text-primary lg:text-4xl">Team Portal</h1>

        {signedInEmail ? (
          <>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Signed in as {signedInEmail}.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  void getMyAccount()
                    .then((me) => navigate({ to: homeFor(me.roles) }))
                    .catch(() => navigate({ to: "/team-portal/account" }));
                }}
                className="btn-solid px-7 py-3.5 text-base"
              >
                Open Team Portal
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="btn-ghost-navy inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Staff sign-in. Accounts are created by an administrator — there is no
              public sign-up.
            </p>
            <form
              onSubmit={handleSubmit}
              className="mt-8 w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-left"
            >
              <label className="block text-sm font-semibold text-primary">
                Work email
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                />
              </label>
              <label className="block text-sm font-semibold text-primary">
                Password
                <span className="relative mt-1 block">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2.5 pr-11 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-teal"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </span>
              </label>
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
                Sign in
              </button>
            </form>
            <p className="mt-4 text-sm text-muted-foreground">
              Need access? Contact your supervisor or our office.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
