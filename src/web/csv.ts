export type CsvValue = string | number | boolean | null;

/** A first character that makes a spreadsheet run the cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One field of an RFC 4180 file. Text from GitHub, such as a branch named `=HYPERLINK(…)`,
 * gets a leading apostrophe so that a spreadsheet shows it rather than evaluates it.
 */
export function csvField(value: CsvValue): string {
  if (value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    return String(value);
  }
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A header line, then one line per row, each ended by CRLF as RFC 4180 asks. */
export function csvDocument(
  header: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  return [header, ...rows].map((row) => `${row.map(csvField).join(',')}\r\n`).join('');
}
