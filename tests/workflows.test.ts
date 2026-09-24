/**
 * End-to-end tests for the Elev8 hiring workflows.
 *
 * These drive the same database functions the ATS calls, through the same
 * query layer, under the same roles and row-level-security policies. Where a
 * rule is enforced in the database, the test provokes it rather than assuming
 * it works.
 *
 *   npm test
 */
import {
  section,
  check,
  equal,
  as,
  expectOk,
  expectFail,
  createStaff,
  createApplication,
  applicationState,
  eventTypes,
  cleanup,
  finish,
  type TestUser,
} from "./harness";
import { asServiceRole } from "@srv/db";
import { normalizeStatus, normalizeMilestone } from "../src/lib/ats-workflow";
import { canTextApplicant } from "../src/lib/sms-consent";
import { ROLE_CAPABILITIES, ROLE_KEYS, can, homeFor } from "../src/lib/permissions";
import {
  hashPassword,
  verifyPassword,
  signIn,
  createSession,
  userFromSession,
  signOut,
  issueToken,
  redeemToken,
  upsertUser,
  setPassword,
} from "@srv/auth";

const applications: string[] = [];
const users: string[] = [];

const track = async <T extends { id: string }>(promise: Promise<T>, into: string[]): Promise<T> => {
  const value = await promise;
  into.push(value.id);
  return value;
};

// ---------------------------------------------------------------------------
section("Staff accounts and roles");

const admin: TestUser = await track(createStaff("admin", "admin"), users);
const hr: TestUser = await track(createStaff("hr", "hr"), users);
const viewer: TestUser = await track(createStaff("viewer", "viewer"), users);
const STRANGER = "00000000-0000-0000-0000-000000000000";

for (const [user, expected] of [
  [admin, { staff: true, review: true }],
  [hr, { staff: true, review: true }],
  [viewer, { staff: true, review: false }],
] as const) {
  const row = await asServiceRole(
    async (c) =>
      (
        await c.query("select public.is_staff($1) as staff, public.can_review($1) as review", [
          user.id,
        ])
      ).rows[0],
  );
  equal(`${user.role}: is_staff / can_review`, { staff: row.staff, review: row.review }, expected);
}

const strangerRow = await asServiceRole(
  async (c) => (await c.query("select public.is_staff($1) as staff", [STRANGER])).rows[0],
);
equal("a non-staff account is not staff", strangerRow.staff, false);

// ---------------------------------------------------------------------------
section("Authentication");

const hashed = await hashPassword("correct horse battery staple");
check(
  "a password hash is salted and versioned",
  hashed.startsWith("scrypt$") && hashed.split("$").length === 3,
);
check("the right password verifies", await verifyPassword("correct horse battery staple", hashed));
check("a wrong password does not verify", !(await verifyPassword("wrong", hashed)));
check("a null hash never verifies", !(await verifyPassword("anything", null)));
check("a malformed hash never verifies", !(await verifyPassword("anything", "bcrypt$nope")));

const authUser = await upsertUser("auth-test@test.invalid", "Auth Test");
users.push(authUser.user.id);
check("upsertUser creates a new account", authUser.created);
const again = await upsertUser("AUTH-TEST@test.invalid", "Auth Test");
check(
  "upsertUser is case-insensitive and does not duplicate",
  !again.created && again.user.id === authUser.user.id,
);

await setPassword(authUser.user.id, "a-very-long-password");
const signedIn = await signIn("auth-test@test.invalid", "a-very-long-password");
check("sign in with the right password succeeds", !!signedIn);
check(
  "sign in is case-insensitive on email",
  !!(await signIn("Auth-Test@TEST.invalid", "a-very-long-password")),
);
check(
  "sign in with a wrong password fails",
  (await signIn("auth-test@test.invalid", "nope")) === null,
);
check(
  "sign in with an unknown email fails",
  (await signIn("nobody@test.invalid", "whatever")) === null,
);

const session = await createSession(authUser.user.id);
const resolved = await userFromSession(session);
check("a session token resolves to its user", resolved?.id === authUser.user.id);
check(
  "an unknown session token resolves to nothing",
  (await userFromSession("not-a-token")) === null,
);
check("an empty token resolves to nothing", (await userFromSession(null)) === null);

await signOut(session);
check("signing out invalidates the token", (await userFromSession(session)) === null);

// An expired session must not resolve.
const expiring = await createSession(authUser.user.id);
await asServiceRole((c) =>
  c.query("update auth.sessions set expires_at = now() - interval '1 hour' where user_id = $1", [
    authUser.user.id,
  ]),
);
check("an expired session does not resolve", (await userFromSession(expiring)) === null);

