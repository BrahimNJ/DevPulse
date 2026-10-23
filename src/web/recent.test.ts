import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readRecent, rememberRecent } from './recent.ts';

function memory(initial?: string): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map<string, string>(
    initial === undefined ? [] : [['devpulse.recent', initial]],
  );
  return {
    getItem: (key): string | null => items.get(key) ?? null,
    setItem: (key, value): void => {
      items.set(key, value);
    },
  };
}

describe('recent analyses', () => {
  it('keeps the newest first, without duplicates whatever their case', () => {
    const storage = memory();
    rememberRecent(storage, 'nodejs/node');
    rememberRecent(storage, 'vitejs/vite');
    assert.deepEqual(rememberRecent(storage, 'NodeJS/Node'), ['NodeJS/Node', 'vitejs/vite']);
    assert.deepEqual(readRecent(storage), ['NodeJS/Node', 'vitejs/vite']);
  });

  it('keeps six repositories at most', () => {
    const storage = memory();
    for (let index = 0; index < 8; index += 1) {
      rememberRecent(storage, `owner/repository-${String(index)}`);
    }
    assert.equal(readRecent(storage).length, 6);
    assert.equal(readRecent(storage)[0], 'owner/repository-7');
  });

  it('ignores storage that is missing, corrupt or failing', () => {
    assert.deepEqual(readRecent(undefined), []);
    assert.deepEqual(readRecent(memory('{not json')), []);
    assert.deepEqual(readRecent(memory('[1, "a/b", null]')), ['a/b']);
    const failing = {
      getItem: (): string | null => null,
      setItem: (): void => {
        throw new Error('quota exceeded');
      },
    };
    assert.deepEqual(rememberRecent(failing, 'a/b'), ['a/b']);
  });
});
