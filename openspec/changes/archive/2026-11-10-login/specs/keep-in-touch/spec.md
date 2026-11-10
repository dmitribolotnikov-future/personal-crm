# Spec Delta

## MODIFIED Requirements

### Requirement: Блок «Пора связаться» на главной

The home page SHALL show «Пора связаться» above the contact list with all overdue contacts owned by the current authenticated user. Each entry SHALL show the name, days overdue with correct Russian inflection, and «Связались». Clicking the name SHALL open that contact. The block SHALL be absent when this user has no overdue contacts. Name search and group filters MUST NOT change the block. Another user's contacts MUST NOT be included.

#### Scenario: Есть просроченные контакты
- **WHEN** two of the current user's contacts are overdue and the rest are not overdue or have no frequency
- **THEN** the block above the list contains those two contacts
- **AND** each entry shows its days overdue with correct Russian inflection and «Связались»

#### Scenario: Просроченных нет
- **WHEN** the current user has no overdue contacts
- **THEN** the block is absent and the remaining home-page behavior is preserved
- **AND** overdue contacts owned by another user do not cause the block to appear

#### Scenario: Переход в карточку
- **WHEN** a user clicks a contact name in their overdue block
- **THEN** that user's contact detail page opens

#### Scenario: Поиск не меняет блок
- **WHEN** a user enters a name in contact search or selects group filters
- **THEN** only the ordinary contact list is filtered and the user's overdue block is unchanged

#### Scenario: Тот же результат в другом браузере
- **WHEN** a user signs into the same account in another browser and opens the home page
- **THEN** the overdue block contains the same owned contacts and deadlines

#### Scenario: Another account has overdue contacts
- **WHEN** both A and B have overdue contacts and B opens the home page
- **THEN** B's block includes all and only B's overdue contacts
- **AND** neither names nor communication dates from A appear in B's response
