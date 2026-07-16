import * as React from 'react'
import { cn } from '@/lib/utils'

const controlBase =
  'w-full rounded-md border border-border bg-surface text-text text-base placeholder:text-muted/70 ' +
  'transition-[border-color,box-shadow] outline-none ' +
  'focus:border-accent focus:shadow-[0_0_0_3px_var(--border-accent)] ' +
  'disabled:opacity-60 disabled:cursor-not-allowed aria-[invalid=true]:border-danger'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(controlBase, 'h-10 px-3', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlBase, 'min-h-24 px-3 py-2 resize-y', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(controlBase, 'h-10 px-3 pr-8 appearance-none cursor-pointer', className)} {...props} />
  ),
)
Select.displayName = 'Select'

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5', className)}
      {...props}
    />
  ),
)
Label.displayName = 'Label'

interface FieldProps {
  label?: React.ReactNode
  /** Hilfetext unter dem Feld (wenn kein Fehler aktiv). */
  hint?: React.ReactNode
  /** Fehlermeldung — setzt aria-invalid am Control und färbt rot. */
  error?: React.ReactNode
  required?: boolean
  className?: string
  /** Genau ein Control (Input/Select/Textarea). Bekommt id + aria automatisch. */
  children: React.ReactElement
}

/**
 * Verknüpft Label, Hilfetext und Fehler barrierefrei mit einem Control.
 * Injiziert id, aria-describedby und aria-invalid in das Kind-Element.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const reactId = React.useId()
  const controlProps = children.props as { id?: string }
  const id = controlProps.id ?? reactId
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  const control = React.cloneElement(children, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  } as React.HTMLAttributes<HTMLElement>)

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </Label>
      )}
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
