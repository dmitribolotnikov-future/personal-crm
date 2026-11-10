# Tasks

## 1. Confirm migration input and prepare dependencies

- [x] 1.1 Ask the owner how the application should obtain the email that receives existing records and demo data; record the answer in this design and confirm there is no guessed address or fallback. Verify the agreed mechanism serves both migrations and seeding.
- [x] 1.2 Check current stable Better Auth, Nodemailer, Mailpit, and required type/adapter package releases against official sources. Discuss any additional direct library not already selected in the source specification before installing it; add agreed dependencies with pnpm and verify installation and the lockfile.
- [x] 1.3 Create the two-context login acceptance test skeleton and owner-isolation operation matrix. Run the new tests against the existing behavior and record the expected failures for missing authentication and shared data; preserve the separate existing main-scenario test.

## 2. Auth schema, ownership migration, and demo data

- [x] 2.1 Write and run a failing isolated-database migration test for D10 with pre-login contacts, notes, groups, and memberships. Check counts, IDs, every preserved field/timestamp, frequencies, and relationships; preserve the earlier frequency migration regression fixture.
- [x] 2.2 Generate/review the selected Better Auth schema and add Drizzle migrations for auth/link-request state, the confirmed owner, contact/group ownership, owner-scoped group uniqueness, and composite membership foreign keys. Verify D10 passes and direct cross-owner membership inserts are rejected by PostgreSQL.
- [x] 2.3 Add failing tests for missing/invalid owner input, transaction failure, fresh-database migration, and repeated migration. Implement the agreed connection-scoped migration input and unify local and production migration entry points; verify no partial backfill or reassignment and no owner input requirement for a completed backfill.
- [x] 2.4 Write a failing D11 seed test including another user's similar demo records. Make seeding owner-aware and idempotent; verify only the intended owner receives demo contacts/notes and existing records are preserved.
- [x] 2.5 Document migration/seed setup and preservation checks in README.md. Deliver the exact data-changing migration and before/after test result for the owner's review before merge; verify that the migration contains no hardcoded personal email or secret.

## 3. Email transport and real test infrastructure

- [x] 3.1 Add Docker Mailpit for local use and a disposable loopback-only Mailpit container to the existing e2e runner. Verify the real inbox/API receives mail for a unique test address, external relay is disabled, and cleanup stops only the runner's own containers; no automatic tests for deployment scripts or CI configuration.
- [x] 3.2 Write failing A16 email-content and transport-configuration tests, then implement the one server-only Nodemailer transport and Russian HTML/text email template. Verify real SMTP delivery into Mailpit, exact sender/subject/copy, and the trusted absolute login URL.
- [x] 3.3 Implement an e2e helper that polls Mailpit for the exact recipient and obtains the real link. Verify A18 with a real browser and database, no mocked auth/delivery, and no fabricated session cookie.
- [x] 3.4 Document local SMTP/inbox setup and the runtime delivery settings in README.md, with no real secrets or values in `.env.example`. Run the A17 manual inbox check and record its result; do not read or write `.env`.

## 4. Magic-link lifecycle and public auth boundary

- [x] 4.1 Write failing A03, A05, A06, and A07 tests, then configure Better Auth and server normalization/validation. Verify existing/new addresses get indistinguishable confirmations, equivalent addresses resolve to one account, and first verification asks for no name or password.
- [x] 4.2 Write failing A08-A11 tests and implement 900-second lifetime, stale-link handling, and durable latest-link state around the real auth handler. Verify expiry boundaries, reuse, simultaneous redemption, and replacement/redemption races without weakening Better Auth's verification.
- [x] 4.3 Write failing A12-A13 rolling-window and concurrent-request tests, then implement PostgreSQL serialization and quota reservation for normalized addresses. Verify direct raw auth requests cannot bypass the rule, independent recipients have independent allowances, restart does not reset state, and rate-limited requests do not replace the latest link.
- [x] 4.4 Verify all public issuance/verification paths pass the guarded boundary. Run the release-specific integration proof with real PostgreSQL and Mailpit, including cleanup/release after errors; revise the wrapper if a library hook cannot cover the contract before proceeding.
- [x] 4.5 Add the auth endpoint/link behavior and operational error handling to the README verification instructions. Verify SMTP failures log no credential/token and retain the specified generic confirmation; do not introduce another user-facing error flow.

## 5. Login UI, sessions, and device sign-out

- [x] 5.1 Write failing A01, A02, A04, and D08 browser/server tests, then add the public login and stale-link pages, protected CRM route layout, and empty-account copy. Verify exact Russian messages, direct anonymous requests denied, public `/health`, and existing design-token use on narrow and wide screens.
- [x] 5.2 Write failing A14 tests with isolated session timestamps, then implement 30-day rolling sessions and response-cookie renewal on each visit through supported auth routes. Verify persistence across browser restarts, expiry after inactivity, and renewal of both database and browser expiration without long sleeps or production test bypasses.
- [x] 5.3 Write failing A15 and D09 tests, then add the account email and «Выйти» header control with current-session revocation. Verify the first device loses server access immediately, the second stays signed in, and switching accounts does not retain the previous user's rendered data.
- [x] 5.4 Document sign-in, stale-link recovery, multiple devices, and device-local sign-out in README.md. Walk through the documented flow using two real Mailpit addresses and record the observed outcome.

