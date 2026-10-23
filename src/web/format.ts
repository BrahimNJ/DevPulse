import { LOCALES, type Locale } from './i18n.ts';

/** "19 Oct 2026" or "19 oct. 2026", in UTC so that every visitor sees the same day. */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALES[locale].tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

/**
 * A compact age: "today", "12 days", "4 months", "2.3 years". The units and their
 * plurals come from the browser's Intl data, so every language is grammatical.
 */
export function formatAge(days: number, locale: Locale, today: string): string {
  if (days === 0) {
    return today;
  }
  if (days < 60) {
    return unit(days, 'day', locale);
  }
  if (days < 730) {
    return unit(Math.round(days / 30), 'month', locale);
  }
  return unit(days / 365, 'year', locale, 1);
}

function unit(value: number, name: 'day' | 'month' | 'year', locale: Locale, digits = 0): string {
  return (
    new Intl.NumberFormat(LOCALES[locale].tag, {
      style: 'unit',
      unit: name,
      unitDisplay: 'long',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
      .format(value)
      // A number and its unit never break across lines; Intl is not consistent here.
      .replace(/(\d) (?=\p{L})/u, '$1\u00a0')
  );
}

export function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return null;
  }
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

/** "33%" or "33 %": the language decides the spacing. */
export function percentage(part: number, total: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALES[locale].tag, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(total === 0 ? 0 : part / total);
}

/** Commits ahead of and behind the default branch, such as "+12 / −48". */
export function formatDivergence(
  divergence: { readonly ahead: number; readonly behind: number } | null,
  locale: Locale,
): string {
  if (divergence === null) {
    return '–';
  }
  const number = new Intl.NumberFormat(LOCALES[locale].tag);
  return `+${number.format(divergence.ahead)} / −${number.format(divergence.behind)}`;
}
