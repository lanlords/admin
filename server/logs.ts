import { Writable } from 'node:stream'
import type { FastifyReply } from 'fastify'
import { demuxLogs } from './docker.js'
import type { ServerService } from './service.js'

export async function streamLogs(
  reply: FastifyReply,
  service: ServerService,
  id: string,
): Promise<void> {
  const stream = await service.getLogStream(id)

  reply.hijack()
  const response = reply.raw

  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  response.write(': connected\n\n')

  const send = (line: string) => {
    if (!response.writableEnded) {
      response.write(`data: ${JSON.stringify(line)}\n\n`)
    }
  }

  const stdout = new LineWriter(send)
  const stderr = new LineWriter(send)
  demuxLogs(stream, stdout, stderr)

  const heartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(': ping\n\n')
  }, 15_000)

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    stdout.flush()
    stderr.flush()
    ;(stream as { destroy?: () => void }).destroy?.()
    if (!response.writableEnded) response.end()
  }

  response.on('close', close)
  stream.on('end', close)
  stream.on('error', close)
}

class LineWriter extends Writable {
  private buffer = ''

  constructor(private readonly send: (line: string) => void) {
    super()
  }

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.buffer += chunk.toString('utf8')
    this.drain()
    callback()
  }

  flush(): void {
    if (this.buffer) {
      this.send(this.buffer)
      this.buffer = ''
    }
  }

  private drain(): void {
    let index = this.buffer.indexOf('\n')
    while (index !== -1) {
      this.send(this.buffer.slice(0, index).replace(/\r$/, ''))
      this.buffer = this.buffer.slice(index + 1)
      index = this.buffer.indexOf('\n')
    }
  }
}
