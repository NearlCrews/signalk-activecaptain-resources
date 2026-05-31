/**
 * Shared layout for an alarm-style control: a titled fieldset that pairs an
 * opt-in toggle with a single numeric setting beneath it, plus the hints that
 * explain each. Both `ProximityAlarmFields` and `RouteHazardScanFields` use
 * it, parameterized by their labels, ids, and the numeric setting's minimum.
 *
 * The fieldset, legend, toggle, and hint shell come from `ToggleFieldset`;
 * AlarmFieldset slots its single integer NumberField as the children. The
 * numeric input is disabled while the toggle is off, because the setting then
 * has no effect.
 */

import type * as React from 'react'
import NumberField from './NumberField.js'
import ToggleFieldset from './ToggleFieldset.js'

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
  return (
    <ToggleFieldset
      title={title}
      toggleLabel={toggleLabel}
      toggleHint={toggleHint}
      enabled={enabled}
      onToggleEnabled={onToggleEnabled}
    >
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
    </ToggleFieldset>
  )
}
