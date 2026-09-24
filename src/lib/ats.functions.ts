import { createServerFn } from "@tanstack/react-start";
import { ROLE_KEYS } from "@/lib/permissions";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import {
  displayValue,
  humanizeKey,
  requireReviewer,
  requireStaff,
  reviewer,
  staffNames,
  type LooseClient,
} from "@/lib/ats-internal";
import { COMMUNICATION_KEYS, STATUS_KEYS } from "@/lib/ats-workflow";
import { normalizeAnswerSections, type AnswerSection } from "@/lib/answer-display";
import {
  availabilityFromApplicationData,
  type ApplicantAvailability,
} from "@/lib/ats-availability";


/**
 * Staff-only ATS reads and writes.
 *
 * Every function runs as the signed-in staff member, so row-level security is
 * the enforcement boundary. Status, milestone, assignment, scheduling, flag,
 * note, and communication writes all go through database functions that write
 * a fixed allow-list of columns — there is no table-level UPDATE path for
 * staff, and Viewer accounts cannot write at all.
 */

/** Acknowledgment-only rows hidden from the staff record view. */
const HIDDEN_ANSWER_LABELS = new Set([
  "Long-term San Diego availability",
  "Minimum Position Requirements",
  "Job responsibilities",
  "Willingness to complete training",
  "CDSS criminal-record clearance requirement",
  "Upload your First Aid certification",
  "Upload your CPR certification",
  "Upload your First Aid and CPR certification",
]);


export {
  ROLE_KEYS,
  ROLE_LABELS,
  HIRING_ROLES,
  type RoleKey,
} from "@/lib/permissions";

/**
 * What an account's state is, derived rather than stored.
 *
 * Keeping one stored flag (is_active) and reading "Invited" from whether a
 * password has been set avoids two sources of truth drifting apart — an
 * account cannot be marked Active while its owner has never signed in.
 */
export type AccountStatus = "active" | "invited" | "disabled";

export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Disabled",
};

export type StaffAccess = {
  roles: string[];
  canReview: boolean;
  isAdmin: boolean;
  fullName: string;
  email: string;
  active: boolean;
  userId: string;
};

/** Roles of the signed-in staff member (own assignment only). */
export const getStaffAccess = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<StaffAccess> => {
    const supabase = context.supabase as unknown as LooseClient;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = ((data ?? []) as { role: string }[]).map((row) => row.role);
    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("full_name, email, is_active")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      roles,
      canReview: reviewer(roles),
      isAdmin: roles.includes("admin"),
      fullName: (profile?.full_name as string | undefined) ?? "",
      email: (profile?.email as string | undefined) ?? "",
      active: profile ? profile.is_active !== false : false,
      userId: context.userId,
    };
  });

export type ApplicantRow = {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  milestone: string;
  nextAction: string;
  assignedTo: string | null;
  assignedName: string;
  dueAt: string | null;
  completedAt: string | null;
  submittedAt: string;
  opportunity: string;
  flagCount: number;
  openFlagCount: number;
  flags: { id: string; question: string; answer: string; status: string }[];
  confirmationPending: boolean;
  /** Submitted availability answers, used for display-only filtering. */
  availability: ApplicantAvailability;
};

/** Real submitted applications, newest first. No sample data. */
export const listApplicants = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ApplicantRow[]> => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireStaff(supabase, context.userId);

    const { data: apps, error } = await supabase
      .from("applications")
      .select(
        "id, reference, first_name, last_name, email, phone, status, created_at, opportunity_pref, current_milestone, next_action, assigned_to, milestone_due_at, milestone_completed_at, application_data",
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const { data: flags } = await supabase
      .from("hr_review_flags")
      .select("id, application_id, question, answer, flag_status")
      .order("created_at", { ascending: true });

    const { data: scheduling } = await supabase
      .from("application_scheduling")
      .select("application_id, confirmation_state");

    const pending = new Set(
      ((scheduling ?? []) as { application_id: string; confirmation_state: string | null }[])
        .filter((s) => s.confirmation_state === "awaiting_confirmation")
        .map((s) => s.application_id),
    );

    const byApp = new Map<string, ApplicantRow["flags"]>();
    for (const flag of (flags ?? []) as {
      id: string;
      application_id: string;
      question: string;
      answer: string;
      flag_status: string | null;
    }[]) {
      const list = byApp.get(flag.application_id) ?? [];
      list.push({
        id: flag.id,
        question: flag.question,
        answer: flag.answer,
        status: flag.flag_status ?? "Needs Review",
      });
      byApp.set(flag.application_id, list);
    }

    const rows = (apps ?? []) as Record<string, unknown>[];
    const names = await staffNames(supabase, rows.map((r) => r['assigned_to'] as string | null));

    const text = (row: Record<string, unknown>, key: string) => (row[key] as string | null) ?? "";

    return rows.map((row) => {
      const flagList = byApp.get(row['id'] as string) ?? [];
      const assignedTo = (row['assigned_to'] as string | null) ?? null;
      return {
        id: row['id'] as string,
        reference: text(row, 'reference'),
        name: `${text(row, 'first_name')} ${text(row, 'last_name')}`.trim(),
        email: text(row, 'email'),
        phone: text(row, 'phone'),
        status: text(row, 'status') || "new",
        milestone: text(row, 'current_milestone') || "application_received",
        nextAction: text(row, 'next_action'),
        assignedTo,
        assignedName: (assignedTo && names.get(assignedTo)) || "",
        dueAt: (row['milestone_due_at'] as string | null) ?? null,
        completedAt: (row['milestone_completed_at'] as string | null) ?? null,
        submittedAt: text(row, 'created_at'),
        opportunity: text(row, 'opportunity_pref'),
        flagCount: flagList.length,
        openFlagCount: flagList.filter((f) => f.status === "Needs Review").length,
        flags: flagList,
        confirmationPending: pending.has(row['id'] as string),
        availability: availabilityFromApplicationData(
          row['application_data'] as Record<string, unknown> | null,
        ),
      };
    });

  });

