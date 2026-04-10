/**
 * Kanban Board API — update or delete a single board
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { updateBoard, deleteBoard, KanbanError } from '../../server/kanban-store'

export const Route = createFileRoute('/api/kanban-boards/$boardId')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const body = await request.json()
          const hasName = typeof body.name === 'string'
          const hasOrder = typeof body.order === 'number'
          const hasConfig = typeof body.config === 'object' && body.config !== null

          if (!hasName && !hasOrder && !hasConfig) {
            return new Response(
              JSON.stringify({ error: 'at least one of name, order, or config is required' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          const board = await updateBoard(params.boardId, {
            name: hasName ? body.name : undefined,
            order: hasOrder ? body.order : undefined,
            config: hasConfig ? body.config : undefined,
          })
          return new Response(JSON.stringify(board), {
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
          await deleteBoard(params.boardId)
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
