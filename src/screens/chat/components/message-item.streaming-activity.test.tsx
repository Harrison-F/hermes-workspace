import { describe, expect, it } from 'vitest'

import {
  buildHermesActivitySummary,
  buildStreamingToolDetailSummary,
  normalizeToolDetailText,
  shouldAutoExpandHermesActivityCard,
  shouldRenderStandaloneActivityMenu,
  shouldRenderStreamingThoughtSummary,
} from './streaming-activity-ui'

describe('streaming activity ui helpers', () => {
  it('renders the grouped tool card only once actual tool activity exists', () => {
    expect(
      shouldRenderStandaloneActivityMenu({
        isUser: false,
        isStreaming: true,
        hasRevealedText: false,
        streamToolCount: 0,
      }),
    ).toBe(false)

    expect(
      shouldRenderStandaloneActivityMenu({
        isUser: false,
        isStreaming: true,
        hasRevealedText: false,
        streamToolCount: 1,
      }),
    ).toBe(true)
  })

  it('auto-expands the tool card while tool calls are actively streaming', () => {
    expect(
      shouldAutoExpandHermesActivityCard({
        isStreaming: true,
        toolCount: 1,
      }),
    ).toBe(true)

    expect(
      shouldAutoExpandHermesActivityCard({
        isStreaming: true,
        toolCount: 0,
      }),
    ).toBe(false)

    expect(
      shouldAutoExpandHermesActivityCard({
        isStreaming: false,
        toolCount: 1,
      }),
    ).toBe(false)
  })

  it('suppresses the separate lightbulb thought summary during streaming, even before tools start', () => {
    expect(
      shouldRenderStreamingThoughtSummary({
        isStreaming: true,
        hasRevealedText: false,
        streamToolCount: 0,
        thinking: 'I should read the files first',
      }),
    ).toBe(false)

    expect(
      shouldRenderStreamingThoughtSummary({
        isStreaming: true,
        hasRevealedText: false,
        streamToolCount: 2,
        thinking: 'I should read the files first',
      }),
    ).toBe(false)
  })

  it('returns an idle summary when no tools are active', () => {
    expect(buildHermesActivitySummary([])).toMatchObject({
      countLabel: '0 calls',
      statusLabel: 'idle',
      visibleLabel: 'No active tools',
      collapsedLabel: 'No active tools',
    })
  })

  it('builds a compact TUI-style summary from active tool calls', () => {
    expect(
      buildHermesActivitySummary([
        {
          type: 'read_file',
          state: 'input-available',
          input: { path: '/tmp/AGENTS.md' },
        },
        {
          type: 'browser_navigate',
          state: 'output-available',
          input: { url: 'http://127.0.0.1:3002/chat/new' },
        },
      ]),
    ).toMatchObject({
      countLabel: '2 calls',
      statusLabel: '1 running',
      visibleLabel: 'read AGENTS.md, browser http://127.0.0.1:3002/chat/new',
      collapsedLabel: 'read AGENTS.md, browser http://127.0.0.1:3002/chat/new',
    })
  })

  it('normalizes generic missing-detail strings before rendering expanded output', () => {
    expect(normalizeToolDetailText('No detail available for this tool call')).toBe('')
    expect(normalizeToolDetailText('No output captured')).toBe('')
    expect(normalizeToolDetailText('  Captured 14 interactive elements  ')).toBe(
      'Captured 14 interactive elements',
    )
  })

  it('builds useful detail text instead of a generic missing-detail fallback', () => {
    expect(
      buildStreamingToolDetailSummary({
        type: 'browser_snapshot',
        state: 'output-available',
      }),
    ).toBe('browser snapshot completed')

    expect(
      buildStreamingToolDetailSummary({
        type: 'browser_snapshot',
        state: 'output-available',
        outputText: 'No detail available for this tool call',
        preview: 'Captured 14 interactive elements on /chat/new',
      }),
    ).toBe('browser snapshot completed: Captured 14 interactive elements on /chat/new')

    expect(
      buildStreamingToolDetailSummary({
        type: 'search_files',
        input: { pattern: 'streamToolCalls' },
        state: 'output-available',
        outputText: 'No output captured',
      }),
    ).toBe('search "streamToolCalls" completed: {"pattern":"streamToolCalls"}')

    expect(
      buildStreamingToolDetailSummary({
        type: 'exec',
        input: { command: 'npm test -- --run src/stores/chat-store.test.ts' },
        state: 'output-error',
        errorText: 'exit code 1',
      }),
    ).toMatch(/^exec npm test -- --run src\/store… failed: exit code 1$/)
  })
})
