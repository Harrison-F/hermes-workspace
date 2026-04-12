import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isAuthenticated } from '../../server/auth-middleware'

const HOME_DIR = os.homedir()
const ALLOWED_ROOTS = [
  path.join(HOME_DIR, '.hermes'),
  path.join(HOME_DIR, 'hermes-workspace'),
]

function isAllowedPath(filePath: string): boolean {
  return ALLOWED_ROOTS.some((root) => filePath === root || filePath.startsWith(`${root}${path.sep}`))
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.avif':
      return 'image/avif'
    case '.pdf':
      return 'application/pdf'
    case '.csv':
      return 'text/csv; charset=utf-8'
    case '.md':
      return 'text/markdown; charset=utf-8'
    case '.txt':
      return 'text/plain; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

export const Route = createFileRoute('/api/local-media')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const requestedPath = url.searchParams.get('path')?.trim() || ''
        if (!requestedPath) {
          return json({ ok: false, error: 'path required' }, { status: 400 })
        }

        const resolvedPath = path.resolve(requestedPath)
        if (!isAllowedPath(resolvedPath)) {
          return json({ ok: false, error: 'Path not allowed' }, { status: 403 })
        }

        try {
          const buffer = await fs.readFile(resolvedPath)
          return new Response(buffer, {
            headers: {
              'Content-Type': getMimeType(resolvedPath),
              'Cache-Control': 'private, max-age=60',
              'Content-Disposition': `inline; filename="${path.basename(resolvedPath)}"`,
            },
          })
        } catch (error) {
          return json(
            {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 404 },
          )
        }
      },
    },
  },
})
