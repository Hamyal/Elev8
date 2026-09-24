import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/**
 * The shared furniture of the Team Portal.
 *
 * Every role lands on the same dashboard with the same boxes; only the
 * contents differ. These components exist so that stays true — an HR person
 * and a Caretaker should not feel like they are using two different products,
 * and a stat tile should not be styled three slightly different ways across
 * three screens.
 */

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  initial,
  aside,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | undefined;
  /** Shown as an avatar tile when given. */
  initial?: string | undefined;
  /** Right-aligned content, such as the date. */
  aside?: ReactNode | undefined;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div className="flex min-w-0 items-start gap-4">
        {initial ? (
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground"
          >
            {initial}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-1.5 truncate text-2xl font-extrabold text-primary lg:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {aside ? <div className="shrink-0 text-right">{aside}</div> : null}
    </header>
  );
}

export function SectionHeading({
  icon: Icon,
  children,
  action,
}: {
  icon?: Icon | undefined;
  children: ReactNode;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
        {Icon ? <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> : null}
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * One number, one label.
 *
 * `tone="alert"` turns the figure orange only when it is non-zero, so "0 flags
 * needing review" reads as calm rather than as a warning.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string | undefined;
  icon?: Icon | undefined;
  tone?: "default" | "alert" | undefined;
}) {
  const alert = tone === "alert" && typeof value === "number" && value > 0;
  return (
    <div
      className={`flex flex-col rounded-xl border bg-card p-4 ${
        alert ? "border-accent/40" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
          {label}
        </p>
        {Icon ? (
          <Icon
            className={`h-4 w-4 shrink-0 ${alert ? "text-accent" : "text-muted-foreground/40"}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p
        className={`mt-2 text-[2rem] font-extrabold leading-none tabular-nums ${
          alert ? "text-accent" : "text-primary"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** A card that goes somewhere. Same shape as StatCard so rows stay even. */
export function ActionCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: Icon;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-teal hover:shadow-md"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20">
        <Icon className="h-5 w-5 text-teal" strokeWidth={1.75} />
      </span>
      <p className="mt-3.5 font-bold text-primary transition-colors group-hover:text-teal">
        {title}
      </p>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <span className="mt-3.5 inline-flex items-center gap-1 text-sm font-semibold text-teal">
        Open
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

/** A compact sidebar link — a row, not a card, so a list of them stays dense. */
export function QuickLink({
  to,
  icon: Icon,
  label,
  meta,
}: {
  to: string;
  icon: Icon;
  label: string;
  meta?: string | undefined;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/10">
        <Icon className="h-4 w-4 text-teal" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-primary group-hover:text-teal">
          {label}
        </span>
        {meta ? <span className="block truncate text-xs text-muted-foreground">{meta}</span> : null}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-teal"
        aria-hidden="true"
      />
    </Link>
  );
}

/** A bordered panel with a labelled header strip. */
export function Panel({
  title,
  children,
  action,
  padded = true,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode | undefined;
  padded?: boolean | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/50 px-4 py-2.5">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
          {title}
        </p>
        {action}
      </div>
      <div className={padded ? "p-4" : ""}>{children}</div>
    </div>
  );
}

/**
 * One stage of the hiring pipeline.
 *
 * The bar is scaled against the largest stage rather than the total, because
 * against a total the small stages all collapse to invisible slivers — and the
 * shape of the pipeline is exactly what this is meant to show.
 */
export function FunnelRow({
  label,
  value,
  max,
  total,
  tone = "teal",
}: {
  label: string;
  value: number;
  max: number;
  total: number;
  tone?: "teal" | "muted" | "accent" | undefined;
}) {
  const width = max > 0 && value > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  const bar =
    tone === "accent" ? "bg-accent" : tone === "muted" ? "bg-muted-foreground/30" : "bg-teal";

  return (
    <div className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-3 py-2 sm:grid-cols-[8rem_1fr_4rem]">
      <span className="truncate text-sm font-semibold text-primary">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-secondary">
        <span
          className={`block h-full rounded-full ${bar} transition-[width] duration-700 ease-out`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-right text-sm tabular-nums">
        <span className="font-bold text-primary">{value}</span>
        <span className="ml-1 text-xs text-muted-foreground">{share}%</span>
      </span>
    </div>
  );
}

/**
 * The things that need doing, surfaced above everything else.
 *
 * Rendered only when there is something in it — an empty "nothing needs your
 * attention" box trains people to ignore the space it occupies.
 */
export function AttentionBar({
  items,
}: {
  items: { icon: Icon; label: string; count: number; to?: string }[];
}) {
  const live = items.filter((item) => item.count > 0);
  if (!live.length) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-accent/30 bg-accent/[0.04]">
      <div className="divide-y divide-accent/15">
        {live.map((item) => {
          const body = (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                <item.icon className="h-4 w-4 text-accent" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-primary">
                <strong className="font-extrabold tabular-nums">{item.count}</strong> {item.label}
              </span>
              {item.to ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              ) : null}
            </>
          );
          return item.to ? (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/[0.06]"
            >
              {body}
            </Link>
          ) : (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
