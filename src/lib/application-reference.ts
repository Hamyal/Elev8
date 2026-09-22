/**
 * Human-readable application number: FIRST-LAST-#### where #### is the last four
 * digits of the applicant's phone number. The internal UUID stays in the
 * background and is never shown as the application number.
 */
function part(value: string): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildApplicationReference(input: {
  first_name: string;
  last_name: string;
  phone: string;
}): string {
  const first = part(input.first_name) || "APPLICANT";
  const last = part(input.last_name) || "APPLICANT";
  const digits = (input.phone ?? "").replace(/\D+/g, "");
  const last4 = digits.slice(-4).padStart(4, "0");
  return `${first}-${last}-${last4}`;
}

/** Adds a sequential suffix when the base number is already taken. */
export function nextAvailableReference(base: string, taken: readonly string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
