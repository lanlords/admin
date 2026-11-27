import { z } from 'zod'
import type { PublicServerConfig, ServerConfig } from './types.js'

const nonEmpty = z.string().trim().min(1)

export const gameConfigSchema = z.object({
  name: nonEmpty,
  slug: nonEmpty,
  template: nonEmpty,
  target: z.string().trim().startsWith('/'),
})

export const gameMapSchema = z.object({
  name: nonEmpty,
  file: nonEmpty,
})

export const gameQuerySchema = z.object({
  type: nonEmpty,
  port: z.number().int().positive().max(65535),
})

const commandSchema = z.array(nonEmpty).min(1)

export const gameSchema = z.object({
  name: nonEmpty,
  slug: nonEmpty,
  image: nonEmpty,
  tag: nonEmpty.optional(),
  network: nonEmpty.optional(),
  command: commandSchema,
  maxPlayers: z.number().int().positive().optional(),
  configs: z.array(gameConfigSchema).min(1),
  maps: z.array(gameMapSchema).min(1),
  query: gameQuerySchema.optional(),
})

export const teamSchema = z.object({
  name: nonEmpty,
  slug: nonEmpty,
})

export const optionsSchema = z.object({
  enabledGameSlugs: z.array(nonEmpty),
  enabledTeamSlugs: z.array(nonEmpty),
})

export const defaultsSchema = z.object({
  tag: nonEmpty.default('latest'),
  pullPolicy: z.literal('never').default('never'),
  restartPolicy: z.literal('no').default('no'),
  rconPassword: nonEmpty.default('lanlords'),
  maxPlayers: z.number().int().positive().default(16),
})

export const configSchema = z
  .object({
    defaults: defaultsSchema.optional(),
    games: z.array(gameSchema).min(1),
    teams: z.array(teamSchema).min(1),
  })
  .superRefine((config, ctx) => {
    assertUnique(config.games.map((g) => g.slug), 'game slug', ctx)
    assertUnique(config.teams.map((t) => t.slug), 'team slug', ctx)

    for (const game of config.games) {
      assertUnique(
        game.configs.map((c) => c.slug),
        `config slug in game "${game.slug}"`,
        ctx,
        ['games', config.games.indexOf(game), 'configs'],
      )
      assertUnique(
        game.maps.map((m) => m.file),
        `map file in game "${game.slug}"`,
        ctx,
        ['games', config.games.indexOf(game), 'maps'],
      )
    }
  })

function assertUnique(
  values: string[],
  label: string,
  ctx: z.RefinementCtx,
  path: (string | number)[] = [],
) {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate ${label}: "${value}"`,
        path,
      })
    }
    seen.add(value)
  }
}

export function parseConfig(input: unknown): ServerConfig {
  const parsed = configSchema.parse(input)
  return {
    defaults: parsed.defaults ?? defaultsSchema.parse({}),
    games: parsed.games,
    teams: parsed.teams,
  }
}

export function toPublicConfig(config: ServerConfig): PublicServerConfig {
  return {
    games: config.games.map((game) => ({
      name: game.name,
      slug: game.slug,
      maxPlayers: game.maxPlayers ?? config.defaults.maxPlayers,
      configs: game.configs.map(({ name, slug }) => ({ name, slug })),
      maps: game.maps,
    })),
    teams: config.teams,
  }
}
