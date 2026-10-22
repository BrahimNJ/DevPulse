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

/** @typedef {{ status(code: number): { end(): void } }} HttpResponse */

/**
 * @param {BudgetNotification} notification
 * @returns {boolean}
 */
export function shouldStopBilling(notification) {
  return notification.costAmount >= notification.budgetAmount;
}

/**
 * The base64 payload of the Pub/Sub message, whatever signature the platform used to
 * call the function. Which one it uses depends on deployment metadata outside this
 * code, and the deployed function received a shape that was not the expected one, so
 * all three documented shapes are accepted:
 * - legacy event `(message, context)`: `message.data`;
 * - CloudEvent `(event)`: `event.data.message.data`;
 * - HTTP `(request, response)`: `request.body.message.data`.
 *
 * @param {unknown} argument The first argument the function received.
 * @returns {string | undefined}
 */
export function encodedMessage(argument) {
  const value = /** @type {{ data?: unknown, body?: unknown } | null | undefined} */ (argument);
  const candidates = [value?.data, messageData(value?.data), messageData(value?.body)];
  return candidates.find((candidate) => typeof candidate === 'string');
}

/**
 * @param {unknown} envelope A Pub/Sub push envelope, `{ message: { data } }`.
 * @returns {unknown}
 */
function messageData(envelope) {
  return /** @type {{ message?: { data?: unknown } } | null | undefined} */ (envelope)?.message
    ?.data;
}

/**
 * @param {string | undefined} encoded
 * @returns {BudgetNotification}
 */
export function readNotification(encoded) {
  if (encoded === undefined) {
    throw new Error('The call carries no Pub/Sub message.');
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
 * Entry point. Returning acknowledges the message; for the event signatures a throw,
 * and for HTTP a 500, makes Pub/Sub deliver it again, which only a failed unlink
 * deserves.
 *
 * The function declares a single parameter on purpose: the Functions Framework treats
 * a CloudEvent function with two declared parameters as callback-style and waits for a
 * callback that never comes. The second argument is read from `rest` instead.
 *
 * @param {unknown} event The message, the CloudEvent or the HTTP request.
 * @param {...unknown} rest The HTTP response or the event context, if any.
 * @returns {Promise<void>}
 */
export async function stopBilling(event, ...rest) {
  const [responseOrContext] = rest;
  const response = isHttpResponse(responseOrContext) ? responseOrContext : undefined;
  try {
    await handle(encodedMessage(event));
    response?.status(204).end();
  } catch (error) {
    console.error(`Could not disable billing, will retry: ${describe(error)}`);
    if (response === undefined) {
      throw error;
    }
    response.status(500).end();
  }
}

/**
 * Throws only when billing should be detached and could not be.
 *
 * @param {string | undefined} encoded
 * @returns {Promise<void>}
 */
async function handle(encoded) {
  /** @type {BudgetNotification} */
  let notification;
  try {
    notification = readNotification(encoded);
  } catch (error) {
    // Retrying cannot fix a malformed message, so it is acknowledged.
    console.error(`Ignored message: ${describe(error)}`);
    return;
  }
  const status = `cost ${String(notification.costAmount)} of ${String(notification.budgetAmount)}`;
  if (!shouldStopBilling(notification)) {
    process.stdout.write(`Budget ${status}: no action.\n`);
    return;
  }
  const project = await detachBilling();
  console.warn(`Budget ${status}: billing disabled for ${project}.`);
}

/**
 * @param {unknown} value
 * @returns {value is HttpResponse}
 */
function isHttpResponse(value) {
  return (
    typeof (/** @type {{ status?: unknown } | null | undefined} */ (value)?.status) === 'function'
  );
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
