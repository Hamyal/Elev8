import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { ROLE_KEYS, ROLE_LABELS, ROLE_SUMMARIES, type RoleKey } from "@/lib/permissions";
import {
  inviteStaffWithLink,
  listStaff,
  resendStaffInvite,
  setStaffActive,
  setStaffRole,
  updateStaffProfile,
} from "@/lib/ats.functions";

export const Route = createFileRoute("/_authenticated/team-portal/staff")({
  head: () => ({
    meta: [
      { title: "Staff Access — Elev8 Services Team Portal" },
      {
        name: "description",
        content:
          "Administrator tools for Elev8 Services staff accounts: create accounts, assign Admin, HR, or Viewer access, and deactivate access.",
      },
      { property: "og:title", content: "Staff Access — Elev8 Services Team Portal" },
      {
        property: "og:description",
        content: "Administrator tools for Elev8 Services Team Portal staff accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffAccess,
});

const ROLES = ROLE_KEYS;

function StaffAccess() {
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const invite = useServerFn(inviteStaffWithLink);
  const setActive = useServerFn(setStaffActive);

  const staff = useQuery({ queryKey: ["ats", "staff"], queryFn: () => fetchStaff() });

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleKey>("hr");
  // "Invited" is not a stored state — it is what an enabled account looks like
  // before its owner sets a password. So the form asks the two real questions:
  // is the account enabled, and do we send the link now.
  const [status, setStatus] = useState<"active" | "invited" | "disabled">("invited");

  const inviteMutation = useMutation({
    mutationFn: () =>
      invite({
        data: {
          email: email.trim(),
          fullName,
          role,
          enabled: status !== "disabled",
          sendInvitation: status !== "disabled",
        },
      }),
    onSuccess: () => {
      setEmail("");
      setFullName("");
      queryClient.invalidateQueries({ queryKey: ["ats", "staff"] });
    },
  });

  const activeMutation = useMutation({
    mutationFn: (input: { userId: string; active: boolean }) => setActive({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ats", "staff"] }),
  });

  const changeRole = useServerFn(setStaffRole);
  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: (typeof ROLES)[number] }) =>
      changeRole({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ats", "staff"] }),
  });

  const saveProfile = useServerFn(updateStaffProfile);
  // Which row is being renamed, and the name being typed into it.
  const [editing, setEditing] = useState<{ userId: string; fullName: string } | null>(null);
  const profileMutation = useMutation({
    mutationFn: (input: { userId: string; fullName: string }) => saveProfile({ data: input }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["ats", "staff"] });
    },
  });

  const resend = useServerFn(resendStaffInvite);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const resendMutation = useMutation({
    mutationFn: (email: string) => resend({ data: { email } }),
    onSuccess: (_result, email) => setResendNotice(`Invitation email sent to ${email}.`),
    onError: (error) =>
      setResendNotice(error instanceof Error ? error.message : "The email could not be sent."),
  });

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 lg:py-14">
        <Link
          to="/team-portal/applicants"
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Applicant Tracking
        </Link>
        <p className="eyebrow mt-5">Administrator</p>
        <h1 className="mt-2 text-2xl font-extrabold text-primary lg:text-4xl">Staff Access</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Invite staff by email and assign access. Each person receives a secure link to
          choose their own password. Administrators cannot change their own role, and
          there is no public sign-up.
        </p>

        <form
          className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <label className="text-sm font-semibold text-primary">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.currentTarget.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            />
          </label>
          <label className="text-sm font-semibold text-primary">
            Work email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            />
          </label>
          <label className="text-sm font-semibold text-primary">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.currentTarget.value as RoleKey)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs font-normal leading-relaxed text-muted-foreground">
              {ROLE_SUMMARIES[role]}
            </span>
          </label>

          <label className="text-sm font-semibold text-primary">
            Status
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.currentTarget.value as "active" | "invited" | "disabled")
              }
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            >
              <option value="invited">Invited — send the set-password link now</option>
              <option value="active">Active — send the link now</option>
              <option value="disabled">Disabled — create the account, send nothing</option>
            </select>
            <span className="mt-1.5 block text-xs font-normal leading-relaxed text-muted-foreground">
              {status === "disabled"
                ? "The account is created but cannot sign in. Invite them later from the list."
                : "They show as Invited until they set a password, then Active."}
            </span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="btn-solid inline-flex items-center gap-2 px-6 py-3 text-base disabled:opacity-60"
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {status === "disabled" ? "Create account" : "Send invitation"}
            </button>
            {inviteMutation.isSuccess && !inviteMutation.error ? (
              <p className="mt-2 text-sm font-semibold text-status-completed">
                Invitation sent. They can set their own password from the email link.
              </p>
            ) : null}
            {inviteMutation.error ? (
              <p className="mt-2 text-sm font-semibold text-accent">
                {inviteMutation.error instanceof Error
                  ? inviteMutation.error.message
                  : "The account could not be created."}
              </p>
            ) : null}
          </div>
        </form>

        <h2 className="mt-10 flex items-center gap-2 text-lg font-bold text-primary">
          <ShieldCheck className="h-4 w-4 text-teal" aria-hidden="true" />
          Staff accounts
        </h2>
        {staff.isPending ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading…
          </p>
        ) : null}
        {staff.error ? (
          <p className="mt-3 rounded-lg border border-accent/50 bg-accent/5 p-4 text-sm font-semibold text-primary">
            {staff.error instanceof Error ? staff.error.message : "Staff could not be loaded."}
          </p>
        ) : null}
        <ul className="mt-3 space-y-3">
          {(staff.data ?? []).map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                {editing?.userId === member.userId ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (editing.fullName.trim()) profileMutation.mutate(editing);
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      autoFocus
                      value={editing.fullName}
                      onChange={(e) =>
                        setEditing({ userId: member.userId, fullName: e.currentTarget.value })
                      }
                      aria-label={`Full name for ${member.email}`}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                    />
                    <button
                      type="submit"
                      disabled={profileMutation.isPending}
                      className="btn-solid px-4 py-1.5 text-sm disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="btn-ghost-navy px-4 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <p className="text-sm font-bold text-primary">
                    {member.fullName || member.email}
                    {member.isSelf ? " (you)" : ""}
                  </p>
                )}
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {member.email} &middot;{" "}
                  {member.roles.length
                    ? member.roles.map((r) => ROLE_LABELS[r as RoleKey] ?? r).join(", ")
                    : "no role assigned"}{" "}
                  &middot; {member.statusLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* An admin cannot change their own role or access — the
                    database enforces this too, so the last admin cannot lock
                    everyone out of staff management. */}
                {member.isSelf ? null : (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="sr-only">Role for {member.email}</span>
                    <select
                      value={member.roles[0] ?? ""}
                      disabled={roleMutation.isPending}
                      onChange={(e) =>
                        roleMutation.mutate({
                          userId: member.userId,
                          role: e.currentTarget.value as RoleKey,
                        })
                      }
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                    >
                      {member.roles.length ? null : <option value="">no role</option>}
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setEditing({ userId: member.userId, fullName: member.fullName ?? "" })
                  }
                  className="btn-ghost-navy px-5 py-2 text-sm"
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={resendMutation.isPending}
                  onClick={() => {
                    setResendNotice(null);
                    resendMutation.mutate(member.email);
                  }}
                  className="btn-ghost-navy px-5 py-2 text-sm disabled:opacity-60"
                >
                  Resend invitation
                </button>
                {member.isSelf ? null : (
                  <button
                    type="button"
                    onClick={() =>
                      activeMutation.mutate({ userId: member.userId, active: !member.active })
                    }
                    className="btn-ghost-navy px-5 py-2 text-sm"
                  >
                    {member.active ? "Deactivate" : "Reactivate"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {resendNotice ? (
          <p className="mt-3 rounded-lg border border-teal/40 bg-teal/5 p-4 text-sm font-semibold text-primary">
            {resendNotice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
