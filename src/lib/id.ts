/** Random identifier for new rows (UUID v4 from the platform CSPRNG). */
export function newId(): string {
  return crypto.randomUUID()
}
