import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import { registerRoutes, type RouteContext } from './routes.js'

export function buildApp(context: RouteContext): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  registerRoutes(app, context)

  const distDir = path.resolve(process.cwd(), 'dist')
  const indexPath = path.join(distDir, 'index.html')

  if (existsSync(indexPath)) {
    app.register(fastifyStatic, {
      root: distDir,
      prefix: '/',
      wildcard: false,
    })

    app.setNotFoundHandler((request, reply) => {
      if (
        request.method === 'GET' &&
        request.url !== '/api' &&
        !request.url.startsWith('/api/')
      ) {
        return reply.sendFile('index.html')
      }
      return reply.code(404).send({ error: 'Not found' })
    })
  } else {
    app.setNotFoundHandler((_request, reply) =>
      reply.code(404).send({ error: 'Not found' }),
    )
  }

  return app
}
