import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background,border-color,opacity,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-text hover:bg-accent-hover shadow-sm',
        secondary: 'bg-surface-2 text-text border border-border hover:border-accent/40',
        ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-text',
        outline: 'bg-transparent text-text border border-border hover:bg-surface-2',
        danger: 'bg-danger text-white hover:opacity-90 shadow-sm',
        link: 'bg-transparent text-accent-fg hover:underline p-0 h-auto shadow-none',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Rendert als Slot (z. B. um einen <Link> als Button zu stylen). */
  asChild?: boolean
  /** Zeigt Spinner und deaktiviert den Button. */
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className)

    // asChild: Slot erwartet GENAU ein Kind — kein Spinner/disabled-Sibling.
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner size={size === 'lg' ? 18 : 15} />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

export interface IconButtonProps extends ButtonProps {
  /** Pflicht — beschreibt die Aktion für Screenreader. */
  'aria-label': string
}

/** Quadratischer Icon-Button. `aria-label` ist Pflicht. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const square = size === 'sm' ? 'w-8 px-0' : size === 'lg' ? 'w-12 px-0' : 'w-10 px-0'
    return <Button ref={ref} size={size} className={cn(square, className)} {...props} />
  },
)
IconButton.displayName = 'IconButton'

export { buttonVariants }
