import { execFile } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { readHermesEnv, resolveHermesPython } from '@/server/hermes-agent'

const execFileAsync = promisify(execFile)
const TRANSCRIPTION_TIMEOUT_MS = 180_000

function resolveHermesTranscriptionAgentDir(): string | null {
  const candidates = [
    process.env.HERMES_AGENT_PATH?.trim(),
    path.join(os.homedir(), '.hermes', 'hermes-agent'),
    path.resolve(path.dirname(path.resolve('.')), 'hermes-agent'),
    path.resolve(path.dirname(path.resolve('.')), '..', 'hermes-agent'),
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate)) continue
    const transcriptionToolPath = path.join(candidate, 'tools', 'transcription_tools.py')
    if (existsSync(transcriptionToolPath)) return candidate
  }

  return null
}

export function guessAudioExtension(
  filename: string | undefined,
  contentType: string | undefined,
): string {
  const normalizedType = (contentType ?? '').toLowerCase()
  const normalizedName = (filename ?? '').toLowerCase()

  if (normalizedType.includes('webm') || normalizedName.endsWith('.webm')) return '.webm'
  if (normalizedType.includes('mp4') || normalizedName.endsWith('.m4a') || normalizedName.endsWith('.mp4')) return '.m4a'
  if (normalizedType.includes('mpeg') || normalizedName.endsWith('.mp3')) return '.mp3'
  if (normalizedType.includes('wav') || normalizedName.endsWith('.wav')) return '.wav'
  if (normalizedType.includes('ogg') || normalizedName.endsWith('.ogg')) return '.ogg'
  return '.webm'
}

export async function transcribeWorkspaceAudio(args: {
  buffer: Buffer
  filename?: string
  contentType?: string
}): Promise<{ success: boolean; transcript: string; error?: string; provider?: string }> {
  const agentDir = resolveHermesTranscriptionAgentDir()
  if (!agentDir) {
    return {
      success: false,
      transcript: '',
      error: 'Hermes Agent directory not found',
    }
  }

  const extension = guessAudioExtension(args.filename, args.contentType)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hw-voice-'))
  const audioPath = path.join(tempDir, `voice-input${extension}`)

  try {
    await fs.writeFile(audioPath, args.buffer)

    const python = resolveHermesPython(agentDir)
    const script = [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(agentDir)})`,
      'from tools.transcription_tools import transcribe_audio',
      'result = transcribe_audio(sys.argv[1])',
      'print(json.dumps(result))',
    ].join('\n')

    const { stdout } = await execFileAsync(
      python,
      ['-c', script, audioPath],
      {
        cwd: agentDir,
        env: {
          ...process.env,
          ...readHermesEnv(),
          PATH: `${path.resolve(agentDir, '.venv', 'bin')}:${path.resolve(agentDir, 'venv', 'bin')}:${process.env.PATH || ''}`,
        },
        timeout: TRANSCRIPTION_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      },
    )

    const parsed = JSON.parse(stdout.trim()) as {
      success?: boolean
      transcript?: string
      error?: string
      provider?: string
    }

    return {
      success: Boolean(parsed.success),
      transcript: typeof parsed.transcript === 'string' ? parsed.transcript : '',
      error: typeof parsed.error === 'string' ? parsed.error : undefined,
      provider: typeof parsed.provider === 'string' ? parsed.provider : undefined,
    }
  } catch (error) {
    return {
      success: false,
      transcript: '',
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}
