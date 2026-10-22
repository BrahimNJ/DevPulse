/**
 * Budget kill switch (ADR 0007). Cloud Billing publishes the status of the monthly
 * budget to Pub/Sub several times a day. A budget alert only warns; once the month's
 * cost reaches the budget, this function detaches the billing account from the
 * project, which stops every paid service until billing is enabled again by hand.
 */

const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/**
 * @typedef {object} BudgetNotification
 * @property {number} costAmount Cost of the current period, credits excluded by the budget.
 * @property {number} budgetAmount
 */

/**
 * @param {BudgetNotification} notification
 * @returns {boolean}
 */
export function shouldStopBilling(notification) {
  return notification.costAmount >= notification.budgetAmount;
}

/**
 * Decodes the budget notification carried by a Pub/Sub CloudEvent.
 *
 * @param {{ data?: { message?: { data?: string } } }} cloudEvent
 * @returns {BudgetNotification}
 */
export function readNotification(cloudEvent) {
  const encoded = cloudEvent.data?.message?.data;
  if (encoded === undefined) {
    throw new Error('The event carries no Pub/Sub message.');
  }
  /** @type {unknown} */
  const message = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  const parsed = /** @type {Partial<BudgetNotification>} */ (message);
  if (typeof parsed.costAmount !== 'number' || typeof parsed.budgetAmount !== 'number') {
    throw new Error('The message is not a budget notification.');
  }
  return { costAmount: parsed.costAmount, budgetAmount: parsed.budgetAmount };
}

/**
 * Entry point, triggered by the budget topic through Eventarc.
 *
 * @param {{ data?: { message?: { data?: string } } }} cloudEvent
 * @returns {Promise<void>}
 */
export async function stopBilling(cloudEvent) {
  /** @type {BudgetNotification} */
  let notification;
  try {
    notification = readNotification(cloudEvent);
  } catch (error) {
    // Pub/Sub would redeliver a malformed message for days; retrying cannot fix it.
    console.error(`Ignored message: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  const status = `cost ${String(notification.costAmount)} of ${String(notification.budgetAmount)}`;
  if (!shouldStopBilling(notification)) {
    process.stdout.write(`Budget ${status}: no action.\n`);
    return;
  }
  const project = process.env['PROJECT_ID'];
  if (project === undefined || project === '') {
    throw new Error('PROJECT_ID is not set.');
  }
  // Unlinking is idempotent, so there is no read first: reading billing information
  // would need a permission the account does not have. A failure here throws, so that
  // Pub/Sub retries.
  await call(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ billingAccountName: '' }),
  });
  console.warn(`Budget ${status}: billing disabled for ${project}.`);
}

/** @returns {Promise<string>} */
async function accessToken() {
  const token = /** @type {{ access_token: string }} */ (
    await call(METADATA_TOKEN_URL, { headers: { 'metadata-flavor': 'Google' } })
  );
  return token.access_token;
}

/**
 * @param {string} url
 * @param {RequestInit} init
 * @returns {Promise<unknown>}
 */
async function call(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed with ${String(response.status)}.`);
  }
  return response.json();
}
