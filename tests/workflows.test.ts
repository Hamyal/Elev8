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
  const row = await asServiceRole(async (c) =>
    (
      await c.query("select public.is_staff($1) as staff, public.can_review($1) as review", [user.id])
    ).rows[0],
  );
  equal(`${user.role}: is_staff / can_review`, { staff: row.staff, review: row.review }, expected);
}

const strangerRow = await asServiceRole(async (c) =>
  (await c.query("select public.is_staff($1) as staff", [STRANGER])).rows[0],
);
equal("a non-staff account is not staff", strangerRow.staff, false);

// ---------------------------------------------------------------------------
section("Authentication");

const hashed = await hashPassword("correct horse battery staple");
check("a password hash is salted and versioned", hashed.startsWith("scrypt$") && hashed.split("$").length === 3);
check("the right password verifies", await verifyPassword("correct horse battery staple", hashed));
check("a wrong password does not verify", !(await verifyPassword("wrong", hashed)));
check("a null hash never verifies", !(await verifyPassword("anything", null)));
check("a malformed hash never verifies", !(await verifyPassword("anything", "bcrypt$nope")));

const authUser = await upsertUser("auth-test@test.invalid", "Auth Test");
users.push(authUser.user.id);
check("upsertUser creates a new account", authUser.created);
const again = await upsertUser("AUTH-TEST@test.invalid", "Auth Test");
check("upsertUser is case-insensitive and does not duplicate", !again.created && again.user.id === authUser.user.id);

await setPassword(authUser.user.id, "a-very-long-password");
const signedIn = await signIn("auth-test@test.invalid", "a-very-long-password");
check("sign in with the right password succeeds", !!signedIn);
check("sign in is case-insensitive on email", !!(await signIn("Auth-Test@TEST.invalid", "a-very-long-password")));
check("sign in with a wrong password fails", (await signIn("auth-test@test.invalid", "nope")) === null);
check("sign in with an unknown email fails", (await signIn("nobody@test.invalid", "whatever")) === null);

const session = await createSession(authUser.user.id);
const resolved = await userFromSession(session);
check("a session token resolves to its user", resolved?.id === authUser.user.id);
check("an unknown session token resolves to nothing", (await userFromSession("not-a-token")) === null);
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
check("redeeming signs the person in", !!redeemed?.token && !!(await userFromSession(redeemed!.token)));
check("an invite token is single-use", (await redeemToken(inviteToken, "another-password")) === null);
check("an unknown token is refused", (await redeemToken("made-up", "another-password")) === null);
check("the new password works", !!(await signIn("auth-test@test.invalid", "brand-new-password")));
check("the old password no longer works", (await signIn("auth-test@test.invalid", "a-very-long-password")) === null);

// Issuing a fresh token must retire the previous one.
const firstToken = await issueToken(authUser.user.id, "recovery");
const secondToken = await issueToken(authUser.user.id, "recovery");
check("a newer link retires the older one", (await redeemToken(firstToken, "x-password-x")) === null);
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

const strangerRead = await as("authenticated", STRANGER, (db) => db.from("applications").select("id"));
equal("a signed-in non-staff user sees no applications", strangerRead.data?.length, 0);

const viewerRead = await as("authenticated", viewer.id, (db) => db.from("applications").select("id"));
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
    db.rpc("set_application_milestone", { _application_id: app.id, _milestone_key: "initial_outreach" }),
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
equal("starting on the first milestone", normalizeMilestone(state.current_milestone), "application_received");

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
equal("screening ends on the decision step", state.current_milestone, "screening_decision_recorded");

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
  booked.data?.some((r: { application_id: string; booked: boolean }) => r.application_id === pipeline.id && r.booked),
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
    db.rpc("acknowledge_interview_materials", { _materials_id: materialsId, _note: "Confirmed by text" }),
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
check("the jump is logged as a manual move", (await eventTypes(jump.id)).includes("milestone_jumped"));

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
check("the reopened application is no longer closed", state.status !== "not_selected", state.status);

// ---------------------------------------------------------------------------
section("HR review flags");

const flagged = await track(createApplication("Flagged"), applications);
const flagId = await asServiceRole(async (c) =>
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
  (db) => db.rpc("set_hr_flag_review", { _flag_id: flagId, _flag_status: "Discussed", _hr_notes: "" }),
  /not authorized/i,
);

// ---------------------------------------------------------------------------
section("File access logging");

await expectOk("opening a file is recorded", "authenticated", hr.id, (db) =>
  db.rpc("record_file_access", { _application_id: pipeline.id, _file_category: "Application PDF" }),
);
check("the file access appears in the activity log", (await eventTypes(pipeline.id)).includes("file_accessed"));

// ---------------------------------------------------------------------------
section("Public intake");

const contact = await as("service_role", null, (db) =>
  db
    .from("contact_submissions")
    .insert({ name: "Visitor", email: "visitor@test.invalid", message: "Question about services" })
    .select("id")
    .single(),
);
check("the contact form records a submission", !contact.error && !!contact.data?.id, contact.error?.message);
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
await cleanup(applications, users);
await finish();
