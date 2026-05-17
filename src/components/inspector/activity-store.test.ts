import { beforeEach, describe, expect, it } from 'vitest'

import { pushActivity, useActivityStore } from './activity-store'

describe('activity-store', () => {
  beforeEach(() => {
    useActivityStore.getState().clear()
  })

  it('deduplicates identical consecutive tool activity events', () => {
    const event = {
      type: 'tool_call',
      time: '12:00:00 PM',
      text: 'read_file #abc · calling',
      name: 'read_file',
      phase: 'calling',
      runId: 'run-1',
      sessionKey: 'session-1',
      details: 'args:\n{"path":"README.md"}',
    }

    pushActivity(event)
    pushActivity({ ...event, time: '12:00:01 PM' })

    expect(useActivityStore.getState().events).toHaveLength(1)
  })

  it('keeps a bounded activity history', () => {
    for (let i = 0; i < 505; i += 1) {
      pushActivity({
        type: 'tool_call',
        time: String(i),
        text: `tool-${i}`,
        name: `tool-${i}`,
      })
    }

    const events = useActivityStore.getState().events
    expect(events).toHaveLength(500)
    expect(events[0].text).toBe('tool-5')
    expect(events.at(-1)?.text).toBe('tool-504')
  })
})
