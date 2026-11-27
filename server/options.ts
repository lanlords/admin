import type { Options, ServerConfig } from '../shared/types.js'
import { ApiError } from './errors.js'

/**
 * Holds the UI selection of enabled games/teams in memory. This state is shared
 * by every connected browser but is intentionally not persisted: it resets to
 * "everything enabled" when the admin process restarts.
 */
export class OptionsStore {
  private state: Options

  constructor(private readonly config: ServerConfig) {
    this.state = {
      enabledGameSlugs: config.games.map((game) => game.slug),
      enabledTeamSlugs: config.teams.map((team) => team.slug),
    }
  }

  get(): Options {
    return {
      enabledGameSlugs: [...this.state.enabledGameSlugs],
      enabledTeamSlugs: [...this.state.enabledTeamSlugs],
    }
  }

  set(next: Options): Options {
    this.state = {
      enabledGameSlugs: this.validate(
        next.enabledGameSlugs,
        this.config.games.map((game) => game.slug),
        'game',
      ),
      enabledTeamSlugs: this.validate(
        next.enabledTeamSlugs,
        this.config.teams.map((team) => team.slug),
        'team',
      ),
    }
    return this.get()
  }

  /** Reject unknown slugs and drop duplicates, preserving input order. */
  private validate(slugs: string[], known: string[], label: string): string[] {
    const knownSet = new Set(known)
    const seen = new Set<string>()
    const result: string[] = []
    for (const slug of slugs) {
      if (!knownSet.has(slug)) {
        throw new ApiError(400, `Unknown ${label} "${slug}"`)
      }
      if (!seen.has(slug)) {
        seen.add(slug)
        result.push(slug)
      }
    }
    return result
  }
}