import { randomUUID } from 'node:crypto'
import type Docker from 'dockerode'
import { readLabels } from '../shared/labels.js'
import type {
  CreateServerRequest,
  Game,
  GameConfigTemplate,
  GameMap,
  GameServer,
  ServerConfig,
  ServerStatus,
  Team,
  UpdateServerRequest,
} from '../shared/types.js'
import {
  buildContainerSpec,
  containerNameFor,
  defaultServerName,
  imageRef,
} from './containerSpec.js'
import {
  containerIp,
  containerLogs,
  createContainer,
  inspectContainer,
  listManagedContainers,
  removeContainer,
  requireImage,
  restartContainer,
  startContainer,
  uploadFile,
} from './docker.js'
import { ApiError, dockerErrorMessage } from './errors.js'
import type { MetricsService } from './metrics.js'
import type { TemplateRenderer } from './templates.js'

export class ServerService {
  constructor(
    private readonly config: ServerConfig,
    private readonly renderer: TemplateRenderer,
    private readonly metrics: MetricsService,
  ) {}

  async listServers(): Promise<GameServer[]> {
    const containers = await listManagedContainers()
    const servers = await Promise.all(
      containers.map((container) => this.fromContainer(container)),
    )
    return servers.filter((server): server is GameServer => server !== null)
  }

  async create(request: CreateServerRequest): Promise<GameServer> {
    const game = this.requireGame(request.gameSlug)
    const gameConfig = this.requireGameConfig(game, request.configSlug)
    const map = this.requireMap(game, request.map)
    const team1 = this.requireTeam(request.team1)
    const team2 = this.requireTeam(request.team2)
    if (team1.slug === team2.slug) {
      throw new ApiError(400, 'Teams must be different')
    }

    await requireImage(imageRef(game, this.config.defaults))

    const id = randomUUID()
    const createdAt = Date.now()
    const name = request.name?.trim() || defaultServerName(team1, team2)
    const spec = buildContainerSpec({
      id,
      name,
      game,
      config: gameConfig,
      map,
      team1,
      team2,
      defaults: this.config.defaults,
      createdAt,
    })

    const content = this.render(spec.template, spec.vars)
    const nameForContainer = containerNameFor(game.slug, id)

    let container: Docker.Container | null = null
    try {
      container = await createContainer(spec, nameForContainer)
      await uploadFile(container, spec.target, content)
      await startContainer(container.id)
    } catch (error) {
      if (container) await removeContainer(container.id).catch(() => undefined)
      throw error
    }

    const server = await this.getServer(id)
    if (!server) throw new ApiError(502, 'Container was created but not found')
    return server
  }

  async update(id: string, request: UpdateServerRequest): Promise<GameServer> {
    const container = await this.findManagedContainer(id)
    const labels = readLabels(container.Labels)
    if (!labels) throw new ApiError(404, 'Server not found')

    const game = this.requireGame(labels.game)
    const gameConfig = this.requireGameConfig(game, labels.config)
    const map = this.requireMap(game, request.map ?? labels.map)
    const team1 = this.requireTeam(labels.team1)
    const team2 = this.requireTeam(labels.team2)
    const name = request.name?.trim() || labels.name

    if (name === labels.name && map.file === labels.map) {
      const server = await this.fromContainer(container)
      if (!server) throw new ApiError(404, 'Server not found')
      return server
    }

    await requireImage(imageRef(game, this.config.defaults))

    const inspect = await inspectContainer(container.Id)
    const wasRunning =
      inspect.State.Running === true ||
      inspect.State.Status === 'restarting' ||
      inspect.State.Status === 'paused'

    const spec = buildContainerSpec({
      id: labels.id,
      name,
      game,
      config: gameConfig,
      map,
      team1,
      team2,
      defaults: this.config.defaults,
      createdAt: labels.createdAt,
    })
    const content = this.render(spec.template, spec.vars)

    await removeContainer(container.Id)

    let recreated: Docker.Container | null = null
    try {
      recreated = await createContainer(
        spec,
        containerNameFor(game.slug, labels.id),
      )
      await uploadFile(recreated, spec.target, content)
      if (wasRunning) await startContainer(recreated.id)
    } catch (error) {
      if (recreated) await removeContainer(recreated.id).catch(() => undefined)
      throw error
    }

    const server = await this.getServer(labels.id)
    if (!server) {
      throw new ApiError(502, 'Server was recreated but could not be read back')
    }
    return server
  }

  async remove(id: string): Promise<void> {
    const container = await this.findManagedContainer(id, true)
    if (!container) return
    await removeContainer(container.Id)
  }

  async start(id: string): Promise<GameServer> {
    const container = await this.findManagedContainer(id)
    const labels = readLabels(container.Labels)
    if (!labels) throw new ApiError(404, 'Server not found')
    const game = this.requireGame(labels.game)
    this.requireGameConfig(game, labels.config)

    const inspect = await inspectContainer(container.Id)
    if (inspect.State.Running) {
      return (await this.getServer(id))!
    }

    await startContainer(container.Id)
    const server = await this.getServer(id)
    if (!server) throw new ApiError(502, 'Server did not start')
    return server
  }

