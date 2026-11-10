# user-data-isolation Specification

## Purpose

Keep each person's contacts, notes, and groups private across every CRM operation, and preserve existing records when moving the shared database to personal accounts.

## Requirements

### Requirement: Ownership derived from the authenticated user

Every contact and group MUST have an owner. Notes MUST belong to the owner of their parent contact. The server MUST determine the current user from the verified session, never from a submitted owner identifier. Memberships MUST connect a contact and group belonging to the same owner.

#### Scenario: D01 Forged owner and membership
- **WHEN** user B submits user A's identifier as owner or tries to assign B's contact to A's group
- **THEN** B cannot create or transfer data into A's account or create the cross-owner membership
- **AND** the attempted membership update preserves the previously saved contact and memberships

### Requirement: Private contact reads and search

Contact lists, search results, detail and edit pages MUST contain only the current user's contacts. Requesting another user's contact MUST behave like requesting a missing contact, showing «Контакт не найден» on the direct contact page. Server responses MUST NOT include hidden foreign records.

#### Scenario: D02 Two-user acceptance scenario
- **WHEN** A signs in through an email link and creates a contact, and B signs in through a separate email link
- **THEN** B cannot see A's contact in the list or name search
- **AND** the direct link to A's contact shows «Контакт не найден»
- **AND** A can still access that contact

#### Scenario: D03 Direct read and edit requests
- **WHEN** B requests the details or edit page of A's contact, including a direct server request using its identifier
- **THEN** no fields, notes, or group data belonging to A are returned
- **AND** foreign and absent identifiers receive the same unavailable-record behavior

### Requirement: Private contact mutations

The server MUST authorize contact creation, updates, and deletion using the authenticated owner. A request with another person's contact identifier MUST NOT modify or delete the contact, its notes, its memberships, or communication-frequency state.

#### Scenario: D04 Contact mutation matrix
- **WHEN** B directly attempts each update and deletion operation against A's contact
- **THEN** every operation is refused and A's complete contact state remains unchanged
- **AND** the same operations remain available for B's own contacts

### Requirement: Notes authorized through their contact

Listing, creating, editing, and deleting notes and the «Связались» action MUST verify ownership through the parent contact on the server. Supplying a note identifier or contact identifier belonging to another user MUST NOT expose or change notes or communication dates.

#### Scenario: D05 Note and contacted mutation matrix
- **WHEN** B directly attempts to list, add, update, or delete notes for A, or invoke «Связались» for A's contact
- **THEN** each attempt fails to disclose or change A's notes and communication dates
- **AND** B can perform these operations for B's own contacts and notes

### Requirement: Private groups and memberships

The server MUST restrict group lists, details, members, creation, renaming, deletion, contact group selectors, inline group creation, and membership changes to the current owner. Requests with foreign group or contact identifiers MUST NOT reveal or modify those records or create partial changes.

#### Scenario: D06 Group read and mutation matrix
- **WHEN** B directly requests A's group or members, renames or deletes A's group, or creates an inline group for A's contact
- **THEN** A's group, members, contacts, and notes are neither disclosed nor changed
- **AND** a failed inline creation leaves no newly created group or membership

#### Scenario: D07 Group selectors and filters
- **WHEN** B opens contact group selectors or filters and submits A's group identifier directly as a filter
- **THEN** only B's groups, contacts, and membership labels can appear in any response
- **AND** no information about A's group members is disclosed

### Requirement: Empty account and account persistence

A new account with no owned contacts SHALL show an empty list and «Добавь первый контакт». Signing into the same account in another browser MUST show its saved data. Signing into a different account on the same browser MUST NOT retain the previous account's data in the rendered CRM.

#### Scenario: D08 New account
- **WHEN** a new person verifies their first sign-in link
- **THEN** the contact list is empty and shows «Добавь первый контакт»
- **AND** no existing or demo contacts owned by another account appear

#### Scenario: D09 Same account and switched account
- **WHEN** A signs into a second browser and later signs out and signs in there as B
- **THEN** the second browser first shows A's saved contacts and then only B's contacts
- **AND** A's data is not retained in B's rendered pages or returned server data

### Requirement: Preserve existing records under the original owner

All contacts, notes, and groups present before this change MUST become accessible to the user with the owner's email, supplied through a mechanism confirmed with the owner during implementation. No record or membership MUST be lost. Demo seeding MUST target that same owner and remain safe to repeat.

#### Scenario: D10 Legacy data transfer
- **WHEN** the ownership migration runs on a database containing existing contacts, notes, groups, and memberships
- **THEN** all records retain their identifiers, contents, timestamps, relationships, and communication-frequency state
- **AND** row counts remain unchanged, all contacts and groups belong to the intended owner, and another account cannot access them

#### Scenario: D11 Owner demo data
- **WHEN** demo seeding runs and then runs again for the confirmed owner
- **THEN** demo contacts and their notes belong only to that owner and are not duplicated
- **AND** seeding does not modify another user's records or mistake them for already seeded owner data

### Requirement: Consistent recovery boundary

Recovery after deploying authentication MUST pair the previous application version with the database backup taken before this deployment. Recovery MUST be manual, using the existing confirmed restore process; the deployment MUST NOT automatically roll back after a failed smoke check.

#### Scenario: D12 Manual recovery instructions
- **WHEN** the operator reviews the documented recovery procedure for this change
- **THEN** it identifies both the pre-deployment backup and previous image, requires human-run restore and image selection, and prevents normal migration-on-start from reapplying the login migration during recovery
- **AND** the deployment reports a failed smoke without performing an automatic rollback
