import { useState } from 'react'
import { Play, RotateCcw, Trash2, Users, Map, Clock, FileText, Pencil, Info } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './StatusBadge'
import { EditServerDialog } from './EditServerDialog'
import { ServerInfoDialog } from './ServerInfoDialog'
import type { GameServer } from '@/types'
import { useServerStore } from '@/store/useServerStore'
import { cn } from '@/lib/utils'

interface ServerCardProps {
  server: GameServer
}

export function ServerCard({ server }: ServerCardProps) {
  const { startServer, restartServer, deleteServer } = useServerStore()
  const [editOpen, setEditOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const isTransitioning =
    busy ||
    server.status === 'starting' ||
    server.status === 'stopping' ||
    server.status === 'deleting'

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch {
      // The store surfaces the error in the banner.
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className={cn(
        'transition-all duration-200',
        server.status === 'running' && 'ring-1 ring-emerald-500/20',
        server.status === 'error' && 'ring-1 ring-destructive/30',
      )}>
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <h3 className="font-semibold leading-none">{server.name}</h3>
            <p className="text-sm text-muted-foreground">
              {server.gameName} — {server.configName}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setInfoOpen(true)}
              title="Server info & logs"
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
            <StatusBadge status={server.status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-4">
          {/* Teams */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" />
            <span>
              {server.team1} <span className="text-muted-foreground/50">vs</span> {server.team2}
            </span>
          </div>

          {/* Config */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate font-mono text-xs">{server.configName}</span>
          </div>

          {/* Map */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Map className="h-4 w-4 shrink-0" />
            <span>{server.mapName}</span>
          </div>

          {server.error && (
            <p className="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {server.error}
            </p>
          )}

          {/* Live query data */}
          {server.status === 'running' && server.metrics ? (
            <div className="flex items-center gap-4 rounded-md bg-muted/50 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{server.metrics.playerCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Map className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{server.metrics.map}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{server.metrics.uptime}</span>
              </div>
            </div>
          ) : server.status === 'running' ? (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Live stats unavailable
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
            title="Edit server"
            disabled={busy}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          {server.status === 'stopped' && (
            <Button
              size="sm"
              onClick={() => void run(() => startServer(server.id))}
              disabled={isTransitioning}
            >
              <Play className="h-4 w-4" />
              Start
            </Button>
          )}
          {server.status === 'running' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void run(() => restartServer(server.id))}
              disabled={isTransitioning}
            >
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void run(() => deleteServer(server.id))}
            disabled={isTransitioning}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          {isTransitioning && (
            <Button size="sm" variant="outline" disabled>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Working…
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Dialogs */}
      <EditServerDialog server={server} open={editOpen} onOpenChange={setEditOpen} />
      <ServerInfoDialog server={server} open={infoOpen} onOpenChange={setInfoOpen} />
    </>
  )
}
