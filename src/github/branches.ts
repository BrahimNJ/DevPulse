import type { Branch, RepositoryBranches } from '../branches/report.ts';
import type { GitHubClient } from './client.ts';

/** GraphQL returns the last commit of 100 branches per request; REST would need one each. */
const BRANCHES_QUERY = `
  query ($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef { name }
      refs(refPrefix: "refs/heads/", first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          target {
            ... on Commit { oid committedDate author { name user { login } } }
          }
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
}

interface BranchesQueryData {
  readonly repository: {
    readonly defaultBranchRef: { readonly name: string } | null;
    readonly refs: {
      readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
      readonly nodes: readonly RefNode[];
    };
  };
}

/** Reads every branch of a repository with its last commit and protection status. */
export async function fetchRepositoryBranches(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<RepositoryBranches> {
  // Sequential on purpose: GraphQL reports a missing repository with a clear message,
  // whereas a parallel REST call could fail first with a bare 404.
  const { defaultBranch, nodes } = await fetchRefs(client, owner, name);
  const protectedNames = await fetchProtectedBranchNames(client, owner, name);

  const branches = nodes.flatMap((node) => {
    const branch = toBranch(node, protectedNames);
    return branch === null ? [] : [branch];
  });
  return { owner, name, defaultBranch, branches };
}

async function fetchRefs(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<{ defaultBranch: string | null; nodes: RefNode[] }> {
  const nodes: RefNode[] = [];
  let defaultBranch: string | null;
  let cursor: string | null = null;

  do {
    const data: BranchesQueryData = await client.graphql<BranchesQueryData>(
      BRANCHES_QUERY,
      { owner, name, cursor },
      `Repository ${owner}/${name} was not found, or it is not public.`,
    );
    const { refs } = data.repository;
    defaultBranch = data.repository.defaultBranchRef?.name ?? null;
    nodes.push(...refs.nodes);
    cursor = refs.pageInfo.hasNextPage ? refs.pageInfo.endCursor : null;
  } while (cursor !== null);

  return { defaultBranch, nodes };
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

function toBranch(node: RefNode, protectedNames: ReadonlySet<string>): Branch | null {
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
  };
}
