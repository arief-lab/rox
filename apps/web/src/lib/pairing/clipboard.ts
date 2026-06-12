// SPDX-License-Identifier: AGPL-3.0-or-later
export interface Clipboard {
  readText: () => Promise<string>;
  writeText: (text: string) => Promise<void>;
}

/**
 * Reads text from the system clipboard.
 *
 * The `clipboard` parameter is injectable so tests can stub
 * `navigator.clipboard` without monkey-patching globals. In production code,
 * omit the argument and the default (`navigator.clipboard`) is used.
 */
export function readClipboard(
  clipboard: Pick<Clipboard, "readText"> = globalThis.navigator.clipboard
): Promise<string> {
  return clipboard.readText();
}

/**
 * Writes text to the system clipboard. See {@link readClipboard} for the
 * `clipboard` parameter contract.
 */
export function writeClipboard(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> = globalThis.navigator.clipboard
): Promise<void> {
  return clipboard.writeText(text);
}
