/*
 * Builtin keys that changed (DECISIONS #134): no key names a person, so the library prayers once keyed
 * `<lang>.lovy-<slug>` are `<lang>.life-<slug>`. A builtin text's id is `builtin:<key>` and is kept in many rows — the
 * text, its segments, attempts and stats, per-text achievement keys (`ruleId:textId`), run plans, templates, tasks, the
 * XP ledger's `refId` — so the rename goes through every string of a row. The v6 upgrade renames a device's rows;
 * every restore renames older backups and restore points.
 */
const OLD_KEY = /\b(en|pl)\.lovy-/g

/** `value` with an old builtin key, or an id or key holding one, renamed. */
export const renamedKey = (value: string): string => value.replace(OLD_KEY, '$1.life-')

/** `value` with every string renamed by {@link renamedKey}; the same object when nothing changes. */
export function withRenamedKeys<T>(value: T): T {
  if (typeof value === 'string') return renamedKey(value) as T
  if (Array.isArray(value)) {
    const items = value.map(withRenamedKeys)
    return items.some((item, index) => item !== value[index]) ? (items as T) : value
  }
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value).map(([key, item]) => [key, withRenamedKeys(item)] as const)
    return entries.some(([key, item]) => item !== (value as Record<string, unknown>)[key]) ? (Object.fromEntries(entries) as T) : value
  }
  return value
}

