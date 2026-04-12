import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { usePageTitle } from '@/hooks/use-page-title'
import { KanbanPanel } from '@/features/kanban/KanbanPanel'

const getBoardInitialData = createServerFn({ method: 'GET' }).handler(async ({ request }) => {
  const [{ isAuthenticated }, { listBoards, listTasks }] = await Promise.all([
    import('@/server/auth-middleware'),
    import('@/server/kanban-store'),
  ])

  if (!isAuthenticated(request)) {
    return null
  }

  const cookies = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim()) ?? []
  const readCookie = (name: string) => {
    const match = cookies.find((part) => part.startsWith(`${name}=`))
    return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
  }

  const cookieBoardId = readCookie('hermes-kanban-active-board')
  const openingBoardId = readCookie('hermes-opening-convon-board')

  const boards = await listBoards()
  const hrfBoard = boards.find((board) => board.name === 'HRF')
  const activeBoard =
    (cookieBoardId ? boards.find((board) => board.id === cookieBoardId) : null) ??
    (openingBoardId ? boards.find((board) => board.id === openingBoardId) : null) ??
    hrfBoard ??
    boards[0] ??
    null

  const taskResult = activeBoard ? await listTasks({ boardId: activeBoard.id }) : { tasks: [] }

  return {
    boards,
    activeBoardId: activeBoard?.id ?? null,
    tasks: taskResult.tasks,
  }
})

export const Route = createFileRoute('/board')({
  loader: () => getBoardInitialData(),
  component: BoardRoute,
})

function BoardRoute() {
  const initialData = Route.useLoaderData()
  usePageTitle('Board')
  return <KanbanPanel initialData={initialData} />
}
