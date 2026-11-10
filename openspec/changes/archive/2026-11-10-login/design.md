# Design

## Context

See `proposal.md` for motivation and `specs/02-пользователи-вход.md` for the product contract. The original product document excludes authentication; the explicitly requested login change replaces that exclusion while preserving its separate contact-management acceptance test.

Observed implementation:

- `src/db/schema.ts` defines shared `contacts`, `notes`, `contact_groups`, and `contact_group_memberships`. Groups have a global `contact_groups_normalized_name_unique` constraint. There are no auth tables or auth dependencies yet.
- `src/lib/data.ts` reads all contacts, groups, memberships, notes, and overdue contacts. Several reads serialize entire membership sets to the browser. These must be scoped before serialization, even when the client subsequently filters them.
- `src/app/actions.ts` authorizes no user. `saveContact`, `saveGroup`, and `createGroupForContact` validate IDs and use transactions/locks, but select by record ID alone. Note actions and the raw SQL used by `markContacted` also need owner predicates.
- The common header is in `src/app/layout.tsx`; existing pages live directly under the App Router root. `src/app/page.tsx` has the existing contact browser and overdue block.
- `scripts/test-e2e.mts` creates a disposable localhost PostgreSQL container, runs a legacy frequency migration fixture, migrates, builds the app, and runs Playwright. Its fixtures insert ownerless contacts. CI already calls this runner, so no separate email workflow is needed.
- `scripts/migrate.mts` is the production one-off migration entry point; local `db:migrate` currently calls Drizzle Kit directly. `Dockerfile` explicitly copies migration/seed scripts and database modules, which must remain usable with the new schema dependencies.
- `deploy/deploy.sh` backs up the current database, pulls the image, migrates while the old app is still running, starts the new app, and checks public `/health`. `rollback.sh` calls deployment again. `restore.sh` restores into a recreated database and restarts the same application version.

## Goals / Non-Goals

**Goals:** A shared authentication boundary, server-derived owner identity at every data boundary, database constraints against cross-owner memberships, durable link lifecycle and send limits, and a reviewed migration preserving every existing record.

**Non-Goals:** See the proposal's excluded product features. Do not introduce a second auth system, an email provider SDK, Redis, a queue service, or a second environment-specific application build. Do not expose sessions or provider credentials to client components.

## Decisions

### 1. Integrate Better Auth with PostgreSQL through Drizzle

Use Better Auth's Magic Link plugin and its supported Drizzle adapter. Keep server configuration in a server-only auth module, with the supported Next.js handler under `/api/auth/[...all]`. Verify stable package versions and adapter compatibility during implementation; if the selected release needs a separately packaged adapter, discuss that additional direct dependency before installing it.

Use the generated auth schema for the selected release, checked into the project's schema and migrations, including the user, session, account, and verification models it needs. User IDs are text; CRM contacts/groups retain their existing integer IDs. Normalize email once on the server and enforce uniqueness of the normalized address. Do not ask for a name; any schema-required name is an internal value, not a new product field. Precreating the legacy owner must not mark the email verified without a real link verification.

