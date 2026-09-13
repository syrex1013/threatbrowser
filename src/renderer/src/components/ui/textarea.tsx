import * as React from 'react'

import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-tv-control border border-tv-border-strong bg-white px-4 py-3 text-sm text-tv-ink',
        'transition-all duration-tv ease-tv',
        'placeholder:text-tv-ink-subtle hover:border-tv-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tv-red focus-visible:ring-offset-2 focus-visible:border-tv-red',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
