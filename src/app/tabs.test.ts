import { describe, expect, it } from 'vitest'
import { tabOf } from './tabs'

describe('tabOf', () => {
  it('lights the tab of a section and of its sub-screens', () => {
    expect(tabOf('/')).toBe('today')
    expect(tabOf('/library')).toBe('library')
    expect(tabOf('/library/abc/edit')).toBe('library')
    expect(tabOf('/sessions/new')).toBe('sessions')
    expect(tabOf('/settings/mic-test')).toBe('settings')
  })

  it('puts the Bible under the library', () => {
    expect(tabOf('/bible')).toBe('library')
    expect(tabOf('/bible/pbg/GEN')).toBe('library')
  })

  it('puts the daily tasks under sessions', () => {
    expect(tabOf('/tasks')).toBe('sessions')
    expect(tabOf('/tasks/new')).toBe('sessions')
  })

  it('does not match a mere prefix or an unknown screen', () => {
    expect(tabOf('/libraryx')).toBeNull()
    expect(tabOf('/friend')).toBeNull()
  })
})
