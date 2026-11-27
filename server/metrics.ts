import { GameDig } from 'gamedig'
import type { GameQuery, RconStatus } from '../shared/types.js'

const TTL_MS = 2500

interface CacheEntry {
  at: number
  value: Promise<RconStatus | null>
}

export class MetricsService {
  private readonly cache = new Map<string, CacheEntry>()

  async query(
    key: string,
    query: GameQuery | undefined,
    ip: string | null,
    startedAt: string | undefined,
  ): Promise<RconStatus | null> {
    if (!query || !ip) return null

    const cacheKey = `${key}|${ip}|${query.port}`
    const now = Date.now()
    const cached = this.cache.get(cacheKey)
    if (cached && now - cached.at < TTL_MS) {
      return cached.value
    }

    const value = this.probe(query, ip, startedAt)
    this.cache.set(cacheKey, { at: now, value })
    return value
  }

  private async probe(
    query: GameQuery,
    ip: string,
    startedAt: string | undefined,
  ): Promise<RconStatus | null> {
    try {
      const state = await GameDig.query({
        type: query.type,
        host: ip,
        port: query.port,
        maxRetries: 1,
        socketTimeout: 1500,
        attemptTimeout: 2500,
        requestPlayers: true,
      })

      return {
        playerCount: Array.isArray(state.players)
          ? state.players.length
          : (state.numplayers ?? 0),
        map: state.map ?? '',
        uptime: formatUptime(startedAt),
        lastPoll: Date.now(),
      }
    } catch {
      return null
    }
  }
}

export function formatUptime(startedAt: string | undefined): string {
  if (!startedAt) return '—'
  const started = Date.parse(startedAt)
  if (!Number.isFinite(started)) return '—'

  const elapsed = Math.max(0, Date.now() - started)
  const hours = Math.floor(elapsed / 3_600_000)
  const minutes = Math.floor((elapsed % 3_600_000) / 60_000)

  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
