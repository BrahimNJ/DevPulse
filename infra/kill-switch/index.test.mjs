import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readNotification, shouldStopBilling } from './index.mjs';

/**
 * @param {unknown} message
 * @returns {{ data: { message: { data: string } } }}
 */
function event(message) {
  return {
    data: { message: { data: Buffer.from(JSON.stringify(message)).toString('base64') } },
  };
}

describe('budget kill switch', () => {
  it('stops billing only once the cost reaches the budget', () => {
    assert.equal(shouldStopBilling({ costAmount: 0.99, budgetAmount: 1 }), false);
    assert.equal(shouldStopBilling({ costAmount: 1, budgetAmount: 1 }), true);
    assert.equal(shouldStopBilling({ costAmount: 3.5, budgetAmount: 1 }), true);
  });

  it('reads the amounts of a budget notification', () => {
    const notification = readNotification(
      event({ budgetDisplayName: 'devpulse', costAmount: 0.42, budgetAmount: 1 }),
    );

    assert.deepEqual(notification, { costAmount: 0.42, budgetAmount: 1 });
  });

  it('rejects an event that is not a budget notification', () => {
    assert.throws(() => readNotification({}), /no Pub\/Sub message/);
    assert.throws(() => readNotification(event({ hello: 'world' })), /not a budget/);
  });
});
