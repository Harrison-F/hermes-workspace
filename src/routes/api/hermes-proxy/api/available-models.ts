import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../../server/auth-middleware'
import { ensureGatewayProbed, getCapabilities } from '../../../../server/gateway-capabilities'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import YAML from 'yaml'

const HERMES_HOME = path.join(os.homedir(), '.hermes')
const CONFIG_PATH = path.join(HERMES_HOME, 'config.yaml')
const HERMES_API_URL = process.env.HERMES_API_URL || 'http://127.0.0.1:8642'

type ProviderOption = {
  id: string
  label: string
  authenticated: boolean
}

type ModelEntry = {
  id: string
  description: string
}

function readConfig(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return (YAML.parse(raw) as Record<string, unknown>) || {}
  } catch {
    return {}
  }
}

function getActiveProvider(config: Record<string, unknown>): string {
  const modelField = config.model
  if (typeof modelField === 'string') {
    return typeof config.provider === 'string' ? config.provider : ''
  }
  if (modelField && typeof modelField === 'object') {
    const modelObj = modelField as Record<string, unknown>
    return (
      (typeof modelObj.provider === 'string' ? modelObj.provider : '') ||
      (typeof config.provider === 'string' ? config.provider : '')
    )
  }
  return typeof config.provider === 'string' ? config.provider : ''
}

function getAuthStoreProfiles(): Array<ProviderOption> {
  for (const storePath of [
    path.join(os.homedir(), '.hermes', 'auth-profiles.json'),
    path.join(os.homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json'),
  ]) {
    try {
      if (!fs.existsSync(storePath)) continue
      const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
      const profiles = store?.profiles || {}
      const providers = new Map<string, ProviderOption>()
      for (const key of Object.keys(profiles)) {
        const providerId = key.split(':')[0]
        const value = profiles[key]
        if (typeof value !== 'object' || value === null) continue
        const p = value as Record<string, unknown>
        const token = String(p.token || p.key || p.access || '').trim()
        if (!token) continue
        if (!providers.has(providerId)) {
          providers.set(providerId, {
            id: providerId,
            label: providerId,
            authenticated: true,
          })
        }
      }
      if (providers.size > 0) return [...providers.values()]
    } catch {
      // ignore auth store parse failures
    }
  }
  return []
}

async function fetchModels(): Promise<Array<{ id?: string; name?: string; provider?: string; description?: string }>> {
  const response = await fetch(`${HERMES_API_URL}/v1/models`)
  if (!response.ok) throw new Error(`Hermes models request failed (${response.status})`)
  const payload = (await response.json()) as { data?: Array<Record<string, unknown>>; models?: Array<Record<string, unknown>> }
  const rawModels = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.models)
      ? payload.models
      : []
  return rawModels.map((record) => ({
    id:
      (typeof record.id === 'string' ? record.id : '') ||
      (typeof record.name === 'string' ? record.name : '') ||
      (typeof record.model === 'string' ? record.model : ''),
    name:
      (typeof record.name === 'string' ? record.name : '') ||
      (typeof record.display_name === 'string' ? record.display_name : '') ||
      (typeof record.label === 'string' ? record.label : ''),
    provider:
      (typeof record.provider === 'string' ? record.provider : '') ||
      (typeof record.owned_by === 'string' ? record.owned_by : ''),
    description:
      (typeof record.description === 'string' ? record.description : '') ||
      (typeof record.name === 'string' ? record.name : ''),
  }))
}

export const Route = createFileRoute('/api/hermes-proxy/api/available-models')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        await ensureGatewayProbed()
        const config = readConfig()
        const activeProvider = getActiveProvider(config)
        const url = new URL(request.url)
        const requestedProvider = (url.searchParams.get('provider') || '').trim()
        const provider = requestedProvider || activeProvider
        const authProviders = getAuthStoreProfiles()

        if (!getCapabilities().models) {
          return json({
            provider,
            models: [],
            providers: authProviders,
            ok: false,
            error: 'Gateway does not support /v1/models',
          }, { status: 503 })
        }

        try {
          const models = await fetchModels()
          const filtered = provider
            ? models.filter((model) => {
                const modelProvider = (model.provider || (model.id?.includes('/') ? model.id.split('/')[0] : ''))
                return modelProvider === provider
              })
            : models

          const normalizedModels: Array<ModelEntry> = filtered
            .filter((model) => typeof model.id === 'string' && model.id.trim().length > 0)
            .map((model) => ({
              id: String(model.id),
              description: String(model.description || model.name || model.id),
            }))

          const allProviders = new Map<string, ProviderOption>()
          for (const p of authProviders) allProviders.set(p.id, p)
          for (const model of models) {
            const inferredProvider = (model.provider || (model.id?.includes('/') ? model.id.split('/')[0] : '')).trim()
            if (!inferredProvider) continue
            if (!allProviders.has(inferredProvider)) {
              allProviders.set(inferredProvider, {
                id: inferredProvider,
                label: inferredProvider,
                authenticated: inferredProvider === activeProvider,
              })
            }
          }

          return json({
            provider,
            models: normalizedModels,
            providers: [...allProviders.values()],
          })
        } catch (err) {
          return json({
            provider,
            models: [],
            providers: authProviders,
            error: err instanceof Error ? err.message : String(err),
          }, { status: 503 })
        }
      },
    },
  },
})
