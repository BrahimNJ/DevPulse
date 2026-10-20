/** Validation of user input shared by every interface (CLI, HTTP API). */

export interface RepositoryRef {
  readonly owner: string;
  readonly name: string;
}

export const DEFAULT_STALE_DAYS = 90;

// GitHub owner and repository name character sets; `.` and `..` would alter the URL path.
const REPOSITORY_PATTERN = /^([A-Za-z0-9-]+)\/((?!\.{1,2}$)[A-Za-z0-9._-]+)$/;

/** Parses `<owner>/<repo>`, or returns null when the value is not a repository. */
export function parseRepository(value: string): RepositoryRef | null {
  const [, owner, name] = REPOSITORY_PATTERN.exec(value.trim()) ?? [];
  return owner === undefined || name === undefined ? null : { owner, name };
}

/** Parses a positive whole number of days, or returns null when it is not one. */
export function parseStaleDays(value: string): number | null {
  return /^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : null;
}
