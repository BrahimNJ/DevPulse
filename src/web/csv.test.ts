import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { csvField } from './csv.ts';

describe('CSV field', () => {
  it('writes plain values as they are', () => {
    assert.equal(csvField('main'), 'main');
    assert.equal(csvField(42), '42');
    assert.equal(csvField(true), 'true');
    assert.equal(csvField(null), '');
  });

  it('quotes a field holding a comma, a quote or a line break', () => {
    assert.equal(csvField('a,b'), '"a,b"');
    assert.equal(csvField('say "hi"'), '"say ""hi"""');
    assert.equal(csvField('one\ntwo'), '"one\ntwo"');
  });

  it('keeps a spreadsheet from running text as a formula', () => {
    assert.equal(csvField('=1+1'), "'=1+1");
    assert.equal(csvField('+cmd'), "'+cmd");
    assert.equal(csvField('-x'), "'-x");
    assert.equal(csvField('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(csvField('=HYPERLINK("x","y")'), '"\'=HYPERLINK(""x"",""y"")"');
  });

  it('leaves numbers alone, negative ones included', () => {
    assert.equal(csvField(-3), '-3');
  });
});
