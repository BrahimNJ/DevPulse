import { run } from './main.ts';

process.exitCode = await run({
  argv: process.argv.slice(2),
  env: process.env,
  fetch: globalThis.fetch,
  now: () => new Date(),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
