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

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const TYPES: Readonly<Record<ExportFormat, string>> = {
  markdown: 'text/markdown;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
};

/**
 * The file's bytes and type. A CSV file starts with a byte order mark: without it, Excel
 * reads UTF-8 as a legacy encoding and garbles accented names.
 */
export function exportBlob(content: string, format: ExportFormat): Blob {
  return new Blob([format === 'csv' ? `${BYTE_ORDER_MARK}${content}` : content], {
    type: TYPES[format],
  });
}

/** Hands the file to the browser, which saves it under `name` in the downloads. */
export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Revoking at once can cancel the download in some browsers; a moment later it is safe.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
