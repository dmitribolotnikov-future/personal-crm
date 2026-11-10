# Proposal

## Why

Friends want to use the CRM, but the application currently exposes the same contacts to everyone. Each person needs to sign in with their email address and manage only their own contacts, notes, and groups.

The product contract for this change is `specs/02-пользователи-вход.md`. It supersedes the initial exclusion of authentication in `specs/01-продуктовая-идея.md`; the original contact-management acceptance scenario remains required after sign-in.

## What Changes

- **BREAKING**: Require passwordless email sign-in before accessing CRM data. The first verified sign-in creates an account without asking for a name.
- Normalize and validate email addresses on the server. Use single-use links valid for 15 minutes, invalidate older links on a new request, and allow at most three emails per normalized address in ten minutes.
- Keep each device signed in for 30 days since its last visit. Show the account email and device-local sign-out in the header.
- Send Russian sign-in emails through Nodemailer: Mailpit in local development and automated tests, Resend SMTP in production, configured at runtime for the same application image.
- **BREAKING**: Assign contacts and groups to users; derive note ownership from the parent contact. Enforce ownership in every server read and mutation, including direct requests, filters, memberships, and overdue contacts.
- Transfer every existing contact, note, group, and membership to the owner's account without losing data. Ask how to supply the owner's email during implementation, as the source specification requires.
- Keep the original main-scenario browser test separate; add a two-user sign-in and isolation acceptance test using real PostgreSQL and Mailpit.
- Exclude passwords, social providers, email codes, profiles, email changes, account deletion, sharing, invitations, roles, and administration.

## Capabilities

### New Capabilities

- `user-auth`: Email-link sign-in, account creation, validation, link lifecycle, send limits, sessions, sign-out, and environment-configured delivery.
- `user-data-isolation`: Server-enforced ownership of contacts, notes, groups, memberships, and legacy data transfer.

### Modified Capabilities

- `contact-groups`: Group-name uniqueness is scoped to the owner; persistence across browsers requires signing into the same account.
- `keep-in-touch`: The overdue block contains only the current user's contacts; another browser must sign into the same account to see the same results.

## Impact

- Application: `src/db/schema.ts`, `src/lib/data.ts`, contact/group mutation helpers, `src/app/actions.ts`, authenticated pages and header, new public login/error pages and Better Auth routes.
- Persistence: Better Auth tables, contact/group ownership and constraints, durable email-link request state, reviewed legacy-data migration, and owner-aware demo seeding.
- Dependencies already selected by the source specification: Better Auth, Nodemailer, and Mailpit; Resend SMTP for production. Verify current stable releases and any required adapter package before implementation.
- Delivery: local `compose.yaml`, isolated e2e runner and fixtures, production `deploy/compose.yaml`, migration/image packaging, and README instructions for human-managed secrets and DNS.
- Rollout: database backup, migrations before starting the new image, `/health` smoke, and manual recovery using both the pre-deployment database backup and the previous application version.
