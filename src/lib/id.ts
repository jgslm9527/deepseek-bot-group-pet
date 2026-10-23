/** Lexicographically sortable local id. No network or crypto service needed. */
export function newId(prefix = 'id'): string {
  const random = crypto.getRandomValues(new Uint32Array(2))
  const suffix = Array.from(random, (part) => part.toString(36)).join('')
  return `${prefix}_${Date.now().toString(36)}_${suffix}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
