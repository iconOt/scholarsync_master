# AGENTS.md — ScholarSync Master (Platform Layer)

This file is the single source of context an AI coding agent should read before implementing or making any architectural decision on the **Master/Platform layer**. Read the sections in order.

> **This is a companion document to the Tenant layer's `AGENTS.md`, not a replacement for it.** ScholarSync is two separate systems (see [Platform Layering](#2-architecture-context)). This file describes **Master only** — the internal system ScholarSync's own team uses to onboard schools, track platform revenue, and govern the platform. It is not a school-facing product; no proprietor, teacher, parent, or student ever logs into this system. If a request is about anything a school's own staff or families would use, it belongs in the Tenant repo, not here.

> **Assumptions made while drafting this** — the Tenant layer's stack and decisions were used as the starting point for consistency, since Master needs to interoperate with it natively (Service Bindings, Queues, KV). Update anything below that isn't actually what you want:
> - **Stack**: Cloudflare Workers + Hono + Drizzle + TypeScript, same as Tenant — chosen so Master↔Tenant communication (Service Bindings, Queues, KV) is native rather than cross-platform, and so there's one shared engineering pattern instead of two.
> - **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui, deployed to Cloudflare Pages — same stack as Tenant, but this is an **internal admin console for ScholarSync staff**, not a customer-facing product, so its design priorities are different (see [UI Context](#3-ui-context)).
> - **Database**: Master's own data lives in a dedicated schema (e.g. `master`) inside the **same shared Supabase Postgres instance** the Tenant layer already uses — not a second Supabase project. Master additionally holds elevated Postgres credentials so it can run the DDL that creates a new tenant schema during onboarding. This is a real security-relevant decision — see [Provisioning Model](#provisioning-model) and [Invariants](#invariants).
> - **Storage**: Master reuses the **same R2 bucket** as Tenant, under its own reserved key prefix (e.g. `_master/...`), rather than a second bucket — consistent with the prefix-isolation pattern already chosen for schools.
> - **Auth**: a separate custom JWT system for ScholarSync's own internal staff, with its own user table in the `master` schema — entirely disconnected from any tenant's user table or any school's Super Admin login.
> - **Staff roles**: a starting role set is proposed below — not yet confirmed by you.
> - **MFA**: confirmed as required for every Master staff account from day one — not deferred the way it is in Tenant Phase 1.

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Context](#2-architecture-context)
3. [UI Context](#3-ui-context)
4. [Code Standards](#4-code-standards)
5. [AI Workflow Rules](#5-ai-workflow-rules)
6. [Progress Tracker](#6-progress-tracker)

Update the **Progress Tracker** section after each meaningful implementation change. If implementation changes the architecture, scope, or standards documented here, update the relevant section before continuing.

---

## 1. Project Overview

### ScholarSync Master

ScholarSync Master is the internal platform-governance system behind ScholarSync. It's used exclusively by ScholarSync's own team — never by a school, a proprietor, a teacher, or a family. Its job is everything that has to happen *before* a school can use the Tenant product, everything that spans *across* schools once they're live, and everything involved in *running ScholarSync as a business* on top of the platform it operates.

Where the Tenant layer answers "how does one school run itself," Master answers "how does ScholarSync run every school."

### Goals

1. Onboard a new school completely and reliably — subdomain, Postgres schema, R2 prefix allocation — as one coherent, resumable process, not a fragile manual checklist.
2. Give ScholarSync accurate, real-time visibility into its own platform-wide billing — what every school owes, based on active student counts — without ever needing to query a tenant's own schema directly.
3. Govern the platform: suspend or reinstate a school (including for non-payment of ScholarSync's own invoice), manage ScholarSync's own internal staff accounts and what each of them is allowed to do.
4. Serve as the Tenant layer's dependency-light source of truth for tenant configuration — fast enough to sit in Tenant's hot path (via KV), resilient enough that Tenant keeps working even if Master has a bad day.
5. Own the Billing Engine: generate each school's termly invoice from its active-student count, track billing history and outstanding invoices, and give ScholarSync one place this logic lives instead of scattered across every Tenant instance.
6. Be the natural home for any future cross-school capability (e.g. a multi-campus owner view), even though building that is explicitly deferred for now (see Tenant's `AGENTS.md`, Architecture Decisions).

### Core User Flow

*(The "user" here is always a ScholarSync staff member, not a school.)*

1. Staff logs into the Master admin console with their own internal ScholarSync credentials.
2. Staff onboards a new school: enters the school's name, desired subdomain slug, and the proprietor's contact info.
3. Master runs the onboarding workflow: validates the subdomain, provisions the tenant's Postgres schema (running the Tenant layer's migrations against it), and registers the school's R2 key-prefix.
4. Master writes the resulting config to Cloudflare KV, where the Tenant layer will read it on every request for that school.
5. Master seeds the new schema's first row: the proprietor's Super Admin account, then sends them their subdomain and initial login.
6. Ongoing: Master consumes usage/billing metrics streamed from every live Tenant instance — most importantly each school's current active-student count — and keeps them current for billing and operational dashboards.
7. Ongoing, once per academic term: the Billing Engine generates each school's invoice (active students × price per student) from that synced data, and tracks whether it's been paid.
8. Ongoing: staff can suspend or reinstate a school — including for non-payment of ScholarSync's own invoice — which the Tenant layer reflects on its very next request via KV.

### Features

**Staff Authentication & Identity**
- Secure login, logout, password reset, session management for ScholarSync's own internal team
- Confirmed: MFA is required for every Master staff account, no exceptions — a compromised Master account can affect every school, not just one
- Account lockout protection, login/session audit logging

**Staff Roles & Permissions** *(confirmed set)*
- **Master Super Admin** — full access; the only role that can create other Master staff accounts
- **Onboarding Staff** — can run the school-onboarding workflow, cannot touch revenue data or suspend a school
- **Finance/Revenue Staff** — reconciles incoming bank transfers against schools' outstanding ScholarSync invoices, marks invoices paid, and has authority to deactivate (and reinstate) a school specifically for non-payment of its ScholarSync invoice, per Billing Engine enforcement — this is a narrower suspend authority than Support Staff's, scoped only to billing default, not general policy/compliance suspensions. Cannot run the onboarding workflow. *(Renamed from "Finance/Revenue Viewer" — the manual bank-transfer reconciliation workflow this billing model requires makes "read-only" inaccurate; this role does real reconciliation work and needs the authority to act on what it finds.)*
- **Support Staff** — can view a school's status and provisioning details, can suspend/reinstate for non-billing reasons (policy violation, proprietor request, technical issue), cannot see revenue figures or reconcile invoices
- **Customer Care** — handles complaints and support requests raised by schools directly with ScholarSync (billing questions, technical issues, onboarding help, feature requests). Can view and respond to complaint tickets and the minimal school context needed to handle them (school name, status, contact info), but has no access to billing/revenue figures or suspend/reinstate authority — this is a response/resolution role, not an account-governance one. See [Complaint & Support Ticket Management](#complaint--support-ticket-management) below.
- Feature-level permission control, same philosophy as Tenant's role system — don't hardcode a permission check to a role name, check the permission

**Complaint & Support Ticket Management**
- Logs complaints/support requests **from schools directed at ScholarSync itself** — a proprietor or Administrator raising a billing question, a technical problem, or a feature request with ScholarSync. This is explicitly not a general inbox for parent/teacher complaints about a school — those stay inside that school's own Communication Hub in the Tenant layer, where they belong; Master doesn't get visibility into family-level communication (see the tenant-data boundary in [Invariants](#invariants)).
- Ticket lifecycle: Open → In Progress → Resolved, assignable to a Customer Care staff member, with a visible history of responses.
- Responses go out through Resend (email) and/or WhatsApp — reusing the same channel infrastructure pattern as the Tenant layer's own Communication Hub, not a new messaging system.
- **Whether this should also cover complaints escalated by end-users (parents/teachers) that a school forwards upward to ScholarSync is an open question** — if that's needed, it requires careful scoping so Customer Care staff only see what's necessary to resolve that specific escalation, not a general window into that school's internal communications (see Open Questions).

**School Onboarding**
- Subdomain validation (format, uniqueness) and reservation
- Tenant Postgres schema creation, with the Tenant layer's current migration set applied automatically — a new school starts on the same schema version as every other live school, never behind
- R2 key-prefix registration for the new `schoolId` (no actual storage action required — R2 needs no bucket-level setup, this is purely a config entry)
- Writes final config to Cloudflare KV: subdomain → `schoolId`, schema name, R2 prefix, enabled-module flags, active/suspended status
- Seeds the new schema's first row (the proprietor's Super Admin account) and sends them their login
- **The whole workflow is a resumable, step-tracked process, not a single all-or-nothing action** — see [Provisioning Model](#provisioning-model) for why this matters

**School Lifecycle Management**
- Suspend a school (e.g. non-payment of ScholarSync's own invoice, policy violation, proprietor request) — flips status in KV, which the Tenant layer reads on its next request and responds with a clear "school suspended" state rather than silently failing
- Reinstate a suspended school
- Offboarding/churn handling, with its own defined data-retention policy distinct from suspension — see [Churn & Data Retention Model](#churn--data-retention-model)

**Billing Engine**
- **This is ScholarSync's own revenue mechanism — how ScholarSync gets paid by schools, entirely separate from how a school's families pay that school** (which Master has no visibility into at all; see [Invariants](#invariants)).
- Consumes active-student-count and usage-metric updates streamed from every Tenant instance's Cloudflare Queue (see [Platform Layering](#2-architecture-context)) — this is the data the Billing Engine runs on.
- **Generates a termly invoice per school**: Active Students × Price Per Student (currently ₦900, configurable platform-wide by ScholarSync — not by any individual school). Continuously recalculates the *expected* invoice as a school's active count changes through the term, so the number shown is never a stale end-of-term surprise, even though the actual invoice is only formally issued once per term.
- **Maintains billing history** per school — every past invoice, amount, and payment status.
- **Tracks outstanding invoices** — which schools haven't paid, and for how long.
- **Generates invoice PDFs** for each termly bill.
- **Revenue analytics** — ScholarSync's own platform-wide revenue, by school, by term, by month — this is Master's real "how is the business doing" view, and it's derived entirely from the Billing Engine's own invoices, never from the usage-metric numbers a Tenant reports (see the distinction in [Billing Engine Model](#billing-engine-model) and the corresponding invariant).
- **Payment status monitoring** — has this school's current invoice been paid — and **billing reports** for Finance/Revenue Staff.
- **Enforcement**: if a school's invoice goes unpaid past a defined grace period, Finance/Revenue staff (or an automated rule, see Open Questions) can deactivate the school — reusing the exact same suspend mechanism in School Lifecycle Management above, not a separate enforcement path. Reactivating once paid uses the same reinstate mechanism.

**Audit Logging**
- Every provisioning action, suspension/reinstatement, staff account change, and invoice generation/status change is logged with who did it (or that it was an automated rule) and when — this system holds elevated privileges (see [Invariants](#invariants)), so its own actions need to be at least as auditable as anything it enforces on the Tenant side

### Scope

**In Scope**
- Onboarding a new school end-to-end (subdomain, schema, R2 prefix, KV config)
- The Billing Engine: termly invoice generation from active-student counts, billing history, outstanding-invoice tracking, and ScholarSync's own platform-wide revenue analytics
- School suspension/reinstatement, including for non-payment of ScholarSync's own invoice
- ScholarSync's own internal staff accounts and permissions
- Serving as the Tenant layer's config source of truth via KV, and its Service Binding fallback

**Explicitly NOT this system's job**
- Any day-to-day school operation — attendance, assessment, fees collection, messaging, everything a proprietor/teacher/family actually uses. That's the Tenant layer, entirely.
- **How a school's own families pay that school.** ScholarSync is not a payment gateway or financial intermediary — schools collect fees directly, by whatever method they use, and Master has no visibility into or involvement in that money at all. Master only knows a school's *active student count*, which drives what the school owes *ScholarSync*, a completely separate transaction.
- Reading or displaying a specific student's, teacher's, or family's data. Master's business is schools as accounts, not the people inside them — the one exception is the minimal seed data needed to create a school's first Super Admin row during onboarding.
- A multi-campus owner-facing view. Deliberately deferred (see Tenant's `AGENTS.md`, Architecture Decisions) — revisit only if a real multi-school proprietor need shows up.

**Out of Scope (for now)**
- Anything not explicitly listed above

### Success Criteria

1. A staff member can onboard a new school from a single workflow, ending with a working subdomain and a provisioned schema on the current migration version — with no manual step performed outside this system.
2. If onboarding fails partway (e.g. R2 prefix registration fails after the schema was already created), the school is left in a clearly-flagged incomplete state that can be resumed or retried — never a silent, half-provisioned school that looks "active" but isn't fully working.
3. The Billing Engine's active-student count for each school reflects reality even if a Queue message is redelivered or arrives out of order — never double-counted or stale.
4. Each school's termly invoice is calculated correctly (active students × price per student) and available as a downloadable PDF, with billing history and outstanding-invoice status accurately tracked over time.
5. Suspending a school — for any reason, including non-payment of ScholarSync's own invoice — takes effect on that school's very next request, with no code path that lets a suspended school keep operating normally.
6. Master never reads or writes a tenant schema's business data (student records, grades, messages, fee details) — its only tenant-schema touch is the one-time Super Admin seed row at onboarding. It also never has visibility into how a school's families pay that school.
7. A Customer Care staff member can log, track, and resolve a school's complaint/support ticket end to end, with visibility limited to that school's account-level context — never a window into that school's internal family/teacher communications.
8. A churned school can be reactivated in full within the archive window with no re-onboarding required, can export its complete data during that window, and is permanently and irreversibly deleted only after the window closes.

---

## 2. Architecture Context

### Stack

| Layer               | Technology                                | Role |
| --------------------- | ------------------------------------------ | ---- |
| Frontend             | React + Vite + TypeScript + Tailwind + shadcn/ui | Internal admin console for ScholarSync staff only |
| Frontend hosting      | Cloudflare Pages                          | Serves the internal admin console |
| Backend/API           | Cloudflare Workers + Hono                 | Onboarding workflow, revenue ingestion, staff auth, Tenant-facing Service Binding responder |
| ORM                   | Drizzle                                   | Master's own `master` schema, plus the DDL that provisions new tenant schemas |
| Database              | PostgreSQL on **Supabase** — same shared instance as Tenant, Master's own `master` schema, with elevated credentials for tenant-schema DDL | Platform governance data: school registry, revenue ledger, staff accounts, audit log |
| File/media storage    | Cloudflare R2 — same bucket as Tenant, reserved `_master/...` prefix | Any Master-owned documents/exports |
| School billing collection | Bank transfer into ScholarSync's own account(s), manually reconciled by Finance/Revenue Staff | How a school actually pays ScholarSync's termly invoice — no payment gateway involved |
| Email                 | Resend                                    | Staff account emails, proprietor onboarding notifications |
| Auth                  | Custom JWT, own `master` schema user table | Staff login, entirely separate from any tenant's users |
| Master↔Tenant channels | Cloudflare KV (writer), Service Bindings (responder), Queues (consumer) | See [Platform Layering](#platform-layering-master-vs-tenant-recap) |

### Platform Layering: Master vs Tenant (recap)

*(Full detail lives in the Tenant layer's `AGENTS.md` — this is the same boundary, described from Master's side.)*

- **Tenant is the product.** Master is the thing that makes the product possible to run at scale — it's infrastructure and governance, not a feature schools ever see.
- Master **writes** tenant config to Cloudflare KV (subdomain → schema, R2 prefix, enabled modules, status); Tenant **reads** it on every request. This is the primary channel and it's deliberately one-directional and cache-like — Tenant doesn't need Master to be up to keep serving schools that are already provisioned.
- Master **responds** to Tenant's Service Binding calls for the cache-miss path only (brand-new school, KV eviction). This is a private Worker-to-Worker call, not a public API — no separate auth scheme needed since both systems live in the same Cloudflare account. *(Following the payment-architecture pivot, this channel no longer carries any Paystack-subaccount synchronous actions — there is no subaccount to create or update anymore.)*
- Master **consumes** Tenant's Queue messages for usage/billing metrics — most importantly, active-student-count changes, which feed the Billing Engine directly. This is fire-and-forget from Tenant's side and must never be treated as anything Tenant depends on for its own correctness.
- **Neither system gets a direct database connection into the other's data.** Master's elevated Postgres credentials let it run schema-creation DDL against the shared database, but that's a provisioning privilege, not an invitation to read a tenant schema's business tables for convenience — see [Invariants](#invariants).

### Provisioning Model

Onboarding a school is a **multi-step process that touches several external systems** (Postgres DDL, R2 config, KV, email) — it must be modeled as a durable, resumable workflow, not a single request/response that either fully succeeds or leaves things in an unknown state.

- **Steps, in order**: validate subdomain → create tenant schema + run migrations → register R2 prefix → write config to KV → seed the schema's first Super Admin row → send the proprietor their onboarding notification → mark the school Active in Master's own registry.
- **Each step's completion is tracked** (e.g. a status column per school in Master's registry: `schema_created`, `r2_registered`, `kv_written`, `seeded`, `active`) so a failure partway through can be resumed from the last successful step, rather than either silently leaving a broken school or forcing a full manual redo.
- **A school is never marked "Active" in KV until every step has succeeded.** Tenant should never be able to observe a school that's active-but-incomplete — if KV has no entry (or an explicit "provisioning" status) for a subdomain, Tenant treats it as not-yet-available, not as an error to guess around.
- Recommended execution model: a Cloudflare Queue-driven state machine (each step processed as a message, advancing to the next step on success, retrying with backoff on failure) rather than one long synchronous request — this fits Workers' execution model far better than a single handler trying to do several external calls in sequence within one request lifetime.
- **Migration source of truth, confirmed**: the Tenant repo's migration files are the single source of truth for tenant schema shape — Master does not maintain its own separate copy. Master's onboarding pipeline consumes Tenant's migrations via a **shared published package** (built from the Tenant repo, versioned, published wherever the team publishes internal packages), rather than a manually-copied or manually-synced set of files. This makes it structurally impossible to onboard a school on a stale schema version — there's only one copy of the migrations to be out of date, and Master always pulls the latest published version rather than a snapshot someone forgot to refresh. The Tenant repo's release process should include publishing this package as a normal step, not an afterthought someone has to remember.

### Billing Engine Model

**This is entirely separate from anything a school's families do.** ScholarSync is not a payment gateway — a school's parents pay that school directly, by whatever method the school accepts, and Master has zero visibility into that money. What Master tracks is a completely different transaction: **what the school owes ScholarSync** for using the platform.

- **Input**: each Tenant instance reports its current active-student count (plus general usage metrics — storage usage, system health signals) via the Queue channel described in [Platform Layering](#platform-layering-master-vs-tenant-recap). "Active" follows the same student-lifecycle statuses already defined in the Tenant layer — Graduated, Withdrawn, Archived, and Deleted students don't count; Suspended students are excluded by default pending confirmation of the exact business rule (see Open Questions).
- **Queue consumption must be idempotent and order-aware, not just deduplicated by an event ID** — unlike the old revenue-event model (discrete payment events, deduplicated by `paymentId`), an active-student-count update is closer to a snapshot than a delta. Applying an out-of-order or duplicate count update naively could under- or over-state a school's billable count. The safest implementation treats each message as "this school's count as of timestamp X" and only applies it if X is newer than the last-applied value for that school — not a running sum.
- **Invoice generation**: once per academic term, for every school, calculate Active Students × Price Per Student (currently ₦900, platform-wide, set by ScholarSync). The invoice is generated from whatever the active count is at generation time; because the count is continuously synced, this number should already be the same one visible on an ongoing "estimated invoice" view throughout the term, not a surprise.
- **How a school pays**: schools pay ScholarSync's invoice via bank transfer into ScholarSync's own account(s) — confirmed. There is no payment gateway or payment link in this flow; a Finance/Revenue staff member reconciles incoming transfers against outstanding invoices and marks an invoice paid once confirmed, the same manual-confirmation pattern already used for how a school's own Accountant records a parent's payment in the Tenant layer. This is a real reconciliation workload for Finance/Revenue Staff, not an automated webhook-driven process — worth factoring into that role's actual day-to-day scope, not just its read access.
- **Two numbers that must never be confused**: 
  1. **ScholarSync's actual revenue** — the sum of invoices the Billing Engine has generated and been paid. This is the number that matters for the business.
  2. **"Total Fees Recorded" / "Payments Recorded" per school** — usage-telemetry metrics Master stores about how much money is flowing through a school's own fee collection (synced from Tenant, same channel as active-student count). This is **useful for understanding platform usage and health, not ScholarSync's revenue** — a school processing ₦50M in tuition doesn't mean ScholarSync earned anything close to that; ScholarSync earned Active Students × ₦900. These two numbers must be kept clearly labeled and never summed together or substituted for each other in any dashboard or report (see [Invariants](#invariants)).
- **Enforcement**: an unpaid invoice past a defined grace period **can** result in the school being deactivated (see School Lifecycle Management) — reusing the existing suspend mechanism, not a parallel one. **Confirmed: this is never automatic.** A Finance/Revenue staff member reviews the overdue invoice and deliberately triggers deactivation — there is no scheduled job that suspends a school purely because a grace period lapsed. This is a deliberate choice to keep a human judgment call in the loop before cutting off a school's access (a paying-but-slow school shouldn't get auto-suspended over a bank transfer that's still in transit), the same philosophy already applied to churn (invariant 10) — non-payment alone, however long, never silently triggers deactivation on its own.

**Churn is a distinct, deliberate state — never an automatic side effect of suspension.** Suspension (e.g. non-payment) is reversible and keeps everything fully intact indefinitely; a suspended school that later pays or resolves the issue is reinstated with nothing lost. Churn only happens when a school is actually leaving the platform for good — either the proprietor explicitly requests cancellation, or Master staff make a deliberate decision to close out a school that's been suspended for a long time with no resolution. Non-payment alone, however long, should never silently tip a school from Suspended into Churned — that has to be a deliberate action someone takes, not a timeout.

- **On churn**: the school's KV status flips to `churned` (distinct from `suspended`, so support history is clear), and the Tenant instance becomes inaccessible the same way a suspended one does.
- **A recommended 90-day archive window** follows churn, during which:
  - The proprietor can request a **full data export** (academic records, financial history, everything) through Customer Care — this is the school's one real opportunity to walk away with their records.
  - The proprietor can request **reactivation**, which fully restores the school without re-onboarding from scratch — churn isn't instantly, irreversibly destructive.
- **After the archive window closes**, the tenant schema is permanently deleted — the default here favors data minimization over indefinite retention, consistent with the retention-consciousness already built into the Tenant layer's own admissions-lead policy.
- **This 90-day figure is a suggested default, not a researched legal minimum** — Nigerian education record-keeping requirements may mandate longer retention for specific categories (academic transcripts in particular are the kind of record that sometimes carries its own statutory retention period, separate from any platform relationship). This needs an actual legal/regulatory check before being treated as final — flagged in Open Questions rather than asserted as compliant.

### Auth and Permission Model

- Custom JWT, same general pattern as Tenant (access + refresh tokens), but with its **own, entirely separate user table** in the `master` schema — there is no shared identity between a Master staff account and any school's Super Admin, even if it's the same human being wearing two hats.
- **MFA is confirmed as required for every Master staff account, no exceptions, from Master Super Admin down to Customer Care.** A compromised Tenant Super Admin account affects one school; a compromised Master account can touch the provisioning, revenue, or suspension state of every school on the platform — the blast radius is categorically different, so it doesn't get Tenant Phase 1's "MFA future" deferral. This is a Phase 1 requirement for Master, not a later addition.
- Role and permission checks enforced server-side on every route, same discipline as Tenant.

### Invariants

1. Master never reads or writes a tenant schema's business data (students, grades, fees, messages) except the one-time Super Admin seed row at onboarding — this is a policy boundary enforced by code discipline and access patterns, not a technical wall, since Master's Postgres credentials are necessarily broad enough to run schema-creation DDL. That asymmetry is exactly why every Master action touching tenant infrastructure must be audit-logged (see Audit Logging).
2. A school is never marked Active in Cloudflare KV until every onboarding step has completed successfully — no partially-provisioned school is ever visible to the Tenant layer as if it were ready.
3. Onboarding failures leave the school in a resumable, clearly-flagged state — never silently stuck, never requiring a full manual redo from scratch.
4. The usage/billing-metrics Queue consumer applies each school's active-student-count update only if it's newer than the last-applied value for that school — never a naive sum, and never double-applied on redelivery. See [Billing Engine Model](#billing-engine-model).
5. Suspending a school takes effect via KV and is read by Tenant on its very next request — there is no code path where a suspended school continues operating normally past that point.
6. **Master has zero visibility into how a school's families pay that school** — it never processes, mediates, or gates that money in any way. Its only financial relationship is the separate one between ScholarSync and the school, via the Billing Engine.
7. Every provisioning action, suspension/reinstatement, staff-account change, and invoice generation/status change is logged with who performed it (or that it was an automated rule) and when.
8. Master's own JWT-based auth and user table are entirely separate from any tenant's — no shared login, no shared session, between a ScholarSync staff account and a school's Super Admin account.
9. Complaint/support tickets in Master are about a school's relationship with ScholarSync (billing, technical issues, feature requests) — Customer Care staff never get visibility into a school's internal family/teacher communications through this feature. If end-user escalations are ever supported, they carry only the minimal context needed for that specific ticket, not standing access to a school's Communication Hub data.
10. A school never transitions from Suspended to Churned automatically, no matter how long it's been suspended — churn requires a deliberate action (proprietor request or explicit staff decision), never a timeout.
11. A churned school's data is neither deleted immediately nor kept indefinitely by default — it's retained through a defined archive window (export and reactivation both available during it), then permanently deleted, unless a specific data category has a confirmed legal retention requirement overriding that default.
12. Master never maintains its own separate copy of the Tenant repo's migration files — tenant-schema provisioning always consumes them via the shared published package, so there is exactly one source of truth for schema shape and no possibility of a school being onboarded against a stale version.
13. ScholarSync's actual revenue (from the Billing Engine's own generated and paid invoices) and the usage-telemetry figures Master stores about a school ("Total Fees Recorded," "Payments Recorded" — money flowing through that school's own fee collection) are never summed together, substituted for each other, or displayed as if they were the same number in any report or dashboard.
14. A school deactivated for non-payment of ScholarSync's own invoice uses the exact same suspend/reinstate mechanism as any other suspension reason — there is no separate, parallel billing-enforcement code path.
15. Deactivating a school for non-payment is never automatic — there is no scheduled job or timeout-based trigger. It always requires a Finance/Revenue Staff member to review the overdue invoice and deliberately act, the same "deliberate action, not a timeout" principle already governing churn (invariant 10).

---

## 3. UI Context

This is an **internal tool for ScholarSync's own team**, not a customer-facing product — the design priorities are different from Tenant's polished, multi-role, family-facing UI. Clarity and speed for a small internal team matter more than brand polish here.

### Theme

Reuses the same token system as the Tenant layer (white/navy-black light mode, inverted dark mode, navy blue brand color) for consistency and to avoid a second design system — but the achievement-gold accent from Tenant's theme has no purpose here and should simply be unused, not reinvented for a different meaning.

### Component Library

shadcn/ui on top of Tailwind — same as Tenant, for the same reason: one shared design vocabulary across both codebases, less to maintain.

### Layout Patterns

- A straightforward authenticated shell: sidebar nav (Onboarding, Schools, Revenue, Staff, Audit Log), no need for the role-switching complexity Tenant's UI has, since Master's own role set is much smaller and simpler.
- School onboarding is a multi-step wizard, reflecting the actual multi-step provisioning workflow underneath it — the UI should make each step's status visible (schema created ✓, R2 prefix registered ✓, etc.), not hide the process behind a single "Create School" button that either works or doesn't.
- The Schools list is the most-used screen — status (Active/Suspended/Provisioning), quick suspend/reinstate action, link into that school's provisioning detail.

### Icons

Lucide React, same as Tenant, for consistency.

---

## 4. Code Standards

### General

- Keep modules small and single-purpose, same discipline as Tenant.
- This system holds elevated privileges — treat every change touching tenant-schema DDL, Billing Engine invoice logic, or the KV-writing path as higher-risk than an equivalent Tenant-layer change, since a bug here can affect every school simultaneously, not one. Tenant's isolation architecture contains the blast radius of a Tenant bug to one school; nothing contains the blast radius of a Master bug the same way.

### Language / Type Safety

- TypeScript strict mode, same as Tenant.
- Avoid `any`, especially around the tenant-config objects written to KV — a malformed config object written to KV is a bug that immediately affects a live school.

### Backend (Cloudflare Workers + Hono)

- Same Workers-runtime discipline as Tenant: no Node-only APIs, secrets via Workers bindings, never hardcoded.
- Any route that runs tenant-schema DDL (school onboarding) must be idempotent or step-tracked — never assume a single successful run; assume it might be retried after a partial failure.
- The revenue-event Queue consumer must check for duplicate `paymentId` before recording — see invariant 4.

### Data and Storage

- Master's own data (school registry, revenue ledger, staff accounts, audit log) lives in the `master` schema — never in a tenant's schema, and never in a shared table that mixes the two.
- Master's elevated Postgres credentials are used **only** for schema-creation DDL during onboarding and for the `master` schema's own tables — not as a convenient way to query a tenant's business data for a dashboard or a support ticket. If Master genuinely needs tenant-schema data for some future feature, that needs its own explicit invariant and audit trail, not ad hoc querying.

### File Organization

- `apps/web/` — the internal admin console.
- `apps/api/` — the Cloudflare Worker: onboarding workflow, revenue ingestion, staff auth, KV writer, Service Binding responder.
- `db/` — Drizzle schema for the `master` schema. Tenant-schema provisioning does **not** use a locally-copied migration set — it consumes the Tenant repo's own migrations via the shared published package (see [Provisioning Model](#provisioning-model)), so this directory only needs to depend on that package, not vendor a copy of its contents.
- `jobs/` — Cloudflare Queue consumers (revenue events) and the onboarding state-machine's step processors.
- Name files after the responsibility they contain, not the technology.

---

## 5. AI Workflow Rules

### Approach

Same spec-driven, incremental philosophy as the Tenant layer — implement against this file, don't invent behavior, keep changes scoped.

### Scoping Rules

- Work on one feature unit at a time, same as Tenant.
- **Treat any change to the onboarding workflow, Billing Engine logic, or the KV-writing path as its own reviewed unit** — never bundle it with an unrelated UI change, given how directly it affects every school on the platform.

### Handling Missing Requirements

- Don't invent staff roles, permissions, or onboarding steps beyond what's defined here.
- If a requirement is ambiguous, resolve it in the relevant section before implementing; if missing, add it to the Progress Tracker's Open Questions.

### Protected Foundation Components

- `components/ui/*` (shadcn/ui components)
- Drizzle-generated schema/migration output
- Same rule as Tenant: don't modify these unless a task explicitly requires it.

### Before Moving to the Next Unit

1. The current unit works end to end within its defined scope.
2. No invariant in this file was violated — pay particular attention to invariants 1, 2, and 4 (tenant-data boundary, atomic activation, idempotent revenue ingestion), since these are the ones where a quiet mistake has the widest blast radius.
3. The Progress Tracker reflects the completed work.

---

## 6. Progress Tracker

### Current Phase

- Not started

### Current Goal

- Define the immediate implementation goal here (e.g. "scaffold staff auth + the onboarding state machine's first two steps").

### Completed

- None yet.

### In Progress

- None yet.

### Next Up

- Add the next planned feature unit here.

### Open Questions

- Decide the exact recovery/retry policy for a failed onboarding step — automatic retry with backoff, or a manual "resume" action a staff member triggers from the admin console? Not yet defined.
- Decide whether Customer Care should ever handle end-user (parent/teacher) complaint escalations forwarded by a school, and if so, exactly what limited context they're allowed to see per ticket.
- **Verify the 90-day churn archive window against actual Nigerian education record-keeping requirements** — this file's number is a reasonable-default suggestion, not a legal determination, and academic transcripts in particular may carry their own statutory retention period independent of the platform relationship.
- Confirm whether Suspended students count toward or against a school's Active Student billing count — currently noted as "depending on business rules" but the actual default hasn't been confirmed.
- Confirm the exact cadence for reporting active-student-count changes from Tenant to Master (every single change in real time, or batched periodically) — affects both billing accuracy and Queue volume across every school.

### Architecture Decisions

- Master's own data lives in a dedicated `master` schema inside the same shared Supabase Postgres instance as every tenant, rather than a separate Supabase project — recommended by Claude for operational simplicity, not yet explicitly confirmed by you.
- Master reuses the Tenant layer's R2 bucket under a reserved `_master/...` prefix, consistent with the prefix-isolation pattern already chosen for schools — recommended by Claude, not yet explicitly confirmed by you.
- Onboarding is modeled as a step-tracked, resumable workflow rather than a single atomic action, given how many external systems (Postgres DDL, R2, KV) a single school's onboarding touches — recommended by Claude, not yet explicitly confirmed by you.
- Staff role set confirmed: Master Super Admin, Onboarding Staff, Finance/Revenue Staff, Support Staff, and Customer Care (added per user request — handles school-to-ScholarSync complaints/support tickets, scoped away from revenue and billing-enforcement authority) (confirmed by user). Finance/Revenue role renamed from "Viewer" to "Staff" and given billing-specific suspend/reinstate authority once the manual bank-transfer reconciliation model was confirmed — a read-only role couldn't actually execute the reconciliation-and-deactivation workflow this billing model requires (recommended by Claude, consistent with user's confirmation that a staff member manually triggers deactivation for defaulters).
- MFA confirmed as required for every Master staff account from day one, not deferred like Tenant Phase 1, given the platform-wide blast radius of a compromised Master account (confirmed by user).
- Churn confirmed as a distinct, deliberate state separate from suspension — never an automatic timeout. A 90-day archive window (export + reactivation available) precedes permanent deletion, as a suggested default pending legal verification of Nigerian education record-keeping requirements (confirmed by user, exact duration recommended by Claude and flagged for legal review).
- Migration source of truth confirmed as Option A: Master consumes the Tenant repo's migrations via a shared published package rather than maintaining its own copy — makes onboarding a school on a stale schema version structurally impossible rather than a process someone has to remember (confirmed by user, recommended by Claude).
- **Payment architecture pivot (supersedes every Paystack-subaccount decision made earlier in this file).** ScholarSync is not a payment gateway or financial intermediary — Master has no involvement in, or visibility into, how a school's families pay that school. ScholarSync's own revenue now comes from the Billing Engine: a termly invoice per school, Active Students × ₦900, computed from active-student-count data Tenant streams to Master continuously. This removes the Paystack Subaccount Management feature and the bank-details hand-off flow entirely. Non-payment of ScholarSync's own invoice can result in school deactivation, reusing the existing suspend/reinstate mechanism rather than a new one. "Total Fees Recorded"/"Payments Recorded" figures Master stores per school are usage telemetry only, never ScholarSync's own revenue figure (confirmed by user).

### Session Notes

- Add context needed to resume work in the next session.
