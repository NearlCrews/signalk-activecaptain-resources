/**
 * The Data sources zone of the configuration panel: the per-source accordion.
 * It renders one collapsible `DataSourceCard` per POI source, each with the
 * matching card-body component as its children, plus a one-line summary built
 * from the current configuration so a collapsed card still says what it does.
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
import ActiveCaptainSource from './ActiveCaptainSource.js'
import DataSourceCard from './DataSourceCard.js'
import NoaaEncSource from './NoaaEncSource.js'
import OpenSeaMapSource from './OpenSeaMapSource.js'
import UscgLightListSource from './UscgLightListSource.js'

interface Props {
  state: PluginConfig
  dispatch: Dispatch<ConfigAction>
}

/** Build the ActiveCaptain card's collapsed one-line summary. */
function activeCaptainSummary (state: PluginConfig): string {
  const total = POI_TYPE_FLAGS.length
  const selected = POI_TYPE_FLAGS.filter(([flag]) => state[flag] === true).length
  // No selection means the plugin imports every type, so report it as such.
  const types = selected === 0 ? 'all POI types' : `${selected} of ${total} POI types`
  return `${types}, ${state.cachingDurationMinutes} min cache`
}

/** Build the OpenSeaMap card's collapsed one-line summary. */
function openSeaMapSummary (state: PluginConfig): string {
  const selected = (state.openSeaMapSeamarkGroups ?? []).length
  return `${selected} of ${SEAMARK_GROUP_REFS.length} feature groups`
}

/** Build the USCG Light List card's collapsed one-line summary. */
function uscgLightListSummary (state: PluginConfig): string {
  const hours = state.uscgLightListRefreshHours ?? DEFAULT_USCG_LIGHT_LIST_REFRESH_HOURS
  return `${hours} h refresh`
}

/** Build the NOAA ENC card's collapsed one-line summary. */
function noaaEncSummary (state: PluginConfig): string {
  const band = state.noaaEncScaleBand ?? DEFAULT_NOAA_ENC_SCALE_BAND
  // Wrecks and obstructions default on; rocks default off.
  const layers: string[] = []
  if (state.noaaEncIncludeWrecks !== false) layers.push('wrecks')
  if (state.noaaEncIncludeObstructions !== false) layers.push('obstructions')
  if (state.noaaEncIncludeRocks === true) layers.push('rocks')
  const layerList = layers.length === 0 ? 'no layers' : layers.join(', ')
  return `${band} band, ${layerList}`
}

/** The per-source accordion shown in the configuration panel. */
export default function DataSourcesSection ({ state, dispatch }: Props): React.ReactElement {
  return (
    <section>
      <h2 style={S.sectionHeading}>Data sources</h2>
      <DataSourceCard
        name='Garmin ActiveCaptain'
        enabled
        summary={activeCaptainSummary(state)}
      >
        <ActiveCaptainSource state={state} dispatch={dispatch} />
      </DataSourceCard>
      <DataSourceCard
        name='OpenSeaMap'
        enabled={state.openSeaMapEnabled === true}
        summary={openSeaMapSummary(state)}
        onToggleEnabled={(enabled) => dispatch({ type: 'setOpenSeaMapEnabled', enabled })}
      >
        <OpenSeaMapSource state={state} dispatch={dispatch} />
      </DataSourceCard>
      <DataSourceCard
        name='USCG Light List (US Aids to Navigation)'
        enabled={state.uscgLightListEnabled === true}
        summary={uscgLightListSummary(state)}
        onToggleEnabled={(enabled) => dispatch({ type: 'setUscgLightListEnabled', enabled })}
      >
        <UscgLightListSource state={state} dispatch={dispatch} />
      </DataSourceCard>
      <DataSourceCard
        name='NOAA ENC Direct (US wrecks, obstructions, and rocks)'
        enabled={state.noaaEncEnabled === true}
        summary={noaaEncSummary(state)}
        onToggleEnabled={(enabled) => dispatch({ type: 'setNoaaEncEnabled', enabled })}
      >
        <NoaaEncSource state={state} dispatch={dispatch} />
      </DataSourceCard>
    </section>
  )
}
