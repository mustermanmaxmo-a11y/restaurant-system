import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva('rounded-lg border bg-surface transition-colors', {
  variants: {
    variant: {
      elevated: 'border-border shadow-sm',
      flat: 'border-border',
      ghost: 'border-transparent bg-transparent',
      accent: 'border-accent/25 bg-accent-subtle',
    },
    padding: {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    },
    interactive: {
      true: 'hover:border-accent/40 hover:shadow-md cursor-pointer',
      false: '',
    },
  },
  defaultVariants: { variant: 'elevated', padding: 'md', interactive: false },
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, padding, interactive }), className)} {...props} />
  ),
)
Card.displayName = 'Card'

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-bold tracking-tight text-text', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex items-center gap-2 border-t border-border pt-3', className)} {...props} />
}
