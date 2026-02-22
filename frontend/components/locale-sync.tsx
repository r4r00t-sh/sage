'use client';

import { useEffect } from 'react';
import { useLocaleStore } from '@/lib/store';

/**
 * Syncs locale from store to document (data-locale, lang).
 * When locale is 'ml', globals.css applies Manjari font to body.
 */
export function LocaleSync() {
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.setAttribute('data-locale', locale);
    document.documentElement.lang = locale === 'ml' ? 'ml' : 'en';
  }, [locale]);

  return null;
}
