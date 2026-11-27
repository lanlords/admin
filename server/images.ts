import { randomUUID } from 'node:crypto'
import type {
  GameImage,
  ImageJobEvent,
  ImagePullJob,
  ImagePullResult,
  ServerConfig,
} from '../shared/types.js'
import { imageRef } from './containerSpec.js'
import {
  inspectImage,
  pingDocker,
  pullImage,
  type PullProgress,
} from './docker.js'
import { ApiError, dockerErrorMessage } from './errors.js'

/**
 * Image refs are emitted by Docker per layer. Aggregate their byte counters so
 * the UI can render one progress bar per image, and throttle those updates so a
 * large pull does not flood the SSE stream.
 */
const PROGRESS_INTERVAL_MS = 200

type LayerProgress = { current: number; total: number }

export class ImageService {
  private job: ImagePullJob | null = null
  private running = false
  private readonly listeners = new Set<(event: ImageJobEvent) => void>()
  private lastProgressAt = 0
  private readonly layers = new Map<string, Map<string, LayerProgress>>()

  constructor(private readonly config: ServerConfig) {}

  /** Unique effective image refs, in config order. */
  refs(): string[] {
    const refs = new Set<string>()
    for (const game of this.config.games) {
      refs.add(imageRef(game, this.config.defaults))
    }
    return [...refs]
  }

  /** Config-derived images joined with their local Docker state. */
  async listImages(): Promise<GameImage[]> {
    const groups = new Map<string, GameImage['games']>()
    for (const game of this.config.games) {
      const ref = imageRef(game, this.config.defaults)
      const games = groups.get(ref) ?? []
      games.push({ name: game.name, slug: game.slug })
      groups.set(ref, games)
    }

    let dockerUp = true
    try {
      await pingDocker()
    } catch {
      dockerUp = false
    }

    const images: GameImage[] = []
    for (const [ref, games] of groups) {
      if (!dockerUp) {
        images.push({
          ref,
          games,
          present: null,
          imageId: null,
          size: null,
          created: null,
        })
        continue
      }

      try {
        const inspect = await inspectImage(ref)
        images.push({
          ref,
          games,
          present: inspect !== null,
          imageId: inspect?.Id ?? null,
          size: inspect?.Size ?? null,
          created: inspect?.Created ?? null,
        })
      } catch {
        images.push({
          ref,
          games,
          present: null,
          imageId: null,
          size: null,
          created: null,
        })
      }
    }
    return images
  }

  snapshot(): ImagePullJob | null {
    return this.job
  }

  subscribe(listener: (event: ImageJobEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  startAll(): { job: ImagePullJob; done: Promise<void> } {
    return this.start(this.refs())
  }

  startOne(ref: string): { job: ImagePullJob; done: Promise<void> } {
    if (!this.refs().includes(ref)) {
      throw new ApiError(404, `Image "${ref}" is not defined in config.yaml`)
    }
    return this.start([ref])
  }

  private start(refs: string[]): {
    job: ImagePullJob
    done: Promise<void>
  } {
    if (this.running) {
      throw new ApiError(409, 'An image pull is already in progress')
    }

    const job: ImagePullJob = {
      id: randomUUID(),
      state: 'running',
      startedAt: Date.now(),
      finishedAt: null,
      refs: [...refs],
      currentRef: refs[0] ?? null,
      results: Object.fromEntries(
        refs.map((ref) => [
          ref,
          {
            ref,
            state: 'queued',
            status: 'Queued',
            current: 0,
            total: 0,
            error: null,
          } satisfies ImagePullResult,
        ]),
      ),
      updated: 0,
      failed: 0,
    }

    this.job = job
    this.running = true
    this.lastProgressAt = 0
    this.layers.clear()
    this.emit({ type: 'update', job })

    return { job, done: this.run(job) }
  }

  private async run(job: ImagePullJob): Promise<void> {
    try {
      for (const ref of job.refs) {
        job.currentRef = ref
        this.layers.set(ref, new Map())
        this.update(job, ref, { state: 'pulling', status: 'Pulling', error: null })

        try {
          await pullImage(ref, (progress) => this.onProgress(job, ref, progress))
          const total = job.results[ref]?.total ?? 0
          this.update(job, ref, {
            state: 'success',
            status: 'Pulled',
            current: total,
            total,
            error: null,
          })
        } catch (error) {
          this.update(job, ref, {
            state: 'error',
            status: 'Failed',
            error: dockerErrorMessage(error),
          })
        }
      }
    } finally {
      this.layers.clear()
      job.state = 'done'
      job.finishedAt = Date.now()
      job.currentRef = null
      job.updated = Object.values(job.results).filter(
        (result) => result.state === 'success',
      ).length
      job.failed = Object.values(job.results).filter(
        (result) => result.state === 'error',
      ).length
      this.running = false
      this.emit({ type: 'done', job })
    }
  }

  private update(
    job: ImagePullJob,
    ref: string,
    patch: Partial<ImagePullResult>,
  ): void {
    const previous = job.results[ref]
    if (!previous) return
    job.results[ref] = { ...previous, ...patch }
    job.updated = Object.values(job.results).filter(
      (result) => result.state === 'success',
    ).length
    job.failed = Object.values(job.results).filter(
      (result) => result.state === 'error',
    ).length
    this.emit({ type: 'update', job })
  }

  private onProgress(
    job: ImagePullJob,
    ref: string,
    progress: PullProgress,
  ): void {
    const result = job.results[ref]
    if (!result || job.state === 'done') return

    const layers = this.layers.get(ref)
    if (
      layers &&
      progress.id &&
      progress.current !== undefined &&
      progress.total !== undefined
    ) {
      layers.set(progress.id, {
        current: progress.current,
        total: progress.total,
      })
    }

    let current = 0
    let total = 0
    for (const layer of layers?.values() ?? []) {
      current += layer.current
      total += layer.total
    }

    job.results[ref] = { ...result, status: progress.status, current, total }

    const now = Date.now()
    if (now - this.lastProgressAt >= PROGRESS_INTERVAL_MS) {
      this.lastProgressAt = now
      this.emit({ type: 'update', job })
    }
  }

  private emit(event: ImageJobEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}