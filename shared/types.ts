/* ── YAML config types ── */

export interface GameConfigTemplate {
  name: string
  slug: string
  /** Path to the Nunjucks template, relative to TEMPLATES_DIR. */
  template: string
  /** Absolute path inside the container where the rendered config is written. */
  target: string
}

export interface GameMap {
  name: string
  file: string
}

export interface GameQuery {
  /** gamedig game type, e.g. "teamfortress2". */
  type: string
  /** Game port inside the container; gamedig applies any query-port offset. */
  port: number
}

export interface Game {
  name: string
  slug: string
  image: string
  tag?: string
  /** Docker network to attach the container to. Omitted → Docker default bridge. */
  network?: string
  /** Command template. Placeholders use `{name}` syntax. */
  command: string[]
  maxPlayers?: number
  configs: GameConfigTemplate[]
  maps: GameMap[]
  query?: GameQuery
}

export interface Team {
  name: string
  slug: string
}

export interface ConfigDefaults {
  tag: string
  pullPolicy: 'never'
  restartPolicy: 'no'
  rconPassword: string
  maxPlayers: number
}

export interface ServerConfig {
  defaults: ConfigDefaults
  games: Game[]
  teams: Team[]
}

/* ── Public (sanitized) config returned to the browser ── */

export interface PublicGameConfig {
  name: string
  slug: string
}

export interface PublicGame {
  name: string
  slug: string
  maxPlayers: number
  configs: PublicGameConfig[]
  maps: GameMap[]
}

export interface PublicServerConfig {
  games: PublicGame[]
  teams: Team[]
}

/* ── Options (which games/teams are enabled in the UI) ── */

export interface Options {
  enabledGameSlugs: string[]
  enabledTeamSlugs: string[]
}

/* ── Runtime server types ── */

export type ServerStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'deleting'
  | 'error'

export interface RconStatus {
  playerCount: number
  map: string
  uptime: string
  lastPoll: number
}

export interface GameServer {
  id: string
  containerId: string
  /** Image ID the container was created from. */
  imageId: string
  name: string
  gameSlug: string
  gameName: string
  configSlug: string
  configName: string
  map: string
  mapName: string
  team1: string
  team2: string
  status: ServerStatus
  ip: string | null
  metrics: RconStatus | null
  error: string | null
  createdAt: number
}

export interface CreateServerRequest {
  gameSlug: string
  configSlug: string
  map: string
  team1: string
  team2: string
  name?: string
}

export interface UpdateServerRequest {
  name?: string
  map?: string
}

/* ── Game images ── */

export interface GameImageGame {
  name: string
  slug: string
}

/** A config-derived image ref joined with its local Docker state. */
export interface GameImage {
  /** Effective image reference, including the configured tag. */
  ref: string
  /** Every game in the config that uses this exact ref. */
  games: GameImageGame[]
  /** True/false when Docker could be inspected, null when it is unreachable. */
  present: boolean | null
  /** Local image ID, used to detect running containers on an older build. */
  imageId: string | null
  /** Local image size in bytes. */
  size: number | null
  /** Local image creation timestamp (ISO string). */
  created: string | null
}

export type ImagePullState = 'queued' | 'pulling' | 'success' | 'error'

export interface ImagePullResult {
  ref: string
  state: ImagePullState
  /** Human-readable status, e.g. "Downloading", "Pulled", "Failed". */
  status: string
  /** Bytes downloaded across all layers in the current pull. */
  current: number
  /** Total bytes expected across all layers in the current pull. */
  total: number
  error: string | null
}

export interface ImagePullJob {
  id: string
  state: 'running' | 'done'
  startedAt: number
  finishedAt: number | null
  refs: string[]
  currentRef: string | null
  results: Record<string, ImagePullResult>
  updated: number
  failed: number
}

/** Payload of the image job SSE stream. */
export interface ImageJobEvent {
  type: 'snapshot' | 'update' | 'done'
  job: ImagePullJob | null
}

/* ── Template / command variables ── */

export interface TemplateVars {
  serverName: string
  gameName: string
  gameSlug: string
  map: string
  mapName: string
  team1: string
  team2: string
  team1Slug: string
  team2Slug: string
  maxPlayers: number
  port: string
  queryPort: string
  rconPassword: string
  createdAt: number
  configPath: string
  [key: string]: string | number
}
