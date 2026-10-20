import { parseArgs } from 'node:util';

export const USAGE = `Usage: devpulse branches <owner>/<repo> [options]

Show branch statistics for a public GitHub repository.

Options:
  --stale-days <n>  Days without a commit before a branch is stale (default: 90)
  --json            Print the report as JSON
  -h, --help        Show this help

Environment:
  GITHUB_TOKEN      GitHub token, required by the GraphQL API
                    (for example: GITHUB_TOKEN=$(gh auth token))
`;

export const DEFAULT_STALE_DAYS = 90;

export type Command =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'branches';
      readonly owner: string;
      readonly name: string;
      readonly staleDays: number;
      readonly json: boolean;
    };

/** Invalid command-line input; its message is shown with the usage text. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

// GitHub owner and repository name character sets; `.` and `..` would alter the URL path.
const REPOSITORY_PATTERN = /^([A-Za-z0-9-]+)\/((?!\.{1,2}$)[A-Za-z0-9._-]+)$/;

export function parseCommand(argv: readonly string[]): Command {
  const { values, positionals } = parseOrThrow(argv);
  if (values.help === true) {
    return { kind: 'help' };
  }

  const [command, repository, ...extra] = positionals;
  if (command !== 'branches') {
    throw new UsageError(
      command === undefined ? 'Missing command.' : `Unknown command: ${command}`,
    );
  }
  if (extra.length > 0) {
    throw new UsageError(`Unexpected argument: ${extra.join(' ')}`);
  }

  const match = REPOSITORY_PATTERN.exec(repository ?? '');
  const [, owner, name] = match ?? [];
  if (owner === undefined || name === undefined) {
    throw new UsageError('Expected a repository as <owner>/<repo>.');
  }

  return {
    kind: 'branches',
    owner,
    name,
    staleDays: parseStaleDays(values['stale-days']),
    json: values.json === true,
  };
}

interface ParsedArgs {
  readonly values: {
    readonly 'stale-days'?: string | undefined;
    readonly json?: boolean | undefined;
    readonly help?: boolean | undefined;
  };
  readonly positionals: readonly string[];
}

function parseOrThrow(argv: readonly string[]): ParsedArgs {
  try {
    return parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        'stale-days': { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

function parseStaleDays(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_STALE_DAYS;
  }
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new UsageError('--stale-days must be a positive whole number.');
  }
  return Number(value);
}
