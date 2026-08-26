/**
 * Convex Schema - Zephyra Admin Dashboard
 *
 * Este archivo define el schema completo para el dashboard de administración.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // ADMIN USERS
  // ============================================
  adminUsers: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("superadmin"), v.literal("admin")),
    avatarStorageId: v.optional(v.id("_storage")),
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // PASSWORD RESET TOKENS
  // ============================================
  passwordResetTokens: defineTable({
    adminUserId: v.id("adminUsers"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenHash"])
    .index("by_user", ["adminUserId"]),

  // ============================================
  // BLOG POSTS
  // ============================================
  blogPosts: defineTable({
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    content: v.string(), // HTML from WYSIWYG
    coverStorageId: v.optional(v.id("_storage")),
    authorId: v.id("teamMembers"),
    status: v.union(v.literal("draft"), v.literal("published")),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_status_published", ["status", "publishedAt"])
    .index("by_author", ["authorId"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // TEAM MEMBERS
  // ============================================
  teamMembers: defineTable({
    name: v.string(),
    role: v.string(), // e.g., "Cofundadora", "Consultora"
    specialty: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imagePositionX: v.optional(v.number()),
    imagePositionY: v.optional(v.number()),
    displayOrder: v.number(),
    isVisible: v.boolean(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_visible_order", ["isVisible", "displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // PROJECTS
  // ============================================
  projects: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    excerpt: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    displayOrder: v.number(),
    isFeatured: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["displayOrder"])
    .index("by_featured", ["isFeatured", "displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // PROJECT ACHIEVEMENTS
  // ============================================
  projectAchievements: defineTable({
    projectId: v.id("projects"),
    description: v.string(),
    displayOrder: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_order", ["projectId", "displayOrder"]),

  // ============================================
  // SERVICE BLOCKS
  // ============================================
  serviceBlocks: defineTable({
    title: v.string(),
    subtitle: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    displayOrder: v.number(),
    isActive: v.boolean(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_active_order", ["isActive", "displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // SERVICES
  // ============================================
  services: defineTable({
    title: v.string(),
    description: v.string(),
    iconName: v.string(), // Material Icon name
    displayOrder: v.number(),
    isActive: v.boolean(),
    blockId: v.optional(v.id("serviceBlocks")),
    blockDisplayOrder: v.optional(v.number()),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_active_order", ["isActive", "displayOrder"])
    .index("by_deleted", ["deletedAt"])
    .index("by_block", ["blockId"])
    .index("by_block_order", ["blockId", "blockDisplayOrder"]),

  // ============================================
  // CLIENTS
  // ============================================
  clients: defineTable({
    name: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.optional(v.string()),
    displayOrder: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // ALLIANCES
  // ============================================
  alliances: defineTable({
    name: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.optional(v.string()),
    displayOrder: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // NEWSLETTER SUBSCRIBERS
  // ============================================
  newsletterSubscribers: defineTable({
    email: v.string(),
    subscribedAt: v.number(),
    isActive: v.boolean(),
    unsubscribedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_active", ["isActive"])
    .index("by_subscribed", ["subscribedAt"]),

  // ============================================
  // LMS — Sprint 0 subset (PDD v1.3 §6.3)
  // All LMS tables are prefixed `lms*` to namespace them against the
  // institutional tables above. Additive change only — institutional
  // tables are untouched. Full aggregate set lands in Sprint 1.
  // ============================================

  // Course aggregate. One row per ingested SCORM course.
  // CAMPUS does not reversion: an updated course = new campusCourseId = new row.
  lmsCourses: defineTable({
    campusCourseId: v.string(), // unique — provider identifier
    title: v.string(),
    slug: v.string(),
    // E03: admin-editable presentation copy. Optional because legacy Sprint-0
    // rows have neither, and the public catalog renders gracefully without.
    description: v.optional(v.string()),
    coverStorageId: v.optional(v.id("_storage")),
    // T-04 (Split-4 M-HOME, spec §4): closed taxonomy — five slugs, enum in
    // code, not an editable table (SPEC-HOME-ACADEMIA-2026-08-26.md §4.1).
    // Optional and additive: existing rows have no topic and are not
    // backfilled — Zephyra assigns it by hand from the panel, after ingest.
    // A course with no topic still lists in /cursos; it just surfaces under
    // no chip (spec §4.2). Never touched by ingestScormPackage (spec §4.3).
    topic: v.optional(
      v.union(
        v.literal("diversidad-inclusion"),
        v.literal("liderazgo"),
        v.literal("sostenibilidad"),
        v.literal("cultura-organizacional"),
        v.literal("comunicacion")
      )
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    scormStorageId: v.optional(v.id("_storage")), // original zip (optional)
    scoFiles: v.optional(v.any()), // map: relative path -> Id<"_storage">
    manifest: v.optional(v.string()), // parsed imsmanifest.xml (serialized)
    scoStructure: v.optional(v.any()), // organizations + items + resources
    entryPoint: v.optional(v.string()), // launch resource path
    // Sprint 2 (Sales / Checkout B2C): pricing surface. priceUsd is ALWAYS USD
    // (SDD §9.4 — MercadoPago converts to ARS at checkout). Optional because
    // legacy Sprint-0/1 rows predate pricing; the catalog CTA gates on
    // `isPurchasable` so an un-priced course never exposes a "Comprar" path.
    priceUsd: v.optional(v.number()),
    currency: v.optional(v.string()), // reserved; defaults to "USD" semantics
    isPurchasable: v.optional(v.boolean()), // gates the public buy CTA
    createdAt: v.number(),
    updatedAt: v.number(),
    // E03: set when a row is archived because a new ingest of the same
    // campusCourseId superseded it. PDD §6.3 invariant — existing
    // lmsEnrollments stay pointed at this archived row.
    archivedAt: v.optional(v.number()),
    // Soft delete (repo convention)
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_campus_course_id", ["campusCourseId"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    // T-04: serves "published courses of topic X" (home chips + /cursos?tema=).
    // Compound on [status, topic] rather than a lone `by_topic` — every
    // consumer of this index filters on status first (only published courses
    // are ever shown under a chip), so a standalone topic index would just
    // be a strict subset of this one's leading field.
    // Correction of record: this index IS prefix-redundant with `by_status`
    // above — Convex serves any query over an index's fields prefix, so
    // `by_status_topic` alone could already answer listPublished's "all
    // published, any topic" (lms/courses.ts:31). Both are kept deliberately:
    // repointing listPublished mid-sprint carries more risk than one extra
    // index write costs, and this repo already made that same call for
    // `blogPosts` (`by_status` + `by_status_published`, lines 62-63, same
    // file) — this pair follows that precedent, not an exception to it.
    // Cleanup candidate, post-go-live, not this sprint: retire
    // `lmsCourses.by_status` and move `listPublished` onto `by_status_topic`.
    .index("by_status_topic", ["status", "topic"])
    .index("by_deleted", ["deletedAt"]),

  // Enrollment aggregate. D01 promoted learnerId from a v.string() placeholder
  // to Id<"lmsCustomers"> now that learner identity exists (Sprint 1 C). The
  // real seat-claim flow (lmsSeats + claimRequest aggregates) lands in Sprint 2.
  lmsEnrollments: defineTable({
    // Sprint 3a: a claimed seat (lmsSeats._id, stringified) owns at most one
    // enrollment — enforced via the UNIQUE `by_seat` index below (app-enforced
    // single-row-per-seatId on claim, Convex indexes are not unique-constrained).
    seatId: v.optional(v.string()),
    learnerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("expired")
    ),
    claimRequestId: v.optional(v.string()), // Sprint 1: claim idempotency
    startedAt: v.optional(v.number()),
    firstTouchedAt: v.optional(v.number()), // engagement signal
    expiresAt: v.optional(v.number()),
    // Projected from lmsScormEvents (Phase D).
    // D02: aggregate now reflects the COURSE across all SCOs.
    // - progressPercent = floor(completedScoCount / course.scoStructure.scos.length × 100)
    // - lessonStatus    = "completed" iff all SCOs completed, "passed" if all ≥ passed, else "incomplete"
    // - suspendData     = latest-touched SCO's suspend_data (legacy single-SCO consumer compat;
    //                     per-SCO suspend_data lives in scoStates[scoId].suspendData)
    progressPercent: v.number(),
    scoreRaw: v.optional(v.number()),
    lessonStatus: v.optional(v.string()),
    suspendData: v.optional(v.string()),
    // D02 — denormalized counter (Q5 lock). MUST be re-derived inside
    // recordScormEvent on every event so it never drifts from scoStates.
    completedScoCount: v.number(),
    // D02 — per-SCO state map: { [scoId: string]: { lessonStatus, scoreRaw?, suspendData?, completedAt? } }.
    // WHY v.any(): Sprint 1 accepts a loose shape; a v.object() schema can land
    // in Sprint 2 once the SCO state surface is stable. WHY NOT denormalize
    // totalScos here: courses can be re-ingested with a different SCO count
    // (PDD §6.3 archive-on-duplicate) — course row is the single source of
    // truth, dereferenced via courseId on each event.
    scoStates: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_learner", ["learnerId"])
    .index("by_learner_course_status", ["learnerId", "courseId", "status"])
    .index("by_claim_request", ["claimRequestId"])
    // Sprint 3a UNIQUE (app-enforced): one enrollment per claimed seat.
    .index("by_seat", ["seatId"]),

  // SCORM event log — append-only audit trail. Never updated or deleted.
  lmsScormEvents: defineTable({
    enrollmentId: v.id("lmsEnrollments"),
    timestamp: v.number(),
    element: v.string(), // e.g. cmi.core.lesson_status, cmi.core.score.raw
    value: v.string(), // raw value sent by the content
    commitId: v.optional(v.string()), // groups SetValue calls of one Commit
  })
    .index("by_enrollment", ["enrollmentId"])
    .index("by_enrollment_timestamp", ["enrollmentId", "timestamp"])
    .index("by_commit", ["commitId"]),

  // ============================================
  // LMS — Sprint 1 additions (PDD v1.3 §6.3 + §7.5)
  // Learner identity + magic-link tokens. Additive only.
  // ============================================

  // Learner / customer aggregate. Three subtypes — individual buyer,
  // organization admin, organization-managed learner. Magic-link is the
  // primary auth path; passwordHash is optional and only present once a
  // learner opts in to set one.
  lmsCustomers: defineTable({
    email: v.string(), // lowercased
    type: v.union(
      v.literal("individual"),
      v.literal("org_admin"),
      v.literal("org_learner")
    ),
    passwordHash: v.optional(v.string()), // argon2id encoded string; absent until learner opts to set
    // Sprint 3a TYPED MIGRATION: narrowed v.optional(v.string()) (Sprint-1
    // placeholder) → v.optional(v.id("lmsOrganizations")) now that the org
    // aggregate exists. Verified safe @ e71dfa3: all 4 live customers are
    // type "individual" with NO organizationId set (zero non-null values),
    // so no backfill is required. Set for org_admin / org_learner rows.
    organizationId: v.optional(v.id("lmsOrganizations")),
    activatedAt: v.optional(v.number()), // set on first successful magic-link consume
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
    // Soft delete (repo convention).
    // Learners NEVER appear as deletedBy in ANY row (PDD H-2 mitigation):
    // self-initiated Habeas Data deletions are processed by an admin, who
    // is the recorded actor.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_email", ["email"])
    .index("by_type", ["type"])
    .index("by_organization", ["organizationId"])
    .index("by_deleted", ["deletedAt"]),

  // Magic-link tokens. Opaque random tokens stored as HMAC-SHA-256 of the
  // raw token (NOT argon2id — argon2id is the wrong tool for opaque random
  // tokens; it burns CPU for no security gain). Single-use: `usedAt` is
  // stamped on consume. TTL is enforced in the consume mutation, not the
  // schema (30min for activation, 15min for signin/recovery).
  lmsMagicLinkTokens: defineTable({
    email: v.string(), // lowercased — may not yet be an lmsCustomers row (activation creates it on consume)
    tokenHash: v.string(), // HMAC-SHA-256(rawToken, MAGIC_LINK_HMAC_KEY)
    purpose: v.union(
      v.literal("learner_activation"),
      v.literal("learner_signin"),
      v.literal("learner_recovery"),
      // B2B seat-claim invite. A dedicated purpose (NOT a reused
      // "learner_activation") so the B2C consume path and the seat-claim path
      // can never honor each other's tokens (cross-purpose escalation guard).
      v.literal("seat_invite")
    ),
    // Bound ONLY for purpose "seat_invite": the pack the invite grants a seat
    // in. Verified at claim time so an invitee cannot redeem against a
    // different pack of the same org by editing the URL (cross-pack guard).
    seatPackId: v.optional(v.id("lmsSeatPacks")),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
    createdFromIp: v.optional(v.string()), // forensic, optional
  })
    .index("by_token", ["tokenHash"])
    .index("by_email_purpose", ["email", "purpose"])
    .index("by_expires", ["expiresAt"]),

  // ============================================
  // LMS — Sprint 2 additions (Sales / Checkout B2C)
  // Money-path data model. B2C individual checkout only (packs/seats
  // deferred to Sprint 3). PaymentProvider abstraction from day 1
  // (SDD §3.4). Additive only — institutional + prior LMS tables untouched.
  // ============================================

  // Order aggregate. One row per B2C checkout intent. `externalReference`
  // is the orderId echoed by MercadoPago on the webhook, the bridge from a
  // raw MP payment back to our order. Soft-delete discipline applies even
  // though orders are rarely deleted; learners NEVER appear as `deletedBy`
  // (admin-initiated only).
  lmsOrders: defineTable({
    customerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
    // For a "pack" order this holds the SERVER-COMPUTED pack total
    // (= seatCount × unitPriceUsd × (1 − appliedDiscountPct/100)); for a
    // "b2c" order it is the single-course price. Always USD (SDD §9.4).
    priceUsd: v.number(),
    status: v.union(
      v.literal("pending_payment"),
      v.literal("paid"),
      v.literal("cancelled"),
      v.literal("failed")
    ),
    mpPreferenceId: v.optional(v.string()), // MercadoPago preference ID
    externalReference: v.string(), // orderId echoed by the MP webhook
    // --- Sprint 3a additions (Sales Pack / Org checkout). ALL optional. ---
    // ABSENT orderType ⇒ treat as "b2c" (default-b2c semantics in code). The
    // seat-mint branch in convex/lms/payment/internal.ts (APPROVED block)
    // branches on this field; recordRevenueShare + buyer email stay common.
    orderType: v.optional(v.union(v.literal("b2c"), v.literal("pack"))),
    organizationId: v.optional(v.id("lmsOrganizations")), // set only for pack orders
    seatCount: v.optional(v.number()), // pack: number of seats purchased
    unitPriceUsd: v.optional(v.number()), // pack: per-seat list price (USD) before discount
    appliedDiscountPct: v.optional(v.number()), // pack: volume-tier discount applied (0–100)
    createdAt: v.number(),
    updatedAt: v.number(),
    // Soft delete (repo convention). Admin-initiated only.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_learner_course_status", ["customerId", "courseId", "status"])
    .index("by_external_reference", ["externalReference"])
    // Supports reuse of an open `pending_payment` pack order on retry
    // (lookup an existing unpaid pack for the same org+course before creating).
    .index("by_org_course_status", ["organizationId", "courseId", "status"])
    .index("by_deleted", ["deletedAt"]),

  // Payment aggregate. One row per MercadoPago payment. `mpPaymentId` carries
  // a UNIQUE index — the idempotency backstop on duplicate webhook deliveries
  // (Phase P0 money-path core dedupes on it before mutating). `webhookEventLog`
  // is an append-only forensic trail of every event touching this payment.
  lmsPayments: defineTable({
    orderId: v.id("lmsOrders"),
    mpPaymentId: v.string(), // UNIQUE (see by_mp_payment_id) — idempotency on duplicate webhooks
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled")
    ),
    grossArs: v.optional(v.number()), // amount MP charged (ARS, after FX from USD)
    usdAmount: v.number(), // original USD amount from the Order
    webhookEventLog: v.array(
      v.object({
        eventType: v.string(), // "webhook_received" | "signature_verified" | "state_fetched" | "approved" | "rejected" | ...
        payload: v.any(), // full event payload
        timestamp: v.number(),
      })
    ),
    lastVerifiedAt: v.number(), // last time fetchPaymentState was called
    createdAt: v.number(),
    // Soft delete (repo convention). Admin-initiated only.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    // UNIQUE backstop — application must enforce single-row-per-mpPaymentId on
    // insert (Convex indexes are not unique-constrained); the dedupe query in
    // the webhook handler reads this index first.
    .index("by_mp_payment_id", ["mpPaymentId"])
    .index("by_order_id", ["orderId"])
    .index("by_deleted", ["deletedAt"]),

  // Revenue-share ledger. One row per approved payment. 80/20 split locked
  // (SDD §3.3): c14CutUsd = 20% of grossUsd, zephyraCutUsd = 80%. `payoutId`
  // is null until reconciled in the manual monthly payout (Opción B).
  lmsRevenueShares: defineTable({
    paymentId: v.id("lmsPayments"),
    grossUsd: v.number(),
    grossArs: v.number(),
    mpFees: v.optional(v.number()), // parsed from MP fee_details if present (null OK)
    c14CutUsd: v.number(), // 20% of grossUsd
    zephyraCutUsd: v.number(), // 80% of grossUsd
    period: v.string(), // YYYY-MM
    payoutId: v.optional(v.string()), // null until reconciled (manual monthly payout)
    createdAt: v.number(),
    // Soft delete (repo convention). Admin-initiated only.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_period", ["period"])
    .index("by_payment_id", ["paymentId"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // LMS — Sprint 3a additions (Sales Pack + Org Admin — revenue spine)
  // B2B seat-pack model. An organization buys a pack of seats for ONE course;
  // its single Owner Admin claims seats to learners. Additive only — all
  // institutional + prior LMS tables keep their existing shape (the lone
  // exception is the documented type-narrow of lmsCustomers.organizationId,
  // safe because no orgs existed before this sprint).
  // ============================================

  // Organization aggregate. One row per buyer organization.
  // MODELING DECISION (diverges from the SDD draft): the draft proposed
  // `adminCustomerIds: Id[]` (an array of admins). Commercial §9.1 LOCKS a
  // SINGLE Owner Admin with no role matrix, so we model a single
  // `ownerCustomerId` instead — cleaner, matches the lock, and avoids a
  // premature N-N. (Re-introducing multi-admin later is itself additive.)
  lmsOrganizations: defineTable({
    name: v.string(),
    taxId: v.optional(v.string()), // CUIT/tax id — optional at creation
    ownerCustomerId: v.id("lmsCustomers"), // the single Owner Admin (org_admin)
    createdAt: v.number(),
    // Soft delete (repo convention). Admin-initiated only.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  }).index("by_owner", ["ownerCustomerId"]),

  // Seat-pack aggregate. One pack = one paid pack order = one course.
  // INVARIANT (enforced transactionally in mutations on every mint/claim/release):
  //   availableSeats + claimedSeats ≤ totalSeats.
  // MINT IDEMPOTENCY: exactly one pack (+ its lmsSeats rows) is created per
  // paid order, keyed on orderId — lookup-via `by_order` BEFORE insert; the
  // lmsPayments.mpPaymentId UNIQUE index is the upstream webhook backstop.
  lmsSeatPacks: defineTable({
    orderId: v.id("lmsOrders"),
    organizationId: v.id("lmsOrganizations"),
    courseId: v.id("lmsCourses"), // one pack grants seats for exactly one course
    totalSeats: v.number(),
    availableSeats: v.number(), // unclaimed pool
    claimedSeats: v.number(), // currently held by a learner
    validFrom: v.number(),
    // VESTIGIAL / nullable: licenses are vitalicias (no expiration) in V1.
    // Kept nullable so a future expiring-license SKU is an additive change,
    // not a migration. Always null when minted today. (ADR-0013.)
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    // UNIQUE (app-enforced) — the mint-idempotency lookup key.
    .index("by_order", ["orderId"])
    .index("by_organization", ["organizationId"]),

  // Seat aggregate. One row per seat in a pack. Lifecycle is a STATUS change,
  // never a soft-delete: release returns a seat to the `available` pool. There
  // is deliberately NO "expired" status in V1 (licenses are vitalicias).
  // The releasing actor is an org_admin (lmsCustomers), not adminUsers — which
  // is exactly why release ≠ deletedBy soft-delete.
  lmsSeats: defineTable({
    seatPackId: v.id("lmsSeatPacks"),
    status: v.union(
      v.literal("available"),
      v.literal("claimed"),
      v.literal("released") // released back to the pool; re-claimable
    ),
    claimedBy: v.optional(v.id("lmsCustomers")), // the org_learner holding it
    claimedAt: v.optional(v.number()),
    // CLAIM IDEMPOTENCY: claimSeat looks up by_claim_request BEFORE inserting.
    claimRequestId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_seatpack_status", ["seatPackId", "status"])
    .index("by_claim_request", ["claimRequestId"]),

  // Progress-consent gate (PRIVACY). Nominal (named) learner progress is
  // reachable by an org admin ONLY when a row here exists with granted: true
  // for the (learner, org) pair. courseId is optional: absent ⇒ org-wide
  // consent; present ⇒ scoped to one course. The backend MUST check this on
  // every nominal-progress read path.
  lmsProgressConsents: defineTable({
    learnerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
    courseId: v.optional(v.id("lmsCourses")), // null ⇒ org-wide consent
    granted: v.boolean(),
    grantedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  }).index("by_learner_org", ["learnerCustomerId", "organizationId"]),

  // Volume-discount tier config. Lets Zephyra tune discount bands WITHOUT a
  // code change. Seed bands (seeded by the backend; SDD commercial §9.x):
  //   1–9   → 0%,  selfCheckout: true
  //   10–24 → 10%, selfCheckout: true
  //   25–49 → 20%, selfCheckout: true
  //   50+   → custom, selfCheckout: false ("Contactanos")
  // maxSeats null = open-ended (the top band). Server is authoritative on
  // which tier applies to a given seatCount.
  lmsVolumeDiscountTiers: defineTable({
    minSeats: v.number(),
    maxSeats: v.optional(v.number()), // null = open-ended top band
    discountPct: v.number(), // 0–100
    selfCheckout: v.boolean(), // false ⇒ "Contactanos" (no self-serve)
    createdAt: v.number(),
  }).index("by_min_seats", ["minSeats"]),
});