## 6. Server reads, mutations, groups, and overdue isolation

- [x] 6.1 Write failing D02-D03 tests, then require server-verified user identity for every read in `src/lib/data.ts`. Scope contact/group/membership/note joins and serialized results before they reach the browser; verify foreign and missing contact IDs show «Контакт не найден» with no data leak.
- [x] 6.2 Write failing D01 and D04 tests, then make `saveContact` and contact actions require the trusted owner. Verify creation ignores a forged owner, updates/deletes cannot affect another account, foreign group assignment rolls back all changes, and row locks/uniqueness checks retain owner predicates.
- [x] 6.3 Write failing D05 tests for every note operation and `markContacted`, then scope them through the owned parent contact. Verify another user's note bodies/timestamps and communication dates remain unchanged after every refused operation.
- [x] 6.4 Write failing D06-D07 tests, then scope group helpers/actions, duplicate checks, inline group creation, members, selectors, and filters. Verify foreign operations disclose nothing, inline failures leave no partial group/membership, and own operations still work.
- [x] 6.5 Write failing tests for all eight `contact-groups` delta scenarios, reusing existing same-owner validation tests where they already match. Implement owner-scoped duplicate-name handling and authenticated cross-browser persistence; verify A and B can each own «Друзья» while own-account duplicates remain invalid.
- [x] 6.6 Write failing tests for all six `keep-in-touch` delta scenarios, then scope overdue queries/actions to the user. Verify only owned overdue contacts appear, correct ordering/dates/inflection remain intact, and search/group filters still affect only the ordinary list.
- [x] 6.7 Document private groups, same-account cross-browser behavior, and per-user overdue contacts in README.md. Audit every server DB call against the operation matrix and verify no optional owner parameter, shared fallback, or global user-data cache remains.

## 7. Existing acceptance and regression integration

