# Verification

## Server operation matrix

Every operation requires a verified server session. Test each operation with its owner, a different owner, and an anonymous request. After a rejected mutation, compare the original complete record and its relationships.

| Boundary | Reads | Writes | Refused foreign operation |
| --- | --- | --- | --- |
| Contacts | list, name search, detail, edit | create, update fields/frequency, delete | Missing-contact result; preserve fields, notes and memberships |
| Notes | list through contact | add, edit, delete | No body/timestamp disclosure or changes |
| Communication | overdue list and ordering | mark contacted | No foreign name/date disclosure or date changes |
| Groups | list, detail, members | create, rename, delete | No group/member disclosure or changes |
| Memberships | labels, selectors, filters | replace, inline group creation | Reject cross-owner IDs transactionally without partial groups |
| Sessions | server lookup, each browser visit | refresh, current-device sign-out | No anonymous CRM access; revocation is immediate and device-local |
| Migration | full legacy snapshot before/after | owner backfill and constraints | Missing/invalid input or failure leaves no partial ownership |
| Seeding | owner-scoped existing demo lookup | owner-only demo contacts/notes | Preserve other accounts, including similar records |

## TDD results

Results are recorded after executing the corresponding tests. A skeleton is not acceptance completion.

- Initial `pnpm test:e2e e2e/login.spec.ts`: `anonymous CRM access requires sign-in` failed because `/` remained accessible; the two-context acceptance skeleton failed because no email sign-in page exists. `health remains public` passed. The original main scenario was retained separately without changes.
- `pnpm test:e2e --migrations-only` before implementation: the existing frequency migration regression passed; D10 failed because `auth_user` does not exist. The new fixture snapshots contacts, notes, groups and memberships with fixed historical dates and communication frequency.
- Email normalization/required-owner unit tests first failed on the absent implementation, then passed (3 tests).
- Ownership migration checks passed: 3 contacts, 2 notes, 1 group and 1 membership retained every original field and timestamp. Missing/invalid owner, an intentionally failed backfill, fresh-database setup, repeat migration without input and PostgreSQL cross-owner rejection passed.
- D11 initially failed because seeding inserted ownerless contacts. After implementation, each of two synthetic accounts received its own 1000 demo contacts and notes; repeated owner seeding left both accounts' complete snapshots unchanged.
- Mail content/configuration unit tests first failed on the absent implementation, then passed (2 tests). The real-auth integration suite initially failed because the auth boundary was absent.

## Dependency verification (2026-11-10)

- npm registry stable tags: Better Auth 1.7.18 and Nodemailer 10.4.0. Installed with pnpm 12.10.1 and updated `pnpm-lock.yaml`. Nodemailer 10 already includes its declarations; the initially checked `@types/nodemailer` 8.0.2 was removed as redundant.
- The selected Better Auth package includes `@better-auth/drizzle-adapter` 1.7.18 and re-exports `better-auth/adapters/drizzle`; the import was executed successfully. No additional direct adapter package was installed.
- Official GitHub release API: Mailpit [v1.33.1](https://github.com/axllent/mailpit/releases/tag/v1.33.1), published 2026-11-07.
- Existing peer mismatch remains: Vitest 5.0.5 requests Node type definitions 22/24+, while the project already uses `@types/node` 20.19.43. No new auth peer mismatch.

## Server boundary audit

- Every exported read in `src/lib/data.ts` obtains the request's verified user before constructing `createUserData`. The React session cache is request-scoped; no user data has a global cache.
- Every server action in `src/app/actions.ts` obtains that identity directly or through `currentData`. Submitted owner fields are never used. Mutation helpers require an owner argument without a default.
- `src/lib/user-data.ts` filters contact/group reads before serialization, scopes membership lookup to the owner, joins notes to the owned contact, and scopes every note mutation with an owned-contact subquery. Both insert-from-select operations include the owner predicate.
- `saveContact` scopes contact locks, group locks, updates and membership deletion/insertion. `saveGroup` scopes duplicate lookup and updates. Inline creation locks the owned parent and rolls back failed membership writes.
- PostgreSQL composite foreign keys independently reject cross-owner membership writes. Group names are unique only within their owner's account.
- The real database operation matrix passed for foreign reads, forged owner input, contact mutations, every note operation, mark-contacted, group operations and inline rollback. Complete snapshots remained unchanged after refused writes.
- The protected CRM layout and proxy require a verified session; individual server reads/actions repeat authorization. The proxy uses Better Auth's supported session handler to forward renewed response cookies, while Server Components perform read-only session lookup.

## Rollout state

- The owner confirmed `mail.crm.lichnocrm.ru` is already Verified in Resend. Sender: `noreply@mail.crm.lichnocrm.ru`; application origin: `https://app.lichnocrm.ru`.
- README contains local/production runtime settings and commands for the owner to generate secrets personally. `.env.example` contains empty values only; no `.env` was inspected or changed by the agent.
- The owner confirmed adding `LEGACY_OWNER_EMAIL` and then the remaining production auth/SMTP settings personally in `/srv/personal-crm/.env`, following the secret-generation, save and `chmod 600` instructions. Task 8.4 is complete on the owner's confirmation; the agent did not inspect secret values. Actual production delivery remains part of task 8.5.
- Image contents and Compose runtime inputs are prepared. Image/job execution still needs the existing GitHub image build after the owner's commit-and-push instruction.
- Deployment now prepares backup -> stop old app -> migration -> new app -> public smoke. Actual deployment verification remains pending; no deployment/CI automatic tests or rollback were added.
- D12 manual review: matched image/backup are selected explicitly; a correctly labeled pre-recovery backup is taken first; the previous app container is created without starting it; only PostgreSQL is started before the existing confirmed restore; app starts only after restoring the compatible database. Docker Compose `create` flags were checked against the installed CLI help. No restore was executed.

## Final local verification (2026-11-10)

- `pnpm lint`: passed. Generated Playwright reports and browser-tool artifacts are excluded from source linting; all application and test sources remain checked.
- `pnpm format:check`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 93 tests passed in 10 files.
- `pnpm test:e2e`: 24 browser tests passed, including the original main scenario, the full bidirectional A/B acceptance scenario, device-local sign-out, rolling cookie/database expiry, groups and all six private overdue scenarios. The runner's real migration, seed, ownership-operation and auth-protocol checks also passed against disposable PostgreSQL and Mailpit.
- Production Next.js build completed during the same runner. OpenSpec strict validation and `git diff --check` passed.
- An earlier run was invalidated by a trace archive error while a test source was being formatted. The final complete run used unchanged source files and retained trace/error checks.

## Manual local inbox and device walkthrough

- Started `pnpm test:e2e --preview` with a clean disposable database and loopback-only Mailpit. No existing development database was used.
- Requested `manual-a@example.test` through the visible login form, opened the Russian message in the Mailpit browser inbox and clicked its actual sign-in link. The account started empty; creating a contact and note succeeded.
- In an independent browser context, signed in as `manual-b@example.test` through its actual inbox message. Its list was empty and the direct URL of A's contact showed `Контакт не найден`. Returning to A still showed the original contact and note.
- Signed B out, then signed into A in that second context through a newly delivered message. A's saved contact appeared. Signing A out in the first context returned it to login while the second context still opened A's contact and note.
- Opening A's already used original link showed `Ссылка устарела, запроси новую` and the recovery link.
- This records A17 and the documented two-address/device walkthrough locally. Real Resend delivery and production rollout verification remain pending.
