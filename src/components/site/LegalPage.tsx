import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ArrowUp, Check, Copy, CopyCheck, X } from "lucide-react";

/**
 * Furniture for the Privacy Policy and Terms pages.
 *
 * These two pages are read by two very different audiences: an applicant
 * deciding whether to trust us with their phone number, and a carrier
 * compliance reviewer checking that the required disclosures are present and
 * findable. Both are served by the same thing — structure that lets a specific
 * fact be located without reading the whole page. Hence the contents rail, the
 * numbered sections, and the fact tables.
 *
 * Built from the existing tokens (navy `primary`, orange `accent`, `teal`,
 * `muted` surface) so it belongs to the rest of the site.
 */

/* -------------------------------------------------------------------------- */
/* Motion                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Whether the visitor has asked for reduced motion.
 *
 * This site serves people with disabilities, so every animation below is
 * decorative and every one of them is skipped when this returns true -- the
 * content appears immediately rather than waiting on a transition.
 */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

/**
 * Fades and lifts its children into place the first time they scroll into
 * view. It only ever animates once, so scrolling back up does not replay it.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Milliseconds, for staggering siblings. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      // Trigger slightly before the element reaches the fold, so it has
      // finished animating by the time it is properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={`${className} ${
        reduced
          ? ""
          : `transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
              shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`
      }`}
      style={!reduced && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Keeps the revealed content readable when JavaScript does not run.
 *
 * Reveal starts at zero opacity and is brought in by an observer, so without
 * scripting the page would render blank. These two pages are read by carrier
 * compliance reviewers and crawlers, where that would be a real failure, so
 * the animation is neutralised rather than trusted. Render once per page.
 */
export function RevealFallbackStyles() {
  return (
    <noscript>
      <style>{"[data-reveal]{opacity:1 !important;transform:none !important}"}</style>
    </noscript>
  );
}

/**
 * A card that lights up under the pointer.
 *
 * The cursor position is written to two CSS custom properties and a radial
 * gradient reads them, so the glow follows the mouse without React
 * re-rendering on every move. Pointer events cover touch too, where there is
 * no hover and the overlay simply stays hidden.
 */
