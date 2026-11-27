import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { optionsSchema, toPublicConfig } from '../shared/schema.js'
import type { ServerConfig } from '../shared/types.js'
import { ApiError } from './errors.js'
import { streamImageJobs } from './imageEvents.js'
import type { ImageService } from './images.js'
import { streamLogs } from './logs.js'
import type { OptionsStore } from './options.js'
import type { ServerService } from './service.js'

const createServerSchema = z.object({
  gameSlug: z.string().trim().min(1),
  configSlug: z.string().trim().min(1),
  map: z.string().trim().min(1),
  team1: z.string().trim().min(1),
  team2: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80).optional(),
})

const updateServerSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    map: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.name !== undefined || value.map !== undefined, {
    message: 'Nothing to update',
  })

const pullImageSchema = z.object({
  ref: z.string().trim().min(1),
})

export interface RouteContext {
  config: ServerConfig
  service: ServerService
  images: ImageService
  options: OptionsStore
}

export function registerRoutes(
  app: FastifyInstance,
  { config, service, images, options }: RouteContext,
): void {
  app.get('/api/health', async () => ({ ok: true }))

  app.get('/api/config', async () => toPublicConfig(config))

  app.get('/api/options', async () => options.get())

  app.put('/api/options', async (request) => {
    const body = optionsSchema.parse(request.body)
    return options.set(body)
  })

  app.get('/api/images', async () => images.listImages())

  app.post('/api/images/pull', async (request, reply) => {
    const { ref } = pullImageSchema.parse(request.body)
    const { job, done } = images.startOne(ref)
    void done.catch(() => undefined)
    return reply.code(202).send(job)
  })

  app.post('/api/images/pull-all', async (_request, reply) => {
    const { job, done } = images.startAll()
    void done.catch(() => undefined)
    return reply.code(202).send(job)
  })

  app.get('/api/images/stream', async (_request, reply) => {
    streamImageJobs(reply, images)
  })

  app.get('/api/servers', async () => service.listServers())

  app.post('/api/servers', async (request, reply) => {
    const body = createServerSchema.parse(request.body)
    const server = await service.create(body)
    return reply.code(201).send(server)
  })

  app.patch('/api/servers/:id', async (request) => {
    const { id } = request.params as { id: string }
    const body = updateServerSchema.parse(request.body)
    return service.update(id, body)
  })

  app.delete('/api/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.remove(id)
    return reply.code(204).send()
  })

  app.post('/api/servers/:id/start', async (request) => {
    const { id } = request.params as { id: string }
    return service.start(id)
  })

  app.post('/api/servers/:id/restart', async (request) => {
    const { id } = request.params as { id: string }
    return service.restart(id)
  })

  app.get('/api/servers/:id/logs', async (request, reply) => {
    const { id } = request.params as { id: string }
    await streamLogs(reply, service, id)
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: error.message })
    }

    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Invalid request',
        issues: error.issues.map((issue) => issue.message),
      })
    }

    const candidate =
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500
    const statusCode = candidate >= 400 ? candidate : 500

    if (statusCode >= 500) {
      reply.log.error(error)
    }

    return reply.code(statusCode).send({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  })
}
