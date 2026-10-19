// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { matchesTags } from '@/lib/utils/tag-filter'
import { normalizeAudience } from '@/features/broadcasts/audience'
describe('tag matching', () => {
 const selected = new Set(['Touch Base', 'Buyer'])
 it('distinguishes partial and full matches', () => {
  expect(matchesTags(['Buyer'], selected, 'any')).toBe(true)
  expect(matchesTags(['Buyer'], selected, 'all')).toBe(false)
  expect(matchesTags(['Buyer','Touch Base','Extra'], selected, 'all')).toBe(true)
  expect(matchesTags(null, selected, 'any')).toBe(false)
  expect(matchesTags(undefined, selected, 'all')).toBe(false)
  expect(matchesTags([], new Set(), 'all')).toBe(true)
 })
 it('persists AND, preserves legacy defaults and rejects malformed modes', () => {
  expect(normalizeAudience({tags:['Buyer'],tag_match:'all'})).toEqual({tags:['Buyer'],tag_match:'all'})
  expect(normalizeAudience({tags:['Buyer']})).toEqual({tags:['Buyer']})
  expect(normalizeAudience({tags:['Buyer'],tag_match:'invalid'})).toBeNull()
 })
})
