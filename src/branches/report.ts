/** The commit at the tip of a branch. */
export interface LastCommit {
  readonly sha: string;
  readonly date: Date;
  /** GitHub login when the author is linked to an account, otherwise the Git name. */
  readonly author: string | null;
}

/** A branch as read from the repository, before any analysis. */
export interface Branch {
  readonly name: string;
  readonly isProtected: boolean;
  readonly lastCommit: LastCommit;
}

export interface RepositoryBranches {
  readonly owner: string;
  readonly name: string;
  /** Null for an empty repository, which has no default branch yet. */
  readonly defaultBranch: string | null;
  readonly branches: readonly Branch[];
}

export interface ReportOptions {
  /** Injected so that the report is deterministic and testable. */
  readonly now: Date;
  /** A branch without a commit for at least this many days is stale. */
  readonly staleDays: number;
}

export interface BranchSummary extends Branch {
  readonly isDefault: boolean;
  /** Whole days since the last commit. */
  readonly ageDays: number;
  readonly isStale: boolean;
}

export interface BranchReport {
  readonly repository: string;
  readonly defaultBranch: string | null;
  readonly generatedAt: Date;
  readonly staleDays: number;
  readonly totals: {
    readonly branches: number;
    readonly protected: number;
    readonly stale: number;
  };
  /** Most recently updated first. */
  readonly branches: readonly BranchSummary[];
}

const MS_PER_DAY = 86_400_000;

/**
 * Summarises the branches of a repository. The default branch is never reported as
 * stale: an inactive default branch describes the repository, not abandoned work.
 */
export function buildBranchReport(
  repository: RepositoryBranches,
  options: ReportOptions,
): BranchReport {
  const branches = repository.branches
    .map((branch) => summarise(branch, repository.defaultBranch, options))
    .sort(byMostRecentCommit);

  return {
    repository: `${repository.owner}/${repository.name}`,
    defaultBranch: repository.defaultBranch,
    generatedAt: options.now,
    staleDays: options.staleDays,
    totals: {
      branches: branches.length,
      protected: branches.filter((branch) => branch.isProtected).length,
      stale: branches.filter((branch) => branch.isStale).length,
    },
    branches,
  };
}

function summarise(
  branch: Branch,
  defaultBranch: string | null,
  options: ReportOptions,
): BranchSummary {
  const elapsed = options.now.getTime() - branch.lastCommit.date.getTime();
  // A commit dated in the future (clock skew) counts as fresh, not as negative age.
  const ageDays = Math.max(0, Math.floor(elapsed / MS_PER_DAY));
  const isDefault = branch.name === defaultBranch;

  return { ...branch, isDefault, ageDays, isStale: !isDefault && ageDays >= options.staleDays };
}

function byMostRecentCommit(a: BranchSummary, b: BranchSummary): number {
  const byDate = b.lastCommit.date.getTime() - a.lastCommit.date.getTime();
  return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
}
