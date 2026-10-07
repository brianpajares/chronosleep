import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 rounded-md font-semibold no-underline transition-[background-color,box-shadow,transform,border-color] duration-150 ease-out-soft active:translate-y-px disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-on-primary shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:shadow-[var(--focus-ring)]',
        secondary:
          'border border-line-strong bg-surface text-fg hover:border-primary hover:bg-subtle',
        text: 'text-link underline-offset-4 hover:underline',
        danger: 'bg-danger text-bg hover:opacity-90',
      },
      size: {
        sm: 'min-h-11 px-4 text-sm',
        md: 'min-h-11 px-5 text-base',
        lg: 'min-h-12 px-6 text-base sm:min-h-[52px] sm:px-8 sm:text-lg',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Keeps the button width and announces the state with text (children), not only a spinner. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? (
            <span
              aria-hidden="true"
              className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          ) : null}
          {children}
        </>
      )}
    </Comp>
  );
}
