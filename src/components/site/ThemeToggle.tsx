'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'cs-theme';

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function ThemeToggle() {
  const t = useTranslations('site');
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted preference after mount
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const cycle = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    apply(next);
    try {
      if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const label = theme === 'light' ? t('theme_light') : theme === 'dark' ? t('theme_dark') : t('theme_system');
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex size-11 items-center justify-center rounded-md text-fg transition-colors hover:bg-subtle"
      aria-label={`${t('theme_toggle')}: ${label}`}
      title={label}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}
