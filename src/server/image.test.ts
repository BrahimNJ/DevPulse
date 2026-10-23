import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = resolve(import.meta.dirname, '../..');
const ENTRY = resolve(ROOT, 'src/server/main.ts');

/** Relative modules a file loads at run time; `import type` is erased by Node. */
function runtimeImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const pattern = /^(?:import|export)(?!\s+type\b)[^'"]*?from\s+'(\.{1,2}\/[^']+)'/gmu;
  return [...source.matchAll(pattern)].flatMap((match) =>
    match[1] === undefined ? [] : [resolve(dirname(file), match[1])],
  );
}

/** The top-level `src/` directories the server reaches from its entry point. */
function serverDirectories(): Set<string> {
  const seen = new Set<string>();
  const pending = [ENTRY];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (!seen.has(file)) {
      seen.add(file);
      pending.push(...runtimeImports(file));
    }
  }
  return new Set(
    [...seen].map((file) => relative(ROOT, file).split(/[\\/]/u).slice(0, 2).join('/')),
  );
}

describe('container image', () => {
  it('copies every directory the server imports', () => {
    const dockerfile = readFileSync(resolve(ROOT, 'Dockerfile'), 'utf8');
    const copied = new Set(
      [...dockerfile.matchAll(/^COPY\s+(src\/[\w-]+)\s/gmu)].flatMap((match) =>
        match[1] === undefined ? [] : [match[1]],
      ),
    );
    const directories = serverDirectories();

    assert.ok(directories.has('src/delivery'), 'the import graph was not followed');
    for (const directory of directories) {
      assert.ok(copied.has(directory), `Dockerfile does not copy ${directory}`);
    }
    // The interface is built into dist/web; its sources stay out of the image.
    assert.ok(!directories.has('src/web'));
  });
});
