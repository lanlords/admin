import { describe, expect, it } from 'vitest'
import { buildContainerSpec, imageRef } from './containerSpec.js'
import {
  buildLabels,
  LABEL_GAME,
  LABEL_ID,
  LABEL_MAP,
  readLabels,
} from '../shared/labels.js'
import type { ConfigDefaults, Game, Team } from '../shared/types.js'

const defaults: ConfigDefaults = {
  tag: 'latest',
  pullPolicy: 'never',
  restartPolicy: 'no',
  rconPassword: 'secret',
  maxPlayers: 16,
}

const game: Game = {
  name: 'Counter-Strike 2',
  slug: 'cs2',
  image: 'docker.io/gameserver/cs2',
  command: ['+map', '{map}', '+hostname', '{serverName}'],
  maxPlayers: 10,
  configs: [
    {
      name: 'Competitive',
      slug: 'comp',
      template: 'cs2/comp.cfg.j2',
      target: '/data/game/cs2/cfg/server.cfg',
    },
  ],
  maps: [{ name: 'Dust II', file: 'de_dust2' }],
  query: { type: 'counterstrike2', port: 27015 },
}

const team1: Team = { name: 'FieldFuckers', slug: 'FF' }
const team2: Team = { name: 'Veldheren', slug: 'VH' }

describe('buildContainerSpec', () => {
  it('derives the image reference and labels', () => {
    const spec = buildContainerSpec({
      id: '1234abcd-0000-0000-0000-000000000000',
      name: 'FFvsVH',
      game,
      config: game.configs[0],
      map: game.maps[0],
      team1,
      team2,
      defaults,
      createdAt: 1000,
    })

    expect(spec.imageRef).toBe('docker.io/gameserver/cs2:latest')
    expect(spec.labels[LABEL_GAME]).toBe('cs2')
    expect(spec.labels[LABEL_ID]).toBe('1234abcd-0000-0000-0000-000000000000')
    expect(spec.labels[LABEL_MAP]).toBe('de_dust2')
    expect(spec.restartPolicy).toBe('no')
  })

  it('interpolates command placeholders', () => {
    const spec = buildContainerSpec({
      id: 'abc',
      name: 'FFvsVH',
      game,
      config: game.configs[0],
      map: game.maps[0],
      team1,
      team2,
      defaults,
      createdAt: 1000,
    })

    expect(spec.cmd).toEqual(['+map', 'de_dust2', '+hostname', 'FFvsVH'])
    expect(spec.vars.maxPlayers).toBe(10)
    expect(spec.vars.queryPort).toBe('27015')
    expect(spec.vars.rconPassword).toBe('secret')
  })

  it('uses the per-game tag when provided', () => {
    expect(imageRef({ ...game, tag: 'v2' }, defaults)).toBe(
      'docker.io/gameserver/cs2:v2',
    )
  })

  it('round-trips the server labels', () => {
    const labels = buildLabels({
      id: 'abc',
      name: 'FFvsVH',
      game: 'cs2',
      config: 'comp',
      map: 'de_dust2',
      team1: 'FF',
      team2: 'VH',
      createdAt: 1234,
    })

    expect(readLabels(labels)).toEqual({
      id: 'abc',
      name: 'FFvsVH',
      game: 'cs2',
      config: 'comp',
      map: 'de_dust2',
      team1: 'FF',
      team2: 'VH',
      createdAt: 1234,
    })
  })
})
