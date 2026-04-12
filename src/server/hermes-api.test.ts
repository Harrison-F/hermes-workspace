import { describe, expect, it } from 'vitest'
import { toChatMessage, type HermesMessage } from './hermes-api'

describe('toChatMessage media normalization', () => {
  it('converts MEDIA paths into attachments and removes the marker from text', () => {
    const message: HermesMessage = {
      id: 1,
      session_id: 'session-1',
      role: 'assistant',
      content:
        'Here is the chart.\n\nMEDIA:/Users/test/chart.png\n\nLet me know if you want a second export.',
      timestamp: 1,
    }

    const result = toChatMessage(message) as Record<string, any>

    expect(result.text).toBe('Here is the chart.\n\nLet me know if you want a second export.')
    expect(result.attachments).toEqual([
      {
        id: 'media-1',
        name: 'chart.png',
        contentType: 'image/png',
        url: '/api/local-media?path=%2FUsers%2Ftest%2Fchart.png',
        previewUrl: '/api/local-media?path=%2FUsers%2Ftest%2Fchart.png',
      },
    ])
    expect(result.content).toEqual([
      { type: 'text', text: 'Here is the chart.\n\nLet me know if you want a second export.' },
    ])
  })
})
