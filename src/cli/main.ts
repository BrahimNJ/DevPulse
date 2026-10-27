import { buildBranchReport } from '../branches/report.ts';
import { fetchRepositoryBranches } from '../github/branches.ts';
import { GitHubClient, GitHubError } from '../github/client.ts';
import { parseCommand, USAGE, UsageError } from './args.ts';
import { formatJson, formatTable } from './format.ts';

/** Everything the CLI touches outside its own logic, injected for tests. */
export interface Environment {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fetch: typeof fetch;
  readonly now: () => Date;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

/** Runs the CLI and returns the process exit code. */
export async function run(environment: Environment): Promise<number> {
  try {
    return await execute(environment);
  } catch (error) {
    if (error instanceof UsageError) {
      environment.stderr(`Error: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    if (error instanceof GitHubError) {
      environment.stderr(`Error: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

async function execute(environment: Environment): Promise<number> {
  const command = parseCommand(environment.argv);
  if (command.kind === 'help') {
    environment.stdout(USAGE);
    return 0;
  }

  const token = environment.env['GITHUB_TOKEN'];
  if (token === undefined || token === '') {
    environment.stderr(
      'Error: GITHUB_TOKEN is not set. The GitHub GraphQL API requires a token,\n' +
        'for example: GITHUB_TOKEN=$(gh auth token)\n',
    );
    return 1;
  }

  const client = new GitHubClient({ token, fetch: environment.fetch });
  const repository = await fetchRepositoryBranches(client, command.owner, command.name);
  const full = buildBranchReport(repository, {
    now: environment.now(),
    staleDays: command.staleDays,
  });
  // The totals describe the whole repository, even when only stale branches are listed.
  const report = command.staleOnly
    ? { ...full, branches: full.branches.filter((branch) => branch.isStale) }
    : full;

  environment.stdout(command.json ? formatJson(report) : formatTable(report));
  return 0;
}
