import type { ReactNode } from "react";

export function RequiredLegend() {
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold text-accent">*</span> Required
    </p>
  );
}

export function Field({
  id,
  label,
  help,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: ReactNode | undefined;
  required?: boolean | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2" data-field={id}>
      <label htmlFor={id} className="block text-sm font-semibold text-primary">
        {label}
        {required ? (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>
      {help ? (
        <p id={`${id}-help`} className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {help}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Fieldset({
  id,
  legend,
  help,
  required,
  error,
  children,
}: {
  id: string;
  legend: ReactNode;
  help?: ReactNode | undefined;
  required?: boolean | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <fieldset
      className="w-full min-w-0 space-y-2"
      data-field={id}
      aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="text-sm font-semibold text-primary">
        {legend}
        {required ? (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </legend>
      {help ? (
        <p id={`${id}-help`} className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {help}
        </p>
      ) : null}
      <div className="space-y-2 pt-1">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-accent">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

const base =
  "block w-full max-w-full rounded-lg border bg-card px-3 py-3 sm:py-2.5 text-base text-foreground outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/30";

export function inputClass(error?: string | undefined) {
  return `${base} ${error ? "border-accent" : "border-border"}`;
}

export function describedBy(id: string, error?: string | undefined, help?: boolean) {
  const ids = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(
    Boolean,
  );
  return ids.length ? ids.join(" ") : undefined;
}

export function Choice({
  type,
  name,
  value,
  checked,
  onChange,
  children,
  invalid,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string, checked: boolean) => void;
  children: ReactNode;
  invalid?: boolean | undefined;
}) {
  return (
    <label
      className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-3.5 text-sm leading-relaxed break-words transition sm:py-2.5 ${
        checked
          ? "border-teal bg-teal/5 text-foreground"
          : invalid
            ? "border-accent text-foreground"
            : "border-border text-foreground hover:border-teal/60"
      }`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(value, e.currentTarget.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--teal)]"
      />
      <span className="min-w-0 break-words">{children}</span>
    </label>
  );
}
