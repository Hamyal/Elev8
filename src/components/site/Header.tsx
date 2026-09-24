import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { createApplicationAttempt } from "@/lib/application-attempt";
import { getSessionUser, signOut, type SessionUser } from "@/lib/auth-client";

const NAV = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "Internships & Careers", to: "/careers" },
  { label: "Families & Referrals", to: "/referrals" },
  { label: "Team Portal", to: "/team-portal" },
] as const;

function isActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Who is signed in, for the header only.
 *
 * The header renders on every page, including public ones, so this must never
 * throw or block: a failed lookup simply means the signed-out header, which is
 * the correct fallback. `pathname` is a dependency because signing in or out
 * navigates, and the header has to notice.
 */
function useSessionUser(pathname: string) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    getSessionUser({ force: true })
      .then((result) => {
        if (active) setUser(result);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  return user;
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const headerRef = useRef<HTMLElement>(null);
  const user = useSessionUser(pathname);

  async function handleSignOut() {
    await signOut();
    // A full navigation rather than a router push, so every cached query for
    // the previous person is discarded with the page.
    window.location.href = "/team-portal";
  }

  // Close the mobile menu when tapping outside of it.
  useEffect(() => {
    if (!mobileOpen) return;
    function handleClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileOpen]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="site-shell flex items-center justify-between gap-9 py-4 lg:h-[126px] lg:py-0">
        <div className="flex items-center gap-3">
          <button
            className="text-primary lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <Logo />
        </div>

        <nav className="hidden items-center gap-[42px] lg:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`relative text-[0.9375rem] font-bold transition-colors hover:text-accent ${
                  active ? "text-accent" : "text-primary"
                }`}
              >
                {item.label}
                <span
                  className={`absolute -bottom-1.5 left-0 h-0.5 rounded-full bg-accent transition-all ${
                    active ? "w-full" : "w-0"
                  }`}
                />
              </Link>
            );
          })}
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/team-portal/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-[0.9375rem] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                title={`Signed in as ${user.email}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-[0.9375rem] font-bold text-primary transition-colors hover:border-accent hover:text-accent"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/contact"
              className="rounded-lg bg-primary px-[26px] py-[18px] text-[0.9375rem] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Contact Us
            </Link>
          )}
        </nav>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="site-shell flex flex-col py-2">
            {NAV.map((item) => {
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 border-b border-border/60 py-3 text-sm font-medium transition-colors ${
                    active ? "text-accent" : "text-foreground hover:text-primary"
                  }`}
                >
                  <span
                    className={`h-5 w-1 rounded-full bg-accent transition-all ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/contact"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 border-b border-border/60 py-3 text-sm font-medium transition-colors text-foreground hover:text-primary"
            >
              <span className="h-5 w-1 rounded-full bg-accent opacity-0 transition-all" />
              Contact Us
            </Link>
            <Link
              to="/careers/apply"
              search={{ fresh: true }}
              onClick={() => {
                createApplicationAttempt();
                setMobileOpen(false);
              }}
              className="my-3 block rounded-lg bg-accent px-5 py-3 text-center text-sm font-bold text-accent-foreground"
            >
              Start Application
            </Link>

            {/* The same signed-in controls as the desktop header, so signing
                out does not require finding a wider screen. */}
            {user ? (
              <div className="mb-3 border-t border-border pt-3">
                <p className="truncate pb-2 text-xs font-semibold text-muted-foreground">
                  Signed in as {user.email}
                </p>
                <Link
                  to="/team-portal/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void handleSignOut();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-bold text-primary"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
}
