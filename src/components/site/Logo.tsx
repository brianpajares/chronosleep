import { cn } from '@/lib/utils';

/** Moon + midpoint mark. Decorative: the accessible name comes from the surrounding link. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn('size-8 shrink-0', className)}
    >
      <defs>
        <linearGradient id="cs-logo-g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0e7490" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#cs-logo-g)" />
      <path
        d="M20.5 7.5a9 9 0 1 0 4 12.8 7.2 7.2 0 0 1-4-12.8Z"
        fill="#fff"
        opacity="0.96"
      />
      <circle cx="22.5" cy="10.5" r="1.7" fill="#fde68a" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-lg font-bold tracking-tight text-fg', className)}>
      Chrono<span className="text-primary">Sleep</span>
    </span>
  );
}
