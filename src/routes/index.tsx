import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const getOpeningDestination = createServerFn({ method: 'GET' }).handler(async ({ request }) => {
  const [{ listBoards }] = await Promise.all([import('@/server/kanban-store')])

  const cookies = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim()) ?? []

  const readCookie = (name: string) => {
    const match = cookies.find((part) => part.startsWith(`${name}=`))
    return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
  }

  const openingMode = readCookie('hermes-opening-screen-mode') || 'convon'
  const preferredBoardId = readCookie('hermes-opening-convon-board')

  if (openingMode === 'chat') return '/chat' as const
  if (openingMode === 'files') return '/files' as const

  const boards = await listBoards()
  const hrfBoard = boards.find((board) => board.name === 'HRF')
  const chosenBoard =
    (preferredBoardId ? boards.find((board) => board.id === preferredBoardId) : null) ??
    hrfBoard ??
    boards[0] ??
    null

  return chosenBoard ? '/board' as const : '/chat' as const
})

export const Route = createFileRoute('/')({
  beforeLoad: async function redirectToOpeningScreen() {
    const destination = await getOpeningDestination()
    throw redirect({
      to: destination,
      replace: true,
    })
  },
  component: function IndexRoute() {
    return null
  },
})
