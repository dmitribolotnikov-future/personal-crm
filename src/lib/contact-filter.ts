function normalize(text: string): string {
  return text.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
}

export function getContactFilterGroups<T extends { id: number }>(
  contactGroupIds: readonly number[],
  selectedGroups: readonly T[],
): T[] {
  return selectedGroups.filter((group) => contactGroupIds.includes(group.id));
}

export function resolveGroupFilters(
  selectedIds: readonly number[],
  groups: readonly { id: number }[],
): number[] {
  const available = new Set(groups.map((group) => group.id));
  return [...new Set(selectedIds)].filter((id) => available.has(id));
}

export function filterContacts<T extends { name: string; groupIds: number[] }>(
  contacts: readonly T[],
  query: string,
  groupIds: readonly number[],
): T[] {
  const search = normalize(query);
  return contacts.filter((contact) =>
    (groupIds.length === 0 || groupIds.some((groupId) => contact.groupIds.includes(groupId))) &&
    normalize(contact.name).includes(search),
  );
}