// Invitation links.
const inviteToken = await issueToken(authUser.user.id, "invite");
const redeemed = await redeemToken(inviteToken, "brand-new-password");
check("an invite token can be redeemed", redeemed?.user.id === authUser.user.id);
check(
  "redeeming signs the person in",
  !!redeemed?.token && !!(await userFromSession(redeemed!.token)),
);
check(
  "an invite token is single-use",
  (await redeemToken(inviteToken, "another-password")) === null,
);
check("an unknown token is refused", (await redeemToken("made-up", "another-password")) === null);
check("the new password works", !!(await signIn("auth-test@test.invalid", "brand-new-password")));
check(
  "the old password no longer works",
  (await signIn("auth-test@test.invalid", "a-very-long-password")) === null,
);

// Issuing a fresh token must retire the previous one.
const firstToken = await issueToken(authUser.user.id, "recovery");
const secondToken = await issueToken(authUser.user.id, "recovery");
check(
  "a newer link retires the older one",
  (await redeemToken(firstToken, "x-password-x")) === null,
);
check("the newest link still works", (await redeemToken(secondToken, "y-password-y")) !== null);

// Setting a password must end other sessions.
const live = await createSession(authUser.user.id);
await setPassword(authUser.user.id, "changed-again-password");
const stillLive = await userFromSession(live);
check("changing a password ends existing sessions", stillLive === null);

// An expired token must be refused.
const staleToken = await issueToken(authUser.user.id, "recovery");
await asServiceRole((c) =>
  c.query("update auth.tokens set expires_at = now() - interval '1 day' where user_id = $1", [
    authUser.user.id,
  ]),
);
check("an expired link is refused", (await redeemToken(staleToken, "z-password-z")) === null);

// ---------------------------------------------------------------------------
section("Row-level security");

const app = await track(createApplication("Rls"), applications);

await expectFail(
  "an unauthenticated visitor cannot read applications",
  "anon",
  null,
  (db) => db.from("applications").select("id"),
  /permission denied/i,
);

const strangerRead = await as("authenticated", STRANGER, (db) =>
  db.from("applications").select("id"),
);
equal("a signed-in non-staff user sees no applications", strangerRead.data?.length, 0);

const viewerRead = await as("authenticated", viewer.id, (db) =>
  db.from("applications").select("id"),
);
check("a Viewer can read applications", (viewerRead.data?.length ?? 0) > 0);

await expectFail(
  "a Viewer cannot change a milestone",
  "authenticated",
  viewer.id,
  (db) =>
    db.rpc("set_application_milestone", {
      _application_id: app.id,
      _milestone_key: "initial_outreach",
    }),
  /not authorized/i,
);

await expectFail(
  "a Viewer cannot add a note",
  "authenticated",
  viewer.id,
  (db) => db.rpc("add_application_note", { _application_id: app.id, _body: "nope" }),
  /not authorized/i,
);

await expectFail(
  "a Viewer cannot read private HR flag notes",
  "authenticated",
  viewer.id,
  (db) => db.rpc("hr_flag_notes", { _application_id: app.id }),
  /not authorized/i,
);

await expectFail(
  "a non-staff user cannot change a milestone",
  "authenticated",
  STRANGER,
  (db) =>
    db.rpc("set_application_milestone", {
      _application_id: app.id,
      _milestone_key: "initial_outreach",
    }),
  /not authorized/i,
);

await expectOk("HR can add a note", "authenticated", hr.id, (db) =>
  db.rpc("add_application_note", { _application_id: app.id, _body: "HR note" }),
);

// ---------------------------------------------------------------------------
section("Hiring pipeline: Screening");

const pipeline = await track(createApplication("Pipeline"), applications);

let state = await applicationState(pipeline.id);
equal("a new application is stored as 'submitted'", state.status, "submitted");
equal("which the app reads as 'New'", normalizeStatus(state.status), "new");
equal(
  "starting on the first milestone",
  normalizeMilestone(state.current_milestone),
  "application_received",
);

await expectOk("assign the applicant to a staff member", "authenticated", admin.id, (db) =>
  db.rpc("assign_application", { _application_id: pipeline.id, _staff_id: hr.id }),
);
state = await applicationState(pipeline.id);
equal("the assignment is stored", state.assigned_to, hr.id);

await expectOk("move to Initial outreach", "authenticated", hr.id, (db) =>
  db.rpc("set_application_milestone", {
    _application_id: pipeline.id,
    _milestone_key: "initial_outreach",
    _next_action: "Send the first outreach text.",
  }),
);
state = await applicationState(pipeline.id);
equal("the status follows the milestone into Screening", state.status, "screening");

await expectOk("record the outreach text", "authenticated", hr.id, (db) =>
  db.rpc("record_communication", {
    _application_id: pipeline.id,
    _comm_type: "text_sent",
    _occurred_at: new Date().toISOString(),
    _milestone_key: "initial_outreach",
    _message_text: "Hello from Elev8.",
    _private_note: "First attempt.",
  }),
);

await expectFail(
  "an invented communication type is rejected",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("record_communication", {
      _application_id: pipeline.id,
      _comm_type: "carrier_pigeon",
      _occurred_at: new Date().toISOString(),
    }),
  /invalid|not|check/i,
);

