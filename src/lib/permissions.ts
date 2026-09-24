/**
 * What each role may do, in one place.
 *
 * Before this existed, role checks were written inline wherever they were
 * needed — `roles.includes("admin")` in a server function, `canReview` in a
 * component, `is_staff()` in a policy. That works until the roles multiply,
 * and then nobody can answer "what exactly can a Caretaker do?" without
 * reading the whole codebase.
 *
 * This module answers that question. It is the source of truth for the user
 * interface and for server-side checks.
 *
 * It is NOT the enforcement boundary. The database still is: row-level
 * security and the SECURITY DEFINER functions decide what a request may
 * actually touch, and they do so whatever this file says. Treat the two as
 * belt and braces — if they ever disagree, the database wins and this file is
 * the bug.
 */

export const ROLE_KEYS = ["admin", "hr", "viewer", "employee", "caretaker"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Roles whose holders may open the applicant tracking system at all. */
export const HIRING_ROLES: RoleKey[] = ["admin", "hr", "viewer"];

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: "Admin",
  hr: "HR",
  viewer: "Viewer",
  employee: "Employee",
  caretaker: "Caretaker",
};

export const ROLE_SUMMARIES: Record<RoleKey, string> = {
  admin: "Everything, including accounts, roles and settings.",
  hr: "Runs hiring end to end: applicants, stages, interviews, offers.",
  viewer: "Reads applicant records. Changes nothing.",
  employee: "Their own account and the information meant for employees.",
  caretaker: "Their own account and the information meant for caretakers.",
};

/**
 * Every distinct thing a person can be permitted to do.
 *
 * Kept deliberately coarse. A capability per button would be unmaintainable;
 * these are the boundaries that actually differ between roles.
 */
export const CAPABILITIES = [
  // Applicant tracking
  "ats.view",
  "ats.manageApplicants",
  "ats.manageStages",
  "ats.manageInterviews",
  "ats.manageOffers",
  "ats.notes",
  "ats.hrFlags",
  "ats.viewDocuments",
  // Administration
  "admin.dashboard",
  "admin.manageUsers",
  "admin.assignRoles",
  "admin.settings",
  // Everyone
  "self.viewOwn",
  "self.updateOwn",
  "self.tasks",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "ats.view": "View applicant records",
  "ats.manageApplicants": "Manage applicants",
  "ats.manageStages": "Move applicants through hiring stages",
  "ats.manageInterviews": "Schedule and manage interviews",
  "ats.manageOffers": "Manage offers",
  "ats.notes": "Add notes",
  "ats.hrFlags": "Review HR flags and private notes",
  "ats.viewDocuments": "Open applicant documents",
  "admin.dashboard": "Open the admin dashboard",
  "admin.manageUsers": "Create, edit and disable users",
  "admin.assignRoles": "Assign roles",
  "admin.settings": "Manage system settings",
  "self.viewOwn": "See their own information",
  "self.updateOwn": "Update their own information",
  "self.tasks": "Complete assigned tasks and forms",
};

const EVERYONE: Capability[] = ["self.viewOwn", "self.updateOwn", "self.tasks"];

const HR_CAPABILITIES: Capability[] = [
  "ats.view",
  "ats.manageApplicants",
  "ats.manageStages",
  "ats.manageInterviews",
  "ats.manageOffers",
  "ats.notes",
  "ats.hrFlags",
  "ats.viewDocuments",
];

/**
 * Admin is defined as "everything", by listing every capability rather than
 * by a special case. A capability added later is therefore granted to Admin
 * automatically, and cannot be forgotten.
 */
export const ROLE_CAPABILITIES: Record<RoleKey, Capability[]> = {
  admin: [...CAPABILITIES],
  hr: [...HR_CAPABILITIES, ...EVERYONE],
  // Reads applicant records and their documents; changes nothing, and never
  // sees the private HR notes attached to review flags.
  viewer: ["ats.view", "ats.viewDocuments", ...EVERYONE],
  employee: [...EVERYONE],
  caretaker: [...EVERYONE],
};

/** True when any of the roles held grants the capability. */
export function can(roles: readonly string[], capability: Capability): boolean {
  return roles.some((role) => (ROLE_CAPABILITIES[role as RoleKey] ?? []).includes(capability));
}

export function capabilitiesFor(roles: readonly string[]): Capability[] {
  const granted = new Set<Capability>();
  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role as RoleKey] ?? []) granted.add(capability);
  }
  return CAPABILITIES.filter((capability) => granted.has(capability));
}

/**
 * The landing page after signing in.
 *
 * One dashboard for every role. It shows the sections that role can see, so
 * there is no need to route people to different homes — and nobody lands on a
 * page they will immediately be refused.
 */
export function homeFor(_roles: readonly string[]): string {
  return "/team-portal/dashboard";
}

export function primaryRole(roles: readonly string[]): RoleKey | null {
  for (const role of ROLE_KEYS) {
    if (roles.includes(role)) return role;
  }
  return null;
}
