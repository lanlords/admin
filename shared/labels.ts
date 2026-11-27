/* ── Docker label contract ── */

export const LABEL_MANAGED = 'lanlords.managed'
export const LABEL_ID = 'lanlords.id'
export const LABEL_NAME = 'lanlords.name'
export const LABEL_GAME = 'lanlords.game'
export const LABEL_CONFIG = 'lanlords.config'
export const LABEL_MAP = 'lanlords.map'
export const LABEL_TEAM1 = 'lanlords.team1'
export const LABEL_TEAM2 = 'lanlords.team2'
export const LABEL_CREATED_AT = 'lanlords.createdAt'

export interface ServerLabels {
  id: string
  name: string
  game: string
  config: string
  map: string
  team1: string
  team2: string
  createdAt: number
}

export function buildLabels(labels: ServerLabels): Record<string, string> {
  return {
    [LABEL_MANAGED]: 'true',
    [LABEL_ID]: labels.id,
    [LABEL_NAME]: labels.name,
    [LABEL_GAME]: labels.game,
    [LABEL_CONFIG]: labels.config,
    [LABEL_MAP]: labels.map,
    [LABEL_TEAM1]: labels.team1,
    [LABEL_TEAM2]: labels.team2,
    [LABEL_CREATED_AT]: String(labels.createdAt),
  }
}

export function readLabels(
  labels: Record<string, string> | undefined,
): ServerLabels | null {
  if (!labels || labels[LABEL_MANAGED] !== 'true') return null

  const id = labels[LABEL_ID]
  const game = labels[LABEL_GAME]
  const config = labels[LABEL_CONFIG]
  const map = labels[LABEL_MAP]
  const team1 = labels[LABEL_TEAM1]
  const team2 = labels[LABEL_TEAM2]

  if (!id || !game || !config || !map || !team1 || !team2) return null

  const createdAt = Number(labels[LABEL_CREATED_AT])

  return {
    id,
    name: labels[LABEL_NAME] ?? id,
    game,
    config,
    map,
    team1,
    team2,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
  }
}

export function containerName(gameSlug: string, id: string): string {
  return `lanlords-${gameSlug}-${id.replace(/-/g, '').slice(0, 8)}`
}
