/**
 * The ActiveCaptain data-source card body: the cache-duration field, the
 * minimum-rating filter, and the ActiveCaptain POI-type selector. It is the
 * `children` of the ActiveCaptain `DataSourceCard` in the accordion.
 */

import type * as React from 'react'
import type { Dispatch } from 'react'
import type { ConfigAction } from '../config-reducer.js'
import { DEFAULT_MINIMUM_RATING } from '../normalize-config.js'
import type { PluginConfig } from '../../shared/types.js'
import ActiveCaptainPoiTypes from './ActiveCaptainPoiTypes.js'
import CacheDurationField from './CacheDurationField.js'
import RatingFilterField from './RatingFilterField.js'

interface Props {
  state: PluginConfig
  dispatch: Dispatch<ConfigAction>
}

/** The configuration fields for the ActiveCaptain source. */
export default function ActiveCaptainSource ({ state, dispatch }: Props): React.ReactElement {
  return (
    <>
      <CacheDurationField
        value={state.cachingDurationMinutes}
        onChange={(minutes) => dispatch({ type: 'setCacheDuration', minutes })}
      />
      <RatingFilterField
        value={state.minimumRating ?? DEFAULT_MINIMUM_RATING}
        onChange={(rating) => dispatch({ type: 'setMinimumRating', rating })}
      />
      <ActiveCaptainPoiTypes
        config={state}
        onToggle={(flag, enabled) => dispatch({ type: 'setPoiType', flag, enabled })}
        onSetAll={(enabled) => dispatch({ type: 'setAllPoiTypes', enabled })}
      />
    </>
  )
}
