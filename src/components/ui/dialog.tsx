import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Simple native dialog (no Radix) ── */

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** Extra classes for the dialog panel, e.g. to widen it. */
  contentClassName?: string
}

export function Dialog({ open, onOpenChange, children, contentClassName }: DialogProps) {
  if (!open) return null

  return (
    <Portal onClose={() => onOpenChange(false)} contentClassName={contentClassName}>
      {children}
    </Portal>
  )
}

/* ── Portal with backdrop ── */

function Portal({
  onClose,
  children,
  contentClassName,
}: {
  onClose: () => void
  children: ReactNode
  contentClassName?: string
}) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/50"
        onClick={(e) => {
          if (e.target === backdropRef.current) onClose()
        }}
      />
      {/* Content */}
      <div className={cn('relative z-10 mx-4 w-full max-w-lg rounded-xl border bg-background p-6 shadow-lg', contentClassName)}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/* ── Sub-components ── */

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
  )
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
}

// Re-export for compatibility with existing imports
export { Dialog as DialogRoot }
export const DialogTrigger = ({ children }: { children: ReactNode }) => <>{children}</>
export const DialogClose = ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" onClick={onClick} {...props}>
    {children}
  </button>
)
