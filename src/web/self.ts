/**
 * Whether a repository is DevPulse itself or another repository of its author, so the
 * report can say a word about it. GitHub names are case-insensitive, and a pasted URL
 * or a trailing `.git` names the same repository.
 */
export const AUTHOR = 'BrahimNJ';
export const SELF_REPOSITORY = `${AUTHOR}/DevPulse`;

export type Relation = 'self' | 'author' | null;

export function relationOf(repository: string): Relation {
  const name = repository
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/(\.git)?\/*$/i, '')
    .toLowerCase();
  if (name === SELF_REPOSITORY.toLowerCase()) {
    return 'self';
  }
  return name.startsWith(`${AUTHOR.toLowerCase()}/`) ? 'author' : null;
}