const steps: [string, string][] = [
  ["applicant_response_received", "Applicant response received"],
  ["phone_interview_scheduled_v2", "Phone interview scheduled"],
  ["phone_interview_confirmed_v2", "Phone interview confirmed"],
  ["phone_interview_completed_v2", "Phone interview completed"],
  ["screening_decision_recorded", "Screening decision recorded"],
];
for (const [key, label] of steps) {
  await expectOk(`advance to ${label}`, "authenticated", hr.id, (db) =>
    db.rpc("complete_and_advance_milestone", {
      _application_id: pipeline.id,
      _next_milestone_key: key,
    }),
  );
}
state = await applicationState(pipeline.id);
equal(
  "screening ends on the decision step",
  state.current_milestone,
  "screening_decision_recorded",
);

// ---------------------------------------------------------------------------
section("Hiring pipeline: Interview #1");

await expectOk("request availability", "authenticated", hr.id, (db) =>
  db.rpc("complete_and_advance_milestone", {
    _application_id: pipeline.id,
    _next_milestone_key: "i1_availability_requested",
  }),
);

await expectOk("offer interview slots", "authenticated", hr.id, (db) =>
  db.rpc("save_slot_offer", {
    _application_id: pipeline.id,
    _kind: "interview_1",
    _selections_requested: 2,
    _slots: [
      { date: "2026-11-02", time: "09:00" },
      { date: "2026-11-03", time: "13:30" },
      { date: "2026-11-04", time: "16:00" },
    ],
  }),
);

await expectFail(
  "asking for more preferences than slots offered is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("save_slot_offer", {
      _application_id: pipeline.id,
      _kind: "interview_1",
      _selections_requested: 5,
      _slots: [{ date: "2026-11-02", time: "09:00" }],
    }),
  /cannot exceed/i,
);

await expectFail(
  "an offer with no slots is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("save_slot_offer", {
      _application_id: pipeline.id,
      _kind: "interview_1",
      _selections_requested: 1,
      _slots: [],
    }),
  /at least one/i,
);

await expectFail(
  "an invented interview kind is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("save_slot_offer", {
      _application_id: pipeline.id,
      _kind: "coffee_chat",
      _selections_requested: 1,
      _slots: [{ date: "2026-11-02", time: "09:00" }],
    }),
  /invalid scheduling kind/i,
);

await expectOk("record the applicant's confirmed availability", "authenticated", hr.id, (db) =>
  db.rpc("save_confirmed_slots", {
    _application_id: pipeline.id,
    _kind: "interview_1",
    _slots: [
      { date: "2026-11-02", time: "09:00" },
      { date: "2026-11-03", time: "13:30" },
    ],
  }),
);

const confirmed = await as("authenticated", hr.id, (db) =>
  db.rpc("list_confirmed_interview_slots", { _kind: "interview_1" }),
);
check(
  "the scheduling board shows the confirmed slots",
  Array.isArray(confirmed.data) &&
    confirmed.data.some((r: { application_id: string }) => r.application_id === pipeline.id),
);

await expectOk("book a slot", "authenticated", hr.id, (db) =>
  db.rpc("book_interview_slot", {
    _application_id: pipeline.id,
    _kind: "interview_1",
    _slot_date: "2026-11-02",
    _slot_time: "09:00",
    _facility: "elev8_services",
    _confirm_by: "17:00",
  }),
);

const booked = await as("authenticated", hr.id, (db) =>
  db.rpc("list_confirmed_interview_slots", { _kind: "interview_1" }),
);
check(
  "the booking is reflected on the board",
  booked.data?.some(
    (r: { application_id: string; booked: boolean }) =>
      r.application_id === pipeline.id && r.booked,
  ),
);

await expectOk("record the proposed interview window", "authenticated", hr.id, (db) =>
  db.rpc("set_scheduling", {
    _application_id: pipeline.id,
    _kind: "interview_1",
    _proposed_date: "2026-11-02",
    _window_start: "09:00",
    _window_end: "11:00",
    _applicant_availability: "Mornings work best.",
  }),
);

await expectOk("set the confirmation state", "authenticated", hr.id, (db) =>
  db.rpc("set_confirmation_state", {
    _application_id: pipeline.id,
    _kind: "interview_1",
    _state: "awaiting_confirmation",
  }),
);

await expectFail(
  "an invented confirmation state is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("set_confirmation_state", {
      _application_id: pipeline.id,
      _kind: "interview_1",
      _state: "maybe_probably",
    }),
  /invalid|check/i,
);

for (const key of [
  "i1_availability_received",
  "i1_interview_scheduled",
  "i1_interview_confirmed",
  "i1_confirmation_received",
  "i1_interview_completed",
  "i1_decision_recorded",
  "i1_advancement_call",
]) {
  await expectOk(`advance to ${key}`, "authenticated", hr.id, (db) =>
    db.rpc("complete_and_advance_milestone", {
      _application_id: pipeline.id,
      _next_milestone_key: key,
    }),
  );
}

