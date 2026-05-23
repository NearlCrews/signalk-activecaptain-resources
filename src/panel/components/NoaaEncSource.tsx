/**
 * The NOAA ENC Direct data-source card body: the dedupe toggle, the
 * chart-scale-band selector, and three per-layer toggles (wrecks,
 * obstructions, and rocks). It is the `children` of the NOAA ENC
 * `DataSourceCard` in the accordion; the enable toggle lives on the card
 * header itself.
 */

import type * as React from 'react'
import type { Dispatch } from 'react'
import type { ConfigAction } from '../config-reducer.js'
import { DEFAULT_NOAA_ENC_SCALE_BAND, NOAA_ENC_SCALE_BANDS } from '../normalize-config.js'
import { S } from '../styles.js'
import type { PluginConfig } from '../../shared/types.js'

/** Stable id linking the band selector's visible label to its `<select>`. */
const BAND_FIELD_ID = 'ac-noaa-enc-scale-band'

/** Human-readable label for each ENC chart scale band. */
const BAND_LABELS: Readonly<Record<typeof NOAA_ENC_SCALE_BANDS[number], string>> = {
  overview: 'Overview',
  general: 'General',
  coastal: 'Coastal',
  approach: 'Approach',
  harbour: 'Harbor',
  berthing: 'Berthing'
}

interface Props {
  state: PluginConfig
  dispatch: Dispatch<ConfigAction>
}

/** The configuration fields for the NOAA ENC Direct source. */
export default function NoaaEncSource ({ state, dispatch }: Props): React.ReactElement {
  // Dedupe defaults on: an absent value is treated as checked.
  const dedupeEnabled = state.noaaEncDedupe !== false
  // Wrecks and obstructions default on; rocks default off.
  const includeWrecks = state.noaaEncIncludeWrecks !== false
  const includeObstructions = state.noaaEncIncludeObstructions !== false
  const includeRocks = state.noaaEncIncludeRocks === true
  const band = state.noaaEncScaleBand ?? DEFAULT_NOAA_ENC_SCALE_BAND

  return (
    <>
      <label style={S.checkboxRow}>
        <input
          type='checkbox'
          style={S.checkbox}
          checked={dedupeEnabled}
          onChange={(e) => dispatch({ type: 'setNoaaEncDedupe', enabled: e.target.checked })}
        />
        Merge NOAA ENC markers that duplicate an ActiveCaptain marker
      </label>
      <p style={S.hint}>
        When enabled, a NOAA ENC point of interest close to an ActiveCaptain
        point of the same type is merged into it, so one physical feature is
        shown once. The surviving marker records every source that reported it.
      </p>
      <div style={S.fieldRow}>
        <label htmlFor={BAND_FIELD_ID} style={S.label}>Chart scale band</label>
        <select
          id={BAND_FIELD_ID}
          style={S.input}
          value={band}
          onChange={(e) => dispatch({ type: 'setNoaaEncScaleBand', band: e.target.value })}
        >
          {NOAA_ENC_SCALE_BANDS.map((bandId) => (
            <option key={bandId} value={bandId}>{BAND_LABELS[bandId]}</option>
          ))}
        </select>
        <p style={S.hint}>
          Which ENC chart scale to query. Overview returns large-area features
          only; berthing returns the densest, finest detail. Coastal is the
          recommended default for most underway use.
        </p>
      </div>
      <section style={S.groupsSection}>
        <fieldset style={S.group}>
          <legend style={S.groupTitle}>Hazard layers to import</legend>
          <label style={S.checkboxRow}>
            <input
              type='checkbox'
              style={S.checkbox}
              checked={includeWrecks}
              onChange={(e) => dispatch({ type: 'setNoaaEncIncludeWrecks', enabled: e.target.checked })}
            />
            Wrecks
          </label>
          <label style={S.checkboxRow}>
            <input
              type='checkbox'
              style={S.checkbox}
              checked={includeObstructions}
              onChange={(e) => dispatch({ type: 'setNoaaEncIncludeObstructions', enabled: e.target.checked })}
            />
            Obstructions
          </label>
          <label style={S.checkboxRow}>
            <input
              type='checkbox'
              style={S.checkbox}
              checked={includeRocks}
              onChange={(e) => dispatch({ type: 'setNoaaEncIncludeRocks', enabled: e.target.checked })}
            />
            Underwater rocks
          </label>
          <p style={S.hint}>
            Underwater rocks default off because a coastal-band query can
            return tens of thousands of rocks, which slows the chart plotter
            and obscures other hazards.
          </p>
        </fieldset>
      </section>
    </>
  )
}