- [x] 7.1 Update existing test database helpers and group/contact/overdue fixtures to include their test owner. Adapt the original `e2e/main-scenario.spec.ts` to real email-link sign-in in both browsers; verify it remains a separate test and all its previous contact/search/note assertions still pass.
- [ ] 7.2 Complete a separate two-user e2e acceptance test in `e2e/login.spec.ts`: A and B sign in through real Mailpit email links in independent browser contexts; each creates a contact, note, and group. Verify isolation in both directions: neither user sees the other's contacts in lists/search or overdue results, notes, groups, filter options, or group members. Direct links to the other's contact show «Контакт не найден», and direct links to the other's group reveal no group or members. Verify each user can still see their own saved data. Run against real Docker PostgreSQL and Mailpit without mocks, locally and in the existing GitHub e2e job; retain the original main-scenario e2e as a separate test. This covers D02 and the read-isolation behavior of D03, D05-D07, and K06.
- [x] 7.3 Run the scenario-to-test audit below and the existing application checks: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e`. Verify every automatic scenario has a named passing test and keep all existing checks and assertions enabled.

## 8. Image, controlled rollout, and manual recovery

- [ ] 8.1 Update production Compose runtime configuration and Docker image contents for the auth schema and migration/seed imports. Verify the same image builds without production auth/SMTP secrets and can run app, migrate, and seed jobs with runtime settings. Use the existing CI image build; do not create a script-specific workflow.
- [ ] 8.2 Prepare the existing deployment scripts for this incompatible ownership transition: backup first, stop the old app before ownership migration, migrate once from the new image, start it only after success, and smoke public `/health`. Review the exact shell changes and verify by the real deployment; add no automatic deployment/CI tests or rollback.
- [x] 8.3 Document the D12 paired manual recovery procedure using the existing restore confirmation/safety backup and a compatible previous image, without restarting a mismatched image or rerunning the login migration. Verify the command sequence by review before merge; the owner alone performs restore/recovery and records any execution result.
- [x] 8.4 Give the owner concrete server `.env` lines to add, secret-generation commands to run personally, and required Resend/DNS setup. Verify readiness through owner confirmation, without reading/writing `.env`, displaying passwords/keys, or changing unrelated server configuration; keep `.env` permissions 600.
- [ ] 8.5 After the authorized merge/deployment, record A19's real production email test and the rollout smoke, owner record-count checks, two-user isolation, and device-local sign-out. Report a failed smoke immediately and leave recovery to the owner; verify only current/previous images remain and existing log caps are preserved.

## Scenario verification map

Each row is a separate named test or, for server operations, a separate recorded manual test. Operation-matrix rows expand into individual assertions for each listed operation. Existing scenario titles remain identifiers when modifying existing capabilities.

| Scenario | Required verification |
| --- | --- |
| A01 Anonymous access | Browser/server test: `anonymous CRM access requires sign-in` |
| A02 Public operational endpoint | HTTP test: `health remains public` |
| A03 Equivalent addresses | Real-auth test: `email variants share account and policy state` |
| A04 Invalid email in the form | Browser test: `invalid email shows field error without mail` |
| A05 Invalid direct request | HTTP test: `invalid direct sign-in request sends no mail` |
| A06 Existing and new addresses | Real-auth test: `new and existing email confirmations match` |
| A07 First and subsequent sign-in | Real-auth test: `first verification creates one passwordless account`; browser `new account starts empty with first-contact prompt` |
| A08 Link within its lifetime | Real-auth test: `latest unused link works before expiry` |
| A09 Expired link | Real-auth test: `link expires at fifteen minutes` |
| A10 Used link and concurrent redemption | Real-auth test: `link redemption succeeds only once` |
| A11 Replacement link | Real-auth test: `new link invalidates earlier links` |
| A12 Limit and recovery | Real-auth test: `send allowance recovers as the rolling window advances` |
| A13 Concurrent and independent recipients | Real-auth test: `concurrent normalized recipients share one allowance` |
| A14 Rolling session expiration | Browser/database test: `each visit renews a thirty-day device session` |
| A15 Header and device-local sign-out | Browser test: `sign-out revokes only the current device` |
| A16 Email content and destination | Mailpit test: `sign-in email matches content and trusted URL` |
| A17 Local development inbox | Manual local test: arbitrary address -> Mailpit inbox -> successful link sign-in |
| A18 Automated email-link sign-in | Runner/browser test: `acceptance signs in through real Mailpit delivery` |
| A19 Production delivery from the same image | Manual production test: real Resend delivery and successful sign-in from the same built image |
| D01 Forged owner and membership | Server/database test: `owner spoofing and cross-owner assignment cannot change data` |
| D02 Two-user acceptance scenario | Separate two-context e2e: `signed-in users cannot see each others contacts notes or groups`; check both directions and preserve access to own data |
| D03 Direct read and edit requests | Server/browser test: `foreign contact reads match missing contact behavior` |
| D04 Contact mutation matrix | Server/database tests: `foreign contact update and delete are refused` |
| D05 Note and contacted mutation matrix | Server/database tests: `foreign note reads and writes and mark-contacted are refused` |
| D06 Group read and mutation matrix | Server/database tests: `foreign group operations and inline creation are refused` |
| D07 Group selectors and filters | Browser/server test: `foreign groups never enter selectors filters or serialized results` |
| D08 New account | Browser test: `new account starts empty with first-contact prompt` |
| D09 Same account and switched account | Browser test: `cross-browser persistence and account switching retain only current data` |
| D10 Legacy data transfer | Isolated migration test: `legacy ownership backfill preserves all records and fields` |
| D11 Owner demo data | Isolated seed test: `demo seed belongs to owner and is safe to repeat` |
| D12 Manual recovery instructions | Manual review/test: paired backup/image procedure and no automatic smoke rollback |
| contact-groups / Создать свою группу | Group test: `created group belongs to the current user and starts empty` |
| contact-groups / Создать группу без контактов | Group test: `account without contacts can create a group` |
| contact-groups / Открыть в другом браузере | Browser test: `same-account groups persist across browsers` |
| contact-groups / Пустое название | Existing validation test: `group names reject empty or whitespace-only input` |
| contact-groups / Пробелы по краям | Existing validation test: `group names trim display text and normalize Cyrillic case` |
| contact-groups / Повтор при создании | Owner-aware group test: `own duplicate group creation is rejected` |
| contact-groups / Повтор при переименовании | Owner-aware group test: `own duplicate group rename preserves both groups` |
| contact-groups / Identical names in different accounts | Group test: `different owners can create and rename identical group names` |
| keep-in-touch / Есть просроченные контакты | Owner-aware overdue test: `owned overdue entries show days and contacted button` |
| keep-in-touch / Просроченных нет | Owner-aware overdue test: `foreign overdue contacts do not create an empty owners block` |
| keep-in-touch / Переход в карточку | Browser test: `owned overdue entry opens its contact` |
| keep-in-touch / Поиск не меняет блок | Browser test: `search and group filters do not change owned overdue entries` |
| keep-in-touch / Тот же результат в другом браузере | Browser test: `same-account overdue results persist across browsers` |
| keep-in-touch / Another account has overdue contacts | Server/browser test: `overdue results exclude every other owner` |

## Workflow follow-up

- On the owner's commit-and-push instruction, commit this work on its feature branch, push, open a PR to `main`, and enable squash auto-merge unless the owner requests otherwise.
- After merge, switch to updated `main` and remove the merged local branch. Complete the real rollout/human verification tasks before marking the feature accepted.
- Sync the final delta requirements and archive only after implementation, acceptance, and the owner's requested workflow are complete.
