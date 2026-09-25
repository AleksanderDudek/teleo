export type ClassValue = string | false | null | undefined | 0

/** Joins truthy class names (variants in this codebase never conflict, so no merging needed). */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
