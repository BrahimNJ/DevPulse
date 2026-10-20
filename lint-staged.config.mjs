/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,mts,mjs}': ['eslint --max-warnings=0 --fix', 'prettier --write'],
  '*.md': ['markdownlint-cli2 --fix', 'prettier --write'],
  '*.{json,jsonc,yml,yaml,css,html}': 'prettier --write',
};
