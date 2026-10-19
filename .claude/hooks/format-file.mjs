// PostToolUse hook: formats each file Claude writes, so diffs never contain style noise.
import { spawnSync } from 'node:child_process';
import { extname, join } from 'node:path';
import { projectRelativePath, projectRoot, readHookInput } from './hook-input.mjs';

const FORMATTED_EXTENSIONS = new Set([
  '.ts',
  '.mts',
  '.js',
  '.mjs',
  '.json',
  '.jsonc',
  '.md',
  '.yml',
  '.yaml',
]);

const input = await readHookInput();
const path = projectRelativePath(input);

if (path !== undefined && FORMATTED_EXTENSIONS.has(extname(path))) {
  // Calling the Prettier binary through Node avoids a shell and npx start-up cost.
  const prettier = join(projectRoot(), 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  const result = spawnSync(process.execPath, [prettier, '--write', '--log-level=warn', path], {
    cwd: projectRoot(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    // Non-blocking: the edit already happened, so report the failure to Claude and the user.
    console.error(`Prettier could not format ${path}:\n${result.stderr}`);
    process.exit(1);
  }
}
