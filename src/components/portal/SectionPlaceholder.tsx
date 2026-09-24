import type { ComponentType } from "react";

/**
 * A navigation section that has no content yet.
 *
 * Every item in the top bar has to lead somewhere, or the bar is lying about
 * what exists. This says plainly that the section is not built, which is more
 * useful than an empty page that reads as broken or as "you have no records".
 */
export function SectionPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
}) {
  return (
    <section className="site-shell py-16">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 ring-1 ring-inset ring-teal/20">
          <Icon className="h-6 w-6 text-teal" strokeWidth={1.5} />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-primary">{title}</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-bold text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />
          Not built yet
        </p>
      </div>
    </section>
  );
}
