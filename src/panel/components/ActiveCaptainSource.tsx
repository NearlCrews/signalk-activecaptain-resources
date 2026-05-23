/**
 * The ActiveCaptain data-source card body. Every clustered option group is
 * wrapped in its own bordered fieldset: import layers (POI types), refresh
 * and freshness (per-bbox debounce plus the detail cache duration), and
 * the rating filter (which conceptually stands alone but is wrapped for
 * visual consistency with the other cards). ActiveCaptain has no
 * update-year filter and no merge option (it is the base every other
 * source merges into), so those cells are absent.
 */

import type * as React from 'react'
import type { Dispatch } from 'react'
import type { ConfigAction } from '../config-reducer.js'
import { DEFAULT_MINIMUM_RATING, DEFAULT_REFRESH_SECONDS } from '../normalize-config.js'
import { S } from '../styles.js'
import type { PluginConfig } from '../../shared/types.js'
import ActiveCaptainPoiTypes from './ActiveCaptainPoiTypes.js'
import CacheDurationField from './CacheDurationField.js'
import RatingFilterField from './RatingFilterField.js'
import RefreshSecondsField from './RefreshSecondsField.js'

interface Props {
  state: PluginConfig
  dispatch: Dispatch<ConfigAction>
}

/** The configuration fields for the ActiveCaptain source. */
export default function ActiveCaptainSource ({ state, dispatch }: Props): React.ReactElement {
  return (
    <>
      <ActiveCaptainPoiTypes
        config={state}
        onToggle={(flag, enabled) => dispatch({ type: 'setPoiType', flag, enabled })}
        onSetAll={(enabled) => dispatch({ type: 'setAllPoiTypes', enabled })}
      />
      <fieldset style={S.group}>
        <legend style={S.groupTitle}>Refresh and freshness</legend>
        <RefreshSecondsField
          id='ac-activecaptain-refresh-seconds'
          label='Refresh period (seconds)'
          hint={'How long to reuse the most recent ActiveCaptain result for the ' +
            'same chart viewport before re-querying. A Freeboard refresh burst ' +
            'on a stationary view stays inside the cache; a user who pans to a ' +
            'fresh view re-queries immediately. Leave at 0 to query Garmin on ' +
            'every list call.'}
          value={state.activeCaptainRefreshSeconds ?? DEFAULT_REFRESH_SECONDS}
          onChange={(seconds) => dispatch({ type: 'setActiveCaptainRefreshSeconds', seconds })}
        />
        <CacheDurationField
          value={state.cachingDurationMinutes}
          onChange={(minutes) => dispatch({ type: 'setCacheDuration', minutes })}
        />
      </fieldset>
      <fieldset style={S.group}>
        <legend style={S.groupTitle}>Filters</legend>
        <RatingFilterField
          value={state.minimumRating ?? DEFAULT_MINIMUM_RATING}
          onChange={(rating) => dispatch({ type: 'setMinimumRating', rating })}
        />
      </fieldset>
    </>
  )
}
