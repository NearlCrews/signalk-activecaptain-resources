/**
 * The ActiveCaptain data-source card body. Field order follows the same
 * convention every per-source card uses: import layers first, then the
 * refresh-period field (the per-bbox debounce window), then the detail
 * cache duration, then the minimum-rating filter. ActiveCaptain has no
 * update-year filter and no merge option (it is the base every other
 * source merges into), so the rest of the convention is empty for this
 * card.
 */

import type * as React from 'react'
import type { Dispatch } from 'react'
import type { ConfigAction } from '../config-reducer.js'
import { DEFAULT_MINIMUM_RATING, DEFAULT_REFRESH_SECONDS } from '../normalize-config.js'
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
      <RatingFilterField
        value={state.minimumRating ?? DEFAULT_MINIMUM_RATING}
        onChange={(rating) => dispatch({ type: 'setMinimumRating', rating })}
      />
    </>
  )
}
