import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escapeMarkdown } from './markdown.ts';

describe('Markdown escaping', () => {
  it('leaves ordinary text alone', () => {
    assert.equal(escapeMarkdown('feature/login-v2.1'), 'feature/login-v2.1');
  });

  it('escapes what Markdown would read as formatting', () => {
    assert.equal(escapeMarkdown('_draft_'), String.raw`\_draft\_`);
    assert.equal(escapeMarkdown('a|b'), String.raw`a\|b`);
    assert.equal(
      escapeMarkdown('[x](y) <b> ~d~ *e* &f'),
      String.raw`\[x\](y) \<b\> \~d\~ \*e\* \&f`,
    );
    assert.equal(escapeMarkdown('`code`'), '\\`code\\`');
    assert.equal(escapeMarkdown(String.raw`back\slash`), String.raw`back\\slash`);
  });

  it('keeps a value on one line', () => {
    assert.equal(escapeMarkdown('one\r\ntwo\nthree'), 'one two three');
  });
});