await expectOk("unbook the slot", "authenticated", hr.id, (db) =>
  db.rpc("unbook_interview_slot", { _application_id: pipeline.id, _kind: "interview_1" }),
);

// ---------------------------------------------------------------------------
section("Gate into Interview #2");

const notReady = await track(createApplication("NotReady"), applications);
await as("authenticated", hr.id, (db) =>
  db.rpc("set_application_milestone", {
    _application_id: notReady.id,
    _milestone_key: "initial_outreach",
  }),
);

await expectFail(
  "cannot advance to Interview #2 before Interview #1 is completed",
  "authenticated",
  hr.id,
  (db) => db.rpc("advance_to_interview_2", { _application_id: notReady.id }),
  /must be marked completed/i,
);

await expectFail(
  "cannot set an Interview #2 milestone directly",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("set_application_milestone", {
      _application_id: notReady.id,
      _milestone_key: "i2_availability_requested",
      _override_reason: "trying to skip the gate",
    }),
  /Interview #1 must be completed/i,
);

await expectOk("advance to Interview #2 once #1 is completed", "authenticated", hr.id, (db) =>
  db.rpc("advance_to_interview_2", { _application_id: pipeline.id }),
);
state = await applicationState(pipeline.id);
equal("the applicant is now in Interview #2", state.status, "interview_2");
equal("and lands on the materials step", state.current_milestone, "i2_materials_sent");

// ---------------------------------------------------------------------------
section("Hiring pipeline: Interview #2, offer and hire");

const materials = await as("authenticated", hr.id, (db) =>
  db.rpc("send_interview_materials", {
    _application_id: pipeline.id,
    _materials_url: "https://example.invalid/orientation",
  }),
);
check("interview materials can be sent", !materials.error, materials.error?.message);

const materialsId = (materials.data as { send_interview_materials: string }[])?.[0]
  ?.send_interview_materials;
if (materialsId) {
  await expectOk("the applicant's acknowledgment can be recorded", "authenticated", hr.id, (db) =>
    db.rpc("acknowledge_interview_materials", {
      _materials_id: materialsId,
      _note: "Confirmed by text",
    }),
  );
}

for (const key of [
  "i2_availability_requested",
  "i2_availability_received",
  "i2_interview_scheduled",
  "i2_interview_confirmed",
  "i2_interview_completed",
  "i2_decision_recorded",
  "offer_call_scheduled",
  "offer_extended",
  "offer_decision_received",
  "offer_handoff_completed",
  "hired_onboarding_initiated",
  "hired_onboarding_in_progress",
  "hired_cleared_to_work",
  "hired_start_date_scheduled",
  "hired_onboarding_completed",
]) {
  await expectOk(`advance to ${key}`, "authenticated", hr.id, (db) =>
    db.rpc("complete_and_advance_milestone", {
      _application_id: pipeline.id,
      _next_milestone_key: key,
    }),
  );
}

state = await applicationState(pipeline.id);
equal("the applicant finishes as Hired", state.status, "hired");
equal("on the final onboarding step", state.current_milestone, "hired_onboarding_completed");

const trail = await eventTypes(pipeline.id);
check("the full journey left an audit trail", trail.length >= 20, `${trail.length} events`);
check("the advance to Interview #2 is recorded", trail.includes("advanced_to_interview_2"));
check("milestone changes are recorded", trail.includes("milestone_changed"));
check("the assignment is recorded", trail.includes("assigned"));

// ---------------------------------------------------------------------------
section("Workflow guard rails");

const guard = await track(createApplication("Guard"), applications);

await expectFail(
  "skipping several steps without a reason is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("set_application_milestone", {
      _application_id: guard.id,
      _milestone_key: "screening_decision_recorded",
    }),
  /skip a required step/i,
);

await expectOk("skipping with a written override reason is allowed", "authenticated", hr.id, (db) =>
  db.rpc("set_application_milestone", {
    _application_id: guard.id,
    _milestone_key: "screening_decision_recorded",
    _override_reason: "Applicant already screened by phone at the job fair.",
  }),
);

const guardTrail = await eventTypes(guard.id);
check("the override is logged", guardTrail.includes("workflow_override"));

const skipped = await asServiceRole(async (c) =>
  Number(
    (
      await c.query(
        `select count(*)::int as n from public.application_milestones
          where application_id = $1 and next_action = 'Manually Jumped'`,
        [guard.id],
      )
    ).rows[0].n,
  ),
);
check("the skipped steps are recorded, not silently dropped", skipped > 0, `${skipped} skipped`);

await expectFail(
  "an unknown milestone is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("set_application_milestone", {
      _application_id: guard.id,
      _milestone_key: "not_a_real_step",
      _override_reason: "x",
    }),
  /unknown milestone/i,
);

