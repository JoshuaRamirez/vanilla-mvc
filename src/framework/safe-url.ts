/** Relative URLs, or absolute ones with a known-safe scheme. */
const SAFE = /^(?:(?:https?|mailto|tel):|[^:/?#]*(?:[/?#]|$))/i;

/**
 * Neutralize javascript:, data:, and other script-capable URLs from data.
 * Use for any href or src that isn't a literal in the template.
 *
 *   <a href=${safeUrl(link.url)}>
 */
export function safeUrl(url: unknown): string {
  const text = String(url ?? '').trim();
  return SAFE.test(text) ? text : 'about:blank#blocked';
}
