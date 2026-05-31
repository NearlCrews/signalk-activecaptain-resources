/**
 * The bridge air-draft check controls: an opt-in toggle plus two numeric
 * settings, the fallback vessel air draft and the clearance safety margin.
 *
 * Unlike `ProximityAlarmFields` and `RouteHazardScanFields`, this control group
 * pairs the toggle with two numeric fields rather than one, so it lays out the
 * fieldset directly instead of reusing the single-field `AlarmFieldset`. Both
 * numeric inputs are disabled while the toggle is off, because the settings then
 * have no effect, matching the `AlarmFieldset` behavior.
 */

import type * as React from 'react'
import NumberField from './NumberField.js'
import { S } from '../styles.js'
import {
  MIN_CLEARANCE_MARGIN_METERS,
  MAX_CLEARANCE_MARGIN_METERS
} from '../../shared/bridge-clearance.js'

/**
 * Smallest fallback air draft the field accepts. Zero is valid and means rely
 * on `design.airHeight` alone, so the floor is zero, matching the
 * `vesselAirDraftMeters` schema minimum.
 */
const MIN_AIR_DRAFT_METERS = 0

/** Step for both fractional meter fields: half a meter per arrow press. */
const METER_STEP = 0.5

interface Props {
  enabled: boolean
  airDraftMeters: number
  marginMeters: number
  onToggleEnabled: (enabled: boolean) => void
  onChangeAirDraft: (meters: number) => void
  onChangeMargin: (meters: number) => void
}

/** The bridge air-draft check controls shown in the configuration panel. */
export default function BridgeAirDraftFields ({
  enabled,
  airDraftMeters,
  marginMeters,
  onToggleEnabled,
  onChangeAirDraft,
  onChangeMargin
}: Props): React.ReactElement {
  return (
    <fieldset style={S.group}>
      <legend style={S.groupTitle}>Bridge air-draft check</legend>
      <label style={S.checkboxRow}>
        <input
          type='checkbox'
          style={S.checkbox}
          checked={enabled}
          onChange={(e) => onToggleEnabled(e.target.checked)}
        />
        Warn when an approaching bridge is too low for the vessel
      </label>
      <p style={S.hint}>
        When enabled, the plugin compares each approaching bridge, and each
        bridge on the active route ahead, against the vessel air draft, and
        raises a Signal K notification when the charted clearance would not
        clear the vessel. The route-ahead warning also needs the route-corridor
        hazard scan enabled above.
      </p>
      <NumberField
        id='ac-bridge-air-draft'
        label='Vessel air draft (meters)'
        hint="0 = use the vessel's design.airHeight from the Signal K data model. Set a value here only as a fallback for a vessel that does not report design.airHeight."
        value={airDraftMeters}
        onChange={onChangeAirDraft}
        min={MIN_AIR_DRAFT_METERS}
        step={METER_STEP}
        disabled={!enabled}
        dense
      />
      <NumberField
        id='ac-bridge-clearance-margin'
        label='Clearance margin (meters)'
        hint='Headroom added to the air draft before the comparison, covering tide, datum, and loading. A bridge warns when its charted clearance is at or below the air draft plus this margin.'
        value={marginMeters}
        onChange={onChangeMargin}
        min={MIN_CLEARANCE_MARGIN_METERS}
        max={MAX_CLEARANCE_MARGIN_METERS}
        step={METER_STEP}
        disabled={!enabled}
        dense
      />
    </fieldset>
  )
}
