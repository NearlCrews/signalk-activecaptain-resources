/**
 * Shared time constants.
 *
 * Every duration the plugin expresses in milliseconds, plus the multiples a
 * source's TTL configuration converts through. Centralizing the literals
 * means a maintainer who reads a `5 * MS_PER_MINUTE` expression sees what
 * the number is without reverse-engineering `300000`.
 */

/** Number of milliseconds in one second. */
export const MS_PER_SECOND = 1000

/** Number of milliseconds in one minute. */
export const MS_PER_MINUTE = 60_000

/** Number of milliseconds in one hour. */
export const MS_PER_HOUR = MS_PER_MINUTE * 60

/** Number of milliseconds in one day. */
export const MS_PER_DAY = MS_PER_HOUR * 24
