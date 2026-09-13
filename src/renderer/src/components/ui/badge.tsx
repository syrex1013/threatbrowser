import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-tv-pill border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-tv-border bg-white text-tv-muted',
        secondary: 'border-tv-border bg-tv-surface-subtle text-tv-ink',
        outline: 'border-tv-border bg-transparent text-tv-ink',
        success: 'border-transparent bg-tv-success-soft text-tv-success',
        danger: 'border-transparent bg-tv-error-soft text-tv-error',
        primary: 'border-transparent bg-tv-red text-white'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
