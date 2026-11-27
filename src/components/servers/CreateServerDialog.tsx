import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useServerStore } from '@/store/useServerStore'
import { cn } from '@/lib/utils'
import type { Game, GameConfig, GameMap, Team } from '@/types'

interface CreateServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateServerDialog({ open, onOpenChange }: CreateServerDialogProps) {
  const config = useServerStore((s) => s.config)
  const enabledGameSlugs = useServerStore((s) => s.enabledGameSlugs)
  const enabledTeamSlugs = useServerStore((s) => s.enabledTeamSlugs)
  const createServerAction = useServerStore((s) => s.createServer)

  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [selectedConfig, setSelectedConfig] = useState<string>('')
  const [selectedMap, setSelectedMap] = useState<string>('')
  const [selectedTeam1, setSelectedTeam1] = useState<string>('')
  const [selectedTeam2, setSelectedTeam2] = useState<string>('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedGame('')
      setSelectedConfig('')
      setSelectedMap('')
      setSelectedTeam1('')
      setSelectedTeam2('')
      setFormError(null)
    }
  }, [open])

  const allGames: Game[] = config?.games ?? []
  const allTeams: Team[] = config?.teams ?? []
  const games = useMemo(
    () => allGames.filter((g) => enabledGameSlugs.includes(g.slug)),
    [allGames, enabledGameSlugs],
  )
  const teams = useMemo(
    () => allTeams.filter((t) => enabledTeamSlugs.includes(t.slug)),
    [allTeams, enabledTeamSlugs],
  )
  const currentGame = games.find((g) => g.slug === selectedGame)
  const configs: GameConfig[] = currentGame?.configs ?? []
  const maps: GameMap[] = currentGame?.maps ?? []

  // Auto-select first config and first map when game changes
  useEffect(() => {
    const game = games.find((g) => g.slug === selectedGame)
    if (game) {
      setSelectedConfig(game.configs.length > 0 ? game.configs[0].slug : '')
      setSelectedMap(game.maps.length > 0 ? game.maps[0].file : '')
    } else {
      setSelectedConfig('')
      setSelectedMap('')
    }
  }, [selectedGame])

  const canSubmit =
    selectedGame &&
    selectedConfig &&
    selectedMap &&
    selectedTeam1 &&
    selectedTeam2 &&
    selectedTeam1 !== selectedTeam2

  async function submit(): Promise<boolean> {
    if (!canSubmit || !currentGame) return false

    setBusy(true)
    setFormError(null)
    try {
      await createServerAction({
        gameSlug: currentGame.slug,
        configSlug: selectedConfig,
        map: selectedMap,
        team1: selectedTeam1,
        team2: selectedTeam2,
        name: `${selectedTeam1}vs${selectedTeam2}`,
      })
      return true
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not create server',
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmitAndClose() {
    if (await submit()) {
      onOpenChange(false)
    }
  }

  async function handleSubmitAndContinue() {
    if (await submit()) {
      // Reset selections, keep dialog open
      setSelectedTeam1('')
      setSelectedTeam2('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Create Server</DialogTitle>
        <DialogDescription>
          Pick a game, choose a config and map, select your teams — done.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 mb-6 space-y-5">
        {/* ── Game picker ── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Game</label>
          <div className="grid grid-cols-3 gap-2">
            {games.map((game) => (
              <button
                key={game.slug}
                type="button"
                onClick={() => setSelectedGame(game.slug)}
                className={cn(
                  'rounded-lg border p-3 text-center transition-all',
                  selectedGame === game.slug
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                )}
              >
                <div className="text-lg font-bold tracking-tight">
                  {game.slug.toUpperCase()}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground leading-tight">
                  {game.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Config picker ── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Config</label>
          {selectedGame ? (
            <div className="flex flex-wrap gap-1.5">
              {configs.map((cfg) => (
                <button
                  key={cfg.slug}
                  type="button"
                  onClick={() => setSelectedConfig(cfg.slug)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    selectedConfig === cfg.slug
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                  )}
                >
                  {cfg.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Pick a game first.</p>
          )}
        </div>

        {/* ── Map picker ── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Map</label>
          {selectedGame ? (
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
            <p className="text-xs text-muted-foreground">Pick a game first.</p>
          )}
        </div>

        {/* ── Team pickers ── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Teams</label>
          <div className="grid grid-cols-2 gap-3">
            {/* Team 1 */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Team 1</p>
              <div className="grid grid-cols-2 gap-1.5">
                {teams.map((team) => {
                  const taken = team.slug === selectedTeam2
                  return (
                    <button
                      key={team.slug}
                      type="button"
                      disabled={taken}
                      onClick={() => setSelectedTeam1(team.slug)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-center text-sm font-medium transition-all',
                        selectedTeam1 === team.slug
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : taken
                            ? 'border-border opacity-25 cursor-not-allowed'
                            : 'border-border text-foreground hover:border-muted-foreground/30 hover:bg-muted/30',
                      )}
                    >
                      {team.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Team 2 */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Team 2</p>
              <div className="grid grid-cols-2 gap-1.5">
                {teams.map((team) => {
                  const taken = team.slug === selectedTeam1
                  return (
                    <button
                      key={team.slug}
                      type="button"
                      disabled={taken}
                      onClick={() => setSelectedTeam2(team.slug)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-center text-sm font-medium transition-all',
                        selectedTeam2 === team.slug
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : taken
                            ? 'border-border opacity-25 cursor-not-allowed'
                            : 'border-border text-foreground hover:border-muted-foreground/30 hover:bg-muted/30',
                      )}
                    >
                      {team.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          {selectedTeam1 && selectedTeam2 && selectedTeam1 === selectedTeam2 && (
            <p className="text-xs text-destructive">Teams must be different.</p>
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
        <Button
          variant="outline"
          onClick={() => void handleSubmitAndContinue()}
          disabled={!canSubmit || busy}
        >
          Create &amp; Add Another
        </Button>
        <Button onClick={() => void handleSubmitAndClose()} disabled={!canSubmit || busy}>
          {busy ? 'Creating…' : 'Create Server'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}