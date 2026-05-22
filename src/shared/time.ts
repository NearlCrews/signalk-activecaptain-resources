/**
 * Shared time constants.
 *
 * The ActiveCaptain detail cache and its disk-backed store both express a TTL
 * in minutes and convert it to milliseconds, so the minute-to-millisecond
 * factor lives here and is imported by both rather than copy-pasted.
 */

/** Number of milliseconds in one minute. */
export const MS_PER_MINUTE = 60_000
