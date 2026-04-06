/**
 * Kanban Task API — update or delete a single task
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { updateTask, deleteTask, getTaskVersion, KanbanError } from '../../server/kanban-store'

export const Route = createFileRoute('/api/kanban-tasks/$taskId')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const body = await request.json()
          // Version is optional — auto-populate from current state if not provided
          const version = typeof body.version === 'number'
            ? body.version
            : await getTaskVersion(params.taskId)
          const task = await updateTask(params.taskId, {
            title: body.title,
            description: body.description,
            status: body.status,
            priority: body.priority,
            assignee: body.assignee,
            labels: body.labels,
            version,
            sessionId: body.sessionId,
            agentStatus: body.agentStatus,
            agentSummary: body.agentSummary,
            spawnedFrom: body.spawnedFrom,
          })
          return new Response(JSON.stringify(task), {
            status: 200,
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
      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          await deleteTask(params.taskId)
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
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
    },
  },
})
