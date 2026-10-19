import { RuleConfigSeverity } from '@commitlint/types';

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // CONTRIBUTING.md caps the short description at 72 characters.
    'header-max-length': [RuleConfigSeverity.Error, 'always', 72],
    'scope-case': [RuleConfigSeverity.Error, 'always', 'kebab-case'],
  },
};
