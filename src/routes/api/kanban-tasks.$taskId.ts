/**
 * Kanban Task API — update or delete a single task
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { updateTask, deleteTask, KanbanError } from '../../server/kanban-store'

export const Route = createFileRoute('/api/kanban-tasks/$taskId')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const body = await request.json()
          if (typeof body.version !== 'number') {
            return new Response(JSON.stringify({ error: 'version is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          const task = await updateTask(params.taskId, {
            title: body.title,
            description: body.description,
            status: body.status,
            visibility: body.visibility,
            assignee: body.assignee,
            labels: body.labels,
            dueAt: body.dueAt,
            version: body.version,
            sessionId: body.sessionId,
            comment: body.comment,
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
