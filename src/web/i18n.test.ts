import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FEATURE_GROUPS } from './features.ts';
import {
  DEFAULT_LOCALE,
  initialLocale,
  interpolate,
  keyPaths,
  messagesFor,
  plural,
  rememberLocale,
} from './i18n.ts';

const en = messagesFor('en');
const fr = messagesFor('fr');

/** Every string of a messages object. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(strings);
  }
  return value !== null && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
}

describe('language files', () => {
  it('have exactly the same keys in English and French', () => {
    assert.deepEqual(keyPaths(fr), keyPaths(en));
  });

  it('use the same {placeholders} in both languages', () => {
    const placeholders = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
    const english = strings(en);
    strings(fr).forEach((text, index) => {
      assert.deepEqual(placeholders(text), placeholders(english[index] ?? ''), text);
    });
  });

  it('name every feature and group of the catalogue', () => {
    for (const messages of [en, fr]) {
      for (const group of FEATURE_GROUPS) {
        assert.ok(messages.catalogue.groups[group.id].name !== '', group.id);
        for (const feature of group.features) {
          assert.ok(messages.catalogue.features[feature.id].title !== '', feature.id);
        }
      }
    }
  });

  it('only contain documentation blocks the page can render', () => {
    const valid: Readonly<Record<string, readonly string[]>> = {
      p: ['type', 'text'],
      h3: ['type', 'text'],
      checks: ['type', 'items'],
      steps: ['type', 'items'],
      table: ['type', 'head', 'rows'],
      diagram: ['type', 'nodes', 'detail', 'arrows', 'side'],
      button: ['type', 'text', 'href'],
    };
    for (const messages of [en, fr]) {
      for (const section of messages.docs.sections) {
        for (const block of section.blocks) {
          assert.deepEqual(
            Object.keys(block).sort(),
            [...(valid[block.type] ?? [])].sort(),
            section.id,
          );
        }
      }
    }
  });

  it('follow French typography: a narrow no-break space before : ; ? ! and %', () => {
    for (const text of strings(fr)) {
      assert.doesNotMatch(text, / [:;?!%€]/, text);
    }
  });

  it('keep each language in its own file', () => {
    assert.equal(en.meta.lang, 'en');
    assert.equal(fr.meta.lang, 'fr');
    assert.notEqual(fr.home.lede, en.home.lede);
  });
});

describe('i18n helpers', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    assert.equal(interpolate('{a} of {b}', { a: 2, b: 3 }), '2 of 3');
    assert.equal(interpolate('{missing}'), '{missing}');
  });

  it('picks plural forms by the rules of each language', () => {
    const forms = { one: '{count} branch', other: '{count} branches' };
    assert.equal(plural(forms, 1, 'en'), '1 branch');
    assert.equal(plural(forms, 2, 'en'), '2 branches');
    // In French, 0 and 1 are singular.
    assert.equal(plural(forms, 0, 'fr'), '0 branch');
    assert.equal(plural(forms, 1200, 'fr'), '1\u202f200 branches');
  });

  it('defaults to French and remembers the visitor choice', () => {
    const stored = new Map<string, string>();
    const storage = {
      getItem: (key: string): string | null => stored.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        stored.set(key, value);
      },
    };

    assert.equal(DEFAULT_LOCALE, 'fr');
    assert.equal(initialLocale(storage), 'fr');
    rememberLocale(storage, 'en');
    assert.equal(initialLocale(storage), 'en');
    assert.equal(initialLocale(undefined), 'fr');
    stored.set('devpulse.locale', 'de');
    assert.equal(initialLocale(storage), 'fr');
  });

  it('falls back to French when storage is blocked', () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
    };
    assert.equal(initialLocale(blocked), 'fr');
  });
});
