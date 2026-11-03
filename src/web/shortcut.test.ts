import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isSearchShortcut } from './shortcut.ts';

const SLASH = { key: '/', ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false };
const BODY = { tagName: 'BODY', isContentEditable: false };

describe('search shortcut', () => {
  it('answers a bare slash pressed outside any field', () => {
    assert.equal(isSearchShortcut(SLASH, BODY), true);
    assert.equal(isSearchShortcut(SLASH, { tagName: 'BUTTON', isContentEditable: false }), true);
    assert.equal(isSearchShortcut(SLASH, null), true);
  });

  it('leaves the slash to the visitor while they type', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      assert.equal(isSearchShortcut(SLASH, { tagName, isContentEditable: false }), false);
    }
    assert.equal(isSearchShortcut(SLASH, { tagName: 'DIV', isContentEditable: true }), false);
  });

  it('ignores other keys, combinations and presses already handled', () => {
    assert.equal(isSearchShortcut({ ...SLASH, key: 'a' }, BODY), false);
    assert.equal(isSearchShortcut({ ...SLASH, ctrlKey: true }, BODY), false);
    assert.equal(isSearchShortcut({ ...SLASH, metaKey: true }, BODY), false);
    assert.equal(isSearchShortcut({ ...SLASH, altKey: true }, BODY), false);
    assert.equal(isSearchShortcut({ ...SLASH, defaultPrevented: true }, BODY), false);
  });
});
