import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escapeMarkdown, markdownTable } from './markdown.ts';

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

  it('keeps mentions, issue links, emoji and URLs from coming alive on GitHub', () => {
    assert.equal(escapeMarkdown('@ada'), String.raw`\@ada`);
    assert.equal(escapeMarkdown('fix#12'), String.raw`fix\#12`);
    assert.equal(escapeMarkdown(':smile:'), String.raw`\:smile\:`);
    assert.equal(escapeMarkdown('https://x.example'), String.raw`https\://x.example`);
  });

  it('keeps a value on one line', () => {
    assert.equal(escapeMarkdown('one\r\ntwo\nthree'), 'one two three');
  });
});

describe('Markdown table', () => {
  it('writes the header, the alignment and one line per row', () => {
    assert.equal(
      markdownTable(
        [{ title: 'Branch' }, { title: 'Age', numeric: true }],
        [
          ['main', '1 day'],
          ['dev', '3 days'],
        ],
      ),
      ['| Branch | Age |', '| --- | ---: |', '| main | 1 day |', '| dev | 3 days |'].join('\n'),
    );
  });

  it('escapes every value, so a pipe stays inside its cell', () => {
    assert.equal(
      markdownTable([{ title: 'A|B' }], [['x|y']]),
      ['| A\\|B |', '| --- |', '| x\\|y |'].join('\n'),
    );
  });

  it('accepts a table without rows', () => {
    assert.equal(markdownTable([{ title: 'A' }], []), '| A |\n| --- |');
  });
});
