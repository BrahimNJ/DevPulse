/** The characters Markdown would read as formatting or as the edge of a table cell. */
const SPECIAL = /[\\`*_[\]<>|~&]/g;

/**
 * Text from GitHub, such as a branch or author name, as literal Markdown: its characters
 * cannot format the document, and a line break cannot end a table row.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(SPECIAL, (character) => `\\${character}`);
}
