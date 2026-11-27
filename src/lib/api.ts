import type {
  CreateServerRequest,
  GameImage,
  GameServer,
  ImagePullJob,
  Options,
  PublicServerConfig,
  UpdateServerRequest,
} from '@shared/types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the LanLords backend')
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as {
        error?: string
        issues?: string[]
      }
      if (body.error) {
        message = body.error
        if (body.issues?.length) message += `: ${body.issues.join(', ')}`
      }
    } catch {
      // Keep the status-based message.
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  config(): Promise<PublicServerConfig> {
    return request('/api/config')
  },

  options(): Promise<Options> {
    return request('/api/options')
  },

  updateOptions(body: Options): Promise<Options> {
    return request('/api/options', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  servers(): Promise<GameServer[]> {
    return request('/api/servers')
  },

  createServer(body: CreateServerRequest): Promise<GameServer> {
    return request('/api/servers', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  updateServer(id: string, body: UpdateServerRequest): Promise<GameServer> {
    return request(`/api/servers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  deleteServer(id: string): Promise<void> {
    return request(`/api/servers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },

  startServer(id: string): Promise<GameServer> {
    return request(`/api/servers/${encodeURIComponent(id)}/start`, {
      method: 'POST',
    })
  },

  restartServer(id: string): Promise<GameServer> {
    return request(`/api/servers/${encodeURIComponent(id)}/restart`, {
      method: 'POST',
    })
  },

  logsUrl(id: string): string {
    return `/api/servers/${encodeURIComponent(id)}/logs`
  },

  images(): Promise<GameImage[]> {
    return request('/api/images')
  },

  pullImage(ref: string): Promise<ImagePullJob> {
    return request('/api/images/pull', {
      method: 'POST',
      body: JSON.stringify({ ref }),
    })
  },

  pullAllImages(): Promise<ImagePullJob> {
    return request('/api/images/pull-all', { method: 'POST' })
  },

  imagesStreamUrl(): string {
    return '/api/images/stream'
  },
}
