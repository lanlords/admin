import type { ServerStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusConfig: Record<ServerStatus, { label: string; variant: 'success' | 'warning' | 'muted' | 'destructive' }> = {
  running: { label: 'Running', variant: 'success' },
  starting: { label: 'Starting…', variant: 'warning' },
  stopping: { label: 'Stopping…', variant: 'warning' },
  deleting: { label: 'Deleting…', variant: 'destructive' },
  stopped: { label: 'Stopped', variant: 'destructive' },
  error: { label: 'Error', variant: 'destructive' },
}

interface StatusBadgeProps {
  status: ServerStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status]

  return (
    <Badge variant={cfg.variant} className="gap-1.5">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'running' && 'bg-emerald-500 animate-pulse',
          status === 'starting' && 'bg-amber-500 animate-pulse',
          status === 'stopping' && 'bg-amber-500 animate-pulse',
          status === 'deleting' && 'bg-destructive animate-pulse',
          status === 'stopped' && 'bg-destructive',
          status === 'error' && 'bg-destructive',
        )}
      />
      {cfg.label}
    </Badge>
  )
}