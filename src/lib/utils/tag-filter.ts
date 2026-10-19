export type TagMatch = "any" | "all"

export function matchesTags(tags: string[] | null | undefined, selected: ReadonlySet<string>, mode: TagMatch): boolean {
  if (selected.size === 0) return true
  const actual = new Set(tags ?? [])
  return mode === "all"
    ? [...selected].every(tag => actual.has(tag))
    : [...selected].some(tag => actual.has(tag))
}
