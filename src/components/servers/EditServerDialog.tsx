import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useServerStore } from '@/store/useServerStore'
import { cn } from '@/lib/utils'
import type { GameServer, GameMap } from '@/types'

interface EditServerDialogProps {
  server: GameServer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditServerDialog({ server, open, onOpenChange }: EditServerDialogProps) {
  const config = useServerStore((s) => s.config)
  const updateServer = useServerStore((s) => s.updateServer)

  const [name, setName] = useState('')
  const [selectedMap, setSelectedMap] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (open && server) {
      setName(server.name)
      setSelectedMap(server.map)
      setFormError(null)
    }
  }, [open, server])

  if (!server) return null

  const game = config?.games.find((g) => g.slug === server.gameSlug)
  const maps: GameMap[] = game?.maps ?? []

  async function handleSave() {
    if (!server) return
    setBusy(true)
    setFormError(null)
    try {
      await updateServer(server.id, {
        name: name.trim() || server.name,
        map: selectedMap,
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not update server',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Edit Server</DialogTitle>
        <DialogDescription>
          Change the server name or map. Saving recreates the container.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {/* Server name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Server Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={server.name}
          />
        </div>

        {/* Map picker */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Map</label>
          {maps.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {maps.map((m) => (
                <button
                  key={m.file}
                  type="button"
                  onClick={() => setSelectedMap(m.file)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    selectedMap === m.file
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{server.mapName}</p>
          )}
        </div>
      </div>

      {formError && (
        <p className="mt-2 text-sm text-destructive">{formError}</p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void handleSave()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}