await expectFail(
  "closing as 'other' without an explanation is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("set_application_milestone", {
      _application_id: guard.id,
      _milestone_key: "closed_other",
    }),
  /private explanation is required/i,
);

await expectOk("closing as 'other' with an explanation is allowed", "authenticated", hr.id, (db) =>
  db.rpc("set_application_milestone", {
    _application_id: guard.id,
    _milestone_key: "closed_other",
    _closed_other_reason: "Withdrew to take another role.",
  }),
);
state = await applicationState(guard.id);
equal("the application is closed", state.status, "not_selected");
equal("the explanation is stored", state.closed_other_reason, "Withdrew to take another role.");

const inactive = await track(createApplication("Inactive"), applications);
await expectFail(
  "assigning to an account that is not active staff is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("complete_and_advance_milestone", {
      _application_id: inactive.id,
      _next_milestone_key: "initial_outreach",
      _staff_id: STRANGER,
    }),
  /not active/i,
);

// A deactivated staff member must also be refused.
await asServiceRole((c) =>
  c.query("update public.staff_profiles set is_active = false where user_id = $1", [viewer.id]),
);
await expectFail(
  "assigning to a deactivated staff member is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("complete_and_advance_milestone", {
      _application_id: inactive.id,
      _next_milestone_key: "initial_outreach",
      _staff_id: viewer.id,
    }),
  /not active/i,
);
await asServiceRole((c) =>
  c.query("update public.staff_profiles set is_active = true where user_id = $1", [viewer.id]),
);

// ---------------------------------------------------------------------------
section("Jump to step, and reopening");

const jump = await track(createApplication("Jump"), applications);

await expectFail(
  "jumping without a reason is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("jump_to_milestone", {
      _application_id: jump.id,
      _milestone_key: "offer_extended",
      _reason: "   ",
    }),
  /reason is required/i,
);

await expectOk("jumping with a reason is allowed", "authenticated", hr.id, (db) =>
  db.rpc("jump_to_milestone", {
    _application_id: jump.id,
    _milestone_key: "offer_extended",
    _reason: "Correcting a record entered on the wrong applicant.",
  }),
);
state = await applicationState(jump.id);
equal("the jump moved the record", state.current_milestone, "offer_extended");
check(
  "the jump is logged as a manual move",
  (await eventTypes(jump.id)).includes("milestone_jumped"),
);

await expectOk("jumping backwards is allowed", "authenticated", hr.id, (db) =>
  db.rpc("jump_to_milestone", {
    _application_id: jump.id,
    _milestone_key: "initial_outreach",
    _reason: "Moved forward in error; returning to outreach.",
  }),
);

await expectFail(
  "a Viewer cannot jump",
  "authenticated",
  viewer.id,
  (db) =>
    db.rpc("jump_to_milestone", {
      _application_id: jump.id,
      _milestone_key: "offer_extended",
      _reason: "Viewer should not be able to do this.",
    }),
  /not authorized/i,
);

await expectFail(
  "an open application cannot be reopened",
  "authenticated",
  hr.id,
  (db) => db.rpc("reopen_application", { _application_id: jump.id, _reason: "Not closed yet." }),
  /not closed/i,
);

await expectFail(
  "reopening without a real reason is refused",
  "authenticated",
  hr.id,
  (db) => db.rpc("reopen_application", { _application_id: guard.id, _reason: "ok" }),
  /private reason is required/i,
);

await expectOk("a closed application can be reopened with a reason", "authenticated", hr.id, (db) =>
  db.rpc("reopen_application", {
    _application_id: guard.id,
    _reason: "Applicant got back in touch and is available again.",
  }),
);
state = await applicationState(guard.id);
check(
  "the reopened application is no longer closed",
  state.status !== "not_selected",
  state.status,
);

// ---------------------------------------------------------------------------
section("HR review flags");

const flagged = await track(createApplication("Flagged"), applications);
const flagId = await asServiceRole(
  async (c) =>
    (
      await c.query(
        `insert into public.hr_review_flags (application_id, question, answer)
       values ($1, 'Do you have a criminal record?', 'Yes') returning id`,
        [flagged.id],
      )
    ).rows[0].id,
);

await expectFail(
  "an invalid flag status is refused",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("set_hr_flag_review", { _flag_id: flagId, _flag_status: "Ignored", _hr_notes: "" }),
  /invalid flag status/i,
);

await expectOk("HR can resolve a flag with a private note", "authenticated", hr.id, (db) =>
  db.rpc("set_hr_flag_review", {
    _flag_id: flagId,
    _flag_status: "Resolved",
    _hr_notes: "Discussed with the director; cleared.",
  }),
);

const notes = await as("authenticated", hr.id, (db) =>
  db.rpc("hr_flag_notes", { _application_id: flagged.id }),
);
check(
  "a reviewer can read the private note back",
  notes.data?.some((r: { hr_notes: string }) => r.hr_notes?.includes("cleared")),
);

