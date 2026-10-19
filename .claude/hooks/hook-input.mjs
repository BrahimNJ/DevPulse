import { relative, resolve } from 'node:path';

/**
 * @typedef {object} ToolHookInput
 * @property {string} tool_name
 * @property {{ file_path?: unknown }} tool_input
 */

/** @type {(text: string) => unknown} */
const parseJson = JSON.parse;

/**
 * @param {unknown} value
 * @returns {value is ToolHookInput}
 */
function isToolHookInput(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'tool_name' in value && 'tool_input' in value && typeof value.tool_input === 'object';
}

/**
 * Reads and validates the JSON payload that Claude Code sends to a hook on stdin.
 * @returns {Promise<ToolHookInput>}
 */
export async function readHookInput() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += String(chunk);
  }
  const payload = parseJson(raw);
  if (!isToolHookInput(payload)) {
    throw new TypeError('Unexpected hook payload: missing tool_name or tool_input.');
  }
  return payload;
}

/**
 * Returns the edited file relative to the project root with forward slashes,
 * or undefined when the tool call does not target a file.
 * @param {ToolHookInput} input
 * @returns {string | undefined}
 */
export function projectRelativePath(input) {
  const filePath = input.tool_input.file_path;
  if (typeof filePath !== 'string') {
    return undefined;
  }
  return relative(projectRoot(), resolve(projectRoot(), filePath)).replaceAll('\\', '/');
}

/** @returns {string} */
export function projectRoot() {
  return process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
}
