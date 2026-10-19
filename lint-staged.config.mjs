/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,mts,mjs}': ['eslint --max-warnings=0 --fix', 'prettier --write'],
  '*.md': ['markdownlint-cli2 --fix', 'prettier --write'],
  '*.{json,jsonc,yml,yaml}': 'prettier --write',
};
