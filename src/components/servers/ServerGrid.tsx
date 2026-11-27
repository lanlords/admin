import { useServerStore } from '@/store/useServerStore'
import { ServerCard } from './ServerCard'
import { Server, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ServerGridProps {
  onCreateClick: () => void
}

export function ServerGrid({ onCreateClick }: ServerGridProps) {
  const servers = useServerStore((s) => s.servers)

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Server className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">No servers yet</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          Create your first game server to get started. Pick a game, choose your teams, and you're ready to go.
        </p>
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4" />
          Create Server
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {servers.map((server) => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  )
}
