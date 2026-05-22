/**
 * The OpenSeaMap data-source card body: the Overpass API endpoint field and
 * the seamark feature-group checklist. It is the `children` of the OpenSeaMap
 * `DataSourceCard` in the accordion.
 */

import type * as React from 'react'
import type { Dispatch } from 'react'
import type { ConfigAction } from '../config-reducer.js'
import { DEFAULT_OPENSEAMAP_ENDPOINT } from '../normalize-config.js'
import { SEAMARK_GROUP_IDS } from '../seamark-groups.js'
import type { PluginConfig } from '../../shared/types.js'
import EndpointUrlField from './EndpointUrlField.js'
import SeamarkGroups from './SeamarkGroups.js'

interface Props {
  state: PluginConfig
  dispatch: Dispatch<ConfigAction>
}

/** The configuration fields for the OpenSeaMap source. */
export default function OpenSeaMapSource ({ state, dispatch }: Props): React.ReactElement {
  const selected = state.openSeaMapSeamarkGroups ?? []

  return (
    <>
      <EndpointUrlField
        value={state.openSeaMapEndpoint ?? DEFAULT_OPENSEAMAP_ENDPOINT}
        onChange={(endpoint) => dispatch({ type: 'setOpenSeaMapEndpoint', endpoint })}
      />
      <SeamarkGroups
        selected={selected}
        onToggle={(id, enabled) => dispatch({
          type: 'setOpenSeaMapSeamarkGroups',
          // Rebuild from the canonical group order so toggling a group off and
          // on again does not reshuffle the stored list.
          groups: SEAMARK_GROUP_IDS.filter(
            (groupId) => groupId === id ? enabled : selected.includes(groupId))
        })}
      />
    </>
  )
}
