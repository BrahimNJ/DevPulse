/** The characters Markdown would read as formatting or as the edge of a table cell. */
const SPECIAL = /[\\`*_[\]<>|~&]/g;

/**
 * Text from GitHub, such as a branch or author name, as literal Markdown: its characters
 * cannot format the document, and a line break cannot end a table row.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(SPECIAL, (character) => `\\${character}`);
}

export interface TableColumn {
  readonly title: string;
  /** Figures line up on the right; everything else stays on the left. */
  readonly numeric?: boolean;
}

/** A GitHub-flavoured table; each row holds one raw value per column, escaped here. */
export function markdownTable(
  columns: readonly TableColumn[],
  rows: readonly (readonly string[])[],
): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [
    line(columns.map((column) => escapeMarkdown(column.title))),
    line(columns.map((column) => (column.numeric === true ? '---:' : '---'))),
    ...rows.map((row) => line(row.map(escapeMarkdown))),
  ].join('\n');
}
