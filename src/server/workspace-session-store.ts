import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export type WorkspaceStoredMessage = {
  id: string
  role: string
  content: Array<Record<string, unknown>>
  text?: string
  timestamp: number
  createdAt: string
  sessionKey: string
  __historyIndex?: number
}

export type WorkspaceStoredSession = {
  key: string
  friendlyId: string
  title?: string
  derivedTitle?: string
  label?: string
  updatedAt: number
  archived?: boolean
  lastMessage?: WorkspaceStoredMessage | null
  messages: Array<WorkspaceStoredMessage>
}

type WorkspaceSessionFile = {
  sessions: Array<WorkspaceStoredSession>
}

const STORE_PATH = path.join(os.homedir(), '.hermes', 'workspace-sessions.json')

async function ensureStoreDir() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
}

async function readStore(): Promise<WorkspaceSessionFile> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as WorkspaceSessionFile
    return { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] }
  } catch {
    return { sessions: [] }
  }
}

async function writeStore(store: WorkspaceSessionFile) {
  await ensureStoreDir()
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
}

function nowMessage(sessionKey: string, role: string, text: string): WorkspaceStoredMessage {
  const timestamp = Date.now()
  return {
    id: `local-${randomUUID()}`,
    role,
    content: [{ type: 'text', text }],
    text,
    timestamp,
    createdAt: new Date(timestamp).toISOString(),
    sessionKey,
  }
}

export async function listWorkspaceSessions(includeArchived = false) {
  const store = await readStore()
  return store.sessions
    .filter((session) => includeArchived || !session.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((session) => ({
      key: session.key,
      friendlyId: session.friendlyId,
      title: session.title,
      derivedTitle: session.derivedTitle,
      label: session.label,
      updatedAt: session.updatedAt,
      lastMessage: session.lastMessage ?? null,
    }))
}

export async function createWorkspaceSession(input?: { friendlyId?: string; title?: string }) {
  const store = await readStore()
  const friendlyId = input?.friendlyId?.trim() || randomUUID()
  const existing = store.sessions.find((session) => session.friendlyId === friendlyId || session.key === friendlyId)
  if (existing) {
    if (input?.title?.trim()) existing.title = input.title.trim()
    existing.archived = false
    existing.updatedAt = Date.now()
    await writeStore(store)
    return existing
  }
  const timestamp = Date.now()
  const session: WorkspaceStoredSession = {
    key: friendlyId,
    friendlyId,
    title: input?.title?.trim() || undefined,
    updatedAt: timestamp,
    archived: false,
    lastMessage: null,
    messages: [],
  }
  store.sessions.unshift(session)
  await writeStore(store)
  return session
}

export async function updateWorkspaceSession(
  sessionKey: string,
  updates: { title?: string; archived?: boolean },
) {
  const store = await readStore()
  const session = store.sessions.find((entry) => entry.key === sessionKey || entry.friendlyId === sessionKey)
  if (!session) throw new Error('session not found')
  if (typeof updates.title === 'string') {
    const nextTitle = updates.title.trim()
    session.title = nextTitle || undefined
    session.label = nextTitle || undefined
  }
  if (typeof updates.archived === 'boolean') {
    session.archived = updates.archived
  }
  session.updatedAt = Date.now()
  await writeStore(store)
  return session
}

export function boundWorkspaceSessionMessages(
  messages: Array<WorkspaceStoredMessage>,
  limit?: number,
) {
  const bounded =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? messages.slice(-Math.floor(limit))
      : messages
  const firstIndex = Math.max(0, messages.length - bounded.length)
  return bounded.map((message, index) => ({
    ...message,
    __historyIndex: firstIndex + index,
  }))
}

export async function getWorkspaceSessionMessages(sessionKey: string, limit?: number) {
  const store = await readStore()
  const session = store.sessions.find((entry) => entry.key === sessionKey || entry.friendlyId === sessionKey)
  if (!session) return []
  return boundWorkspaceSessionMessages(session.messages, limit)
}

export async function appendWorkspaceMessage(
  sessionKey: string,
  payload: {
    role: 'user' | 'assistant'
    text: string
    content?: Array<Record<string, unknown>>
  },
) {
  const store = await readStore()
  let session = store.sessions.find((entry) => entry.key === sessionKey || entry.friendlyId === sessionKey)
  if (!session) {
    session = await createWorkspaceSession({ friendlyId: sessionKey })
    store.sessions = (await readStore()).sessions
    session = store.sessions.find((entry) => entry.key === sessionKey || entry.friendlyId === sessionKey)!
  }
  const timestamp = Date.now()
  const message: WorkspaceStoredMessage = {
    id: `local-${randomUUID()}`,
    role: payload.role,
    content: payload.content ?? [{ type: 'text', text: payload.text }],
    text: payload.text,
    timestamp,
    createdAt: new Date(timestamp).toISOString(),
    sessionKey: session.friendlyId,
  }
  session.messages.push(message)
  session.lastMessage = message
  session.updatedAt = timestamp
  if (payload.role === 'user' && !session.title && !session.label && !session.derivedTitle) {
    const trimmed = payload.text.trim().replace(/\s+/g, ' ')
    session.derivedTitle = trimmed.slice(0, 80) || 'New Session'
  }
  await writeStore(store)
  return message
}

export async function seedWorkspaceSessionError(sessionKey: string, errorText: string) {
  return appendWorkspaceMessage(sessionKey, {
    role: 'assistant',
    text: errorText,
    content: [{ type: 'text', text: errorText }],
  })
}
