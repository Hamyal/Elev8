import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { getSessionUser, signOut, type SessionUser } from "@/lib/auth-client";

/**
 * Top navigation for the signed-in portal.
 *
 * The order is fixed by the brief and is deliberately not derived from
 * permissions: every signed-in person sees the same seven sections, and a
 * section they may not use refuses them at its own door rather than quietly
 * vanishing from the bar. That keeps the navigation stable between roles, so
 * one person can be told "it's under Reports" and find it.
 */
const SECTIONS = [
  { label: "Dashboard", to: "/team-portal/dashboard" },
  { label: "Corporate", to: "/team-portal/corporate" },
  { label: "Applicants", to: "/team-portal/applicants" },
  { label: "Team", to: "/team-portal/team" },
  { label: "Clients", to: "/team-portal/clients" },
  { label: "Reports", to: "/team-portal/reports" },
  { label: "Access & Settings", to: "/team-portal/settings" },
] as const;

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function PortalNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    getSessionUser({ force: true })
      .then((result) => active && setUser(result))
      .catch(() => active && setUser(null));
    return () => {
      active = false;
    };
  }, [pathname]);

  // Close the mobile menu on navigation, and when tapping outside it.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSignOut() {
    await signOut();
    // A full navigation, so every cached query for the previous person goes
    // with the page rather than surviving into the next session.
    window.location.href = "/team-portal";
  }

  return (
    <header ref={ref} className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="site-shell flex items-center justify-between gap-4 py-3">
        <Link to="/team-portal/dashboard" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Portal sections" className="hidden min-w-0 flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-0.5">
            {SECTIONS.map((section) => {
              const active = isActive(pathname, section.to);
              return (
                <li key={section.to}>
                  <Link
                    to={section.to}
                    aria-current={active ? "page" : undefined}
                    className={`relative block whitespace-nowrap rounded-lg px-2.5 py-2 text-[0.8125rem] font-bold transition-colors xl:px-3 xl:text-sm ${
                      active ? "text-accent" : "text-primary hover:text-accent"
                    }`}
                  >
                    {section.label}
                    <span
                      className={`absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-accent transition-all xl:inset-x-3 ${
                        active ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title={`Signed in as ${user.email}`}
              className="hidden items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold text-primary transition-colors hover:border-accent hover:text-accent sm:inline-flex"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="text-primary lg:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-background lg:hidden">
          <nav aria-label="Portal sections" className="site-shell flex flex-col py-2">
            {SECTIONS.map((section) => {
              const active = isActive(pathname, section.to);
              return (
                <Link
                  key={section.to}
                  to={section.to}
                  aria-current={active ? "page" : undefined}
                  className={`border-b border-border/60 py-3 text-sm font-bold transition-colors ${
                    active ? "text-accent" : "text-primary"
                  }`}
                >
                  {section.label}
                </Link>
              );
            })}
            {user ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-bold text-primary"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