export function Spotlight({
  children,
  className = "",
  tone = "teal",
}: {
  children: ReactNode;
  className?: string;
  tone?: "teal" | "accent" | "navy";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  const track = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${event.clientX - box.left}px`);
    node.style.setProperty("--my", `${event.clientY - box.top}px`);
  }, []);

  const glow =
    tone === "accent"
      ? "rgba(254,80,5,0.14)"
      : tone === "navy"
        ? "rgba(2,46,90,0.12)"
        : "rgba(0,143,163,0.14)";

  return (
    <div
      ref={ref}
      onPointerMove={reduced ? undefined : track}
      className={`group/spot relative isolate overflow-hidden transition-shadow duration-300 hover:shadow-lg ${className}`}
    >
      {!reduced ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
          style={{
            background: `radial-gradient(18rem circle at var(--mx, 50%) var(--my, 50%), ${glow}, transparent 70%)`,
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reading progress                                                           */
/* -------------------------------------------------------------------------- */

/** A hairline at the top of the viewport showing how far down the page you are. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent" aria-hidden="true">
      <div
        className="h-full bg-accent transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Full-bleed navy hero. The faint grid is drawn with two repeating gradients
 * rather than an image, so it costs nothing to load and stays crisp.
 */
export function LegalHero({
  eyebrow,
  title,
  summary,
  updated,
  highlights,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  highlights: {
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
  }[];
}) {
  return (
    <header className="relative overflow-hidden bg-primary">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 48px),repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 48px)",
        }}
      />
      {/* Warm glow, bottom-left, to stop the navy reading as flat. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-teal/20 blur-3xl"
      />

      <div className="site-shell relative py-16 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-foreground/70">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-primary-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
          {summary}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          {highlights.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3.5 py-1.5 text-xs font-semibold text-primary-foreground backdrop-blur-sm"
            >
              <item.icon className="h-3.5 w-3.5" strokeWidth={2} />
              {item.label}
            </span>
          ))}
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/50">
          Last updated {updated}
        </p>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Contents rail                                                              */
/* -------------------------------------------------------------------------- */

export type TocItem = { id: string; label: string };

/**
 * Sticky contents with the current section marked.
 *
 * IntersectionObserver rather than a scroll handler: it reports which sections
 * are on screen without running work on every scroll frame.
 */
export function ContentsRail({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Bias the band towards the top of the viewport so the heading you are
      // reading is the one highlighted.
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="sticky top-8">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
        On this page
      </p>
      <ul className="mt-4 space-y-0.5 border-l border-border">
        {items.map((item) => {
          const current = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? "true" : undefined}
                className={`-ml-px flex border-l-2 py-1.5 pl-4 text-sm transition-colors ${
                  current
                    ? "border-accent font-bold text-primary"
                    : "border-transparent font-medium text-muted-foreground/70 hover:border-border hover:text-primary"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Same links as chips, for narrow screens where the rail is hidden. */
export function ContentsChips({ items }: { items: TocItem[] }) {
  return (
    <nav aria-label="On this page" className="lg:hidden">
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-teal hover:text-teal"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections and blocks                                                        */
/* -------------------------------------------------------------------------- */

export function Section({
  id,
  index,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  index?: number;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0"
    >
      <div className="flex items-start gap-3.5">
        {Icon ? (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20">
            <Icon className="h-5 w-5 text-teal" strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="min-w-0">
          {index !== undefined ? (
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">
              {String(index).padStart(2, "0")}
            </p>
          ) : null}
          <h2 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">{title}</h2>
        </div>
      </div>
      <Reveal className="mt-4 space-y-3.5 leading-relaxed text-muted-foreground sm:pl-[3.375rem]">
        {children}
      </Reveal>
    </section>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Spotlight className={`rounded-xl border border-border bg-card ${className}`}>
      <div className="p-5">{children}</div>
    </Spotlight>
  );
}

export function FactTable({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="overflow-hidden rounded-xl border border-border shadow-sm">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={`grid gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:gap-4 ${
            index ? "border-t border-border" : ""
          } ${index % 2 ? "bg-card" : "bg-secondary/60"}`}
        >
          <dt className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-teal">
            {row.label}
          </dt>
          <dd className="text-sm leading-relaxed text-muted-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The opt-in journey.
 *
 * A reviewer's first question is "how exactly does someone end up on this
 * list?" — far easier to answer from a diagram than a paragraph. The rail is
 * drawn behind the markers on wide screens and down the left on narrow ones.
 */
export function StepFlow({ steps }: { steps: { title: string; detail: string }[] }) {
  return (
    <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      <span
        aria-hidden="true"
        className="absolute left-[15px] top-2 hidden h-[calc(100%-1rem)] w-px bg-border sm:block lg:left-0 lg:top-[15px] lg:h-px lg:w-full"
      />
      {steps.map((step, index) => (
        <li key={step.title} className="relative">
          <Reveal delay={index * 90}>
            <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-4 ring-background">
              {index + 1}
            </span>
            <p className="mt-3 text-sm font-bold text-primary">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

export function KeywordCard({
  keyword,
  heading,
  children,
  tone = "accent",
}: {
  keyword: string;
  heading: string;
  children: ReactNode;
  tone?: "accent" | "teal";
}) {
  const accent = tone === "accent";
  return (
    <Spotlight
      tone={accent ? "accent" : "teal"}
      className={`rounded-2xl border p-5 ${
        accent ? "border-accent/30 bg-accent/[0.04]" : "border-teal/30 bg-teal/[0.04]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${
          accent ? "bg-accent/20" : "bg-teal/20"
        }`}
      />
      <p
        className={`relative inline-flex rounded-lg px-3 py-1.5 font-mono text-sm font-bold tracking-[0.1em] ${
          accent ? "bg-accent text-accent-foreground" : "bg-teal text-teal-foreground"
        }`}
      >
        {keyword}
      </p>
      <p className="relative mt-3.5 text-sm font-bold text-primary">{heading}</p>
      <p className="relative mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </Spotlight>
  );
}

/** A statement that carries weight — the "we never sell" commitments. */
export function Commitment({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border-l-[3px] border-teal bg-secondary/70 px-5 py-4">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" strokeWidth={3} />
      <p className="text-sm font-semibold leading-relaxed text-primary">{children}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Message preview                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A phone showing the first message an applicant receives.
 *
 * Worth the space on both pages: an applicant deciding whether to opt in gets
 * to see exactly what arrives, and a compliance reviewer can confirm at a
 * glance that the sender is identified and the keywords are present.
 *
 * The text mirrors `buildTemplate("initial_outreach", …)` in
 * src/lib/ats-workflow.ts. That module is not imported here — it is large and
 * belongs to the staff bundle — so if the template changes, change this too.
 */
export function MessagePreview({
  sender,
  lines,
  caption,
}: {
  sender: string;
  lines: string[];
  caption: string;
}) {
  return (
    <figure className="mx-auto w-full max-w-[19rem]">
      <div className="rounded-[2rem] border border-border bg-card p-2.5 shadow-lg">
        <div className="rounded-[1.5rem] bg-secondary/70 p-3">
          <div className="flex items-center justify-between px-1 pb-2.5">
            <span className="text-[0.65rem] font-bold text-muted-foreground/60">9:41</span>
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
            </span>
          </div>
          <p className="pb-2 text-center text-[0.7rem] font-bold text-muted-foreground">{sender}</p>
          <div className="rounded-2xl rounded-bl-md bg-card px-3.5 py-3 shadow-sm">
            {lines.map((line, index) => (
              <p
                key={index}
                className={`text-[0.8rem] leading-[1.45] text-card-foreground ${
                  index ? "mt-2.5" : ""
                } ${line.startsWith("Reply STOP") ? "font-semibold text-muted-foreground" : ""}`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

/**
 * The same message as selectable text.
 *
 * The phone frame shows what it feels like to receive; this shows what it
 * actually says. A carrier reviewer has to paste sample messages into the
 * campaign registration, and you cannot copy text out of a picture — so the
 * written form carries a copy button and stays plain.
 */
export function MessageTranscript({
  label,
  sender,
  lines,
  note,
}: {
  label: string;
  sender: string;
  lines: string[];
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = lines.join("\n\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the text is selectable either way.
    }
  };

  return (
    <Spotlight className="rounded-2xl border border-border bg-card shadow-sm">
      <figure>
        <figcaption className="flex items-center justify-between gap-3 border-b border-border bg-secondary/60 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-teal">{label}</p>
            <p className="mt-0.5 truncate text-sm font-bold text-primary">From: {sender}</p>
          </div>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:border-teal hover:text-teal"
          >
            {copied ? (
              <CopyCheck className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </figcaption>
        <div className="px-5 py-4">
          {lines.map((line, index) => (
            <p
              key={index}
              className={`whitespace-pre-wrap font-mono text-[0.8rem] leading-relaxed text-muted-foreground ${
                index ? "mt-3" : ""
              } ${line.startsWith("Reply STOP") ? "font-bold text-primary" : ""}`}
            >
              {line}
            </p>
          ))}
        </div>
        {note ? (
          <p className="border-t border-border bg-secondary/40 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
            {note}
          </p>
        ) : null}
      </figure>
    </Spotlight>
  );
}

/**
 * Two columns: what we do, and what we never do.
 *
 * The commitments matter most to someone deciding whether to hand over a phone
 * number, and a contrast is read far faster than the same points in prose.
 */
export function CompareGrid({
  doTitle,
  doItems,
  dontTitle,
  dontItems,
}: {
  doTitle: string;
  doItems: string[];
  dontTitle: string;
  dontItems: string[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Spotlight tone="teal" className="rounded-2xl border border-teal/30 bg-teal/[0.04] p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal">
            <Check className="h-3 w-3 text-teal-foreground" strokeWidth={3} />
          </span>
          {doTitle}
        </p>
        <ul className="mt-3.5 space-y-2.5">
          {doItems.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-teal" strokeWidth={2.5} />
              {item}
            </li>
          ))}
        </ul>
      </Spotlight>
      <Spotlight tone="accent" className="rounded-2xl border border-accent/30 bg-accent/[0.04] p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
            <X className="h-3 w-3 text-accent-foreground" strokeWidth={3} />
          </span>
          {dontTitle}
        </p>
        <ul className="mt-3.5 space-y-2.5">
          {dontItems.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
              <X className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.5} />
              {item}
            </li>
          ))}
        </ul>
      </Spotlight>
    </div>
  );
}

/**
 * Which messages arrive at which stage of hiring.
 *
 * Answers the question behind "how often will you text me?" better than a
 * number does: it shows that messages track your own progress and stop when
 * the process does.
 */
export function StageTimeline({
  stages,
}: {
  stages: { stage: string; message: string; count: string }[];
}) {
  return (
    <ol className="relative space-y-4 pl-7">
      <span
        aria-hidden="true"
        className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-border"
      />
      {stages.map((item, index) => (
        <li key={item.stage} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-7 top-1.5 h-[15px] w-[15px] rounded-full border-[3px] border-background bg-teal"
          />
          <Reveal delay={index * 80}>
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <p className="text-sm font-bold text-primary">{item.stage}</p>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-[0.7rem] font-bold text-muted-foreground">
                {item.count}
              </span>
            </div>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.message}</p>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

/**
 * Where a piece of information goes after you send it. Four labelled stops,
 * ending deliberately on deletion.
 */
export function DataJourney({
  steps,
}: {
  steps: {
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    title: string;
    detail: string;
  }[];
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => (
        <li key={step.title}>
          <Reveal delay={index * 90}>
            <Spotlight className="h-full rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20">
                  <step.icon className="h-[18px] w-[18px] text-teal" strokeWidth={1.75} />
                </span>
                <span className="text-[0.7rem] font-bold text-muted-foreground/40">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-primary">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
            </Spotlight>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

export function LegalFooterLinks({
  other,
  otherLabel,
  email,
}: {
  other: "/privacy" | "/terms";
  otherLabel: string;
  email: string;
}) {
  return (
    <div className="mt-14 grid gap-3 border-t border-border pt-10 sm:grid-cols-2">
      <Spotlight className="rounded-2xl border border-border bg-card transition-colors hover:border-teal">
        <Link to={other} className="group block p-5">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-teal">Also read</p>
          <p className="mt-1.5 font-bold text-primary transition-colors group-hover:text-teal">
            {otherLabel}
          </p>
        </Link>
      </Spotlight>
      <Spotlight className="rounded-2xl border border-border bg-card transition-colors hover:border-teal">
        <a href={`mailto:${email}`} className="group block p-5">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-teal">Questions</p>
          <p className="mt-1.5 break-all font-bold text-primary transition-colors group-hover:text-teal">
            {email}
          </p>
        </a>
      </Spotlight>
    </div>
  );
}

/** Appears once you have scrolled past the hero. */
export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const update = () => setShown(window.scrollY > 600);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      tabIndex={shown ? 0 : -1}
      className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-accent ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}
