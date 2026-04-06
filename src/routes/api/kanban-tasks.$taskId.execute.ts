/**
 * Kanban Task Autonomous Execution
 *
 * POST /api/kanban-tasks/:taskId/execute — spawn background agent work
 *
 * - Creates a session if none exists
 * - Sets agentStatus = 'working'
 * - Returns 202 Accepted immediately
 * - Runs agent in background via Hermes API chat endpoint
 * - Updates agentStatus to 'done'/'error' when complete
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { updateTask, getTaskVersion, listTasks, KanbanError } from '../../server/kanban-store'
import { HERMES_API, BEARER_TOKEN } from '../../server/gateway-capabilities'

// Read task directly from store file
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

/** Run agent work in the background — don't await this in the handler */
async function executeInBackground(taskId: string, sessionId: string, prompt: string) {
  try {
    const res = await fetch(`${HERMES_API}/api/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message: prompt }),
    })

    const version = await getTaskVersion(taskId)
    if (res.ok) {
      const data = await res.json()
      const summary = data.response || 'Task completed.'
      // Truncate summary to reasonable length
      const trimmed = summary.length > 500 ? summary.slice(0, 497) + '...' : summary
      await updateTask(taskId, { agentStatus: 'done', agentSummary: trimmed, version })
    } else {
      const errText = await res.text()
      await updateTask(taskId, {
        agentStatus: 'error',
        agentSummary: `Agent error (${res.status}): ${errText.slice(0, 200)}`,
        version,
      })
    }
  } catch (err) {
    try {
      const version = await getTaskVersion(taskId)
      await updateTask(taskId, {
        agentStatus: 'error',
        agentSummary: `Execution failed: ${err instanceof Error ? err.message : String(err)}`,
        version,
      })
    } catch {
      // If we can't even update the status, not much we can do
      console.error(`[execute] Failed to update task ${taskId} after error:`, err)
    }
  }
}

export const Route = createFileRoute('/api/kanban-tasks/$taskId/execute')({
  server: {
    handlers: {
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

          // Guard: only one execution at a time
          const { tasks } = await listTasks({})
          const working = tasks.find(
            (t: { agentStatus?: string; id: string }) =>
              t.agentStatus === 'working' && t.id !== params.taskId
          )
          if (working) {
            return new Response(
              JSON.stringify({
                error: `Another card is already executing: "${working.title}" (${working.id})`,
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            )
          }

          // Also guard against re-executing the same card if already working
          if (task.agentStatus === 'working') {
            return new Response(
              JSON.stringify({ error: 'This card is already executing' }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            )
          }

          // Create session if needed
          let sessionId = task.sessionId
          if (!sessionId) {
            const createRes = await fetch(`${HERMES_API}/api/sessions`, {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({ title: task.title }),
            })
            if (!createRes.ok) {
              const errText = await createRes.text()
              return new Response(
                JSON.stringify({ error: `Failed to create session: ${errText}` }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
              )
            }
            const { session } = await createRes.json()
            sessionId = session.id
          }

          // Set status to working and link session
          const version = await getTaskVersion(params.taskId)
          await updateTask(params.taskId, {
            sessionId,
            agentStatus: 'working',
            agentSummary: 'Execution started...',
            version,
          })

          // Build prompt from card title + description
          const prompt = task.description
            ? `Task: ${task.title}\n\n${task.description}`
            : `Task: ${task.title}`

          // Fire and forget — don't await
          executeInBackground(params.taskId, sessionId, prompt)

          return new Response(
            JSON.stringify({
              status: 'accepted',
              taskId: params.taskId,
              sessionId,
            }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          )
        } catch (err) {
          const status = err instanceof KanbanError ? err.status : 500
          const message = err instanceof Error ? err.message : 'Internal server error'
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
