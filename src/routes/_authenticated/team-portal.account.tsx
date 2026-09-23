import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, UserRound } from "lucide-react";
import { changeOwnPassword, getMyAccount, updateOwnProfile } from "@/lib/ats.functions";
import {
  CAPABILITY_LABELS,
  ROLE_LABELS,
  ROLE_SUMMARIES,
  type Capability,
  type RoleKey,
} from "@/lib/permissions";
import { signOut } from "@/lib/auth-client";

/**
 * Every signed-in person's own account, whatever their role.
 *
 * This is the whole of the portal for an Employee or a Caretaker, so it has to
 * stand on its own: who you are, what your access allows, and the two things
 * you are permitted to change about yourself.
 */
export const Route = createFileRoute("/_authenticated/team-portal/account")({
  head: () => ({
    meta: [
      { title: "My Account — Elev8 Services Team Portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyAccountPage,
});

const input =
  "mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30";

function MyAccountPage() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getMyAccount);
  const saveName = useServerFn(updateOwnProfile);
  const savePassword = useServerFn(changeOwnPassword);

  const account = useQuery({ queryKey: ["account", "me"], queryFn: () => fetchAccount() });

  const [fullName, setFullName] = useState("");
  useEffect(() => {
    if (account.data) setFullName(account.data.fullName);
  }, [account.data]);

  const nameMutation = useMutation({
    mutationFn: () => saveName({ data: { fullName: fullName.trim() } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account", "me"] }),
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const passwordMutation = useMutation({
    mutationFn: () => savePassword({ data: { currentPassword, newPassword } }),
    onSuccess: async () => {
      // Changing the password ends every session, including this one.
      await signOut();
      window.location.href = "/team-portal";
    },
  });

  if (account.isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-teal" aria-hidden="true" />
      </section>
    );
  }

  if (account.error || !account.data) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16">
        <p className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm font-semibold text-primary">
          {account.error instanceof Error
            ? account.error.message
            : "Your account could not be loaded."}
        </p>
      </section>
    );
  }

  const me = account.data;
  const canOpenAts = me.capabilities.includes("ats.view");

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      {canOpenAts ? (
        <Link
          to="/team-portal/applicants"
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Applicant Tracking
        </Link>
      ) : null}

      <p className="eyebrow mt-5">Your account</p>
      <h1 className="mt-2 text-2xl font-extrabold text-primary lg:text-4xl">
        {me.fullName || me.email}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{me.email}</p>

      {/* --- Access ---------------------------------------------------- */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal">Your access</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {me.roles.length ? (
            me.roles.map((role) => (
              <span
                key={role}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-sm font-bold text-primary"
              >
                {ROLE_LABELS[role as RoleKey] ?? role}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No role assigned yet.</span>
          )}
        </div>
        {me.roles[0] ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {ROLE_SUMMARIES[me.roles[0] as RoleKey]}
          </p>
        ) : null}

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {me.capabilities.map((capability) => (
            <li key={capability} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" strokeWidth={2} />
              {CAPABILITY_LABELS[capability as Capability] ?? capability}
            </li>
          ))}
        </ul>

        {!canOpenAts ? (
          <p className="mt-4 rounded-lg bg-secondary px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            Your role does not include the applicant tracking system. If you need it, ask an
            administrator.
          </p>
        ) : null}
      </div>

      {/* --- Name ------------------------------------------------------ */}
      <form
        className="mt-6 rounded-2xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (fullName.trim()) nameMutation.mutate();
        }}
      >
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <UserRound className="h-4 w-4 text-teal" strokeWidth={1.75} />
          Your details
        </p>
        <label className="mt-3 block text-sm font-semibold text-primary">
          Full name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.currentTarget.value)}
            className={input}
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Your email address is how you sign in, so only an administrator can change it.
        </p>
        <button
          type="submit"
          disabled={nameMutation.isPending || !fullName.trim()}
          className="btn-solid mt-4 inline-flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-60"
        >
          {nameMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Save name
        </button>
        {nameMutation.isSuccess ? (
          <p className="mt-2 text-sm font-semibold text-teal">Saved.</p>
        ) : null}
        {nameMutation.error ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-accent">
            {nameMutation.error instanceof Error
              ? nameMutation.error.message
              : "That could not be saved."}
          </p>
        ) : null}
      </form>

      {/* --- Password -------------------------------------------------- */}
      <form
        className="mt-6 rounded-2xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setPasswordError(null);
          if (newPassword.length < 12) {
            setPasswordError("Choose a password of at least 12 characters.");
            return;
          }
          if (newPassword !== confirmPassword) {
            setPasswordError("Those two passwords do not match.");
            return;
          }
          passwordMutation.mutate();
        }}
      >
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <KeyRound className="h-4 w-4 text-teal" strokeWidth={1.75} />
          Change your password
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-primary sm:col-span-2">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.currentTarget.value)}
              className={input}
            />
          </label>
          <label className="text-sm font-semibold text-primary">
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              className={input}
            />
          </label>
          <label className="text-sm font-semibold text-primary">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              className={input}
            />
          </label>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Changing your password signs you out everywhere, including here.
        </p>
        {passwordError ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-accent">
            {passwordError}
          </p>
        ) : null}
        {passwordMutation.error ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-accent">
            {passwordMutation.error instanceof Error
              ? passwordMutation.error.message
              : "Your password could not be changed."}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={passwordMutation.isPending}
          className="btn-solid mt-4 inline-flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-60"
        >
          {passwordMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Change password
        </button>
      </form>
    </section>
  );
}
