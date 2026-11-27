import { loadConfig } from './config.js'
import { buildApp } from './app.js'
import { ImageService } from './images.js'
import { MetricsService } from './metrics.js'
import { OptionsStore } from './options.js'
import { ServerService } from './service.js'
import { TemplateRenderer } from './templates.js'

async function main(): Promise<void> {
  const { config, templatesDir } = await loadConfig()

  const renderer = new TemplateRenderer(templatesDir)
  const metrics = new MetricsService()
  const service = new ServerService(config, renderer, metrics)
  const images = new ImageService(config)
  const options = new OptionsStore(config)

  const app = buildApp({ config, service, images, options })

  const port = Number(process.env.PORT ?? 8787)
  const host = process.env.HOST ?? '0.0.0.0'

  await app.listen({ port, host })

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down')
    await app.close()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'EADDRINUSE'
  ) {
    console.error(
      `Port ${process.env.PORT ?? 8787} is already in use. Set PORT to a free port.`,
    )
  } else {
    console.error(error)
  }
  process.exit(1)
})
