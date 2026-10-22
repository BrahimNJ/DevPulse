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
 * The parts of the Functions Framework (Express) request and response that are used.
 *
 * @typedef {{ body?: unknown }} Request
 * @typedef {{ status(code: number): { end(): void } }} Response
 */

/**
 * @param {BudgetNotification} notification
 * @returns {boolean}
 */
export function shouldStopBilling(notification) {
  return notification.costAmount >= notification.budgetAmount;
}

/**
 * Decodes the budget notification from a Pub/Sub push envelope,
 * `{ message: { data: <base64 JSON> }, subscription }`.
 *
 * @param {unknown} envelope
 * @returns {BudgetNotification}
 */
export function readNotification(envelope) {
  const encoded = /** @type {{ message?: { data?: unknown } } | null | undefined} */ (envelope)
    ?.message?.data;
  if (typeof encoded !== 'string') {
    throw new Error('The request carries no Pub/Sub message.');
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
 * Entry point. Eventarc delivers each Pub/Sub message as an HTTP request, and the
 * function runs with the HTTP signature. A 2xx answer acknowledges the message; any
 * other status makes Pub/Sub deliver it again, which only a transient failure deserves.
 *
 * @param {Request} request
 * @param {Response} response
 * @returns {Promise<void>}
 */
export async function stopBilling(request, response) {
  /** @type {BudgetNotification} */
  let notification;
  try {
    notification = readNotification(request.body);
  } catch (error) {
    // Retrying cannot fix a malformed message, so it is acknowledged.
    console.error(`Ignored message: ${describe(error)}`);
    response.status(204).end();
    return;
  }

  const status = `cost ${String(notification.costAmount)} of ${String(notification.budgetAmount)}`;
  if (!shouldStopBilling(notification)) {
    process.stdout.write(`Budget ${status}: no action.\n`);
    response.status(204).end();
    return;
  }
  try {
    const project = await detachBilling();
    console.warn(`Budget ${status}: billing disabled for ${project}.`);
    response.status(204).end();
  } catch (error) {
    console.error(`Budget ${status}: could not disable billing, will retry: ${describe(error)}`);
    response.status(500).end();
  }
}

/**
 * Unlinking is idempotent, so there is no read first: reading billing information
 * would need a permission the account does not have.
 *
 * @returns {Promise<string>} The project whose billing was detached.
 */
async function detachBilling() {
  const project = process.env['PROJECT_ID'];
  // A permanent error, yet retried on purpose: for a kill switch, retrying while
  // billing stays attached is safer than silently acknowledging.
  if (project === undefined || project === '') {
    throw new Error('PROJECT_ID is not set.');
  }
  await call(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ billingAccountName: '' }),
  });
  return project;
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

/**
 * @param {unknown} error
 * @returns {string}
 */
function describe(error) {
  return error instanceof Error ? error.message : String(error);
}
