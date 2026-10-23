/**
 * The repositories this browser analysed recently, newest first. Re-opening one the
 * same day is free, so the sidebar lists them; they stay on the visitor's machine.
 */
const STORAGE_KEY = 'devpulse.recent';
const MAX_RECENT = 6;

export function readRecent(storage: Pick<Storage, 'getItem'> | undefined): string[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

/** Puts `repository` first, without duplicates whatever their case. */
export function rememberRecent(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  repository: string,
): string[] {
  const next = [
    repository,
    ...readRecent(storage).filter((item) => item.toLowerCase() !== repository.toLowerCase()),
  ].slice(0, MAX_RECENT);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not remembering is acceptable.
  }
  return next;
}
