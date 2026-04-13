import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
  safeErrorMessage,
} from '@/server/rate-limit'
import { transcribeWorkspaceAudio } from '@/server/voice-transcription'

export const Route = createFileRoute('/api/voice/transcribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const ip = getClientIp(request)
        if (!rateLimit(`voice-transcribe:${ip}`, 20, 60_000)) {
          return rateLimitResponse()
        }

        try {
          const contentType = request.headers.get('content-type') || ''
          if (!contentType.includes('multipart/form-data')) {
            return json({ ok: false, error: 'Expected multipart/form-data' }, { status: 400 })
          }

          const form = await request.formData()
          const file = form.get('file')
          if (!(file instanceof File)) {
            return json({ ok: false, error: 'Missing audio file' }, { status: 400 })
          }

          const buffer = Buffer.from(await file.arrayBuffer())
          const result = await transcribeWorkspaceAudio({
            buffer,
            filename: file.name,
            contentType: file.type,
          })

          if (!result.success) {
            return json(
              {
                ok: false,
                transcript: '',
                error: result.error || 'Transcription failed',
                provider: result.provider,
              },
              { status: 500 },
            )
          }

          return json({
            ok: true,
            transcript: result.transcript,
            provider: result.provider,
          })
        } catch (error) {
          return json(
            {
              ok: false,
              error: safeErrorMessage(error),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
