import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { KanbanPanel } from '@/features/kanban/KanbanPanel'

export const Route = createFileRoute('/board')({
  component: BoardRoute,
})

function BoardRoute() {
  usePageTitle('Board')
  return <KanbanPanel />
}
