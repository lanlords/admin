import { containerName, buildLabels } from '../shared/labels.js'
import type {
  ConfigDefaults,
  Game,
  GameConfigTemplate,
  GameMap,
  Team,
  TemplateVars,
} from '../shared/types.js'
import { PLACEHOLDER_RE } from './config.js'

export interface BuildSpecInput {
  id: string
  name: string
  game: Game
  config: GameConfigTemplate
  map: GameMap
  team1: Team
  team2: Team
  defaults: ConfigDefaults
  createdAt: number
}

export interface ContainerSpec {
  id: string
  name: string
  imageRef: string
  labels: Record<string, string>
  cmd: string[]
  network?: string
  restartPolicy: ConfigDefaults['restartPolicy']
  template: string
  target: string
  vars: TemplateVars
}

export function imageRef(game: Game, defaults: ConfigDefaults): string {
  const tag = game.tag ?? defaults.tag
  return game.image.includes('@') ? game.image : `${game.image}:${tag}`
}

export function buildContainerSpec(input: BuildSpecInput): ContainerSpec {
  const { id, name, game, config, map, team1, team2, defaults, createdAt } =
    input

  const maxPlayers = game.maxPlayers ?? defaults.maxPlayers
  const vars: TemplateVars = {
    serverName: name,
    gameName: game.name,
    gameSlug: game.slug,
    map: map.file,
    mapName: map.name,
    team1: team1.name,
    team2: team2.name,
    team1Slug: team1.slug,
    team2Slug: team2.slug,
    maxPlayers,
    port: game.query ? String(game.query.port) : '',
    queryPort: game.query ? String(game.query.port) : '',
    rconPassword: defaults.rconPassword,
    createdAt,
    configPath: config.target,
  }

  return {
    id,
    name,
    imageRef: imageRef(game, defaults),
    labels: buildLabels({
      id,
      name,
      game: game.slug,
      config: config.slug,
      map: map.file,
      team1: team1.slug,
      team2: team2.slug,
      createdAt,
    }),
    cmd: game.command.map((part) => interpolate(part, vars)),
    network: game.network,
    restartPolicy: defaults.restartPolicy,
    template: config.template,
    target: config.target,
    vars,
  }
}

export function defaultServerName(team1: Team, team2: Team): string {
  return `${team1.slug}vs${team2.slug}`
}

export function interpolate(value: string, vars: TemplateVars): string {
  return value.replace(PLACEHOLDER_RE, (_match, key: string) =>
    key in vars ? String(vars[key]) : _match,
  )
}

export function containerNameFor(gameSlug: string, id: string): string {
  return containerName(gameSlug, id)
}