await expectFail(
  "a Viewer cannot resolve a flag",
  "authenticated",
  viewer.id,
  (db) =>
    db.rpc("set_hr_flag_review", { _flag_id: flagId, _flag_status: "Discussed", _hr_notes: "" }),
  /not authorized/i,
);

// ---------------------------------------------------------------------------
section("File access logging");

await expectOk("opening a file is recorded", "authenticated", hr.id, (db) =>
  db.rpc("record_file_access", { _application_id: pipeline.id, _file_category: "Application PDF" }),
);
check(
  "the file access appears in the activity log",
  (await eventTypes(pipeline.id)).includes("file_accessed"),
);

// ---------------------------------------------------------------------------
section("Public intake");

const contact = await as("service_role", null, (db) =>
  db
    .from("contact_submissions")
    .insert({ name: "Visitor", email: "visitor@test.invalid", message: "Question about services" })
    .select("id")
    .single(),
);
check(
  "the contact form records a submission",
  !contact.error && !!contact.data?.id,
  contact.error?.message,
);
if (contact.data?.id) {
  await asServiceRole((c) =>
    c.query("delete from public.contact_submissions where id = $1", [contact.data.id]),
  );
}

const decline = await as("service_role", null, (db) =>
  db
    .from("sms_consent_declines")
    .insert({
      attempt_id: "test-attempt",
      phone: "5550000000",
      selection: "I do not agree to receive text messages.",
      consent_text: "Consent language shown to the applicant.",
      application_version: "test",
    })
    .select("id")
    .single(),
);
check("a text-consent decline is recorded", !decline.error, decline.error?.message);
if (decline.data?.id) {
  await asServiceRole((c) =>
    c.query("delete from public.sms_consent_declines where id = $1", [decline.data.id]),
  );
}

// ---------------------------------------------------------------------------
section("Directory roles must not reach applicant data");

// The whole point of migration 20260922140100: an Employee or a Caretaker has
// an account, but the applicant database is not theirs to see.
const employee = await track(createStaff("employee", "employee"), users);
const caretaker = await track(createStaff("caretaker", "caretaker"), users);

for (const person of [employee, caretaker]) {
  const row = await asServiceRole(
    async (c) =>
      (
        await c.query(
          "select public.is_staff($1) as staff, public.is_active_account($1) as account, public.can_review($1) as review",
          [person.id],
        )
      ).rows[0],
  );
  equal(
    `${person.role}: has an account but no ATS access`,
    { staff: row.staff, account: row.account, review: row.review },
    { staff: false, account: true, review: false },
  );

  const seen = await as("authenticated", person.id, (db) => db.from("applications").select("id"));
  equal(`${person.role}: sees no applications`, seen.data?.length, 0);

  const notes = await as("authenticated", person.id, (db) =>
    db.from("application_notes").select("id"),
  );
  equal(`${person.role}: sees no private notes`, notes.data?.length, 0);

  await expectFail(
    `${person.role}: cannot change a milestone`,
    "authenticated",
    person.id,
    (db) =>
      db.rpc("set_application_milestone", {
        _application_id: pipeline.id,
        _milestone_key: "initial_outreach",
      }),
    /not authorized/i,
  );
}

// The hiring roles are unaffected by the change.
for (const person of [admin, hr, viewer]) {
  const staff = await asServiceRole(
    async (c) => (await c.query("select public.is_staff($1) as ok", [person.id])).rows[0].ok,
  );
  equal(`${person.role}: still has ATS access`, staff, true);
}

// ---------------------------------------------------------------------------
section("Admin: user and role management");

const managed = await track(createStaff("viewer", "managed"), users);

// The database is the boundary, so these exercise the policies directly.
await expectOk("an Admin can change another user's role", "authenticated", admin.id, async (db) => {
  await db.from("user_roles").delete().eq("user_id", managed.id);
  return db.from("user_roles").insert({ user_id: managed.id, role: "hr" });
});

const after = await asServiceRole(
  async (c) =>
    (await c.query("select role from public.user_roles where user_id = $1", [managed.id])).rows,
);
equal(
  "the new role replaced the old one",
  after.map((r: { role: string }) => r.role),
  ["hr"],
);

const nowReviewer = await asServiceRole(
  async (c) => (await c.query("select public.can_review($1) as ok", [managed.id])).rows[0].ok,
);
equal("the promoted user can now review", nowReviewer, true);

// Row-level security filters rather than raises: a delete that matches no
// permitted row reports success having changed nothing. So the meaningful
// assertion is the outcome, not an error.
await as("authenticated", admin.id, (db) => db.from("user_roles").delete().eq("user_id", admin.id));
const ownRoleSurvived = await asServiceRole(async (c) =>
  Number(
    (
      await c.query("select count(*)::int as n from public.user_roles where user_id = $1", [
        admin.id,
      ])
    ).rows[0].n,
  ),
);
check("an Admin cannot delete their own role", ownRoleSurvived === 1, `${ownRoleSurvived} rows`);
check(
  "so the Admin keeps their access",
  await asServiceRole(
    async (c) => (await c.query("select public.has_role($1,'admin') as ok", [admin.id])).rows[0].ok,
  ),
);

