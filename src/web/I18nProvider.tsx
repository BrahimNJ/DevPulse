import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';

import { initialLocale, messagesFor, rememberLocale, type Locale, type Messages } from './i18n.ts';

export interface I18n {
  readonly locale: Locale;
  /** The texts of the current language. */
  readonly t: Messages;
  readonly setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18n | null>(null);

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Holds the language for the whole page; switching it re-renders without a reload. */
export function I18nProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale(browserStorage()));
  const t = messagesFor(locale);

  // Screen readers, translation tools and search engines read the page language here.
  useEffect(() => {
    document.documentElement.lang = t.meta.lang;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.meta.description);
  }, [t]);

  const setLocale = useCallback((next: Locale): void => {
    rememberLocale(browserStorage(), next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n must be used inside I18nProvider.');
  }
  return value;
}
