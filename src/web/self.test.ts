import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { relationOf } from './self.ts';

describe('relation to DevPulse', () => {
  it('recognises DevPulse whatever the case or the form of the name', () => {
    assert.equal(relationOf('BrahimNJ/DevPulse'), 'self');
    assert.equal(relationOf(' brahimnj/devpulse '), 'self');
    assert.equal(relationOf('https://github.com/BrahimNJ/DevPulse.git'), 'self');
    assert.equal(relationOf('https://www.github.com/brahimnj/devpulse/'), 'self');
  });

  it("recognises the author's other repositories", () => {
    assert.equal(relationOf('BrahimNJ/InvoiceFlow'), 'author');
    assert.equal(relationOf('brahimnj/brahimnj'), 'author');
  });

  it('ignores everything else, including look-alike names', () => {
    assert.equal(relationOf('nodejs/node'), null);
    assert.equal(relationOf('BrahimNJx/DevPulse'), null);
    assert.equal(relationOf('someone/BrahimNJ'), null);
    assert.equal(relationOf(''), null);
  });
});
