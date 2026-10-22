import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatAge, formatDate, formatDivergence, median, percentage } from './format.ts';

describe('web formatting', () => {
  it('formats ages from days to years', () => {
    assert.equal(formatAge(0), 'today');
    assert.equal(formatAge(1), '1 day');
    assert.equal(formatAge(59), '59 days');
    assert.equal(formatAge(120), '4 months');
    assert.equal(formatAge(840), '2.3 years');
  });

  it('formats dates in UTC', () => {
    assert.equal(formatDate('2026-10-19T23:30:00Z'), '19 Oct 2026');
  });

  it('formats the divergence from the default branch', () => {
    assert.equal(formatDivergence({ ahead: 12, behind: 48 }), '+12 / −48');
    assert.equal(formatDivergence(null), '–');
  });

  it('computes the median of odd, even and empty lists', () => {
    assert.equal(median([9, 1, 5]), 5);
    assert.equal(median([1, 2, 3, 10]), 3);
    assert.equal(median([]), null);
  });

  it('formats a share as a whole percentage', () => {
    assert.equal(percentage(1, 3), '33%');
    assert.equal(percentage(0, 0), '0%');
  });
});