This uses the mandated auth library instead of maintaining cookies or login token cryptography ourselves. The [official adapter documentation](https://better-auth.com/docs/adapters/drizzle) describes schema generation and integration; verify the release's actual generated schema before coding migrations.

### 2. Make link replacement and send limits durable and serialized

Set the plugin's link lifetime explicitly to 900 seconds. Its default is shorter. Use its token verification and atomic single-use consumption. The [Magic Link documentation](https://better-auth.com/docs/plugins/magic-link) confirms configurable expiry, first-link registration, and single-use redemption.

The application additionally needs a rolling three-emails-per-600-seconds allowance keyed by normalized email and invalidation of all previous links. These are application guarantees; do not assume an IP limiter or the plugin's defaults implement them.

Keep a per-email request state in PostgreSQL (`magic_link_requests`: normalized email, current token digest/generation, recent reserved send times) and an expiring token-digest-to-email lookup (`magic_link_tokens`). Store no raw link in these application tables. Serialize issuance and verification for that email using a PostgreSQL advisory lock held for the full operation, releasing the connection/lock in `finally`. The token lookup allows verification to resolve the same lock key. Under the lock, compare the digest with the current generation, enforce expiry and allowance, and delegate actual verification/session creation to Better Auth. Retain older digest lookups until expiry so replaced links are rejected consistently.

Wrap both public plugin issuance and verification routes in this boundary; calling the raw auth endpoint must not bypass normalization, limits, or replacement. A rejected rate-limited request does not issue a new token or invalidate the latest one. Reserve quota before SMTP so concurrent requests and ambiguous SMTP failures cannot exceed the allowance. On transport failure, preserve the source specification's generic confirmation for valid, nonlimited requests and log a sanitized operational error without tokens or credentials.

An implementation proof must demonstrate that the chosen release's route hooks/wrapper cover both operations and concurrent replacement/redemption. Do that before building the remaining UI; a hook limitation requires revising the integration, never relaxing the contract. In-memory counters lose state across restarts and cannot satisfy the concurrency guarantee. There is no additional storage service.

### 3. Validate sessions at the server boundary and renew per visit

Use database-backed device sessions, a 30-day lifetime, and refresh on each authenticated visit rather than the library's default refresh interval. Use supported Next.js cookie handling and an auth route for refreshes that require writing response cookies; a read-only Server Component is not sufficient for browser cookie renewal. Check the session in every server data/action entry point. A route-group layout centralizes page redirects but does not replace these checks.

Use `/login` and a public stale-link page as the only new product screens. After a valid link, open `/`; after sign-out, open `/login`. A protected route group can retain existing CRM URLs while separating their header from public pages. Keep `/health` public and avoid initializing auth secrets or database reads during the image build.

The authenticated header shows normalized email and «Выйти» using existing design tokens and UI primitives. Sign-out revokes only the current session; disable cookie session caching so revoked sessions cannot continue to authorize server operations. Use HTTPS-secure, HTTP-only production cookies and explicit trusted application origins. Do not enable password, social login, or account management UI. The [session documentation](https://better-auth.com/docs/concepts/session-management) explains rolling expiry, refresh intervals, and per-session revocation.

### 4. Scope CRM queries and enforce membership consistency

Add nonnullable `owner_id` foreign keys on contacts and groups. Notes retain `contact_id` and derive ownership through the contact: duplicating note ownership would create unnecessary drift.

| Model | Before | After |
| --- | --- | --- |
| Auth user/session | Absent | Auth schema, unique normalized email, separate device sessions |
| Contact | Integer ID, shared fields and frequency | Existing fields plus required `owner_id` |
| Group | Integer ID, globally unique normalized name | Required `owner_id`; unique `(owner_id, normalized_name)` |
| Note | Parent contact, text and timestamps | Same fields; every operation joins or checks the owned parent |
| Membership | Contact/group pair | Same pair plus `owner_id`; composite foreign keys require both parents to have that owner |
| Link request/token state | Absent | Durable normalized-email allowance/current digest and expiring digest lookup |

Add referenced unique keys `(owner_id, id)` to contacts/groups and matching composite membership foreign keys, preserving cascades and the existing contact/group pair primary key. Index owner-scoped listing and group-membership access. This protects relationships against races as well as application mistakes.

Resolve the session once per request and pass its trusted user ID into the data/mutation helpers. Helpers must require that ID; no optional owner or fallback to a shared account. Scope joins, counts, existence/duplicate checks, row locks, updates, deletes, and insert-from-select statements. Check group ownership before replacing memberships and preserve transaction rollback on a foreign group ID. Scope duplicate-group constraint recognition to the new composite unique constraint.

Map foreign contacts to the same missing-contact UI and server outcome as absent IDs; use the exact «Контакт не найден» copy. Foreign notes and groups must likewise reveal no existence or data. Never cache owner-specific results globally or send foreign memberships to a client for filtering. Retain existing contact frequency/date rules and transactional save behavior.

Application-level SQL predicates, reviewed through an explicit operation matrix, fit the existing Drizzle architecture. Database row-level security would require connection/session context infrastructure and is unnecessary for this change; foreign keys still enforce structural ownership.

### 5. Send through one runtime-configured Nodemailer transport

Use Nodemailer SMTP everywhere. Local Docker Mailpit has loopback-only SMTP and inbox ports; the disposable e2e Mailpit container has its own random localhost ports and no relay. The e2e runner passes these settings explicitly, polls the Mailpit API for the exact unique recipient, and stops only its own containers in `finally`.

Production uses Resend SMTP with TLS. Runtime settings cover `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional SMTP authentication, and `MAIL_FROM`. Migrations and demo seeding both receive the confirmed owner's address through `LEGACY_OWNER_EMAIL`. Application secrets and SMTP settings must not be required at build time or embedded in browser bundles. Production uses `noreply@mail.crm.<owner-domain>`; the owner configures Resend domain verification and DNS before rollout. The README identifies the existing application domain, but do not infer or change DNS records.

Use Russian HTML and text email bodies with the specified copy and an absolute trusted application URL. Resend uses the API key as its SMTP password, so its HTTP SDK is unnecessary. See [Resend SMTP](https://resend.com/changelog/smtp-service), [Nodemailer SMTP configuration](https://nodemailer.com/smtp), and [Mailpit's integration API](https://github.com/axllent/mailpit).

### 6. Preserve legacy data with one reviewed migration path

The owner supplied the intended email in the implementation conversation on 2026-11-10. Use the proposed `LEGACY_OWNER_EMAIL` runtime setting for both migrations and demo seeding. The owner sets its value personally in `.env`; keep `.env.example` empty and never embed the personal address in source, migrations, or defaults. Normalize and validate this required input before modifying the database, then inject it with `set_config` into the same migration connection used by the SQL backfill. A completed ownership migration does not require this input again; seeding always requires it. Missing or invalid input must fail before any ownership change, without a fallback account.

Use checked-in Drizzle migrations to create auth/link state, create or find the normalized owner account, add/backfill owner fields, replace group uniqueness, and add nonnull/composite foreign-key constraints. Preserve IDs, all contact fields, note bodies/timestamps, group names, memberships, and communication state. Fail before applying ownership changes if the required owner input is missing or invalid; transactional backfill/constraints must not leave partial ownership.

Unify local `db:migrate` and the production one-off entry point so local migrations do not bypass owner setup. On an already migrated database, migration reruns must not reassign data or demand owner input for completed backfills. Demo seeding still needs the confirmed owner's identity and checks for existing demo records only within that account.

Extend the existing isolated migration fixture sequence: it currently verifies the earlier frequency migration before applying the rest. Keep that regression, then load representative pre-login contacts, notes, groups, and memberships, run the real login migration, and compare counts and every preserved field/relationship. This is an application data-integrity test; do not add automatic tests for deployment shell scripts or CI configuration.

### 7. Keep acceptance tests independent and traceable

Use TDD for application code: each new behavior test first fails against the old behavior, then passes after implementation. Every scenario in the four delta specs has its own named test. Parameterize the operation matrices so each read/mutation receives an assertion and check the other user's database state after rejected writes.

Keep `e2e/main-scenario.spec.ts` as the separate original scenario with a real email-link sign-in prerequisite, including a second browser signed into the same account. Add `e2e/login.spec.ts` for two independent browser contexts, actual Mailpit links, list/search/direct-link isolation, and sign-out. Extend existing group/overdue tests with owner-aware fixtures and retain all previous acceptance assertions. Do not replace sign-in with fabricated cookies or mocks. Expiry tests set test-owned issuance/session timestamps in the isolated database; do not sleep for 15 minutes or 30 days or add a production test bypass.

Map scenarios to tests in `tasks.md`. Runtime email routing and production recovery have manual checks, per the repository rule that server/deploy/CI changes are verified by real rollout rather than automatic shell-script tests. Run the existing six CI checks without disabling any.

## Risks / Trade-offs

- A missing owner predicate can expose all users' records -> require the server operation matrix, separate A/B contexts, direct request coverage, and database assertions for refused writes.
- Authentication defaults do not implement all requested rules -> explicitly test 15-minute expiry, replacement races, normalized-email limits, per-visit renewal, and device-only revocation.
- SMTP and database commits cannot be atomic -> serialize per recipient and reserve quota before sending; keep generic confirmation and sanitized operational logs on provider failure.
- Old ownerless code remains unsafe against the migrated database -> stop the old app for the ownership transition and keep it stopped on migration failure; never resume it automatically against the migrated schema.
- Resend cannot deliver before its sender domain and server settings are ready -> human preparation before merge/deployment; Mailpit covers implementation and CI without real delivery.
- The current `rollback.sh` deploys an image but retains the current database, while `restore.sh` restarts its current image -> document and prepare a manual paired recovery sequence that cannot briefly run the new image against the old database or reapply the new migration.

## Migration Plan

1. Confirm the owner-email input mechanism during implementation. Prepare human-only Resend/DNS and secret configuration instructions without reading or writing `.env` or displaying credentials. Keep server `.env` mode 600.
2. Generate the schema/backfill migrations, demonstrate the isolated before/after data comparison, and show the data-changing migration to the owner before merge. Review both the database changes and migration connection setup.
3. Add runtime configuration to the production app/migrate/seed services as appropriate; package everything those jobs import in the same image. Add local Mailpit and reuse the e2e runner in the current workflow. Verify current stable dependency/image versions when these files are changed.
4. Prepare the compatibility transition in the existing `deploy/` scripts: obtain the usual backup before any changes, pull the new image, stop the old app before ownership migration, run the one-off migration, and start the new app only after success. No new deployment workflow. A failure reports the stopped/failed state for human action; no automatic rollback.
5. Keep `/health` public, run the existing smoke, then manually verify production email sign-in, owner legacy records and counts, a second user's empty account, separation, and device-local sign-out. Keep only the current and previous images and the existing capped logs.
6. Before merge, document a concrete manual paired recovery command/procedure in the README using the existing restore process, a captured pre-login backup, and the previous image. Preserve restore's `yes` confirmation, safety backup, and same-version behavior. Select the compatible previous image under stopped-app maintenance before restore restarts it; do not use an image-only rollback or run the login migration again. The human runs restore and recovery; this planning workflow performs neither.

## Open Questions

- Owner identity input is resolved: `LEGACY_OWNER_EMAIL`, supplied personally by the owner, serves migrations and demo seeding without a default or hardcoded address.
- Rollout sender is resolved: `noreply@mail.crm.lichnocrm.ru`, with `https://app.lichnocrm.ru` as the application origin. On 2026-11-10 the owner explicitly confirmed `mail.crm.lichnocrm.ru` is already Verified in Resend. The owner still supplies the runtime signing secret and Resend SMTP key personally.

## Manual Review

Review `proposal.md` for scope, the four delta specs for acceptance behavior, and `tasks.md` for the implementation order and each scenario's verification. No application behavior changes during proposal preparation. After implementation, the primary manual check uses two independent browsers: sign in as A, add a contact, then sign in as B and verify that list, search, and the direct contact URL do not expose A's contact. Use local Mailpit for this check before production delivery is configured.