export type ApplicantDetail = {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  milestone: string;
  nextAction: string;
  assignedTo: string | null;
  assignedName: string;
  dueAt: string | null;
  completedAt: string | null;
  closedOtherReason: string | null;
  submittedAt: string;
  typedName: string;
  answers: { label: string; value: string }[];
  /** Step 5 review snapshot: same groups, order, and labels the applicant saw. */
  answerSections: AnswerSection[];
  flags: {
    id: string;
    question: string;
    answer: string;
    status: string;
    hrNotes: string | null;
    createdAt: string;
  }[];
  notes: { id: string; body: string; author: string; createdAt: string }[];
  files: { key: string; category: string; name: string }[];
  hasPdf: boolean;
  events: {
    id: string;
    type: string;
    detail: string;
    fromStatus: string | null;
    toStatus: string | null;
    actor: string;
    createdAt: string;
  }[];
  milestoneTrail: {
    id: string;
    milestone: string;
    dueAt: string | null;
    completedAt: string | null;
    state: string;
    createdAt: string;
  }[];
  communications: {
    id: string;
    type: string;
    occurredAt: string;
    milestone: string | null;
    template: string | null;
    message: string;
    privateNote: string | null;
    staff: string;
  }[];
  scheduling: {
    kind: string;
    proposedDate: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    applicantAvailability: string;
    finalWindowStart: string | null;
    finalWindowEnd: string | null;
    confirmationState: string | null;
    confirmationDueAt: string | null;
    completedAt: string | null;
  }[];
  slotOffers: {
    id: string;
    kind: string;
    selectionsRequested: number;
    createdAt: string;
    slots: { date: string; time: string }[];
  }[];
  /** Slots this candidate confirmed they can attend (staff-confirmed). */
  confirmedSlots: { kind: string; date: string; time: string }[];
  /** The single slot the candidate is locked into, per stage. */
  bookings: {
    kind: string;
    date: string;
    time: string;
    facility: string;
    confirmBy: string | null;
  }[];
  materials: {
    id: string;
    url: string | null;
    sentAt: string;
    sentBy: string;
    acknowledgedAt: string | null;
    acknowledgedNote: string;
  }[];
  interview1Completed: boolean;
};

