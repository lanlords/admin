import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseConfig, toPublicConfig } from '../shared/schema.js'
import { TemplateRenderer } from './templates.js'

const validGame = {
  name: 'CS2',
  slug: 'cs2',
  image: 'docker.io/gameserver/cs2',
  command: ['+map', '{map}'],
  configs: [
    {
      name: 'Competitive',
      slug: 'comp',
      template: 'cs2/comp.cfg.j2',
      target: '/data/server.cfg',
    },
  ],
  maps: [{ name: 'Dust II', file: 'de_dust2' }],
}

describe('parseConfig', () => {
  it('applies defaults and keeps the rcon password out of the public config', () => {
    const config = parseConfig({
      games: [validGame],
      teams: [{ name: 'Team', slug: 'T' }],
    })

    expect(config.defaults.tag).toBe('latest')
    expect(config.defaults.pullPolicy).toBe('never')
    expect(config.defaults.restartPolicy).toBe('no')
    expect(config.defaults.rconPassword).toBe('lanlords')

    const publicConfig = toPublicConfig(config)
    expect(JSON.stringify(publicConfig)).not.toContain('rconPassword')
  })

  it('rejects duplicate slugs', () => {
    expect(() =>
      parseConfig({
        games: [validGame, validGame],
        teams: [{ name: 'Team', slug: 'T' }],
      }),
    ).toThrow(/Duplicate game slug/)
  })
})

describe('TemplateRenderer', () => {
  let directory = ''

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it('renders variables and preserves newlines', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'lanlords-'))
    await writeFile(
      path.join(directory, 'test.cfg.j2'),
      'hostname "{{ serverName }}"\nmaxplayers {{ maxPlayers }}\n',
    )

    const renderer = new TemplateRenderer(directory)
    const output = renderer.render('test.cfg.j2', {
      serverName: 'FFvsVH',
      maxPlayers: 10,
    } as never)

    expect(output).toBe('hostname "FFvsVH"\nmaxplayers 10\n')
  })
})
