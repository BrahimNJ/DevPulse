import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { countByStatus, FEATURE_GROUPS } from './features.ts';

describe('feature catalogue', () => {
  it('lists only the branch and delivery reports as available, matching the code', () => {
    const available = FEATURE_GROUPS.flatMap((group) =>
      group.features.filter((feature) => feature.status === 'available').map(() => group.id),
    );
    assert.deepEqual(new Set(available), new Set(['branches', 'collaboration']));
    assert.equal(countByStatus('available'), 10);
  });

  it('gives every group and feature a unique name', () => {
    const groups = FEATURE_GROUPS.map((group) => group.id);
    const titles = FEATURE_GROUPS.flatMap((group) => group.features.map((f) => f.id));
    assert.equal(new Set(groups).size, groups.length);
    assert.equal(new Set(titles).size, titles.length);
  });
});
