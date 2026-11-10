# Spec Delta

## MODIFIED Requirements

### Requirement: Пользовательские группы

An authenticated user SHALL be able to view their own groups and create groups with custom names. Group creation MUST NOT require existing contacts. The application MUST persist groups and memberships between visits, including another browser signed into the same account. Groups belonging to other accounts MUST NOT be exposed.

#### Scenario: Создать свою группу
- **WHEN** an authenticated user creates «Теннис»
- **THEN** the group appears in that user's group list and contact selectors
- **AND** the new group has no members

#### Scenario: Создать группу без контактов
- **WHEN** the current user has no contacts and opens group management
- **THEN** the user can create «Семья»

#### Scenario: Открыть в другом браузере
- **WHEN** a user creates groups and assigns contacts, then signs into the same account in another browser
- **THEN** the same group names and memberships are available
- **AND** another account does not receive those groups or memberships

### Requirement: Проверка названия группы

A group name MUST be nonempty after trimming surrounding whitespace, which MUST be removed on save. Creation and renaming MUST reject another group with the same name, ignoring case and surrounding whitespace, only within the current owner's account. On error, the form SHALL explain the problem and preserve the entered name. Different users MUST be allowed to use the same name independently.

#### Scenario: Пустое название
- **WHEN** a user saves a name containing only whitespace
- **THEN** the form says a name is required
- **AND** no group is created or renamed

#### Scenario: Пробелы по краям
- **WHEN** a user creates a group named «  Аналитики  »
- **THEN** it is stored and displayed as «Аналитики»

#### Scenario: Повтор при создании
- **WHEN** the current user already owns «Друзья» and creates « друзья »
- **THEN** the form reports the duplicate
- **AND** no second group is created and the entered name remains in the form

#### Scenario: Повтор при переименовании
- **WHEN** the current user owns «Друзья» and «Теннис» and renames «Теннис» to «ДРУЗЬЯ»
- **THEN** the form reports the duplicate
- **AND** both groups retain their previous names and memberships

#### Scenario: Identical names in different accounts
- **WHEN** A owns «Друзья» and B creates or renames B's group to « друзья »
- **THEN** B's save succeeds with the trimmed name
- **AND** neither user's group exposes or changes the other user's members
