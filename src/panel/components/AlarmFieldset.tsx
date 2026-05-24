/**
 * Shared layout for an alarm-style control: a titled fieldset that pairs an
 * opt-in toggle with a single numeric setting beneath it, plus the hints that
 * explain each. Both `ProximityAlarmFields` and `RouteHazardScanFields` use
 * it, parameterized by their labels, ids, and the numeric setting's minimum.
 *
 * The numeric input is disabled while the toggle is off, because the setting
 * then has no effect.
 */

import type * as React from 'react'
import NumberField from './NumberField.js'
import { S } from '../styles.js'

interface Props {
  /** Fieldset legend, e.g. `Proximity hazard alarms`. */
  title: string
  /** Stable id for the numeric input, linking it to its visible label. */
  numberFieldId: string
  /** Label for the toggle checkbox. */
  toggleLabel: string
  /** Hint paragraph rendered below the toggle. */
  toggleHint: React.ReactNode
  /** Whether the alarm is enabled. */
  enabled: boolean
  /** Called when the toggle is flipped. */
  onToggleEnabled: (enabled: boolean) => void
  /** Label for the numeric field, e.g. `Alarm radius (meters)`. */
  numberLabel: string
  /** Hint paragraph rendered next to the numeric field. */
  numberHint: React.ReactNode
  /** Smallest accepted numeric value (integer, floors when the field is empty). */
  numberMin: number
  /** Numeric step the input's up/down arrows use. */
  numberStep?: number
  /** Committed numeric value. */
  numberValue: number
  /** Called with the clamped numeric value on every keystroke. */
  onChangeNumber: (next: number) => void
}

/** A titled fieldset with an opt-in toggle and a single numeric setting. */
export default function AlarmFieldset ({
  title,
  numberFieldId,
  toggleLabel,
  toggleHint,
  enabled,
  onToggleEnabled,
  numberLabel,
  numberHint,
  numberMin,
  numberStep,
  numberValue,
  onChangeNumber
}: Props): React.ReactElement {
  // The outer <section> wrapper that used to sit around the fieldset is
  // gone: AlertsSection already provides the section landmark, and the
  // extra nested section made screen-reader landmark navigation noisier
  // without adding any visual structure.
  return (
    <fieldset style={S.group}>
      <legend style={S.groupTitle}>{title}</legend>
      <label style={S.checkboxRow}>
        <input
          type='checkbox'
          style={S.checkbox}
          checked={enabled}
          onChange={(e) => onToggleEnabled(e.target.checked)}
        />
        {toggleLabel}
      </label>
      <p style={S.hint}>{toggleHint}</p>
      <NumberField
        id={numberFieldId}
        label={numberLabel}
        hint={numberHint}
        value={numberValue}
        onChange={onChangeNumber}
        min={numberMin}
        step={numberStep}
        integer
        disabled={!enabled}
        dense
      />
    </fieldset>
  )
}