export const getApplicant = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ApplicantDetail> => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    const canReview = reviewer(roles);
    const { collectApplicationFiles } = await import("@/lib/ats-files");

    const { data: app, error } = await supabase
      .from("applications")
      .select(
        "id, reference, first_name, last_name, email, phone, status, created_at, typed_name, application_data, application_pdf_path, current_milestone, next_action, assigned_to, milestone_due_at, milestone_completed_at, closed_other_reason",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) throw new Error("Application not found.");

    const applicationData = (app.application_data ?? {}) as Record<string, unknown>;
    const files = collectApplicationFiles(applicationData);
    const fileKeys = new Set(files.map((f) => f.rootKey));

    const answers = Object.entries(applicationData)
      .filter(([key]) => !fileKeys.has(key) && key !== "review_sections")
      .map(([key, value]) => ({ label: humanizeKey(key), value: displayValue(value) }))
      .filter((row) => row.value !== "" && !HIDDEN_ANSWER_LABELS.has(row.label));

    // Preferred rendering: the archived Step 5 review snapshot. Records saved
    // before the snapshot existed fall back to the flat key/value list.
    const snapshot = applicationData["review_sections"];
    const answerSections = Array.isArray(snapshot)
      ? normalizeAnswerSections(
          (snapshot as { label?: unknown; rows?: unknown }[])
          .map((section) => ({
            label: String(section?.label ?? ""),
            rows: (Array.isArray(section?.rows) ? section.rows : [])
              .map((row: { label?: unknown; value?: unknown; lines?: unknown; blocks?: unknown }) => ({
                label: String(row?.label ?? ""),
                value: displayValue(row?.value),
                ...(Array.isArray(row?.lines) && row.lines.length
                  ? { lines: (row.lines as unknown[]).map((l) => String(l)) }
                  : {}),
                ...(Array.isArray(row?.blocks) && row.blocks.length
                  ? {
                      blocks: (row.blocks as { title?: unknown; fields?: unknown }[]).map((b) => ({
                        title: String(b?.title ?? ""),
                        fields: (Array.isArray(b?.fields) ? b.fields : []).map(
                          (f: { label?: unknown; value?: unknown }) => ({
                            label: String(f?.label ?? ""),
                            value: displayValue(f?.value),
                          }),
                        ),
                      })),
                    }
                  : {}),
              }))
              .filter(
                (row) =>
                  row.label !== "" && row.value !== "" && !HIDDEN_ANSWER_LABELS.has(row.label),
              ),
          }))
          .filter((section) => section.rows.length > 0),
        )
      : [];




    const { data: flags } = await supabase
      .from("hr_review_flags")
      .select("id, question, answer, flag_status, created_at")
      .eq("application_id", data.id)
      .order("created_at", { ascending: true });

    // Private HR notes are readable only through the admin/HR-gated function.
    let noteByFlag = new Map<string, string>();
    if (canReview) {
      const { data: flagNotes } = await supabase.rpc("hr_flag_notes", {
        _application_id: data.id,
      });
      noteByFlag = new Map(
        ((flagNotes ?? []) as { flag_id: string; hr_notes: string }[]).map((row) => [
          row.flag_id,
          row.hr_notes ?? "",
        ]),
      );
    }

    let notes: ApplicantDetail["notes"] = [];
    if (canReview) {
      const { data: noteRows } = await supabase
        .from("application_notes")
        .select("id, body, author_id, created_at")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false });
      const rows = (noteRows ?? []) as {
        id: string;
        body: string;
        author_id: string;
        created_at: string;
      }[];
      const authorMap = await staffNames(supabase, rows.map((n) => n.author_id));
      notes = rows.map((n) => ({
        id: n.id,
        body: n.body,
        author: authorMap.get(n.author_id) ?? "Staff",
        createdAt: n.created_at,
      }));
    }

    const { data: eventRows } = await supabase
      .from("application_events")
      .select("id, event_type, detail, from_status, to_status, actor_id, created_at")
      .eq("application_id", data.id)
      .order("created_at", { ascending: false });
    const events = (eventRows ?? []) as {
      id: string;
      event_type: string;
      detail: string | null;
      from_status: string | null;
      to_status: string | null;
      actor_id: string | null;
      created_at: string;
    }[];

    const { data: trailRows } = await supabase
      .from("application_milestones")
      .select("id, milestone_key, due_at, completed_at, state, created_at")
      .eq("application_id", data.id)
      .order("created_at", { ascending: false });
    const trail = (trailRows ?? []) as {
      id: string;
      milestone_key: string;
      due_at: string | null;
      completed_at: string | null;
      state: string;
      created_at: string;
    }[];

    const { data: commRows } = await supabase
      .from("application_communications")
      .select(
        "id, staff_id, comm_type, occurred_at, milestone_key, template_key, message_text, created_at",
      )
      .eq("application_id", data.id)
      .order("occurred_at", { ascending: false });
    const comms = (commRows ?? []) as {
      id: string;
      staff_id: string;
      comm_type: string;
      occurred_at: string;
      milestone_key: string | null;
      template_key: string | null;
      message_text: string;
    }[];

    let commNotes = new Map<string, string>();
    if (canReview && comms.length) {
      const { data: privateNotes } = await supabase.rpc("communication_notes", {
        _application_id: data.id,
      });
      commNotes = new Map(
        ((privateNotes ?? []) as { communication_id: string; private_note: string }[]).map((r) => [
          r.communication_id,
          r.private_note ?? "",
        ]),
      );
    }

    const { data: schedRows } = await supabase
      .from("application_scheduling")
      .select(
        "kind, proposed_date, window_start, window_end, applicant_availability, final_window_start, final_window_end, confirmation_state, confirmation_due_at, completed_at",
      )
      .eq("application_id", data.id);

    const { data: offerRows } = await supabase
      .from("interview_slot_offers")
      .select("id, kind, selections_requested, created_at")
      .eq("application_id", data.id)
      .order("created_at", { ascending: false });
    const offers = (offerRows ?? []) as {
      id: string;
      kind: string;
      selections_requested: number;
      created_at: string;
    }[];
    const { data: slotRows } = offers.length
      ? await supabase
          .from("interview_slots")
          .select("offer_id, slot_date, slot_time")
          .in("offer_id", offers.map((o) => o.id))
      : { data: [] };
    const slotsByOffer = new Map<string, { date: string; time: string }[]>();
    for (const slot of (slotRows ?? []) as {
      offer_id: string;
      slot_date: string;
      slot_time: string;
    }[]) {
      const list = slotsByOffer.get(slot.offer_id) ?? [];
      list.push({ date: slot.slot_date, time: slot.slot_time });
      slotsByOffer.set(slot.offer_id, list);
    }

    const { data: confirmedRows } = await supabase
      .from("interview_confirmed_slots")
      .select("kind, slot_date, slot_time")
      .eq("application_id", data.id)
      .order("slot_date", { ascending: true });

    const { data: bookingRows } = await supabase
      .from("interview_bookings")
      .select("kind, slot_date, slot_time, facility, confirm_by")
      .eq("application_id", data.id);



    const { data: materialRows } = await supabase
      .from("interview_materials")
      .select("id, materials_url, sent_by, sent_at, acknowledged_at, acknowledged_note")
      .eq("application_id", data.id)
      .order("sent_at", { ascending: false });
    const materials = (materialRows ?? []) as {
      id: string;
      materials_url: string;
      sent_by: string | null;
      sent_at: string;
      acknowledged_at: string | null;
      acknowledged_note: string;
    }[];

    const nameMap = await staffNames(supabase, [
      ...events.map((e) => e.actor_id),
      ...comms.map((c) => c.staff_id),
      ...materials.map((m) => m.sent_by),
      (app.assigned_to as string | null) ?? null,
    ]);

    const assignedTo = (app.assigned_to as string | null) ?? null;

    return {
      id: app.id as string,
      reference: (app.reference as string) ?? "",
      name: `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim(),
      email: (app.email as string) ?? "",
      phone: (app.phone as string) ?? "",
      status: (app.status as string) ?? "new",
      milestone: (app.current_milestone as string) ?? "application_received",
      nextAction: (app.next_action as string) ?? "",
      assignedTo,
      assignedName: (assignedTo && nameMap.get(assignedTo)) || "",
      dueAt: (app.milestone_due_at as string | null) ?? null,
      completedAt: (app.milestone_completed_at as string | null) ?? null,
      closedOtherReason: canReview ? ((app.closed_other_reason as string | null) ?? null) : null,
      submittedAt: (app.created_at as string) ?? "",
      typedName: (app.typed_name as string) ?? "",
      answers,
      answerSections,
      
      flags: ((flags ?? []) as {
        id: string;
        question: string;
        answer: string;
        flag_status: string | null;
        created_at: string;
      }[]).map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        status: f.flag_status ?? "Needs Review",
        hrNotes: canReview ? (noteByFlag.get(f.id) ?? "") : null,
        createdAt: f.created_at,
      })),
      notes,
      files: files.map((f) => ({ key: f.path, category: f.category, name: f.name })),
      hasPdf: !!app.application_pdf_path,
      events: events
        .filter((e) => canReview || !["workflow_override"].includes(e.event_type))
        .map((e) => ({
          id: e.id,
          type: e.event_type,
          detail: e.detail ?? "",
          fromStatus: e.from_status,
          toStatus: e.to_status,
          actor: (e.actor_id && nameMap.get(e.actor_id)) || "System",
          createdAt: e.created_at,
        })),
      milestoneTrail: trail.map((m) => ({
        id: m.id,
        milestone: m.milestone_key,
        dueAt: m.due_at,
        completedAt: m.completed_at,
        state: m.state,
        createdAt: m.created_at,
      })),
      communications: comms.map((c) => ({
        id: c.id,
        type: c.comm_type,
        occurredAt: c.occurred_at,
        milestone: c.milestone_key,
        template: c.template_key,
        message: c.message_text ?? "",
        privateNote: canReview ? (commNotes.get(c.id) ?? "") : null,
        staff: nameMap.get(c.staff_id) ?? "Staff",
      })),
      scheduling: ((schedRows ?? []) as Record<string, string | null>[]).map((s) => ({
        kind: s['kind'] as string,
        proposedDate: s['proposed_date'] ?? null,
        windowStart: s['window_start'] ?? null,
        windowEnd: s['window_end'] ?? null,
        applicantAvailability: s['applicant_availability'] ?? "",
        finalWindowStart: s['final_window_start'] ?? null,
        finalWindowEnd: s['final_window_end'] ?? null,
        confirmationState: s['confirmation_state'] ?? null,
        confirmationDueAt: s['confirmation_due_at'] ?? null,
        completedAt: s['completed_at'] ?? null,
      })),
      confirmedSlots: ((confirmedRows ?? []) as Record<string, string>[]).map((s) => ({
        kind: s['kind'] as string,
        date: s['slot_date'] as string,
        time: s['slot_time'] as string,
      })),
      bookings: ((bookingRows ?? []) as Record<string, string | null>[]).map((b) => ({
        kind: b['kind'] as string,
        date: b['slot_date'] as string,
        time: b['slot_time'] as string,
        facility: b['facility'] as string,
        confirmBy: b['confirm_by'] ?? null,
      })),
      slotOffers: offers.map((o) => ({
        id: o.id,
        kind: o.kind,
        selectionsRequested: o.selections_requested,
        createdAt: o.created_at,
        slots: (slotsByOffer.get(o.id) ?? []).sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
        ),
      })),
      materials: materials.map((m) => ({
        id: m.id,
        url: canReview ? m.materials_url : null,
        sentAt: m.sent_at,
        sentBy: (m.sent_by && nameMap.get(m.sent_by)) || "Staff",
        acknowledgedAt: m.acknowledged_at,
        acknowledgedNote: m.acknowledged_note ?? "",
      })),
      interview1Completed: trail.some(
        (m) =>
          (m.milestone_key === "i1_interview_completed" ||
            m.milestone_key === "interview1_completed") &&
          !!m.completed_at,
      ),

    };
  });

/** Writes status + updated_at only, through the database function. */
export const changeApplicantStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(STATUS_KEYS as [string, ...string[]]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const { error } = await supabase.rpc("set_application_status", {
      _application_id: data.id,
      _new_status: data.status,
    });
    if (error) throw new Error(error.message);
    return { status: data.status };
  });

/**
 * Interview #2 is entered only by this deliberate Admin/HR decision, after
 * Interview #1 is completed. The database function records the actor and the
 * time in the append-only activity history.
 */
export const advanceToInterview2 = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("advance_to_interview_2", {
      _application_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { status: "interview_2" as const };
  });

/**
 * Reopens a closed (Not Selected) application. Admin and HR only. A private
 * reason is required; the closing history is preserved.
 */
export const reopenApplication = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().min(5).max(2000),
        milestone: z.string().min(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { data: milestone, error } = await supabase.rpc("reopen_application", {
      _application_id: data.id,
      _reason: data.reason,
      _milestone_key: data.milestone ?? null,
    });
    if (error) throw new Error(error.message);
    return { milestone: (milestone as string | null) ?? null };
  });

/** Milestone change. Skipping ahead requires a private override reason. */
export const setMilestone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        milestone: z.string().min(1),
        nextAction: z.string().max(400).optional(),
        dueAt: z.string().optional(),
        overrideReason: z.string().max(2000).optional(),
        closedOtherReason: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("set_application_milestone", {
      _application_id: data.id,
      _milestone_key: data.milestone,
      _next_action: data.nextAction ?? null,
      _due_at: data.dueAt ? new Date(data.dueAt).toISOString() : null,
      _override_reason: data.overrideReason ?? null,
      _closed_other_reason: data.closedOtherReason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Deliberate override: moves a record straight to any milestone, forward or
 * backward, skipping the guided step validation. A private reason is required
 * and the move is logged as a manual move in the activity history.
 */
export const jumpToMilestone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        milestone: z.string().min(1),
        reason: z.string().min(5).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("jump_to_milestone", {
      _application_id: data.id,
      _milestone_key: data.milestone,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const completeMilestone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), detail: z.string().max(400).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("complete_milestone", {
      _application_id: data.id,
      _detail: data.detail ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Single-transaction "Complete This Step" — completes, assigns, advances, and logs one event. */
export const completeAndAdvanceMilestone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        milestone: z.string().min(1),
        nextAction: z.string().max(400).optional(),
        dueAt: z.string().optional(),
        staffId: z.string().uuid().nullable().optional(),
        detail: z.string().max(400).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("complete_and_advance_milestone", {
      _application_id: data.id,
      _next_milestone_key: data.milestone,
      _next_action: data.nextAction ?? null,
      _due_at: data.dueAt ? new Date(data.dueAt).toISOString() : null,
      _staff_id: data.staffId ?? null,
      _detail: data.detail ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMilestoneDeadline = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), dueAt: z.string().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("set_milestone_deadline", {
      _application_id: data.id,
      _due_at: data.dueAt ? new Date(data.dueAt).toISOString() : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignApplicant = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), staffId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("assign_application", {
      _application_id: data.id,
      _staff_id: data.staffId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Records a message or call that a staff member sent or made outside the ATS. */
export const recordCommunication = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        type: z.enum(COMMUNICATION_KEYS as [string, ...string[]]),
        occurredAt: z.string().optional(),
        milestone: z.string().optional(),
        template: z.string().optional(),
        message: z.string().max(8000).default(""),
        privateNote: z.string().max(4000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("record_communication", {
      _application_id: data.id,
      _comm_type: data.type,
      _occurred_at: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
      _milestone_key: data.milestone ?? null,
      _template_key: data.template ?? null,
      _message_text: data.message,
      _private_note: data.privateNote,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveScheduling = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["phone", "interview_1", "interview_2"]),
        proposedDate: z.string().nullable(),
        windowStart: z.string().nullable(),
        windowEnd: z.string().nullable(),
        applicantAvailability: z.string().max(2000).default(""),
        finalWindowStart: z.string().nullable().optional(),
        finalWindowEnd: z.string().nullable().optional(),
        completedAt: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("set_scheduling", {
      _application_id: data.id,
      _kind: data.kind,
      _proposed_date: data.proposedDate,
      _window_start: data.windowStart,
      _window_end: data.windowEnd,
      _applicant_availability: data.applicantAvailability,
      _final_window_start: data.finalWindowStart ?? null,
      _final_window_end: data.finalWindowEnd ?? null,
      _completed_at: data.completedAt ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setConfirmationState = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["phone", "interview_1", "interview_2"]),
        state: z.enum([
          "awaiting_confirmation",
          "confirmed",
          "applicant_declined",
          "rescheduling_under_review",
          "rescheduled",
          "confirmation_deadline_missed",
        ]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("set_confirmation_state", {
      _application_id: data.id,
      _kind: data.kind,
      _state: data.state,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The interview times a candidate confirmed — always staff-confirmed first. */
export const saveConfirmedSlots = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["interview_1", "interview_2"]),
        slots: z.array(z.object({ date: z.string().min(1), time: z.string().min(1) })),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("save_confirmed_slots", {
      _application_id: data.id,
      _kind: data.kind,
      _slots: data.slots.map((s) => ({ date: s.date, time: s.time, source: "confirmed" })),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bookInterviewSlot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["interview_1", "interview_2"]),
        date: z.string().min(1),
        time: z.string().min(1),
        facility: z.string().min(1),
        confirmBy: z.string().min(1).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("book_interview_slot", {
      _application_id: data.id,
      _kind: data.kind,
      _slot_date: data.date,
      _slot_time: data.time,
      _facility: data.facility,
      _confirm_by: data.confirmBy,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unbookInterviewSlot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({ id: z.string().uuid(), kind: z.enum(["interview_1", "interview_2"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("unbook_interview_slot", {
      _application_id: data.id,
      _kind: data.kind,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ConfirmedSlotRow = {
  applicationId: string;
  name: string;
  reference: string;
  date: string;
  time: string;
  booked: boolean;
  bookedDate: string | null;
  bookedTime: string | null;
  facility: string | null;
  confirmBy: string | null;
};

/** Every candidate's confirmed availability, for the Schedule Interviews board. */
export const listConfirmedInterviewSlots = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ kind: z.enum(["interview_1", "interview_2"]) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ConfirmedSlotRow[]> => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireStaff(supabase, context.userId);
    const { data: rows, error } = await supabase.rpc("list_confirmed_interview_slots", {
      _kind: data.kind,
    });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Record<string, string | boolean | null>[]).map((r) => ({
      applicationId: r['application_id'] as string,
      name: (r['applicant_name'] as string) ?? "",
      reference: (r['reference'] as string) ?? "",
      date: r['slot_date'] as string,
      time: r['slot_time'] as string,
      booked: !!r['booked'],
      bookedDate: (r['booked_date'] as string | null) ?? null,
      bookedTime: (r['booked_time'] as string | null) ?? null,
      facility: (r['facility'] as string | null) ?? null,
      confirmBy: (r['confirm_by'] as string | null) ?? null,
    }));
  });


export const saveSlotOffer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["phone", "interview_1", "interview_2"]),
        selectionsRequested: z.number().int().min(1),
        slots: z
          .array(z.object({ date: z.string().min(1), time: z.string().min(1) }))
          .min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    if (data.selectionsRequested > data.slots.length) {
      throw new Error(
        "The number of requested preferences cannot exceed the number of slots offered.",
      );
    }
    const { error } = await supabase.rpc("save_slot_offer", {
      _application_id: data.id,
      _kind: data.kind,
      _selections_requested: data.selectionsRequested,
      _slots: data.slots,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendInterviewMaterials = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), url: z.string().url().max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("send_interview_materials", {
      _application_id: data.id,
      _materials_url: data.url,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acknowledgeInterviewMaterials = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({ materialsId: z.string().uuid(), note: z.string().max(2000).default("") })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireReviewer(supabase, context.userId);
    const { error } = await supabase.rpc("acknowledge_interview_materials", {
      _materials_id: data.materialsId,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Updates only the flag's triage status and private HR notes. */
export const reviewHrFlag = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        flagId: z.string().uuid(),
        status: z.enum(["Needs Review", "Discussed", "Resolved"]),
        notes: z.string().max(4000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const { error } = await supabase.rpc("set_hr_flag_review", {
      _flag_id: data.flagId,
      _flag_status: data.status,
      _hr_notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Append-only private note. */
export const addApplicantNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const { error } = await supabase.rpc("add_application_note", {
      _application_id: data.id,
      _body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Short-lived signed link for a private file. Authorization is re-verified on
 * every request; the URL is returned to the caller only and is never stored.
 */
export const createFileLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["pdf", "upload"]),
        path: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireStaff(supabase, context.userId);
    const { collectApplicationFiles } = await import("@/lib/ats-files");
    const { adminDb } = await import("@/server/admin");

    const { data: app, error } = await supabase
      .from("applications")
      .select("id, application_pdf_path, application_data")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) throw new Error("Application not found.");

    let bucket = "application-pdfs";
    let path = (app.application_pdf_path as string | null) ?? "";
    let category = "Application PDF";

    if (data.kind === "upload") {
      const files = collectApplicationFiles(
        (app.application_data ?? {}) as Record<string, unknown>,
      );
      const match = files.find((f) => f.path === data.path);
      if (!match) throw new Error("File not found for this application.");
      bucket = match.bucket;
      path = match.path;
      category = match.category;
    }

    if (!path) throw new Error("No file is stored for this application.");

    const { createSignedUrl } = await import("@/server/storage");
    let signedUrl: string;
    try {
      signedUrl = createSignedUrl(bucket, path, 600);
    } catch {
      throw new Error("The file link could not be created.");
    }

    // Records that the file was opened; never the signed URL itself.
    await supabase.rpc("record_file_access", {
      _application_id: data.id,
      _file_category: category,
    });

    return { url: signedUrl, expiresInMinutes: 10 };
  });

/** Active staff members, for the assignment picker. */
export const listAssignableStaff = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    await requireStaff(supabase, context.userId);
    const { data } = await supabase
      .from("staff_profiles")
      .select("user_id, full_name, email, is_active")
      .order("full_name", { ascending: true });
    return ((data ?? []) as {
      user_id: string;
      full_name: string;
      email: string;
      is_active: boolean;
    }[])
      .filter((row) => row.is_active)
      .map((row) => ({ userId: row.user_id, name: row.full_name || row.email }));
  });

/** Admin-only: create a staff account and assign its role. */
export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().max(200).default(""),
        password: z.string().min(10).max(200),
        role: z.enum(ROLE_KEYS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Only an Admin can add staff accounts.");
    const { adminDb } = await import("@/server/admin");

    const { upsertUser, setPassword } = await import("@/server/auth");

    const { user: created, created: isNew } = await upsertUser(data.email, data.fullName);
    if (!isNew) throw new Error("An account already exists for that email address.");
    await setPassword(created.id, data.password);

    const admin = adminDb as unknown as LooseClient;
    await admin.from("staff_profiles").upsert(
      {
        user_id: created.id,
        email: data.email,
        full_name: data.fullName,
        is_active: true,
      },
      { onConflict: "user_id" },
    );
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: created.id, role: data.role });
    if (roleError) throw new Error(roleError.message);

    return { userId: created.id };
  });

/** Admin-only staff list with roles. */
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Only an Admin can view staff accounts.");

    const { data: profiles } = await supabase
      .from("staff_profiles")
      .select("user_id, full_name, email, is_active, created_at")
      .order("created_at", { ascending: true });
    const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    for (const row of (roleRows ?? []) as { user_id: string; role: string }[]) {
      roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), row.role]);
    }
    // "Invited" means the account exists but its owner has never set a
    // password. That lives on the auth record, which only the service role can
    // read, so it is fetched separately rather than stored a second time.
    const { asServiceRole } = await import("@/server/db");
    const passwordSet = await asServiceRole(async (client) => {
      const { rows } = await client.query(
        "select id from auth.users where encrypted_password is not null",
      );
      return new Set((rows as { id: string }[]).map((r) => r.id));
    });

    return ((profiles ?? []) as {
      user_id: string;
      full_name: string;
      email: string;
      is_active: boolean;
    }[]).map((p) => {
      const status: AccountStatus = !p.is_active
        ? "disabled"
        : passwordSet.has(p.user_id)
          ? "active"
          : "invited";
      return {
        userId: p.user_id,
        fullName: p.full_name,
        email: p.email,
        active: p.is_active,
        status,
        statusLabel: STATUS_LABELS[status],
        roles: roleMap.get(p.user_id) ?? [],
        isSelf: p.user_id === context.userId,
      };
    });
  });

/** Admin-only: activate or deactivate another staff account. */
export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Only an Admin can change staff access.");
    if (data.userId === context.userId)
      throw new Error("You cannot change your own access.");
    const { error } = await supabase
      .from("staff_profiles")
      .update({ is_active: data.active })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Admin-only: change another staff member's role.
 *
 * A role is a single choice, so this replaces whatever the account had rather
 * than adding to it. The database policies already permitted this — see
 * "Admins update roles of others" — but nothing exposed it, so a role could
 * only ever be set at invitation time.
 *
 * An admin may not change their own role. That guard is in the policy as well
 * as here: it stops the last admin removing their own access and locking
 * everyone out of staff management.
 */
export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(ROLE_KEYS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Only an Admin can change roles.");
    if (data.userId === context.userId) throw new Error("You cannot change your own role.");

    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("user_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!profile) throw new Error("That account is not a staff member.");

    // Replace rather than accumulate: clear the old rows, then insert the one.
    const { error: clearError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (clearError) throw new Error(clearError.message);

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);

    return { ok: true, role: data.role };
  });

/**
 * Admin-only: correct a staff member's display name.
 *
 * The email address is deliberately not editable here — it is the account's
 * identity and is what invitation and sign-in are keyed on, so changing it
 * belongs with the auth record, not the profile.
 */
export const updateStaffProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), fullName: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Only an Admin can edit staff accounts.");

    const { error } = await supabase
      .from("staff_profiles")
      .update({ full_name: data.fullName.trim() })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ *
 * Self-service — available to every signed-in role
 * ------------------------------------------------------------------ */

export type MyAccount = {
  userId: string;
  fullName: string;
  email: string;
  active: boolean;
  roles: string[];
  capabilities: string[];
};

/**
 * The signed-in person's own record. Deliberately not gated on a role: an
 * Employee or a Caretaker has no applicant access but must still be able to
 * see and correct their own details.
 */
export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<MyAccount> => {
    const supabase = context.supabase as unknown as LooseClient;
    const { data, error } = await supabase.rpc("my_account");
    if (error) throw new Error(error.message);

    const row = ((data ?? []) as {
      user_id: string;
      full_name: string | null;
      email: string;
      is_active: boolean;
      roles: string[] | null;
    }[])[0];
    if (!row) throw new Error("No account record was found for you.");

    const { capabilitiesFor } = await import("@/lib/permissions");
    const roles = row.roles ?? [];
    return {
      userId: row.user_id,
      fullName: row.full_name ?? "",
      email: row.email,
      active: row.is_active,
      roles,
      capabilities: capabilitiesFor(roles),
    };
  });

/** Corrects the signed-in person's own display name. */
export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ fullName: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const { error } = await supabase.rpc("update_own_profile", { _full_name: data.fullName });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Changes the signed-in person's own password.
 *
 * The current password is required: a session alone is not proof of identity
 * on a shared machine, and without it a walk-up attacker could lock the owner
 * out of their own account.
 */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: z.string().min(12).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { signIn, setPassword } = await import("@/server/auth");
    const user = context.user as { email: string };

    const verified = await signIn(user.email, data.currentPassword);
    if (!verified) throw new Error("That is not your current password.");

    // setPassword ends every existing session, including this one, so the
    // caller is signed out and must sign in again with the new password.
    await setPassword(context.userId, data.newPassword);
    return { ok: true };
  });

/* ------------------------------------------------------------------ *
 * Dashboard — one shape, filled differently per role
 * ------------------------------------------------------------------ */

export type DashboardData = {
  me: { fullName: string; email: string; roles: string[]; capabilities: string[] };
  /** Present only for roles that may see applicant records. */
  hiring?: {
    byStage: { key: string; label: string; count: number }[];
    total: number;
    open: number;
    assignedToMe: number;
    overdue: number;
    awaitingApplicant: number;
    flagsNeedingReview: number;
  };
  /** Present only for Admin. */
  accounts?: { total: number; active: number; invited: number; disabled: number };
};

/**
 * Everything the portal home needs, for whoever is asking.
 *
 * One call rather than one per role, so every dashboard is built from the same
 * shape and a role that may not see a section simply does not receive it. The
 * capability check decides what is fetched, and row-level security independently
 * decides what the queries can return — a Caretaker asking for hiring figures
 * would get nothing even if this function tried.
 */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<DashboardData> => {
    const supabase = context.supabase as unknown as LooseClient;
    const { capabilitiesFor, can } = await import("@/lib/permissions");
    const { STATUSES, normalizeStatus } = await import("@/lib/ats-workflow");

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);

    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("full_name, email")
      .eq("user_id", context.userId)
      .maybeSingle();

    const me = {
      fullName: (profile?.full_name as string | undefined) ?? "",
      email: (profile?.email as string | undefined) ?? "",
      roles,
      capabilities: capabilitiesFor(roles),
    };

    if (!can(roles, "ats.view")) return { me };

    const { data: apps } = await supabase
      .from("applications")
      .select("id, status, assigned_to, milestone_due_at, milestone_completed_at, current_milestone");

    const rows = (apps ?? []) as {
      id: string;
      status: string | null;
      assigned_to: string | null;
      milestone_due_at: string | null;
      milestone_completed_at: string | null;
      current_milestone: string | null;
    }[];

    const now = Date.now();
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = normalizeStatus(row.status);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const { data: flags } = await supabase
      .from("hr_review_flags")
      .select("id, flag_status");
    const flagsNeedingReview = ((flags ?? []) as { flag_status: string | null }[]).filter(
      (f) => (f.flag_status ?? "Needs Review") === "Needs Review",
    ).length;

    const { data: scheduling } = await supabase
      .from("application_scheduling")
      .select("application_id, confirmation_state");
    const awaitingApplicant = (
      (scheduling ?? []) as { confirmation_state: string | null }[]
    ).filter((s) => s.confirmation_state === "awaiting_confirmation").length;

    const hiring: DashboardData["hiring"] = {
      byStage: STATUSES.map((stage) => ({
        key: stage.key,
        label: stage.label,
        count: counts.get(stage.key) ?? 0,
      })),
      total: rows.length,
      open: rows.filter((r) => {
        const status = normalizeStatus(r.status);
        return status !== "hired" && status !== "not_selected";
      }).length,
      assignedToMe: rows.filter((r) => r.assigned_to === context.userId).length,
      overdue: rows.filter(
        (r) =>
          r.milestone_due_at &&
          !r.milestone_completed_at &&
          new Date(r.milestone_due_at).getTime() < now,
      ).length,
      awaitingApplicant,
      flagsNeedingReview,
    };

    if (!can(roles, "admin.manageUsers")) return { me, hiring };

    const { asServiceRole } = await import("@/server/db");
    const accounts = await asServiceRole(async (client) => {
      const { rows: userRows } = await client.query(`
        select sp.is_active, (u.encrypted_password is not null) as has_password
          from public.staff_profiles sp
          join auth.users u on u.id = sp.user_id
      `);
      return {
        total: userRows.length,
        active: userRows.filter((r) => r.is_active && r.has_password).length,
        invited: userRows.filter((r) => r.is_active && !r.has_password).length,
        disabled: userRows.filter((r) => !r.is_active).length,
      };
    });

    return { me, hiring, accounts };
  });

/* ------------------------------------------------------------------ *
 * Admin dashboard
 * ------------------------------------------------------------------ */

export type AdminOverview = {
  users: { total: number; active: number; invited: number; disabled: number };
  byRole: { role: string; count: number }[];
  applicants: { total: number; open: number; needsReview: number };
};

/** Counts for the admin dashboard. Admin only. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Only an Admin can view this dashboard.");

    const { asServiceRole } = await import("@/server/db");
    return asServiceRole(async (client) => {
      const { rows: userRows } = await client.query(`
        select sp.is_active,
               (u.encrypted_password is not null) as has_password
          from public.staff_profiles sp
          join auth.users u on u.id = sp.user_id
      `);
      const users = {
        total: userRows.length,
        active: userRows.filter((r) => r.is_active && r.has_password).length,
        invited: userRows.filter((r) => r.is_active && !r.has_password).length,
        disabled: userRows.filter((r) => !r.is_active).length,
      };

      const { rows: roleRows } = await client.query(`
        select role::text as role, count(*)::int as count
          from public.user_roles group by role order by role
      `);

      const { rows: appRows } = await client.query(`
        select
          count(*)::int as total,
          count(*) filter (where status not in ('hired','not_selected'))::int as open
        from public.applications
      `);
      const { rows: flagRows } = await client.query(`
        select count(*)::int as n from public.hr_review_flags where flag_status = 'Needs Review'
      `);

      return {
        users,
        byRole: roleRows as { role: string; count: number }[],
        applicants: {
          total: appRows[0].total,
          open: appRows[0].open,
          needsReview: flagRows[0].n,
        },
      };
    });
  });

/* ------------------------------------------------------------------ *
 * Staff invitations
 * ------------------------------------------------------------------ */

const DIRECTOR_EMAIL = "director@withelev8.com";

/** Where invitation and password-reset links land. */
function setPasswordUrl() {
  const base = (process.env['PUBLIC_SITE_URL'] ?? "https://www.withelev8.com").replace(/\/+$/, "");
  return `${base}/team-portal/set-password`;
}

/**
 * Sends the branded invite (new account) or password-reset (existing account)
 * email. Returns a plain description of the outcome so the caller can surface
 * a delivery problem (for example, DNS still verifying) instead of failing
 * silently.
 */
async function sendStaffInviteEmail(email: string, fullName: string) {
  const { upsertUser, issueToken } = await import("@/server/auth");
  const { sendInvite } = await import("@/server/mailer");

  // The account is created here rather than by the email provider, so the
  // caller always gets a user id back -- no directory lookup afterwards.
  const { user, created } = await upsertUser(email, fullName);
  const mode = created ? ("invite" as const) : ("recovery" as const);

  const token = await issueToken(user.id, mode);
  const link = `${setPasswordUrl()}?token=${encodeURIComponent(token)}`;

  const result = await sendInvite({ to: email, fullName, link, mode });

  if (result.delivered) {
    return { userId: user.id, sent: true as const, mode };
  }

  // Without SMTP the account still exists and the link is valid; it is simply
  // in the server log rather than an inbox. Say so plainly instead of
  // reporting a failure the administrator cannot act on.
  if (result.transport === "console") {
    return { userId: user.id, sent: true as const, mode, link, viaConsole: true as const };
  }

  return { userId: user.id, sent: false as const, mode, error: result.error };
}

/**
 * One-time bootstrap for the very first Admin. Runs only while no admin role
 * exists anywhere and only for the fixed director address, so it becomes a
 * no-op the moment the first Admin is in place.
 */
export const bootstrapDirectorAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { adminDb } = await import("@/server/admin");
  const admin = adminDb as unknown as LooseClient;

  const { data: existingAdmins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  if ((existingAdmins ?? []).length > 0) {
    return { created: false, sent: false, message: "An Admin account already exists." };
  }

  const result = await sendStaffInviteEmail(DIRECTOR_EMAIL, "Elev8 Director");

  // sendStaffInviteEmail creates the account itself, so the id is always known.
  const userId = result.userId;
  if (!userId) {
    return {
      created: false,
      sent: false,
      message: `The account could not be created: ${"error" in result ? result.error : "unknown error"}`,
    };
  }

  await admin
    .from("staff_profiles")
    .upsert(
      { user_id: userId, email: DIRECTOR_EMAIL, full_name: "Elev8 Director", is_active: true },
      { onConflict: "user_id" },
    );
  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });
  if (roleError && !/duplicate|unique/i.test(roleError.message)) throw new Error(roleError.message);

  return {
    created: true,
    sent: result.sent,
    message: result.sent
      ? `Admin account ready. A ${result.mode === "invite" ? "staff invitation" : "set-password"} email was sent to ${DIRECTOR_EMAIL}.`
      : `Admin account ready, but the email could not be sent yet: ${"error" in result ? result.error : "unknown error"}`,
  };
});

/**
 * Admin-only: invite a new staff member. The staff member receives the
 * branded invitation email and chooses their own password — no password is
 * ever set or seen by the administrator.
 */
export const inviteStaffWithLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().max(200).default(""),
        role: z.enum(ROLE_KEYS),
        /** Disabled creates the account without enabling it. */
        enabled: z.boolean().default(true),
        /** Whether to send the set-password link now. */
        sendInvitation: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Only an Admin can invite staff accounts.");
    const { adminDb } = await import("@/server/admin");
    const admin = adminDb as unknown as LooseClient;

    // Creating the account and sending the link are separate steps, so an
    // account can be prepared ahead of time and invited later.
    let userId: string;
    let invited = false;
    let inviteNote = "";

    if (data.sendInvitation) {
      const result = await sendStaffInviteEmail(data.email, data.fullName);
      if (!result.userId) {
        throw new Error(
          `The account could not be created: ${"error" in result ? result.error : "unknown error"}`,
        );
      }
      userId = result.userId;
      invited = result.sent;
      if (!result.sent) {
        inviteNote = ` The invitation email could not be sent: ${
          "error" in result ? result.error : "unknown error"
        }`;
      } else if ("viaConsole" in result && result.viaConsole) {
        inviteNote =
          " Email is not configured, so the invitation link was written to the server log.";
      }
    } else {
      const { upsertUser } = await import("@/server/auth");
      const created = await upsertUser(data.email, data.fullName);
      userId = created.user.id;
    }

    await admin
      .from("staff_profiles")
      .upsert(
        {
          user_id: userId,
          email: data.email,
          full_name: data.fullName,
          is_active: data.enabled,
        },
        { onConflict: "user_id" },
      );
    const { error: clearError } = await admin.from("user_roles").delete().eq("user_id", userId);
    if (clearError) throw new Error(clearError.message);
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleError && !/duplicate|unique/i.test(roleError.message)) throw new Error(roleError.message);

    const message = !data.enabled
      ? `Account created for ${data.email} and left disabled.${inviteNote}`
      : invited
        ? `Invitation sent to ${data.email}. They can set their own password from the email link.${inviteNote}`
        : `Account created for ${data.email}. No invitation was sent yet.${inviteNote}`;

    return { userId, message };
  });

/** Admin-only: re-send the invitation / set-password email to a staff member. */
export const resendStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as LooseClient;
    const roles = await requireStaff(supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Only an Admin can re-send invitations.");

    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("email, full_name")
      .eq("email", data.email)
      .maybeSingle();
    if (!profile) throw new Error("That email does not belong to a staff account.");

    const result = await sendStaffInviteEmail(
      data.email,
      (profile as { full_name?: string }).full_name ?? "",
    );
    if (!result.sent) {
      throw new Error(
        `The email could not be sent: ${"error" in result ? result.error : "unknown error"}`,
      );
    }
    return { ok: true, mode: result.mode };
  });
