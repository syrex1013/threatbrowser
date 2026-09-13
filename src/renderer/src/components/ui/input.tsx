import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-[3rem] w-full rounded-tv-control border border-tv-border-strong bg-white px-4 py-3 text-sm text-tv-ink',
          'transition-all duration-tv ease-tv',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-tv-ink-subtle hover:border-tv-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tv-red focus-visible:ring-offset-2 focus-visible:border-tv-red',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
