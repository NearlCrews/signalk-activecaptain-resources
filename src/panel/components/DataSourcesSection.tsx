/**
 * The Data sources zone of the configuration panel: the per-source accordion.
 * It renders one collapsible `DataSourceCard` per POI source, each with the
 * matching card-body component as its children, plus a one-line summary built
 * from the current configuration so a collapsed card still says what it does.
 *
 * Disclosure state (which card is expanded) lives on the panel root and is
 * passed down here so the section is purely declarative.
 */

import type * as React from 'react'
import type { Dispatch } from 'react'
import type { ConfigAction } from '../config-reducer.js'
import { POI_TYPE_FLAGS } from '../../shared/poi-type-selection.js'
import { SEAMARK_GROUP_REFS } from '../../shared/seamark-groups.js'
import {
  DEFAULT_NOAA_ENC_SCALE_BAND,
  DEFAULT_USCG_LIGHT_LIST_REFRESH_HOURS
} from '../normalize-config.js'
import { S } from '../styles.js'
import type { PluginConfig } from '../../shared/types.js'
import type { SourceStatus, StatusSnapshot } from '../../status/status-types.js'
import ActiveCaptainSource from './ActiveCaptainSource.js'
import DataSourceCard from './DataSourceCard.js'
import NoaaEncSource, { BAND_LABELS } from './NoaaEncSource.js'
import OpenSeaMapSource from './OpenSeaMapSource.js'
import UscgLightListSource from './UscgLightListSource.js'

type ScaleBand = keyof typeof BAND_LABELS

interface Props {
  state: PluginConfig
  dispatch: Dispatch<ConfigAction>
  /** Per-source status snapshot, or null until the first poll resolves. */
  status: StatusSnapshot | null
  /** Which card ids are currently expanded. */
  expanded: Record<string, boolean>
  /** Toggle the expansion of one card by id. */
  onToggleExpanded: (cardId: string) => void
}

/** Build the ActiveCaptain card's collapsed one-line summary. */
function activeCaptainSummary (state: PluginConfig): string {
  const total = POI_TYPE_FLAGS.length
  const selected = POI_TYPE_FLAGS.filter(([flag]) => state[flag] === true).length
  // No selection means the plugin imports every type, so report it as such.
  const types = selected === 0 ? 'all POI types' : `${selected} of ${total} POI types`
  return `${types}, ${state.cachingDurationMinutes} min cache`
}

/**
 * Append a "since YYYY" tail to a card summary when the user has set the
 * per-source minimum-year filter to a non-zero value. Keeps the collapsed
 * row short when the filter is off (the common case).
 */
function appendSinceYear (summary: string, year: number | undefined): string {
  return year !== undefined && year > 0 ? `${summary}, since ${year}` : summary
}

/** Build the OpenSeaMap card's collapsed one-line summary. */
function openSeaMapSummary (state: PluginConfig): string {
  const selected = (state.openSeaMapSeamarkGroups ?? []).length
  return appendSinceYear(
    `${selected} of ${SEAMARK_GROUP_REFS.length} feature groups`,
    state.openSeaMapMinimumYear
  )
}

/** Build the USCG Light List card's collapsed one-line summary. */
function uscgLightListSummary (state: PluginConfig): string {
  const hours = state.uscgLightListRefreshHours ?? DEFAULT_USCG_LIGHT_LIST_REFRESH_HOURS
  return appendSinceYear(`${hours} h refresh`, state.uscgLightListMinimumUpdateYear)
}

/** Build the NOAA ENC card's collapsed one-line summary. */
function noaaEncSummary (state: PluginConfig): string {
  const rawBand = state.noaaEncScaleBand ?? DEFAULT_NOAA_ENC_SCALE_BAND
  // Use the same friendly label the expanded card shows ("Harbor" not
  // "harbour", "Coastal" not "coastal"), so collapsing the card never
  // surfaces the raw NOAA wire value.
  const label = BAND_LABELS[rawBand as ScaleBand] ?? rawBand
  // Wrecks and obstructions default on; rocks default off.
  const layers: string[] = []
  if (state.noaaEncIncludeWrecks !== false) layers.push('wrecks')
  if (state.noaaEncIncludeObstructions !== false) layers.push('obstructions')
  if (state.noaaEncIncludeRocks === true) layers.push('rocks')
  const layerList = layers.length === 0 ? 'no layers' : layers.join(', ')
  return appendSinceYear(`${label} band, ${layerList}`, state.noaaEncMinimumSurveyYear)
}

/** Look up the per-source status entry by source slug. */
function statusFor (snapshot: StatusSnapshot | null, sourceId: string): SourceStatus | undefined {
  return snapshot?.sources.find((entry) => entry.source === sourceId)
}

/** The per-source accordion shown in the configuration panel. */
export default function DataSourcesSection (
  { state, dispatch, status, expanded, onToggleExpanded }: Props
): React.ReactElement {
  return (
    <section>
      <h2 style={S.sectionHeading}>Data sources</h2>
      <DataSourceCard
        name='Garmin ActiveCaptain'
        enabled
        summary={activeCaptainSummary(state)}
        expanded={expanded.activecaptain === true}
        onToggleExpanded={() => onToggleExpanded('activecaptain')}
        status={statusFor(status, 'activecaptain')}
      >
        <ActiveCaptainSource state={state} dispatch={dispatch} />
      </DataSourceCard>
      <DataSourceCard
        name='OpenSeaMap'
        enabled={state.openSeaMapEnabled === true}
        summary={openSeaMapSummary(state)}
        expanded={expanded.openseamap === true}
        onToggleExpanded={() => onToggleExpanded('openseamap')}
        onToggleEnabled={(enabled) => dispatch({ type: 'setOpenSeaMapEnabled', enabled })}
        status={statusFor(status, 'openseamap')}
      >
        <OpenSeaMapSource state={state} dispatch={dispatch} />
      </DataSourceCard>
      <DataSourceCard
        name='USCG Light List (US Aids to Navigation)'
        enabled={state.uscgLightListEnabled === true}
        summary={uscgLightListSummary(state)}
        expanded={expanded.usclightlist === true}
        onToggleExpanded={() => onToggleExpanded('usclightlist')}
        onToggleEnabled={(enabled) => dispatch({ type: 'setUscgLightListEnabled', enabled })}
        status={statusFor(status, 'usclightlist')}
      >
        <UscgLightListSource state={state} dispatch={dispatch} />
      </DataSourceCard>
      <DataSourceCard
        name='NOAA ENC Direct (US wrecks, obstructions, and rocks)'
        enabled={state.noaaEncEnabled === true}
        summary={noaaEncSummary(state)}
        expanded={expanded.noaaenc === true}
        onToggleExpanded={() => onToggleExpanded('noaaenc')}
        onToggleEnabled={(enabled) => dispatch({ type: 'setNoaaEncEnabled', enabled })}
        status={statusFor(status, 'noaaenc')}
      >
        <NoaaEncSource state={state} dispatch={dispatch} />
      </DataSourceCard>
    </section>
  )
}
