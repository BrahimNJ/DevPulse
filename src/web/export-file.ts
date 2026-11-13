export type ExportFormat = 'markdown' | 'csv';

const EXTENSIONS: Readonly<Record<ExportFormat, string>> = { markdown: 'md', csv: 'csv' };

/**
 * `devpulse-nodejs-node-branches-2026-11-13.md`: the repository, the report and the day
 * it was generated, so that several downloads sort and never overwrite one another.
 */
export function exportFileName(
  repository: string,
  report: string,
  generatedAt: string,
  format: ExportFormat,
): string {
  const name = repository.replace(/[^A-Za-z0-9._-]+/g, '-');
  return `devpulse-${name}-${report}-${generatedAt.slice(0, 10)}.${EXTENSIONS[format]}`;
}
