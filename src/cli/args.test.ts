import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_STALE_DAYS, parseCommand, UsageError } from './args.ts';

describe('parseCommand', () => {
  it('parses the branches command with default options', () => {
    assert.deepEqual(parseCommand(['branches', 'nodejs/node']), {
      kind: 'branches',
      owner: 'nodejs',
      name: 'node',
      staleDays: DEFAULT_STALE_DAYS,
      json: false,
    });
  });

  it('parses --stale-days and --json', () => {
    assert.deepEqual(parseCommand(['branches', 'acme/my.repo', '--stale-days', '30', '--json']), {
      kind: 'branches',
      owner: 'acme',
      name: 'my.repo',
      staleDays: 30,
      json: true,
    });
  });

  it('returns help for -h, even with other arguments', () => {
    assert.deepEqual(parseCommand(['-h']), { kind: 'help' });
    assert.deepEqual(parseCommand(['branches', '--help']), { kind: 'help' });
  });

  for (const [label, argv] of [
    ['a missing command', []],
    ['an unknown command', ['commits', 'acme/app']],
    ['a missing repository', ['branches']],
    ['a repository without an owner', ['branches', 'app']],
    ['a URL instead of owner/repo', ['branches', 'https://github.com/acme/app']],
    ['an extra argument', ['branches', 'acme/app', 'more']],
    ['an unknown option', ['branches', 'acme/app', '--verbose']],
    ['a zero stale threshold', ['branches', 'acme/app', '--stale-days', '0']],
    ['a non-numeric stale threshold', ['branches', 'acme/app', '--stale-days', '1.5']],
  ] as const) {
    it(`rejects ${label}`, () => {
      assert.throws(() => parseCommand(argv), UsageError);
    });
  }
});
