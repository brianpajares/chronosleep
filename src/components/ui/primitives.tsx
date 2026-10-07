import type { HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-line bg-surface shadow-sm', className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'primary' | 'accent' | 'warning' }) {
  const tones = {
    neutral: 'bg-subtle text-muted border-line',
    primary: 'bg-primary-soft text-fg border-transparent',
    accent: 'bg-accent-soft text-fg border-transparent',
    warning: 'bg-subtle text-warning border-line',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-base font-semibold text-fg', className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'block w-full rounded-md border border-line-strong bg-surface px-4 py-2.5 text-lg text-fg shadow-sm transition-shadow placeholder:text-muted/70 focus-visible:border-focus focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  );
}

export function Helper({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />;
}

export function FieldError({
  id,
  children,
  className,
}: {
  id: string;
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn('flex items-start gap-2 text-sm font-medium text-danger', className)}>
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Callout({
  title,
  children,
  tone = 'info',
  className,
}: {
  title: string;
  children: ReactNode;
  tone?: 'info' | 'warning';
  className?: string;
}) {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <div
      role="note"
      className={cn(
        'flex gap-3 rounded-md border bg-subtle p-4 text-sm',
        tone === 'warning' ? 'border-warning/50' : 'border-line',
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-5 shrink-0', tone === 'warning' ? 'text-warning' : 'text-primary')}
      />
      <div>
        <p className="font-semibold text-fg">{title}</p>
        <div className="mt-1 text-muted">{children}</div>
      </div>
    </div>
  );
}

export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm font-semibold tracking-wide text-primary uppercase', className)}
      {...props}
    />
  );
}
