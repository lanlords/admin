import { promises as fs } from 'node:fs'
import path from 'node:path'
import { load } from 'js-yaml'
import { parseConfig } from '../shared/schema.js'
import type { ServerConfig } from '../shared/types.js'

export const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g

export const ALLOWED_PLACEHOLDERS = new Set([
  'serverName',
  'gameName',
  'gameSlug',
  'map',
  'mapName',
  'team1',
  'team2',
  'team1Slug',
  'team2Slug',
  'maxPlayers',
  'port',
  'queryPort',
  'rconPassword',
  'createdAt',
  'configPath',
])

export interface LoadedConfig {
  config: ServerConfig
  configPath: string
  templatesDir: string
}

export function configPathFromEnv(): string {
  return process.env.CONFIG_PATH
    ? path.resolve(process.env.CONFIG_PATH)
    : path.resolve(process.cwd(), 'config.yaml')
}

export function templatesDirFromEnv(): string {
  return process.env.TEMPLATES_DIR
    ? path.resolve(process.env.TEMPLATES_DIR)
    : path.resolve(process.cwd(), 'templates')
}

export function resolveTemplatePath(
  template: string,
  templatesDir: string,
): string {
  const relative = template.startsWith('templates/')
    ? template.slice('templates/'.length)
    : template
  return path.resolve(templatesDir, relative)
}

export async function loadConfig(): Promise<LoadedConfig> {
  const configPath = configPathFromEnv()
  const templatesDir = templatesDirFromEnv()

  let text: string
  try {
    text = await fs.readFile(configPath, 'utf8')
  } catch {
    throw new Error(`Config file not found: ${configPath}`)
  }

  const raw = load(text)
  const config = parseConfig(raw)

  for (const game of config.games) {
    for (const cmd of game.command) {
      for (const match of cmd.matchAll(PLACEHOLDER_RE)) {
        if (!ALLOWED_PLACEHOLDERS.has(match[1])) {
          throw new Error(
            `Unknown placeholder "{${match[1]}}" in command for game "${game.slug}"`,
          )
        }
      }
    }

    for (const gameConfig of game.configs) {
      const templatePath = resolveTemplatePath(gameConfig.template, templatesDir)
      try {
        await fs.access(templatePath)
      } catch {
        throw new Error(
          `Template not found for ${game.slug}/${gameConfig.slug}: ${templatePath}`,
        )
      }
    }
  }

  return { config, configPath, templatesDir }
}
