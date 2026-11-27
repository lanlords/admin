import type { FastifyReply } from 'fastify'
import type { ImageJobEvent } from '../shared/types.js'
import type { ImageService } from './images.js'

export function streamImageJobs(
  reply: FastifyReply,
  images: ImageService,
): void {
  reply.hijack()
  const response = reply.raw

  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  response.write(': connected\n\n')

  const send = (event: ImageJobEvent) => {
    if (!response.writableEnded) {
      response.write(`data: ${JSON.stringify(event)}\n\n`)
    }
  }

  // Replay the current (or last completed) job so a reopened dialog reattaches.
  send({ type: 'snapshot', job: images.snapshot() })
  const unsubscribe = images.subscribe(send)

  const heartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(': ping\n\n')
  }, 15_000)

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    unsubscribe()
    if (!response.writableEnded) response.end()
  }

  response.on('close', close)
}