'use client';

import { useLocale } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** Primary CTA that fires `calculator_start` (spec/analytics_events.json) without any PII. */
export function TrackedCta({
  href = '/calcular/1',
  source,
  children,
  size = 'lg',
  variant,
  className,
}: {
  href?: ComponentProps<typeof Link>['href'];
  source: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const locale = useLocale();
  return (
    <Button asChild size={size} variant={variant} className={cn('shrink-0 whitespace-nowrap', className)}>
      <Link href={href} onClick={() => track('calculator_start', { locale, source_page: source })}>
        {children}
      </Link>
    </Button>
  );
}
