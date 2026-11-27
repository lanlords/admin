import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useImageStore } from '@/store/useImageStore'
import { useServerStore } from '@/store/useServerStore'
import type {
  GameImage,
  ImageJobEvent,
  ImagePullJob,
  ImagePullResult,
} from '@/types'
import {
  CheckCircle2,
  CircleArrowUp,
  Download,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'

interface ImagesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(created: string | null): string {
  if (!created) return '—'
  const date = new Date(created)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function imageBadge(image: GameImage): {
  variant: 'success' | 'warning' | 'muted'
  label: string
} {
  if (image.present === true) return { variant: 'success', label: 'Available' }
  if (image.present === false) return { variant: 'warning', label: 'Missing' }
  return { variant: 'muted', label: 'Unknown' }
}

export function ImagesDialog({ open, onOpenChange }: ImagesDialogProps) {
  const images = useImageStore((s) => s.images)
  const loading = useImageStore((s) => s.loading)
  const error = useImageStore((s) => s.error)
  const fetchImages = useImageStore((s) => s.fetchImages)
  const pull = useImageStore((s) => s.pull)
  const pullAll = useImageStore((s) => s.pullAll)

  const servers = useServerStore((s) => s.servers)

  const [job, setJob] = useState<ImagePullJob | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)
  const lastSuccess = useRef<{ id: string; updated: number }>({
    id: '',
    updated: 0,
  })

  const jobRunning = job?.state === 'running'
  const currentIndex =
    jobRunning && job?.currentRef ? job.refs.indexOf(job.currentRef) : -1
  const dockerUnavailable =
    images.length > 0 && images.every((image) => image.present === null)

  useEffect(() => {
    if (!open) return

    void fetchImages()
    setFeedError(null)

    const source = new EventSource(api.imagesStreamUrl())
    source.onopen = () => setFeedError(null)
    source.onerror = () =>
      setFeedError('Lost the pull progress stream; reconnecting…')
    source.onmessage = (event) => {
      let parsed: ImageJobEvent
      try {
        parsed = JSON.parse(event.data) as ImageJobEvent
      } catch {
        return
      }

      setJob(parsed.job)
      if (!parsed.job) return

      // Refresh local size/created metadata whenever another image lands.
      if (parsed.job.id !== lastSuccess.current.id) {
        lastSuccess.current = { id: parsed.job.id, updated: 0 }
      }
      if (parsed.job.updated > lastSuccess.current.updated) {
        lastSuccess.current.updated = parsed.job.updated
        void fetchImages()
      }
      if (parsed.type === 'done') void fetchImages()
    }

    return () => source.close()
  }, [open, fetchImages])

  async function handlePull(ref: string) {
    try {
      setJob(await pull(ref))
    } catch {
      // The store surfaces the error.
    }
  }

  async function handlePullAll() {
    try {
      setJob(await pullAll())
    } catch {
      // The store surfaces the error.
    }
  }

  function outdatedServersFor(image: GameImage): number {
    if (image.imageId === null) return 0
    return servers.filter(
      (server) =>
        server.status === 'running' &&
        server.imageId !== image.imageId &&
        image.games.some((game) => game.slug === server.gameSlug),
    ).length
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="max-w-3xl"
    >
      <DialogHeader>
        <DialogTitle>Game Images</DialogTitle>
        <DialogDescription>
          Images defined in <code className="font-mono">config.yaml</code> and
          their state in the connected Docker engine. Pulling updates the
          configured tag in place.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {jobRunning && job
            ? `Pulling ${currentIndex + 1} of ${job.refs.length}…`
            : job?.state === 'done'
              ? `Updated ${job.updated}${job.failed ? `, ${job.failed} failed` : ''}.`
              : `${images.filter((image) => image.present === true).length} of ${images.length} available locally.`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchImages()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => void handlePullAll()}
            disabled={jobRunning || images.length === 0 || dockerUnavailable}
            title="Pull every configured image with its configured tag"
          >
            {jobRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Pull All
          </Button>
        </div>
      </div>

      {(error || feedError) && (
        <p className="mt-3 text-sm text-destructive">{error ?? feedError}</p>
      )}

      <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {loading && images.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading images…
          </p>
        )}

        {!loading && images.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No images defined in{' '}
            <code className="font-mono">config.yaml</code>.
          </p>
        )}

        {images.map((image) => {
          const badge = imageBadge(image)
          const result: ImagePullResult | null =
            job?.results[image.ref] ?? null
          const percent =
            result && result.total > 0
              ? Math.min(100, Math.round((result.current / result.total) * 100))
              : null
          const restartCount =
            result?.state === 'success' ? outdatedServersFor(image) : 0

          return (
            <div
              key={image.ref}
              className="rounded-lg border px-3 py-3"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {image.games.map((game) => game.name).join(', ')}
                    </span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {restartCount > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Recreate {restartCount} running server
                        {restartCount === 1 ? '' : 's'} to apply
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                    {image.ref}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {image.present === null
                      ? 'Docker engine unreachable'
                      : `${formatBytes(image.size)} · Created ${formatDate(image.created)}`}
                  </p>

                  {result?.state === 'pulling' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {result.status}
                          {result.total > 0 &&
                            ` · ${formatBytes(result.current)} / ${formatBytes(result.total)}`}
                        </span>
                        {percent !== null && <span>{percent}%</span>}
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full bg-primary transition-all',
                            percent === null && 'w-1/3 animate-pulse',
                          )}
                          style={
                            percent !== null
                              ? { width: `${percent}%` }
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  )}

                  {result?.state === 'error' && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="break-words">{result.error}</span>
                    </p>
                  )}

                  {result?.state === 'success' && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pulled
                    </p>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePull(image.ref)}
                  disabled={jobRunning || image.present === null}
                >
                  {result?.state === 'pulling' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : image.present ? (
                    <CircleArrowUp className="h-4 w-4" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {image.present ? 'Update' : 'Pull'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    </Dialog>
  )
}