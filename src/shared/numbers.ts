/**
 * Number-narrowing helpers shared across the plugin.
 *
 * Several modules need to narrow an `unknown` value off the wire or off the
 * SignalK data model into a finite `number`. A single helper avoids the slight
 * semantic drift that three separate ad-hoc copies were starting to pick up.
 */

/**
 * Narrow an unknown value into a finite `number`, or return `null` when it is
 * not. `NaN`, `Infinity`, and `-Infinity` all fail the check, so a downstream
 * consumer can assume a returned value is genuinely usable.
 */
export function toFiniteNumber (value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Narrow an unknown value into a strictly positive finite `number`, or
 * return `undefined` when it is not. The three input modules' optional
 * config-key validators all want this exact shape (a positive merge
 * radius, never zero or negative): a non-positive value means "fall back
 * to the source's default" rather than "off."
 */
export function positiveFiniteNumber (value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
}
