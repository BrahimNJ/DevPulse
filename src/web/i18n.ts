import en from './locales/en.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };

/** Every text of the interface, in the shape of the English file. */
export type Messages = typeof en;

export type Locale = 'fr' | 'en';

/** French is the default: most readers of the site are French recruiters. */
export const DEFAULT_LOCALE: Locale = 'fr';

export const LOCALES: Readonly<Record<Locale, { readonly label: string; readonly tag: string }>> = {
  fr: { label: 'Français', tag: 'fr-FR' },
  en: { label: 'English', tag: 'en-GB' },
};

/** The French file must have exactly the keys of the English one (checked by a test). */
const MESSAGES: Readonly<Record<Locale, Messages>> = { en, fr };

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}

const STORAGE_KEY = 'devpulse.locale';

/** The language chosen earlier on this browser, or the default. */
export function initialLocale(storage: Pick<Storage, 'getItem'> | undefined): Locale {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'fr' ? saved : DEFAULT_LOCALE;
  } catch {
    // Storage can be disabled; the default language still works.
    return DEFAULT_LOCALE;
  }
}

export function rememberLocale(
  storage: Pick<Storage, 'setItem'> | undefined,
  locale: Locale,
): void {
  try {
    storage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Not remembering the choice is acceptable.
  }
}

/** Replaces each `{name}` in `template` with the matching value. */
export function interpolate(
  template: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/** Picks the `one` or `other` form for `count`, by the plural rules of the language. */
export function plural(
  forms: { readonly one: string; readonly other: string },
  count: number,
  locale: Locale,
): string {
  const form = new Intl.PluralRules(LOCALES[locale].tag).select(count) === 'one' ? 'one' : 'other';
  return interpolate(forms[form], { count: formatNumber(count, locale) });
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALES[locale].tag).format(value);
}

/** Lists every dotted key path of a messages object, to compare two languages. */
export function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => keyPaths(item, `${prefix}[${String(index)}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      keyPaths(item, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  return [prefix];
}
