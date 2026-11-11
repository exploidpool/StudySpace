import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { telegramGreetingName } from './telegram-display.ts'

describe('Telegram greeting name', () => {
  it('adds @ to a short Telegram username', () => {
    assert.equal(telegramGreetingName({ username: 'short_name', first_name: 'Алексей' }), '@short_name')
  })

  it('keeps a 12-character username intact', () => {
    assert.equal(telegramGreetingName({ username: 'abcdefghijkl', first_name: 'Алексей' }), '@abcdefghijkl')
  })

  it('truncates a longer username after 12 characters', () => {
    assert.equal(telegramGreetingName({ username: 'abcdefghijklm', first_name: 'Алексей' }), '@abcdefghijkl…')
  })

  it('falls back to first_name when username is absent', () => {
    assert.equal(telegramGreetingName({ first_name: 'Алексей' }), 'Алексей')
  })

  it('returns null outside Telegram user context', () => {
    assert.equal(telegramGreetingName(null), null)
  })
})
