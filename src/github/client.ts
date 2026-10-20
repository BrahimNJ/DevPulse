export interface GitHubClientOptions {
  readonly token: string;
  /** Injected so that tests never reach the network. */
  readonly fetch: typeof fetch;
  readonly baseUrl?: string;
}

/** A failure reported by GitHub, with a message meant for the end user. */
export class GitHubError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

interface GraphQLResponse<T> {
  readonly data?: T | null;
  readonly errors?: readonly { readonly type?: string; readonly message: string }[];
}

const DEFAULT_BASE_URL = 'https://api.github.com';

export class GitHubClient {
  readonly #token: string;
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;

  constructor(options: GitHubClientOptions) {
    this.#token = options.token;
    this.#fetch = options.fetch;
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  /** Runs a GraphQL query. A NOT_FOUND error is reported as `notFoundMessage`. */
  async graphql<T>(
    query: string,
    variables: Readonly<Record<string, unknown>>,
    notFoundMessage: string,
  ): Promise<T> {
    const response = await this.#request(`${this.#baseUrl}/graphql`, {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    });
    const body = await readJson<GraphQLResponse<T>>(response);

    if (body.errors !== undefined && body.errors.length > 0) {
      if (body.errors.some((error) => error.type === 'NOT_FOUND')) {
        throw new GitHubError(notFoundMessage, 404);
      }
      throw new GitHubError(
        `GitHub GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`,
      );
    }
    if (body.data === undefined || body.data === null) {
      throw new GitHubError('GitHub returned an empty GraphQL response.');
    }
    return body.data;
  }

  /** Fetches every page of a REST collection by following the `Link` header. */
  async restPaginated<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = `${this.#baseUrl}${path}`;

    while (url !== null) {
      const response = await this.#request(url, { method: 'GET' });
      items.push(...(await readJson<T[]>(response)));
      const next = nextPageUrl(response.headers.get('link'));
      url = next === null ? null : this.#sameOrigin(next, url);
    }
    return items;
  }

  /** The token is sent with every request, so never follow a link to another host. */
  #sameOrigin(link: string, current: string): string {
    let resolved: URL;
    try {
      resolved = new URL(link, current);
    } catch {
      throw new GitHubError(`GitHub returned an invalid pagination link: ${link}`);
    }
    if (resolved.origin !== new URL(this.#baseUrl).origin) {
      throw new GitHubError(`Refusing to follow a pagination link to ${resolved.origin}.`);
    }
    return resolved.href;
  }

  async #request(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.#fetch(url, {
        ...init,
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${this.#token}`,
          'x-github-api-version': '2022-11-28',
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new GitHubError(`Could not reach GitHub: ${reason}`);
    }
    if (!response.ok) {
      throw httpError(response);
    }
    return response;
  }
}

function httpError(response: Response): GitHubError {
  const { status } = response;
  if (status === 401) {
    return new GitHubError('GitHub rejected the token (401). Check GITHUB_TOKEN.', status);
  }
  if ((status === 403 || status === 429) && response.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const when = Number.isFinite(reset) ? ` until ${new Date(reset * 1000).toISOString()}` : '';
    return new GitHubError(`GitHub API rate limit exceeded${when}.`, status);
  }
  const retryAfter = response.headers.get('retry-after');
  if ((status === 403 || status === 429) && retryAfter !== null) {
    return new GitHubError(
      `GitHub secondary rate limit hit; retry after ${retryAfter} seconds.`,
      status,
    );
  }
  return new GitHubError(`GitHub request failed with status ${String(status)}.`, status);
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new GitHubError('GitHub returned a response that is not valid JSON.', response.status);
  }
}

/** Extracts the `rel="next"` URL from a GitHub `Link` header. */
export function nextPageUrl(link: string | null): string | null {
  if (link === null) {
    return null;
  }
  const next = link.split(',').find((part) => part.includes('rel="next"'));
  return next === undefined ? null : (/<([^>]+)>/.exec(next)?.[1] ?? null);
}
