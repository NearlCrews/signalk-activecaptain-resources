/**
 * Number input for the minimumRating setting. It holds a raw-text draft while
 * the user edits, so the field can be cleared mid-edit instead of snapping
 * back to a number on every keystroke, and commits a value clamped to the
 * 0-to-5 rating range.
 */

import type * as React from 'react'
import { useState } from 'react'
import { MAX_RATING, MIN_RATING } from '../normaliseConfig.js'
import { S } from '../styles.js'

/** Stable id linking the visible label to its input. */
const FIELD_ID = 'ac-minimum-rating'

interface Props {
  value: number
  onChange: (rating: number) => void
}

/** The minimum-rating filter field shown in the configuration panel. */
export default function RatingFilterField ({ value, onChange }: Props): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string): void => {
    if (raw.trim() === '') {
      onChange(MIN_RATING)
      return
    }
    const parsed = Number(raw)
    onChange(Number.isFinite(parsed)
      ? Math.min(MAX_RATING, Math.max(MIN_RATING, parsed))
      : MIN_RATING)
  }

  return (
    <div style={S.fieldRow}>
      <label htmlFor={FIELD_ID} style={S.label}>Minimum rating</label>
      <input
        id={FIELD_ID}
        type='number'
        min={MIN_RATING}
        max={MAX_RATING}
        step={0.5}
        style={S.input}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value)
          commit(e.target.value)
        }}
        onBlur={() => setDraft(null)}
      />
      <p style={S.hint}>
        Hide points of interest whose average review rating is below this value
        ({MIN_RATING} to {MAX_RATING}). Leave it at {MIN_RATING} to show every
        rating.
      </p>
    </div>
  )
}
