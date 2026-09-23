import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { getAdminOverview } from "@/lib/ats.functions";
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  ROLE_KEYS,
  ROLE_LABELS,
  ROLE_SUMMARIES,
} from "@/lib/permissions";

/**
 * Admin dashboard.
 *
 * Two jobs: show what the system currently holds, and make the permission
 * model legible. The matrix is generated from src/lib/permissions.ts rather
 * than written out here, so it cannot describe access the application does not
 * actually grant.
 */
export const Route = createFileRoute("/_authenticated/team-portal/admin")({
  head: () => ({
    meta: [{ title: "Admin — Elev8 Services Team Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminDashboard,
});

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "alert";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
        {label}
      </p>
      <p
        className={`mt-1.5 text-3xl font-extrabold ${
          tone === "alert" && value > 0 ? "text-accent" : "text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AdminDashboard() {
  const fetchOverview = useServerFn(getAdminOverview);
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fetchOverview() });

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <Link
        to="/team-portal/applicants"
        className="inline-flex items-center gap-1 text-sm font-semibold text-teal"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Applicant Tracking
      </Link>

      <p className="eyebrow mt-5">Administrator</p>
      <h1 className="mt-2 text-2xl font-extrabold text-primary lg:text-4xl">Admin</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Accounts, roles and what each role can reach.
      </p>

      {overview.error ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm font-semibold text-primary"
        >
          {overview.error instanceof Error ? overview.error.message : "This could not be loaded."}
        </p>
      ) : null}

      {overview.isLoading ? (
        <Loader2 className="mt-8 h-5 w-5 animate-spin text-teal" aria-hidden="true" />
      ) : null}

      {overview.data ? (
        <>
          <h2 className="mt-10 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
            Accounts
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total" value={overview.data.users.total} />
            <Stat label="Active" value={overview.data.users.active} />
            <Stat label="Invited" value={overview.data.users.invited} />
            <Stat label="Disabled" value={overview.data.users.disabled} />
          </div>

          <h2 className="mt-10 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
            Applicants
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Stat label="Total" value={overview.data.applicants.total} />
            <Stat label="Still open" value={overview.data.applicants.open} />
            <Stat
              label="Flags needing review"
              value={overview.data.applicants.needsReview}
              tone="alert"
            />
          </div>

          <h2 className="mt-10 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
            People by role
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ROLE_KEYS.map((role) => {
              const row = overview.data.byRole.find((r) => r.role === role);
              return <Stat key={role} label={ROLE_LABELS[role]} value={row?.count ?? 0} />;
            })}
          </div>
        </>
      ) : null}

      {/* --- Shortcuts --------------------------------------------------- */}
      <h2 className="mt-12 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
        Manage
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Link
          to="/team-portal/staff"
          className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-teal"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10">
            <Users className="h-5 w-5 text-teal" strokeWidth={1.75} />
          </span>
          <p className="mt-3 font-bold text-primary group-hover:text-teal">User access</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Create accounts, assign roles, rename people, disable access.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal">
            Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>

        <Link
          to="/team-portal/account"
          className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-teal"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10">
            <UserRound className="h-5 w-5 text-teal" strokeWidth={1.75} />
          </span>
          <p className="mt-3 font-bold text-primary group-hover:text-teal">My account</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your own name and password.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal">
            Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      </div>

      {/* --- Permission matrix ------------------------------------------- */}
      <h2 className="mt-12 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        What each role can do
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Generated from the permission model itself, so it always matches what the application
        grants. The database enforces these rules independently.
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="bg-secondary">
              <th scope="col" className="px-4 py-3 text-left font-bold text-primary">
                Capability
              </th>
              {ROLE_KEYS.map((role) => (
                <th key={role} scope="col" className="px-4 py-3 text-center font-bold text-primary">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((capability, index) => (
              <tr key={capability} className={index % 2 ? "bg-card" : "bg-secondary/40"}>
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {CAPABILITY_LABELS[capability]}
                </th>
                {ROLE_KEYS.map((role) => {
                  const allowed = ROLE_CAPABILITIES[role].includes(capability);
                  return (
                    <td key={role} className="px-4 py-2.5 text-center">
                      <span className="sr-only">{allowed ? "allowed" : "not allowed"}</span>
                      {allowed ? (
                        <Check
                          className="mx-auto h-4 w-4 text-teal"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      ) : (
                        <X
                          className="mx-auto h-4 w-4 text-muted-foreground/25"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_KEYS.map((role) => (
          <div key={role} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-bold text-primary">{ROLE_LABELS[role]}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {ROLE_SUMMARIES[role]}
            </p>
          </div>
        ))}
      </div>

      {/* --- Settings ---------------------------------------------------- */}
      <h2 className="mt-12 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
        <Settings className="h-4 w-4" aria-hidden="true" />
        System settings
      </h2>
      <p className="mt-2 max-w-2xl rounded-xl border border-border bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground">
        Not built yet. The values an administrator might want to edit — the approved message
        wording, interview facilities, phone-interview windows and deadline defaults — are currently
        fixed in code. Some of them should stay there: the text-message disclosure is versioned as
        consent evidence, and making it editable would weaken that record.
      </p>
    </section>
  );
}
