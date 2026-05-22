/**
 * Render an ISO-8601 timestamp as a localized, relative phrase such as
 * "5 minutes ago". Extracted from `StatusBar.tsx` as a plain-TypeScript module
 * so the unit-stepping logic is testable without an `.tsx` import.
 */

/** Relative-time units, largest first, paired with their length in seconds. */
const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1]
]

/**
 * Shared `RelativeTimeFormat` instance. Construction is non-trivial and the
 * formatter is reentrant, so it is reused across every call rather than rebuilt
 * per call (StatusBar renders multiple rows on each 5-second status poll).
 */
const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** Render an ISO-8601 timestamp as a localized, relative phrase. */
export function relativeTime (iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso

  const deltaSeconds = Math.round((then - Date.now()) / 1000)
  const absSeconds = Math.abs(deltaSeconds)

  // Pick the coarsest unit the delta reaches.
  let index = RELATIVE_UNITS.length - 1
  for (let i = 0; i < RELATIVE_UNITS.length; i++) {
    if (absSeconds >= RELATIVE_UNITS[i][1]) {
      index = i
      break
    }
  }
  // Rounding within a unit can spill into the next unit up (3599 s rounds to
  // 60 minutes); step up so it reads "1 hour" rather than "60 minutes".
  while (index > 0 &&
    Math.round(absSeconds / RELATIVE_UNITS[index][1]) * RELATIVE_UNITS[index][1] >= RELATIVE_UNITS[index - 1][1]) {
    index -= 1
  }

  const [unit, unitSeconds] = RELATIVE_UNITS[index]
  return RELATIVE_TIME_FORMAT.format(Math.round(deltaSeconds / unitSeconds), unit)
}
