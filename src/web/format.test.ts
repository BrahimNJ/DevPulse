import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatAge, formatDate, formatDivergence, median, percentage } from './format.ts';

describe('web formatting', () => {
  it('formats ages from days to years, in each language', () => {
    assert.equal(formatAge(0, 'en', 'today'), 'today');
    assert.equal(formatAge(1, 'en', 'today'), '1\u00a0day');
    assert.equal(formatAge(59, 'en', 'today'), '59\u00a0days');
    assert.equal(formatAge(120, 'en', 'today'), '4\u00a0months');
    assert.equal(formatAge(840, 'en', 'today'), '2.3\u00a0years');
    assert.equal(formatAge(1, 'fr', "aujourd'hui"), '1\u00a0jour');
    assert.equal(formatAge(120, 'fr', "aujourd'hui"), '4\u00a0mois');
    assert.equal(formatAge(840, 'fr', "aujourd'hui"), '2,3\u00a0ans');
  });

  it('formats dates in UTC, in each language', () => {
    assert.equal(formatDate('2026-10-19T23:30:00Z', 'en'), '19 Oct 2026');
    assert.equal(formatDate('2026-10-19T23:30:00Z', 'fr'), '19 oct. 2026');
  });

  it('formats the divergence from the default branch', () => {
    assert.equal(formatDivergence({ ahead: 12, behind: 48 }, 'en'), '+12 / −48');
    assert.equal(formatDivergence({ ahead: 3968, behind: 8130 }, 'en'), '+3,968 / −8,130');
    assert.equal(
      formatDivergence({ ahead: 3968, behind: 8130 }, 'fr'),
      '+3\u202f968 / −8\u202f130',
    );
    assert.equal(formatDivergence(null, 'fr'), '–');
  });

  it('computes the median of odd, even and empty lists', () => {
    assert.equal(median([9, 1, 5]), 5);
    assert.equal(median([1, 2, 3, 10]), 3);
    assert.equal(median([]), null);
  });

  it('formats a share as a whole percentage, spaced as each language requires', () => {
    assert.equal(percentage(1, 3, 'en'), '33%');
    assert.equal(percentage(1, 3, 'fr'), '33\u00a0%');
    assert.equal(percentage(0, 0, 'en'), '0%');
  });
});
