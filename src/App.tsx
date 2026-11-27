import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { ServerGrid } from '@/components/servers/ServerGrid'
import { CreateServerDialog } from '@/components/servers/CreateServerDialog'
import { OptionsDialog } from '@/components/servers/OptionsDialog'
import { ImagesDialog } from '@/components/servers/ImagesDialog'
import { useConfig } from '@/hooks/useConfig'
import { useServerStore } from '@/store/useServerStore'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, RotateCcw, Settings, X, Container } from 'lucide-react'

export default function App() {
  const { loading, error } = useConfig()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [imagesOpen, setImagesOpen] = useState(false)
  const fetchServers = useServerStore((s) => s.fetchServers)
  const restartServer = useServerStore((s) => s.restartServer)
  const servers = useServerStore((s) => s.servers)
  const serversLoading = useServerStore((s) => s.loading)
  const apiError = useServerStore((s) => s.error)
  const clearError = useServerStore((s) => s.clearError)

  // Poll the backend for container state and metrics.
  useEffect(() => {
    void fetchServers()
    const interval = setInterval(() => {
      void fetchServers()
    }, 3000)

    return () => clearInterval(interval)
  }, [fetchServers])

  if (loading || (serversLoading && servers.length === 0)) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-destructive">Failed to load config: {error}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Make sure the backend is running and <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">config.yaml</code> is valid.
          </p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      {/* Header bar */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/lanlords-logo.png"
            alt="LanLords logo"
            className="h-9 w-9 rounded-lg object-cover"
          />
          <div>
            <h1 className="text-lg font-semibold">LanLords</h1>
            <p className="text-sm text-muted-foreground">
              Manage your game servers — start, stop, and monitor them in real time.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImagesOpen(true)}
            title="Manage gameserver images"
          >
            <Container className="h-4 w-4" />
            Images
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOptionsOpen(true)}
          >
            <Settings className="h-4 w-4" />
            Options
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void Promise.all(
                servers
                  .filter((server) => server.status === 'running')
                  .map((server) => restartServer(server.id)),
              ).catch(() => undefined)
            }
            title="Restart all running servers"
          >
            <RotateCcw className="h-4 w-4" />
            Restart All
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Server
          </Button>
        </div>
      </div>

      {apiError && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">{apiError}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-muted-foreground hover:text-foreground"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Server grid */}
      <ServerGrid onCreateClick={() => setDialogOpen(true)} />

      {/* Dialogs */}
      <CreateServerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <OptionsDialog open={optionsOpen} onOpenChange={setOptionsOpen} />
      <ImagesDialog open={imagesOpen} onOpenChange={setImagesOpen} />
    </MainLayout>
  )
}
