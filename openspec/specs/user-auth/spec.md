# user-auth Specification

## Purpose

Let people access their personal CRM through an email link without passwords, with predictable link expiry, device sessions, and email delivery in every environment.

## Requirements

### Requirement: Authentication required for CRM access

The application SHALL show a login page with an email field and «Получить ссылку» to visitors without a valid session. CRM pages and server operations MUST require authentication. Authentication routes and `/health` MUST remain reachable without signing in.

#### Scenario: A01 Anonymous access
- **WHEN** a visitor without a valid session opens the home page or a direct CRM page
- **THEN** the visitor sees the login page and no CRM data
- **AND** a direct unauthenticated CRM read or mutation cannot access or change data

#### Scenario: A02 Public operational endpoint
- **WHEN** an unauthenticated client requests `/health`
- **THEN** the existing health response remains available without a login redirect

### Requirement: Email normalization and validation

The application MUST trim surrounding whitespace and treat email addresses case-insensitively. Invalid addresses MUST show «Проверь адрес почты» under the field and MUST NOT trigger an email. Server validation MUST enforce the same rule for requests that bypass the form.

#### Scenario: A03 Equivalent addresses
- **WHEN** a person signs in using surrounding spaces or different letter casing for an existing email address
- **THEN** the same account and its data are used, with no duplicate account
- **AND** send limits and link replacement use that same normalized address

#### Scenario: A04 Invalid email in the form
- **WHEN** a visitor submits an invalid email address in the login form
- **THEN** «Проверь адрес почты» appears under the email field and no email is sent

#### Scenario: A05 Invalid direct request
- **WHEN** a client bypasses the form and sends an invalid email address to the sign-in server endpoint
- **THEN** server validation rejects it and no email is sent

### Requirement: Indistinguishable sign-in requests

After a valid sign-in request, the application SHALL show «Ссылка для входа отправлена на <почта>», with the normalized submitted address, for both new and existing accounts. The response MUST NOT reveal account existence. A reached email limit SHALL instead show the specified limit message.

#### Scenario: A06 Existing and new addresses
- **WHEN** a visitor requests links for a new address and an existing address, neither at its limit
- **THEN** both requests show the same confirmation pattern and send sign-in emails
- **AND** neither response identifies whether the account already exists

### Requirement: Registration through first verified sign-in

The first successful email-link verification SHALL create the person's account and sign them in without a separate registration form or a name field. Later successful verifications SHALL sign into the same account. Passwords and other sign-in methods MUST NOT be offered.

#### Scenario: A07 First and subsequent sign-in
- **WHEN** a new person opens their valid email link and later signs in again with another valid link
- **THEN** the same account is used on both occasions without requesting a name or password

### Requirement: Single-use expiring and replaceable links

A sign-in link MUST work once within 15 minutes of issuance. Requesting a new link for the same normalized email MUST invalidate earlier links. Expired, replaced, invalid, or already used links SHALL show «Ссылка устарела, запроси новую» and a button leading to the login page.

#### Scenario: A08 Link within its lifetime
- **WHEN** a visitor opens the latest unused link less than 15 minutes after issuance
- **THEN** the visitor is signed in and sees their contacts

#### Scenario: A09 Expired link
- **WHEN** a visitor opens a link at or after 15 minutes from issuance
- **THEN** no session is created and the stale-link message and login button are shown

#### Scenario: A10 Used link and concurrent redemption
- **WHEN** a previously used link is opened again, or two clients redeem the same link concurrently
- **THEN** only the first successful redemption can create a session
- **AND** every subsequent redemption shows the stale-link message and login button

#### Scenario: A11 Replacement link
- **WHEN** a visitor requests another link using an equivalent normalized address
- **THEN** every earlier unconsumed link fails with the stale-link message
- **AND** the newest link works within its lifetime

### Requirement: Email send limit per address

The system MUST allow at most three sign-in emails for a normalized email address in any ten-minute period, including concurrent requests and requests from different devices. Further requests SHALL send no email and show «Слишком часто, попробуй через несколько минут».

#### Scenario: A12 Limit and recovery
- **WHEN** three emails have been sent to an address during the preceding ten minutes and another request arrives
- **THEN** no fourth email is sent and the limit message is shown
- **AND** after enough time passes for an earlier send to leave the window, a new request is allowed

#### Scenario: A13 Concurrent and independent recipients
- **WHEN** multiple devices request links concurrently for case and whitespace variants of the same address
- **THEN** together they receive at most three emails in the ten-minute window
- **AND** a different address has its own independent allowance

### Requirement: Device sessions and header

The application MUST retain a session for 30 days since the latest authenticated visit on that device. Multiple devices MUST be usable concurrently. The authenticated header SHALL display the user's email and «Выйти». Sign-out MUST terminate only the current device's session and return to the login page.

#### Scenario: A14 Rolling session expiration
- **WHEN** a user returns before 30 days of inactivity on a device
- **THEN** the device remains signed in and the next inactivity deadline is 30 days after that visit
- **AND** after 30 days without a visit the device requires sign-in again

#### Scenario: A15 Header and device-local sign-out
- **WHEN** the same user is signed in on two devices and clicks «Выйти» on the first
- **THEN** the first device returns to login and its old session no longer authorizes server requests
- **AND** the second device remains signed in with the account email shown in its header

### Requirement: Sign-in email content

The sender SHALL be «Личная CRM» at `noreply@mail.crm.<owner-domain>`. The subject SHALL be «Вход в Личную CRM». The email SHALL contain a «Войти» button, state that the link works for 15 minutes, and say «Если вы не запрашивали вход - просто проигнорируйте письмо».

#### Scenario: A16 Email content and destination
- **WHEN** a sign-in email is captured or delivered
- **THEN** it contains the specified sender, subject, button, lifetime, and ignore-request text
- **AND** the button opens the issued sign-in link for the configured application address

### Requirement: Runtime-configured email delivery

Local development and all automated tests MUST deliver email only to Mailpit, which has a browser inbox and accepts arbitrary recipient addresses. Production MUST send real emails through Resend. Runtime configuration MUST select delivery without changing the application build.

#### Scenario: A17 Local development inbox
- **WHEN** the developer requests sign-in for an arbitrary address locally
- **THEN** the message appears in the Docker Mailpit browser inbox and its link signs the developer in
- **AND** no real email is sent

#### Scenario: A18 Automated email-link sign-in
- **WHEN** the browser acceptance tests run locally or on GitHub
- **THEN** they obtain real sign-in links from Mailpit and sign in against real PostgreSQL
- **AND** no auth or email mock and no real external delivery is used

#### Scenario: A19 Production delivery from the same image
- **WHEN** the same application image runs with production delivery settings
- **THEN** the sign-in email is delivered through Resend to the real recipient
- **AND** no rebuild or environment-specific email implementation is needed
