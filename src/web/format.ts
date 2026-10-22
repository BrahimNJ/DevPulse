const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/** A compact, human age: "today", "12 days", "4 months", "2.3 years". */
export function formatAge(days: number): string {
  if (days === 0) {
    return 'today';
  }
  if (days < 60) {
    return days === 1 ? '1 day' : `${String(days)} days`;
  }
  if (days < 730) {
    return `${String(Math.round(days / 30))} months`;
  }
  return `${(days / 365).toFixed(1)} years`;
}

/** Commits ahead and behind the default branch, such as "+12 / −48". */
export function formatDivergence(
  divergence: { readonly ahead: number; readonly behind: number } | null,
): string {
  return divergence === null ? '–' : `+${String(divergence.ahead)} / −${String(divergence.behind)}`;
}

export function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return null;
  }
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

export function percentage(part: number, total: number): string {
  return total === 0 ? '0%' : `${String(Math.round((part / total) * 100))}%`;
}
