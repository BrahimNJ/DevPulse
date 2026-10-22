import type { Branch, Divergence, RepositoryBranches } from '../branches/report.ts';
import type { GitHubClient } from './client.ts';

const DEFAULT_BRANCH_QUERY = `
  query ($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef { name }
    }
  }
`;

/**
 * GraphQL returns the last commit and the comparison with the default branch of 100
 * branches per request; REST would need one request each. `compare` is skipped when
 * the repository has no default branch to compare with.
 */
const BRANCHES_QUERY = `
  query ($owner: String!, $name: String!, $cursor: String, $base: String!, $compare: Boolean!) {
    repository(owner: $owner, name: $name) {
      refs(refPrefix: "refs/heads/", first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          target {
            ... on Commit { oid committedDate author { name user { login } } }
          }
          compare(headRef: $base) @include(if: $compare) { aheadBy behindBy }
        }
      }
    }
  }
`;

interface RefNode {
  readonly name: string;
  /** Empty when the ref does not point to a commit, which branches always should. */
  readonly target: {
    readonly oid?: string;
    readonly committedDate?: string;
    readonly author?: {
      readonly name: string | null;
      readonly user: { readonly login: string } | null;
    } | null;
  } | null;
  /**
   * The ref as base and the default branch as head: `aheadBy` counts the commits of
   * the default branch missing from this branch, so the meanings are swapped here.
   */
  readonly compare?: { readonly aheadBy: number; readonly behindBy: number } | null;
}

interface DefaultBranchQueryData {
  readonly repository: { readonly defaultBranchRef: { readonly name: string } | null };
}

interface BranchesQueryData {
  readonly repository: {
    readonly refs: {
      readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
      readonly nodes: readonly RefNode[];
    };
  };
}

/**
 * Reads every branch of a repository with its last commit, protection status and
 * divergence from the default branch.
 */
export async function fetchRepositoryBranches(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<RepositoryBranches> {
  // Sequential on purpose: GraphQL reports a missing repository with a clear message,
  // whereas a parallel REST call could fail first with a bare 404.
  const defaultBranch = await fetchDefaultBranch(client, owner, name);
  const nodes = await fetchRefs(client, owner, name, defaultBranch);
  const protectedNames = await fetchProtectedBranchNames(client, owner, name);

  const branches = nodes.flatMap((node) => {
    const branch = toBranch(node, protectedNames, defaultBranch);
    return branch === null ? [] : [branch];
  });
  return { owner, name, defaultBranch, branches };
}

/** The comparison needs the default branch name before the first page of refs. */
async function fetchDefaultBranch(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<string | null> {
  const data = await client.graphql<DefaultBranchQueryData>(
    DEFAULT_BRANCH_QUERY,
    { owner, name },
    notFoundMessage(owner, name),
  );
  return data.repository.defaultBranchRef?.name ?? null;
}

async function fetchRefs(
  client: GitHubClient,
  owner: string,
  name: string,
  defaultBranch: string | null,
): Promise<RefNode[]> {
  const nodes: RefNode[] = [];
  const comparison = { base: defaultBranch ?? '', compare: defaultBranch !== null };
  let cursor: string | null = null;

  do {
    const data: BranchesQueryData = await client.graphql<BranchesQueryData>(
      BRANCHES_QUERY,
      { owner, name, cursor, ...comparison },
      notFoundMessage(owner, name),
    );
    const { refs } = data.repository;
    nodes.push(...refs.nodes);
    cursor = refs.pageInfo.hasNextPage ? refs.pageInfo.endCursor : null;
  } while (cursor !== null);

  return nodes;
}

function notFoundMessage(owner: string, name: string): string {
  return `Repository ${owner}/${name} was not found, or the token cannot access it.`;
}

/**
 * GraphQL `branchProtectionRule` ignores rulesets and is hidden from non-admins, so
 * protection comes from the REST filter, which reports both to anyone.
 */
async function fetchProtectedBranchNames(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<ReadonlySet<string>> {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches?protected=true&per_page=100`;
  const branches = await client.restPaginated<{ readonly name: string }>(path);
  return new Set(branches.map((branch) => branch.name));
}

function toBranch(
  node: RefNode,
  protectedNames: ReadonlySet<string>,
  defaultBranch: string | null,
): Branch | null {
  const { target } = node;
  if (target?.oid === undefined || target.committedDate === undefined) {
    return null;
  }
  return {
    name: node.name,
    isProtected: protectedNames.has(node.name),
    lastCommit: {
      sha: target.oid,
      date: new Date(target.committedDate),
      author: target.author?.user?.login ?? target.author?.name ?? null,
    },
    divergence: node.name === defaultBranch ? null : toDivergence(node.compare),
  };
}

function toDivergence(compare: RefNode['compare']): Divergence | null {
  return compare === undefined || compare === null
    ? null
    : { ahead: compare.behindBy, behind: compare.aheadBy };
}
