import type { DeliveryData, MergedPullRequest, Release } from '../delivery/report.ts';
import type { GitHubClient } from './client.ts';

/** Days of history behind every delivery report. */
export const WINDOW_DAYS = 90;
const WEEKS = 12;
const DAY_MS = 86_400_000;

interface SearchCount {
  readonly issueCount: number;
}

interface PullRequestNode {
  readonly number?: number;
  readonly title?: string;
  readonly createdAt?: string;
  readonly mergedAt?: string | null;
  readonly additions?: number;
  readonly deletions?: number;
  readonly author?: { readonly login: string; readonly __typename: string } | null;
  readonly reviews?: {
    readonly nodes: readonly {
      readonly createdAt: string;
      readonly author: { readonly login: string } | null;
    }[];
  };
}

interface SampleData {
  readonly repository: {
    readonly pullRequests: { readonly nodes: readonly PullRequestNode[] };
    readonly releases: {
      readonly nodes: readonly {
        readonly tagName: string;
        readonly publishedAt: string | null;
        readonly isPrerelease: boolean;
      }[];
    };
  };
}

type CountData = Readonly<Record<string, SearchCount>>;

const PULL_REQUEST_FIELDS = `
  ... on PullRequest {
    number title createdAt mergedAt additions deletions
    author { login __typename }
    reviews(first: 5) { nodes { createdAt author { login } } }
  }
`;

/**
 * The 100 most recently updated merged pull requests, read from the repository itself:
 * unlike search, it works for every repository. GitHub cannot order pull requests by
 * merge date; a recent merge is almost always a recent update, so this approximates the
 * latest merges, though a late comment on an older one can bring it in.
 */
const SAMPLE_QUERY = `
  query ($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(states: MERGED, first: 100, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes { ${PULL_REQUEST_FIELDS} }
      }
      releases(first: 50, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { tagName publishedAt isPrerelease }
      }
    }
  }
`;

/**
 * Reads the delivery history of a repository over the last 90 days: a sample of recently
 * merged pull requests with their first reviews, the releases, and counts by search.
 * Two GraphQL requests run in parallel and cost 1 point each (measured with
 * `rateLimit(dryRun: true)`). The counts search by date, so they cover the whole window
 * even when the sample of a busy repository covers only a few days.
 *
 * The repository name is safe inside a search query: `parseRepository` only lets
 * letters, digits, `.`, `_` and `-` through, so no search qualifier can be injected.
 */
export async function fetchDeliveryData(
  client: GitHubClient,
  owner: string,
  name: string,
  now: Date,
): Promise<DeliveryData> {
  const repository = `repo:${owner}/${name} is:pr`;
  const notFound = `Repository ${owner}/${name} was not found, or the token cannot access it.`;

  const [sample, counts] = await Promise.allSettled([
    client.graphql<SampleData>(SAMPLE_QUERY, { owner, name }, notFound),
    client.graphql<CountData>(countQuery(repository, now), {}, notFound),
  ]);
  // The first query reports a missing repository precisely; report it first.
  if (sample.status === 'rejected') {
    throw sample.reason;
  }
  if (counts.status === 'rejected') {
    throw counts.reason;
  }

  const windowStart = now.getTime() - WINDOW_DAYS * DAY_MS;
  const merged = sample.value.repository.pullRequests.nodes
    .flatMap(toPullRequest)
    .filter((pullRequest) => pullRequest.mergedAt.getTime() >= windowStart);
  const releases = sample.value.repository.releases.nodes.flatMap(toRelease);
  const searched = count(counts.value, 'merged');
  // Search answers 0 for repositories it does not index, such as facebook/react, even
  // though they merge every day: rely on the sample and leave the rest unknown.
  if (searched === 0 && merged.length > 0) {
    return {
      owner,
      name,
      windowDays: WINDOW_DAYS,
      searchIndexed: false,
      mergedCount: merged.length,
      sample: merged,
      abandonedCount: null,
      staleOpenCount: null,
      revertCount: merged.filter((pullRequest) => isRevert(pullRequest.title)).length,
      weeklyMerged: [],
      releases,
    };
  }
  return {
    owner,
    name,
    windowDays: WINDOW_DAYS,
    searchIndexed: true,
    mergedCount: searched,
    sample: merged,
    abandonedCount: count(counts.value, 'abandoned'),
    staleOpenCount: count(counts.value, 'staleOpen'),
    revertCount: count(counts.value, 'reverts'),
    weeklyMerged: Array.from({ length: WEEKS }, (_, index) =>
      count(counts.value, `week${String(WEEKS - 1 - index)}`),
    ),
    releases,
  };
}

/** Counts only (`first: 0`): merged, abandoned, stale and reverted pull requests, 12 weeks. */
function countQuery(repository: string, now: Date): string {
  const since = isoDate(now, WINDOW_DAYS);
  const searches: Record<string, string> = {
    merged: `${repository} is:merged merged:>=${since}`,
    abandoned: `${repository} is:closed is:unmerged closed:>=${since}`,
    staleOpen: `${repository} is:open updated:<${isoDate(now, 30)}`,
    reverts: `${repository} is:merged merged:>=${since} Revert in:title`,
  };
  for (let week = 0; week < WEEKS; week += 1) {
    // Week 0 is the last seven days including today, week 11 twelve weeks ago; search
    // date ranges include both ends.
    const from = isoDate(now, 7 * week + 6);
    const to = isoDate(now, 7 * week);
    searches[`week${String(week)}`] = `${repository} is:merged merged:${from}..${to}`;
  }
  const aliases = Object.entries(searches)
    .map(
      ([alias, query]) =>
        `${alias}: search(query: ${JSON.stringify(query)}, type: ISSUE, first: 0) { issueCount }`,
    )
    .join('\n');
  return `query {\n${aliases}\n}`;
}

function isoDate(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

function count(data: CountData, alias: string): number {
  return data[alias]?.issueCount ?? 0;
}

type MergedNode = PullRequestNode & {
  readonly number: number;
  readonly createdAt: string;
  readonly mergedAt: string;
};

/** Search results can include pull requests that were not merged after all. */
function isMerged(node: PullRequestNode): node is MergedNode {
  return (
    node.number !== undefined && node.createdAt !== undefined && typeof node.mergedAt === 'string'
  );
}

function toPullRequest(node: PullRequestNode): MergedPullRequest[] {
  if (!isMerged(node)) {
    return [];
  }
  return [
    {
      number: node.number,
      title: node.title ?? '',
      createdAt: new Date(node.createdAt),
      mergedAt: new Date(node.mergedAt),
      additions: node.additions ?? 0,
      deletions: node.deletions ?? 0,
      author: node.author?.login ?? null,
      isBot: node.author?.__typename === 'Bot',
      reviews: toReviews(node.reviews),
    },
  ];
}

function toReviews(reviews: PullRequestNode['reviews']): MergedPullRequest['reviews'] {
  return (reviews?.nodes ?? []).map((review) => ({
    author: review.author?.login ?? null,
    createdAt: new Date(review.createdAt),
  }));
}

function toRelease(node: SampleData['repository']['releases']['nodes'][number]): Release[] {
  // A draft release has no publication date yet.
  return node.publishedAt === null
    ? []
    : [
        {
          tag: node.tagName,
          publishedAt: new Date(node.publishedAt),
          isPrerelease: node.isPrerelease,
        },
      ];
}

/**
 * A title containing the word "revert", as `Revert in:title` matches in search, so both
 * paths count the same pull requests. GitHub names a revert "Revert "<title>"".
 */
function isRevert(title: string): boolean {
  return /\brevert\b/i.test(title);
}
