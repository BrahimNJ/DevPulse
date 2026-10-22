const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/** Renew a little before expiry, so that a token never expires during a request. */
const EARLY_RENEWAL_MS = 60_000;

export type AccessTokenProvider = () => Promise<string>;

/**
 * Access tokens of the service account a Cloud Run instance runs as, from the metadata
 * server, cached until shortly before they expire. No key and no SDK are involved.
 */
export function metadataAccessToken(
  fetchImpl: typeof fetch,
  now: () => number = Date.now,
): AccessTokenProvider {
  let cached: { token: string; expiresAt: number } | null = null;
  return async () => {
    if (cached !== null && cached.expiresAt > now()) {
      return cached.token;
    }
    const response = await fetchImpl(METADATA_TOKEN_URL, {
      headers: { 'metadata-flavor': 'Google' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      throw new Error(`The metadata server answered ${String(response.status)}.`);
    }
    const body = (await response.json()) as { access_token: string; expires_in: number };
    cached = {
      token: body.access_token,
      expiresAt: now() + body.expires_in * 1000 - EARLY_RENEWAL_MS,
    };
    return cached.token;
  };
}
