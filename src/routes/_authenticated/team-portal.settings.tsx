import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import { getMyAccount } from "@/lib/ats.functions";
import { can } from "@/lib/permissions";

/**
 * Access & Settings.
 *
 * The landing page for everything administrative. Staff account management
 * used to be reached from a button on the applicant workspace; it now lives
 * here as Users, which is where people will look for it.
 *
 * Entries are filtered by capability, because unlike the top navigation this
 * is a list of things to do rather than a fixed map of the product — offering
 * a Caretaker a link to user management would only produce a refusal.
 */
export const Route = createFileRoute("/_authenticated/team-portal/settings")({
  head: () => ({
    meta: [
      { title: "Access & Settings — Elev8 Services Team Portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessAndSettings,
});

function Row({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-secondary/60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20">
        <Icon className="h-5 w-5 text-teal" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-primary group-hover:text-teal">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-teal"
        aria-hidden="true"
      />
    </Link>
  );
}

function AccessAndSettings() {
  const fetchAccount = useServerFn(getMyAccount);
  const account = useQuery({ queryKey: ["account", "me"], queryFn: () => fetchAccount() });
  const roles = account.data?.roles ?? [];

  return (
    <section className="site-shell py-10">
      <p className="eyebrow">Administration</p>
      <h1 className="mt-2 text-2xl font-extrabold text-primary lg:text-3xl">
        Access &amp; Settings
      </h1>
      <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Accounts, roles and system configuration.
      </p>

      <div className="mt-7 overflow-hidden rounded-xl border border-border bg-card">
        {can(roles, "admin.manageUsers") ? (
          <Row
            to="/team-portal/settings/users"
            icon={Users}
            title="Users"
            description="Create accounts, assign roles, rename people and disable access."
          />
        ) : null}
        {can(roles, "admin.dashboard") ? (
          <Row
            to="/team-portal/admin"
            icon={ShieldCheck}
            title="Roles & permissions"
            description="What each role can reach, and the figures behind the accounts."
          />
        ) : null}
        <Row
          to="/team-portal/account"
          icon={UserRound}
          title="My account"
          description="Your own name and password."
        />
      </div>

      {can(roles, "admin.settings") ? (
        <>
          <h2 className="mt-10 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            System settings
          </h2>
          <div className="mt-3 flex gap-3 rounded-xl border border-border bg-secondary/60 p-5">
            <Settings
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Not built yet. The values an administrator might want to edit — the approved message
              wording, interview facilities, phone-interview windows and deadline defaults — are
              currently fixed in code. Some should stay there: the text-message disclosure is
              versioned as consent evidence, and making it editable would weaken that record.
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
