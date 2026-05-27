/**
 * HTML escape helper shared across the source detail renderers.
 *
 * Each source's detail renderer interpolates wire strings into HTML. The
 * escape table covers every metacharacter that has special meaning in
 * attribute or text contexts: `&`, `<`, `>`, `"`, and `'`. The apostrophe is
 * not strictly required for any of today's interpolation sites (every
 * attribute uses double quotes), but the helper is a shared boundary and
 * the next attribute that switches to single quotes inherits the right
 * behavior automatically.
 */

const ESCAPE_TABLE: ReadonlyMap<string, string> = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;']
])

const ESCAPE_REGEX = /[&<>"']/g

/** Escape a string for safe interpolation into an HTML attribute or text node. */
export function escapeHtml (value: string): string {
  return value.replace(ESCAPE_REGEX, (char) => ESCAPE_TABLE.get(char) ?? char)
}
