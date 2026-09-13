import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-tv ease-tv focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tv-red focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'rounded-none border-2 border-tv-red bg-tv-red text-white hover:border-tv-red-hover hover:bg-tv-red-hover active:border-tv-red-active active:bg-tv-red-active active:translate-y-px',
        secondary:
          'rounded-none border border-tv-border-strong bg-transparent text-tv-ink hover:border-tv-ink hover:bg-tv-surface-subtle',
        outline:
          'rounded-none border border-tv-border-strong bg-transparent text-tv-ink hover:border-tv-ink hover:bg-tv-surface-subtle',
        ghost:
          'rounded-none bg-transparent text-tv-ink hover:bg-tv-surface-muted hover:text-tv-ink',
        'outline-red':
          'rounded-none border-2 border-tv-red bg-transparent text-tv-red hover:bg-tv-red-soft',
        success: 'rounded-none bg-tv-success text-white hover:bg-[#146c43]',
        destructive: 'rounded-none bg-tv-error text-white hover:bg-[#bb2d3b]'
      },
      size: {
        default: 'h-[3.5rem] px-8',
        sm: 'h-9 px-4',
        lg: 'h-[3.75rem] px-10',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'