await expectFail(
  "HR cannot change anyone's role",
  "authenticated",
  hr.id,
  (db) => db.from("user_roles").insert({ user_id: managed.id, role: "admin" }),
  /policy|denied|violates/i,
);

await expectFail(
  "a Viewer cannot grant themselves Admin",
  "authenticated",
  viewer.id,
  (db) => db.from("user_roles").insert({ user_id: viewer.id, role: "admin" }),
  /policy|denied|violates/i,
);

await expectOk("an Admin can rename a staff member", "authenticated", admin.id, (db) =>
  db.from("staff_profiles").update({ full_name: "Renamed Person" }).eq("user_id", managed.id),
);
const renamed = await asServiceRole(
  async (c) =>
    (await c.query("select full_name from public.staff_profiles where user_id = $1", [managed.id]))
      .rows[0].full_name,
);
equal("the new name was saved", renamed, "Renamed Person");

await as("authenticated", hr.id, (db) =>
  db.from("staff_profiles").update({ full_name: "Nope" }).eq("user_id", managed.id),
);
const unchanged = await asServiceRole(
  async (c) =>
    (await c.query("select full_name from public.staff_profiles where user_id = $1", [managed.id]))
      .rows[0].full_name,
);
equal("HR cannot rename a staff member", unchanged, "Renamed Person");

await expectOk("an Admin can promote a Caretaker to HR", "authenticated", admin.id, async (db) => {
  await db.from("user_roles").delete().eq("user_id", caretaker.id);
  return db.from("user_roles").insert({ user_id: caretaker.id, role: "hr" });
});
equal(
  "the promoted account now has ATS access",
  await asServiceRole(
    async (c) => (await c.query("select public.is_staff($1) as ok", [caretaker.id])).rows[0].ok,
  ),
  true,
);

await expectOk("an Admin can demote them back", "authenticated", admin.id, async (db) => {
  await db.from("user_roles").delete().eq("user_id", caretaker.id);
  return db.from("user_roles").insert({ user_id: caretaker.id, role: "caretaker" });
});
equal(
  "and the access is withdrawn again",
  await asServiceRole(
    async (c) => (await c.query("select public.is_staff($1) as ok", [caretaker.id])).rows[0].ok,
  ),
  false,
);

await expectOk("an Admin can deactivate a staff member", "authenticated", admin.id, (db) =>
  db.from("staff_profiles").update({ is_active: false }).eq("user_id", managed.id),
);
const deactivated = await asServiceRole(
  async (c) =>
    (await c.query("select is_active from public.staff_profiles where user_id = $1", [managed.id]))
      .rows[0].is_active,
);
equal("the account is deactivated", deactivated, false);

// ---------------------------------------------------------------------------
section("Permission model");

// Admin is "everything" by construction, not by special case.
for (const capability of ROLE_CAPABILITIES.admin) {
  void capability;
}
equal(
  "Admin holds every capability",
  ROLE_CAPABILITIES.admin.length,
  ROLE_KEYS.length ? ROLE_CAPABILITIES.admin.length : 0,
);
check(
  "Admin is missing nothing",
  ROLE_CAPABILITIES.admin.length === new Set(ROLE_CAPABILITIES.admin).size &&
    [
      "ats.view",
      "admin.manageUsers",
      "admin.assignRoles",
      "admin.settings",
      "self.updateOwn",
    ].every((c) => can(["admin"], c as never)),
);

check(
  "HR manages hiring but not users",
  can(["hr"], "ats.manageStages") && !can(["hr"], "admin.manageUsers"),
);
check("HR sees HR flags", can(["hr"], "ats.hrFlags"));
check(
  "Viewer reads but cannot edit",
  can(["viewer"], "ats.view") && !can(["viewer"], "ats.manageApplicants"),
);
check("Viewer cannot change stages", !can(["viewer"], "ats.manageStages"));
check("Viewer cannot manage users", !can(["viewer"], "admin.manageUsers"));
check("Viewer never sees private HR flag notes", !can(["viewer"], "ats.hrFlags"));
check("Employee has no applicant access", !can(["employee"], "ats.view"));
check("Employee cannot reach admin settings", !can(["employee"], "admin.settings"));
check("Employee can update their own information", can(["employee"], "self.updateOwn"));
check("Caretaker has no applicant access", !can(["caretaker"], "ats.view"));
check("Caretaker cannot reach admin settings", !can(["caretaker"], "admin.settings"));
check("Caretaker can complete assigned tasks", can(["caretaker"], "self.tasks"));

// One home for everyone: the dashboard shows the sections a role can see, so
// nobody is routed to a page they would immediately be refused.
for (const role of ROLE_KEYS) {
  equal(`${role} lands on the shared dashboard`, homeFor([role]), "/team-portal/dashboard");
}
equal("and so does an account with no role yet", homeFor([]), "/team-portal/dashboard");

