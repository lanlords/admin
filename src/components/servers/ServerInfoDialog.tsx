import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { Copy, Terminal } from 'lucide-react'
import type { GameServer } from '@/types'

interface ServerInfoDialogProps {
  server: GameServer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ServerInfoDialog({ server, open, onOpenChange }: ServerInfoDialogProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [disconnected, setDisconnected] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !server) return

    setLogs([])
    setDisconnected(false)

    const source = new EventSource(api.logsUrl(server.id))
    source.onopen = () => setDisconnected(false)
    source.onerror = () => {
      setDisconnected(true)
      // A stopped container's log stream ends after the tail; don't let
      // EventSource reconnect and replay it forever.
      if (server.status !== 'running') source.close()
    }
    source.onmessage = (event) => {
      let line: string
      try {
        line = JSON.parse(event.data) as string
      } catch {
        line = event.data
      }
      setLogs((previous) => [...previous, line].slice(-1000))
    }

    return () => source.close()
  }, [open, server])

  // Auto-scroll to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (!server) return null

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="max-w-3xl"
    >
      <DialogHeader>
        <DialogTitle>{server.name}</DialogTitle>
        <DialogDescription>
          Container info and live logs.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {/* Container IP */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground">Container IP</span>
              <p className="font-mono text-sm">{server.ip ?? 'Not assigned'}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (server.ip) void navigator.clipboard?.writeText(server.ip)
              }}
              disabled={!server.ip}
              title="Copy IP"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Live logs */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Live Logs</span>
            {disconnected && (
              <span className="text-xs text-destructive">reconnecting…</span>
            )}
          </div>
          <div className="h-72 overflow-y-auto rounded-lg border bg-black/5 p-3 font-mono text-xs leading-relaxed dark:bg-white/5">
            {logs.length === 0 ? (
              <span className="text-muted-foreground">Waiting for logs…</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="text-foreground/80">
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    </Dialog>
  )
}
