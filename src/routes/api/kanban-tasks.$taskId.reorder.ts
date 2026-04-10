/**
 * Kanban Task Reorder API — move/reorder a task within or across columns
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { reorderTask, KanbanError } from '../../server/kanban-store'
import type { TaskStatus } from '../../server/kanban-store'

export const Route = createFileRoute('/api/kanban-tasks/$taskId/reorder')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const body = await request.json()
          // Accept { status, columnOrder } from frontend OR { targetStatus, targetIndex, version }
          const targetStatus = (body.targetStatus ?? body.status) as TaskStatus
          const targetIndex = body.targetIndex ?? body.columnOrder ?? 0
          if (!targetStatus || typeof targetStatus !== 'string') {
            return new Response(JSON.stringify({ error: 'status or targetStatus is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          if (typeof body.version !== 'number') {
            return new Response(JSON.stringify({ error: 'version is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          const task = await reorderTask(params.taskId, {
            targetStatus,
            targetIndex,
            version: body.version,
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
    },
  },
})
