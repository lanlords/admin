import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useServerStore } from '@/store/useServerStore'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface OptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OptionsDialog({ open, onOpenChange }: OptionsDialogProps) {
  const config = useServerStore((s) => s.config)
  const enabledGameSlugs = useServerStore((s) => s.enabledGameSlugs)
  const enabledTeamSlugs = useServerStore((s) => s.enabledTeamSlugs)
  const saveOptions = useServerStore((s) => s.saveOptions)

  // Work on copies so Cancel discards changes
  const [games, setGames] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setGames([...enabledGameSlugs])
      setTeams([...enabledTeamSlugs])
    }
  }, [open, enabledGameSlugs, enabledTeamSlugs])

  function toggleGame(slug: string) {
    setGames(
      games.includes(slug) ? games.filter((s) => s !== slug) : [...games, slug],
    )
  }

  function toggleTeam(slug: string) {
    setTeams(
      teams.includes(slug) ? teams.filter((s) => s !== slug) : [...teams, slug],
    )
  }

  function save() {
    void saveOptions({ enabledGameSlugs: games, enabledTeamSlugs: teams })
    onOpenChange(false)
  }

  const allGames = config?.games ?? []
  const allTeams = config?.teams ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Options</DialogTitle>
        <DialogDescription>
          Toggle games and teams on or off. Only enabled items appear in the Create Server form.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-5">
        {/* ── Games ── */}
        <div>
          <h3 className="mb-2 text-sm font-medium">Games</h3>
          <div className="space-y-1">
            {allGames.map((game) => {
              const on = games.includes(game.slug)
              return (
                <button
                  key={game.slug}
                  type="button"
                  onClick={() => toggleGame(game.slug)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all',
                    on
                      ? 'border-border bg-muted/30'
                      : 'border-border/50 opacity-40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                      on ? 'bg-primary text-primary-foreground' : 'bg-muted/50',
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex-1">
                    <span className={cn('text-sm font-medium', !on && 'text-muted-foreground')}>
                      {game.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground/50 font-mono">
                      {game.slug}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground/30 font-bold uppercase">
                    {game.slug}
                  </span>
                </button>
              )
            })}
          </div>
          {allGames.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No games defined in <code className="font-mono">config.yaml</code>.
            </p>
          )}
        </div>

        {/* ── Teams ── */}
        <div>
          <h3 className="mb-2 text-sm font-medium">Teams</h3>
          <div className="flex flex-wrap gap-1.5">
            {allTeams.map((team) => {
              const on = teams.includes(team.slug)
              return (
                <button
                  key={team.slug}
                  type="button"
                  onClick={() => toggleTeam(team.slug)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                    on
                      ? 'border-border bg-muted/30'
                      : 'border-border/50 opacity-40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded',
                      on ? 'bg-primary text-primary-foreground' : 'bg-muted/50',
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  {team.name}
                </button>
              )
            })}
          </div>
          {allTeams.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No teams defined in <code className="font-mono">config.yaml</code>.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={save}>Save</Button>
      </div>
    </Dialog>
  )
}