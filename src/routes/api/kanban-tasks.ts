/**
 * Kanban Tasks API — list and create tasks
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { listTasks, createTask, KanbanError } from '../../server/kanban-store'
import type { TaskVisibility, TaskStatus } from '../../server/kanban-store'

export const Route = createFileRoute('/api/kanban-tasks')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const url = new URL(request.url)
          const boardId = url.searchParams.get('boardId') ?? undefined
          const status = (url.searchParams.get('status') as TaskStatus) ?? undefined
          const visibilityParam = url.searchParams.getAll('visibility')
          const visibility = visibilityParam.length > 0 ? (visibilityParam as TaskVisibility[]) : undefined
          const q = url.searchParams.get('q') ?? undefined
          const limitStr = url.searchParams.get('limit')
          const offsetStr = url.searchParams.get('offset')
          const limit = limitStr ? parseInt(limitStr, 10) : undefined
          const offset = offsetStr ? parseInt(offsetStr, 10) : undefined

          const result = await listTasks({ boardId, status, visibility, q, limit, offset })
          return new Response(JSON.stringify(result.tasks), {
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
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        try {
          const body = await request.json()
          if (!body.boardId || typeof body.boardId !== 'string') {
            return new Response(JSON.stringify({ error: 'boardId is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          if (!body.title || typeof body.title !== 'string') {
            return new Response(JSON.stringify({ error: 'title is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          const task = await createTask({
            boardId: body.boardId,
            title: body.title,
            description: body.description,
            status: body.status,
            visibility: body.visibility,
            createdBy: body.createdBy,
            assignee: body.assignee,
            labels: body.labels,
          })
          return new Response(JSON.stringify(task), {
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
    },
  },
})
