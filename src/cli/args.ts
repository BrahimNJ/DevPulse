import { parseArgs } from 'node:util';

import { DEFAULT_STALE_DAYS, parseRepository, parseStaleDays } from '../branches/input.ts';

export { DEFAULT_STALE_DAYS };

export const USAGE = `Usage: devpulse branches <owner>/<repo> [options]

Show branch statistics for a public GitHub repository.

Options:
  --stale-days <n>  Days without a commit before a branch is stale (default: 90)
  --stale-only      List only the stale branches
  --json            Print the report as JSON
  -h, --help        Show this help

Environment:
  GITHUB_TOKEN      GitHub token, required by the GraphQL API
                    (for example: GITHUB_TOKEN=$(gh auth token))
`;

export type Command =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'branches';
      readonly owner: string;
      readonly name: string;
      readonly staleDays: number;
      readonly staleOnly: boolean;
      readonly json: boolean;
    };

/** Invalid command-line input; its message is shown with the usage text. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

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

  const ref = parseRepository(repository ?? '');
  if (ref === null) {
    throw new UsageError('Expected a repository as <owner>/<repo>.');
  }

  return {
    kind: 'branches',
    owner: ref.owner,
    name: ref.name,
    staleDays: staleDaysOption(values['stale-days']),
    staleOnly: values['stale-only'] === true,
    json: values.json === true,
  };
}

interface ParsedArgs {
  readonly values: {
    readonly 'stale-days'?: string | undefined;
    readonly 'stale-only'?: boolean | undefined;
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
        'stale-only': { type: 'boolean' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

function staleDaysOption(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_STALE_DAYS;
  }
  const days = parseStaleDays(value);
  if (days === null) {
    throw new UsageError('--stale-days must be a positive whole number.');
  }
  return days;
}
