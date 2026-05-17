export type DebugEventType = 'ui' | 'network' | 'console'

export type DebugEvent = {
  at: string
  type: DebugEventType
  message: string
  level?: 'info' | 'warn' | 'error'
}

export type DebugBundlePayload = {
  generatedAt: string
  route: string
  sessionKey: string | null
  selectedMessageId: string | null
  appVersion: string
  uiEvents: Array<DebugEvent>
  networkEvents: Array<DebugEvent>
  consoleEvents: Array<DebugEvent>
  stateSnapshot: Record<string, unknown>
}

const MAX_EVENTS = 20
const uiEvents: Array<DebugEvent> = []
const networkEvents: Array<DebugEvent> = []
const consoleEvents: Array<DebugEvent> = []
let installed = false
let lastSelectedMessageId: string | null = null

function pushEvent(target: Array<DebugEvent>, event: DebugEvent) {
  target.push(event)
  if (target.length > MAX_EVENTS) {
    target.splice(0, target.length - MAX_EVENTS)
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

export function matchesDebugShortcut(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): boolean {
  const mod = event.metaKey || event.ctrlKey
  return mod && event.shiftKey && event.altKey && event.key.toLowerCase() === 'l'
}

export function recordDebugUiEvent(message: string) {
  pushEvent(uiEvents, { at: nowIso(), type: 'ui', message })
}

export function buildDebugBundle(payload: DebugBundlePayload): string {
  return [
    'HERMES WORKSPACE DEBUG BUNDLE',
    `Generated At: ${payload.generatedAt}`,
    `App Version: ${payload.appVersion}`,
    `Route: ${payload.route}`,
    `Session Key: ${payload.sessionKey ?? 'none'}`,
    `Selected Message ID: ${payload.selectedMessageId ?? 'none'}`,
    '',
    'UI EVENTS',
    ...payload.uiEvents.map((event) => `- [${event.at}] ${event.message}`),
    '',
    'NETWORK EVENTS',
    ...payload.networkEvents.map((event) => `- [${event.at}] ${event.message}`),
    '',
    'CONSOLE EVENTS',
    ...payload.consoleEvents.map(
      (event) => `- [${event.at}] ${event.level ?? 'info'}: ${event.message}`,
    ),
    '',
    'STATE SNAPSHOT',
    JSON.stringify(payload.stateSnapshot, null, 2),
  ].join('\n')
}

export function getDebugBundlePayload(snapshot: {
  route: string
  sessionKey: string | null
  selectedMessageId: string | null
  appVersion?: string
  stateSnapshot: Record<string, unknown>
}): DebugBundlePayload {
  return {
    generatedAt: nowIso(),
    route: snapshot.route,
    sessionKey: snapshot.sessionKey,
    selectedMessageId: snapshot.selectedMessageId ?? lastSelectedMessageId,
    appVersion: snapshot.appVersion ?? 'dev',
    uiEvents: [...uiEvents],
    networkEvents: [...networkEvents],
    consoleEvents: [...consoleEvents],
    stateSnapshot: snapshot.stateSnapshot,
  }
}

export function installDebugCollectors() {
  if (installed || typeof window === 'undefined') return
  installed = true

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null
      const clickable = target?.closest('button, a, [data-debug-label]') as HTMLElement | null
      if (!clickable) return
      const messageElement = target?.closest('[data-chat-message-id]') as HTMLElement | null
      if (messageElement) {
        lastSelectedMessageId = messageElement.getAttribute('data-chat-message-id')
      }
      const label =
        clickable.getAttribute('data-debug-label') ||
        clickable.getAttribute('aria-label') ||
        clickable.textContent?.trim() ||
        clickable.tagName.toLowerCase()
      if (label) recordDebugUiEvent(`Clicked ${label}`)
    },
    true,
  )

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const input = args[0]
    const request = input instanceof Request ? input : null
    const url = typeof input === 'string' ? input : request?.url ?? 'unknown'
    const method = request?.method || (args[1]?.method ? String(args[1].method) : 'GET')
    try {
      const response = await originalFetch(...args)
      const finished = typeof performance !== 'undefined' ? performance.now() : Date.now()
      pushEvent(networkEvents, {
        at: nowIso(),
        type: 'network',
        message: `${method.toUpperCase()} ${url} -> ${response.status} (${Math.round(finished - started)}ms)`,
      })
      return response
    } catch (error) {
      const finished = typeof performance !== 'undefined' ? performance.now() : Date.now()
      pushEvent(networkEvents, {
        at: nowIso(),
        type: 'network',
        message: `${method.toUpperCase()} ${url} -> ERROR (${Math.round(finished - started)}ms): ${error instanceof Error ? error.message : String(error)}`,
      })
      throw error
    }
  }

  const originalError = console.error.bind(console)
  console.error = (...args: Array<unknown>) => {
    pushEvent(consoleEvents, {
      at: nowIso(),
      type: 'console',
      level: 'error',
      message: args.map((arg) => String(arg)).join(' '),
    })
    originalError(...args)
  }

  const originalWarn = console.warn.bind(console)
  console.warn = (...args: Array<unknown>) => {
    pushEvent(consoleEvents, {
      at: nowIso(),
      type: 'console',
      level: 'warn',
      message: args.map((arg) => String(arg)).join(' '),
    })
    originalWarn(...args)
  }

  window.addEventListener('error', (event) => {
    pushEvent(consoleEvents, {
      at: nowIso(),
      type: 'console',
      level: 'error',
      message: event.message,
    })
  })
}
