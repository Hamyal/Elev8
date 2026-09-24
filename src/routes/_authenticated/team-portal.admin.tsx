import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  LayoutDashboard,
  Loader2,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { getAdminOverview } from "@/lib/ats.functions";
import { ActionCard, SectionHeading, StatCard } from "@/components/portal/Cards";
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

function AdminDashboard() {
  const fetchOverview = useServerFn(getAdminOverview);
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fetchOverview() });

  return (
    <section className="site-shell py-12">
      <Link
        to="/team-portal/settings"
        className="inline-flex items-center gap-1 text-sm font-semibold text-teal"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Access &amp; Settings
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
          <SectionHeading>Accounts</SectionHeading>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total" value={overview.data.users.total} />
            <StatCard label="Active" value={overview.data.users.active} />
            <StatCard label="Invited" value={overview.data.users.invited} />
            <StatCard label="Disabled" value={overview.data.users.disabled} />
          </div>

          <SectionHeading>Applicants</SectionHeading>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <StatCard label="Total" value={overview.data.applicants.total} />
            <StatCard label="Still open" value={overview.data.applicants.open} />
            <StatCard
              label="Flags needing review"
              value={overview.data.applicants.needsReview}
              tone="alert"
            />
          </div>

          <SectionHeading>People by role</SectionHeading>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ROLE_KEYS.map((role) => {
              const row = overview.data.byRole.find((r) => r.role === role);
              return <StatCard key={role} label={ROLE_LABELS[role]} value={row?.count ?? 0} />;
            })}
          </div>
        </>
      ) : null}

      {/* --- Shortcuts --------------------------------------------------- */}
      <SectionHeading>Manage</SectionHeading>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          to="/team-portal/dashboard"
          icon={LayoutDashboard}
          title="Dashboard"
          description="The day-to-day view: applicants, accounts and what needs attention."
        />
        <ActionCard
          to="/team-portal/settings/users"
          icon={Users}
          title="Users"
          description="Create accounts, assign roles, rename people, disable access."
        />
        <ActionCard
          to="/team-portal/account"
          icon={UserRound}
          title="My account"
          description="Your own name and password."
        />
      </div>

      {/* --- Permission matrix ------------------------------------------- */}
      <SectionHeading icon={ShieldCheck}>What each role can do</SectionHeading>
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
      <SectionHeading icon={Settings}>System settings</SectionHeading>
      <p className="mt-2 max-w-2xl rounded-xl border border-border bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground">
        Not built yet. The values an administrator might want to edit — the approved message
        wording, interview facilities, phone-interview windows and deadline defaults — are currently
        fixed in code. Some of them should stay there: the text-message disclosure is versioned as
        consent evidence, and making it editable would weaken that record.
      </p>
    </section>
  );
}
