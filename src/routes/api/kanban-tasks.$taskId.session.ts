/**
 * Kanban Task Session API — link and retrieve sessions for cards
 *
 * POST /api/kanban-tasks/:taskId/session — create & link a session (idempotent)
 * GET  /api/kanban-tasks/:taskId/session — get linked session + messages
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { updateTask, getTaskVersion, KanbanError } from '../../server/kanban-store'
import { HERMES_API, BEARER_TOKEN } from '../../server/gateway-capabilities'

// Read task directly from store file to avoid circular deps
async function getTask(taskId: string) {
  const { promises: fs } = await import('node:fs')
  const { join } = await import('node:path')
  const { homedir } = await import('node:os')
  const filePath = join(homedir(), '.hermes', 'kanban', 'tasks.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(raw)
  return data.tasks.find((t: { id: string }) => t.id === taskId) ?? null
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (BEARER_TOKEN) h['Authorization'] = `Bearer ${BEARER_TOKEN}`
  return h
}

export const Route = createFileRoute('/api/kanban-tasks/$taskId/session')({
  server: {
    handlers: {
      // POST — create & link session (idempotent)
      POST: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const task = await getTask(params.taskId)
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Idempotent: if task already has a session, return it
          if (task.sessionId) {
            const sessRes = await fetch(`${HERMES_API}/api/sessions/${task.sessionId}`, {
              headers: authHeaders(),
            })
            if (sessRes.ok) {
              const sessData = await sessRes.json()
              return new Response(JSON.stringify(sessData.session), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            }
            // Session was deleted — fall through to create a new one
          }

          // Create a new session via Hermes API
          const createRes = await fetch(`${HERMES_API}/api/sessions`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ title: task.title }),
          })
          if (!createRes.ok) {
            const errText = await createRes.text()
            return new Response(JSON.stringify({ error: `Failed to create session: ${errText}` }), {
              status: 502,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          const { session } = await createRes.json()

          // Link session to task
          const version = await getTaskVersion(params.taskId)
          await updateTask(params.taskId, {
            sessionId: session.id,
            agentStatus: 'idle',
            version,
          })

          return new Response(JSON.stringify(session), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          const status = err instanceof KanbanError ? err.status : 500
          const message = err instanceof Error ? err.message : 'Internal server error'
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },

      // GET — retrieve linked session + messages
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const task = await getTask(params.taskId)
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          if (!task.sessionId) {
            return new Response(JSON.stringify({ session: null, messages: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Fetch session
          const sessRes = await fetch(`${HERMES_API}/api/sessions/${task.sessionId}`, {
            headers: authHeaders(),
          })
          if (!sessRes.ok) {
            return new Response(JSON.stringify({ session: null, messages: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          const sessData = await sessRes.json()

          // Fetch messages
          const msgRes = await fetch(`${HERMES_API}/api/sessions/${task.sessionId}/messages`, {
            headers: authHeaders(),
          })
          const msgData = msgRes.ok ? await msgRes.json() : { items: [] }

          return new Response(JSON.stringify({
            session: sessData.session,
            messages: msgData.items,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Internal server error'
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
