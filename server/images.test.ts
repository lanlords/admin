import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerConfig } from '../shared/types.js'

const docker = vi.hoisted(() => ({
  inspectImage: vi.fn(),
  pingDocker: vi.fn(),
  pullImage: vi.fn(),
}))

vi.mock('./docker.js', () => docker)

import { ImageService } from './images.js'

const gameBase = {
  command: ['+map', '{map}'],
  configs: [
    {
      name: 'Default',
      slug: 'default',
      template: 'x.cfg.j2',
      target: '/data/server.cfg',
    },
  ],
  maps: [{ name: 'Map', file: 'mp_map' }],
}

const config: ServerConfig = {
  defaults: {
    tag: 'latest',
    pullPolicy: 'never',
    restartPolicy: 'no',
    rconPassword: 'secret',
    maxPlayers: 16,
  },
  games: [
    {
      ...gameBase,
      name: 'Counter-Strike 2',
      slug: 'cs2',
      image: 'docker.io/gameserver/cs2',
    },
    {
      ...gameBase,
      name: 'Team Fortress 2',
      slug: 'tf2',
      image: 'docker.io/gameserver/cs2',
    },
    {
      ...gameBase,
      name: 'Call of Duty 2',
      slug: 'cod2',
      image: 'lanlords/cod2',
      tag: 'v2',
    },
    {
      ...gameBase,
      name: 'Call of Duty 4',
      slug: 'cod4',
      image: 'docker.io/gameserver/cod4',
    },
  ],
  teams: [{ name: 'Alpha', slug: 'A' }],
}

const refs = [
  'docker.io/gameserver/cs2:latest',
  'lanlords/cod2:v2',
  'docker.io/gameserver/cod4:latest',
]

beforeEach(() => {
  docker.inspectImage.mockReset()
  docker.pingDocker.mockReset()
  docker.pullImage.mockReset()
  docker.pingDocker.mockResolvedValue(undefined)
})

describe('ImageService.listImages', () => {
  it('dedupes refs in config order and reports local state', async () => {
    docker.inspectImage.mockImplementation(async (ref: string) => {
      if (ref === refs[0]) {
        return {
          Id: 'sha256:aaaa',
          Size: 1024,
          Created: '2024-01-02T03:04:05Z',
        }
      }
      if (ref === refs[1]) return null
      throw new Error('boom')
    })

    const images = await new ImageService(config).listImages()

    expect(images.map((image) => image.ref)).toEqual(refs)
    expect(images[0].games.map((game) => game.slug)).toEqual(['cs2', 'tf2'])
    expect(images[0]).toMatchObject({
      present: true,
      imageId: 'sha256:aaaa',
      size: 1024,
      created: '2024-01-02T03:04:05Z',
    })
    expect(images[1]).toMatchObject({ present: false, size: null, created: null })
    expect(images[2]).toMatchObject({ present: null, size: null, created: null })
  })

  it('marks every image unknown when Docker is unreachable', async () => {
    docker.pingDocker.mockRejectedValue(new Error('no socket'))

    const images = await new ImageService(config).listImages()

    expect(images).toHaveLength(3)
    expect(images.every((image) => image.present === null)).toBe(true)
    expect(docker.inspectImage).not.toHaveBeenCalled()
  })
})

describe('ImageService pulls', () => {
  it('pulls unique refs sequentially and records results', async () => {
    const order: string[] = []
    docker.pullImage.mockImplementation(async (ref: string) => {
      order.push(ref)
    })

    const service = new ImageService(config)
    const { done } = service.startAll()
    await done

    expect(order).toEqual(refs)
    const job = service.snapshot()
    expect(job?.state).toBe('done')
    expect(job?.updated).toBe(3)
    expect(job?.failed).toBe(0)
    expect(Object.values(job!.results).every((result) => result.state === 'success')).toBe(
      true,
    )
  })

  it('continues after a failure and reports it per image', async () => {
    docker.pullImage.mockImplementation(async (ref: string) => {
      if (ref === refs[1]) throw new Error('Pull failed: manifest unknown')
    })

    const service = new ImageService(config)
    const { done } = service.startAll()
    await done

    const job = service.snapshot()!
    expect(job.failed).toBe(1)
    expect(job.updated).toBe(2)
    expect(job.results[refs[1]]).toMatchObject({
      state: 'error',
      error: 'Pull failed: manifest unknown',
    })
    expect(job.results[refs[2]].state).toBe('success')
  })

  it('rejects a second pull while a job is running', async () => {
    docker.pullImage.mockImplementation(() => new Promise(() => undefined))

    const service = new ImageService(config)
    const { job } = service.startAll()

    expect(job.state).toBe('running')
    expect(() => service.startOne(refs[0])).toThrowError(
      'An image pull is already in progress',
    )
  })

  it('rejects refs that are not defined in the config', () => {
    const service = new ImageService(config)

    expect(() => service.startOne('docker.io/nope:latest')).toThrowError(
      'is not defined in config.yaml',
    )
  })

  it('aggregates per-layer progress into a single byte total', async () => {
    docker.pullImage.mockImplementation(
      async (_ref: string, onProgress: (progress: unknown) => void) => {
        onProgress({ id: 'layer-a', current: 50, total: 100, status: 'Downloading' })
        onProgress({ id: 'layer-b', current: 10, total: 20, status: 'Downloading' })
        onProgress({ id: 'layer-a', current: 100, total: 100, status: 'Extracting' })
      },
    )

    const service = new ImageService(config)
    const { done } = service.startOne(refs[0])
    await done

    expect(service.snapshot()?.results[refs[0]]).toMatchObject({
      state: 'success',
      current: 120,
      total: 120,
    })
  })

  it('emits update events and a final done event', async () => {
    docker.pullImage.mockResolvedValue(undefined)

    const service = new ImageService(config)
    const events: string[] = []
    const unsubscribe = service.subscribe((event) => events.push(event.type))

    const { done } = service.startOne(refs[0])
    await done
    unsubscribe()

    expect(events[0]).toBe('update')
    expect(events.at(-1)).toBe('done')
    expect(service.snapshot()?.state).toBe('done')
  })
})