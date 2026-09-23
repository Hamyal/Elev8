import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          &copy; {new Date().getFullYear()} Elev8 Services
        </span>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Link to="/privacy" className="font-medium text-primary transition-colors hover:text-accent">
            Privacy Policy
          </Link>
          <Link to="/terms" className="font-medium text-primary transition-colors hover:text-accent">
            Terms &amp; Conditions
          </Link>
          <Link to="/contact" className="font-medium text-primary transition-colors hover:text-accent">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