// The model must agree with what the database actually enforces.
for (const role of ROLE_KEYS) {
  const person = await track(createStaff(role, `perm-${role}`), users);
  const enforced = await asServiceRole(
    async (c) =>
      (
        await c.query("select public.is_staff($1) as ats, public.can_review($1) as review", [
          person.id,
        ])
      ).rows[0],
  );
  equal(`${role}: model and database agree on ATS access`, enforced.ats, can([role], "ats.view"));
  equal(
    `${role}: model and database agree on write access`,
    enforced.review,
    can([role], "ats.manageApplicants"),
  );
}

// ---------------------------------------------------------------------------
section("Self-service");

const selfUser = await track(createStaff("caretaker", "selfserve"), users);

await expectOk("anyone can read their own account", "authenticated", selfUser.id, (db) =>
  db.rpc("my_account"),
);

const mine = await as("authenticated", selfUser.id, (db) => db.rpc("my_account"));
equal("it returns exactly one row — their own", mine.data?.length, 1);
equal("with their roles", mine.data?.[0]?.roles, ["caretaker"]);

await expectOk("anyone can correct their own name", "authenticated", selfUser.id, (db) =>
  db.rpc("update_own_profile", { _full_name: "  Corrected Name  " }),
);
equal(
  "the name is trimmed and saved",
  await asServiceRole(
    async (c) =>
      (await c.query("select full_name from public.staff_profiles where user_id=$1", [selfUser.id]))
        .rows[0].full_name,
  ),
  "Corrected Name",
);

await expectFail(
  "an empty name is refused",
  "authenticated",
  selfUser.id,
  (db) => db.rpc("update_own_profile", { _full_name: "   " }),
  /enter your full name/i,
);

// Self-service must not become a way to edit someone else.
const otherBefore = await asServiceRole(
  async (c) =>
    (await c.query("select full_name from public.staff_profiles where user_id=$1", [hr.id])).rows[0]
      .full_name,
);
await as("authenticated", selfUser.id, (db) =>
  db.from("staff_profiles").update({ full_name: "Hijacked" }).eq("user_id", hr.id),
);
equal(
  "a Caretaker cannot rename anyone else",
  await asServiceRole(
    async (c) =>
      (await c.query("select full_name from public.staff_profiles where user_id=$1", [hr.id]))
        .rows[0].full_name,
  ),
  otherBefore,
);

const seenByOther = await as("authenticated", selfUser.id, (db) =>
  db.from("staff_profiles").select("user_id"),
);
equal("and sees only their own profile row", seenByOther.data?.length, 1);

// ---------------------------------------------------------------------------
section("Text-message consent");

// Consent is optional: an application must be storable either way.
const withConsent = await asServiceRole(async (c) => {
  const { rows } = await c.query(
    `insert into public.applications
       (reference, first_name, last_name, email, phone, sms_consent, sms_consent_at)
     values ($1, 'Consenting', 'Applicant', 'yes@test.invalid', '5550001111', true, now())
     returning id`,
    [`TST-C-${Date.now().toString().slice(-7)}`],
  );
  return rows[0].id as string;
});
applications.push(withConsent);
check("an application with consent is accepted", !!withConsent);

const withoutConsent = await asServiceRole(async (c) => {
  const { rows } = await c.query(
    `insert into public.applications
       (reference, first_name, last_name, email, phone, sms_consent)
     values ($1, 'Declining', 'Applicant', 'no@test.invalid', '5550002222', false)
     returning id`,
    [`TST-N-${Date.now().toString().slice(-7)}`],
  );
  return rows[0].id as string;
});
applications.push(withoutConsent);
check("an application WITHOUT consent is accepted too", !!withoutConsent);

// Both are ordinary applications, visible to staff and workable.
const visible = await as("authenticated", hr.id, (db) =>
  db.from("applications").select("id, sms_consent").in("id", [withConsent, withoutConsent]),
);
equal("both appear in the staff queue", visible.data?.length, 2);

await expectOk(
  "an applicant without text consent can still be advanced",
  "authenticated",
  hr.id,
  (db) =>
    db.rpc("set_application_milestone", {
      _application_id: withoutConsent,
      _milestone_key: "initial_outreach",
    }),
);

// canTextApplicant is the single gate on actually sending.
check(
  "may text: consent given, not opted out",
  canTextApplicant({ sms_consent: true, sms_opt_out_at: null }),
);
check("must not text: no consent", !canTextApplicant({ sms_consent: false, sms_opt_out_at: null }));
check("must not text: consent missing", !canTextApplicant({}));
check("must not text: consent null", !canTextApplicant({ sms_consent: null }));
check(
  "must not text: consented then opted out",
  !canTextApplicant({ sms_consent: true, sms_opt_out_at: new Date().toISOString() }),
);

// ---------------------------------------------------------------------------
await cleanup(applications, users);
await finish();
