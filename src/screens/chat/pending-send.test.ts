import { afterEach, describe, expect, it } from 'vitest'
import {
  clearPendingMessage,
  hasPendingGeneration,
  resetPendingSend,
  setPendingGeneration,
} from './pending-send'

afterEach(() => {
  resetPendingSend()
  clearPendingMessage('main')
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})

describe('pending-send cleanup', () => {
  it('resetPendingSend clears the in-memory generation flag', () => {
    setPendingGeneration(true)
    expect(hasPendingGeneration()).toBe(true)

    resetPendingSend()

    expect(hasPendingGeneration()).toBe(false)
  })
})
