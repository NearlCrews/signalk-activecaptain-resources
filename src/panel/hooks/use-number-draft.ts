/**
 * Raw-text draft state for a controlled numeric input. A bare controlled
 * `<input type='number'>` snaps back to the committed value on every
 * keystroke, so the user cannot clear the field mid-edit; this hook keeps the
 * literal typed string around until the input loses focus, then drops it so
 * the input renders the committed numeric value again.
 *
 * The hook also defines the canonical empty-input and parse-failure behavior:
 * both fall back to the configured `fallback` (or the minimum). A finite
 * parsed value is clamped to `[min, max]` and, when `integer: true`, truncated
 * to a whole number.
 */

import { useEffect, useRef, useState } from 'react'

/** Options that shape how a draft string is parsed and clamped on commit. */
export interface NumberDraftOptions {
  /** Smallest allowed value. The fallback when the input is empty or unparsable. */
  min: number
  /** Largest allowed value. Omit to leave the high end unbounded. */
  max?: number
  /** Truncate any fractional part on commit. */
  integer?: boolean
  /** Value to commit for empty or unparsable input. Defaults to `min`. */
  fallback?: number
}

/** The state surface the controlled input consumes. */
export interface NumberDraft {
  /** The text the input should render: the live draft if any, otherwise the committed value. */
  display: string
  /** Track a keystroke and commit a clamped numeric value through `onChange`. */
  handleChange: (raw: string) => void
  /** Drop the live draft, so the input snaps back to the committed value. */
  handleBlur: () => void
}

/**
 * Drive a controlled numeric input with a draft-while-editing buffer. `value`
 * is the committed number; `onChange` receives the clamped value for every
 * keystroke (so the parent's state stays in sync as the user types).
 */
export function useNumberDraft (
  value: number,
  onChange: (next: number) => void,
  options: NumberDraftOptions
): NumberDraft {
  const [draft, setDraft] = useState<string | null>(null)

  // Drop the draft when the committed value changes externally (e.g. a
  // Discard action restores the saved snapshot). Without this, the input
  // would keep rendering the user's stale typed text until they
  // focus-and-blur the field. lastCommittedFromHere tracks the value the
  // hook itself last produced, so a self-driven update (handleChange
  // calling onChange) is recognized as ours and leaves the draft alone;
  // any other transition is treated as external and clears the draft.
  const lastCommittedFromHere = useRef<number | null>(null)
  useEffect(() => {
    if (lastCommittedFromHere.current === value) {
      lastCommittedFromHere.current = null
      return
    }
    setDraft(null)
  }, [value])

  const commit = (raw: string): void => {
    const fallback = options.fallback ?? options.min
    let next: number
    if (raw.trim() === '') {
      next = fallback
    } else {
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        next = fallback
      } else {
        next = parsed
        if (options.integer === true) next = Math.trunc(next)
        if (options.max !== undefined && next > options.max) next = options.max
        if (next < options.min) next = options.min
      }
    }
    // Tag this committed value so the external-change-detector recognizes
    // the next render's `value` as ours and leaves the draft in place.
    lastCommittedFromHere.current = next
    onChange(next)
  }

  return {
    display: draft ?? String(value),
    handleChange: (raw) => {
      setDraft(raw)
      commit(raw)
    },
    handleBlur: () => setDraft(null)
  }
}
