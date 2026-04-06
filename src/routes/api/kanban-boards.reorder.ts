/**
 * Kanban Boards Reorder API — reorder boards
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { reorderBoards, KanbanError } from '../../server/kanban-store'

export const Route = createFileRoute('/api/kanban-boards/reorder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const body = await request.json()
          if (!Array.isArray(body.boardIds)) {
            return new Response(JSON.stringify({ error: 'boardIds array is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          const boards = await reorderBoards(body.boardIds)
          return new Response(JSON.stringify({ boards }), {
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