  async restart(id: string): Promise<GameServer> {
    const container = await this.findManagedContainer(id)
    const labels = readLabels(container.Labels)
    if (!labels) throw new ApiError(404, 'Server not found')
    const game = this.requireGame(labels.game)
    this.requireGameConfig(game, labels.config)

    await restartContainer(container.Id)
    const server = await this.getServer(id)
    if (!server) throw new ApiError(502, 'Server did not restart')
    return server
  }

  async getServer(id: string): Promise<GameServer | null> {
    const container = await this.findManagedContainer(id, true)
    if (!container) return null
    return this.fromContainer(container)
  }

  async getLogStream(id: string): Promise<NodeJS.ReadableStream> {
    const container = await this.findManagedContainer(id)
    return containerLogs(container.Id)
  }

  private async fromContainer(
    container: Docker.ContainerInfo,
  ): Promise<GameServer | null> {
    const labels = readLabels(container.Labels)
    if (!labels) return null

    let inspect: Docker.ContainerInspectInfo
    try {
      inspect = await inspectContainer(container.Id)
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return null
      throw error
    }

    const game = this.config.games.find((entry) => entry.slug === labels.game)
    const gameConfig = game?.configs.find(
      (entry) => entry.slug === labels.config,
    )
    const map = game?.maps.find((entry) => entry.file === labels.map)
    const team1 = this.config.teams.find((entry) => entry.slug === labels.team1)
    const team2 = this.config.teams.find((entry) => entry.slug === labels.team2)

    const configError =
      !game || !gameConfig
        ? 'Game or config is no longer present in config.yaml'
        : null

    const status = configError
      ? 'error'
      : statusFromInspect(inspect)

    const ip = containerIp(inspect, game?.network)
    const metrics =
      status === 'running' && game?.query
        ? await this.metrics.query(
            labels.id,
            game.query,
            ip,
            inspect.State.StartedAt,
          )
        : null

    return {
      id: labels.id,
      containerId: container.Id,
      imageId: inspect.Image,
      name: labels.name,
      gameSlug: labels.game,
      gameName: game?.name ?? labels.game,
      configSlug: labels.config,
      configName: gameConfig?.name ?? labels.config,
      map: labels.map,
      mapName: map?.name ?? labels.map,
      team1: team1?.name ?? labels.team1,
      team2: team2?.name ?? labels.team2,
      status,
      ip,
      metrics,
      error:
        configError ??
        (inspect.State.Status === 'dead' ? 'Container is dead' : null),
      createdAt:
        labels.createdAt > 0
          ? labels.createdAt
          : Math.round((container.Created ?? 0) * 1000),
    }
  }

  private async findManagedContainer(
    id: string,
  ): Promise<Docker.ContainerInfo>
  private async findManagedContainer(
    id: string,
    optional: true,
  ): Promise<Docker.ContainerInfo | null>
  private async findManagedContainer(
    id: string,
    optional = false,
  ): Promise<Docker.ContainerInfo | null> {
    const containers = await listManagedContainers()
    const container = containers.find(
      (entry) => readLabels(entry.Labels)?.id === id,
    )
    if (!container && !optional) throw new ApiError(404, 'Server not found')
    return container ?? null
  }

  private requireGame(slug: string): Game {
    const game = this.config.games.find((entry) => entry.slug === slug)
    if (!game) throw new ApiError(400, `Unknown game "${slug}"`)
    return game
  }

  private requireGameConfig(game: Game, slug: string): GameConfigTemplate {
    const gameConfig = game.configs.find((entry) => entry.slug === slug)
    if (!gameConfig) {
      throw new ApiError(400, `Unknown config "${slug}" for game "${game.slug}"`)
    }
    return gameConfig
  }

  private requireMap(game: Game, file: string): GameMap {
    const map = game.maps.find((entry) => entry.file === file)
    if (!map) throw new ApiError(400, `Unknown map "${file}" for "${game.slug}"`)
    return map
  }

  private requireTeam(slug: string): Team {
    const team = this.config.teams.find((entry) => entry.slug === slug)
    if (!team) throw new ApiError(400, `Unknown team "${slug}"`)
    return team
  }

  private render(
    template: string,
    vars: Parameters<TemplateRenderer['render']>[1],
  ): string {
    try {
      return this.renderer.render(template, vars)
    } catch (error) {
      throw new ApiError(500, `Template rendering failed: ${dockerErrorMessage(error)}`)
    }
  }
}

export function statusFromInspect(
  inspect: Docker.ContainerInspectInfo,
): ServerStatus {
  switch (inspect.State.Status) {
    case 'running':
      return 'running'
    case 'restarting':
      return 'starting'
    case 'removing':
      return 'stopping'
    case 'dead':
      return 'error'
    case 'created':
    case 'exited':
    case 'paused':
      return 'stopped'
    default:
      return inspect.State.Running ? 'running' : 'stopped'
  }
}

