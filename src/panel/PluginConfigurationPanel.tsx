/**
 * Root component of the federated configuration panel. The Signal K admin UI
 * loads it from remoteEntry.js and renders it in place of the generated
 * react-jsonschema-form, passing the current configuration and a fire-and-forget
 * save callback.
 */

import type * as React from 'react'
import { useEffect, useState } from 'react'
import ActiveCaptainPoiTypes from './components/ActiveCaptainPoiTypes.js'
import CacheDurationField from './components/CacheDurationField.js'
import FooterBar from './components/FooterBar.js'
import ProximityAlarmFields from './components/ProximityAlarmFields.js'
import RatingFilterField from './components/RatingFilterField.js'
import RouteHazardScanFields from './components/RouteHazardScanFields.js'
import StatusBar from './components/StatusBar.js'
import { useConfig } from './hooks/use-config.js'
import { useStatus } from './hooks/use-status.js'
import {
  DEFAULT_MINIMUM_RATING,
  DEFAULT_PROXIMITY_ALARM_RADIUS_METERS,
  DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS
} from './normalize-config.js'
import { S, THEME_STYLE } from './styles.js'

/** How long, in milliseconds, the "Saved" confirmation pill stays visible. */
const SAVED_PILL_MS = 2500

interface Props {
  /** The plugin configuration supplied by the admin UI. Untyped at the federation boundary. */
  configuration: unknown
  /** Persists the configuration. Fire-and-forget: it returns void and must not be awaited. */
  save: (configuration: unknown) => void
}

/** The configuration panel rendered inside the Signal K admin UI. */
export default function PluginConfigurationPanel ({ configuration, save }: Props): React.ReactElement {
  const { status, error } = useStatus()
  const { state, savedState, dispatch, markSaved } = useConfig(configuration)
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null)

  // Clear the "Saved" pill a short while after a save.
  useEffect(() => {
    if (justSavedAt === null) return
    const timeoutId = setTimeout(() => setJustSavedAt(null), SAVED_PILL_MS)
    return () => clearTimeout(timeoutId)
  }, [justSavedAt])

  // Every reducer case returns a new object only on a real change, so identity
  // inequality against the last-saved snapshot is a sound dirty check.
  const dirty = state !== savedState

  const handleSave = (): void => {
    save(state)
    markSaved()
    setJustSavedAt(Date.now())
  }

  return (
    <div className='ac-config-panel' style={S.root}>
      <style>{THEME_STYLE}</style>
      <StatusBar status={status} />
      {error !== null
        ? (
          <div role='alert' style={S.errorBanner}>
            Status unavailable: {error}. The next poll will retry automatically.
          </div>
          )
        : null}
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
      <ProximityAlarmFields
        enabled={state.enableProximityAlarms === true}
        radiusMeters={state.proximityAlarmRadiusMeters ?? DEFAULT_PROXIMITY_ALARM_RADIUS_METERS}
        onToggleEnabled={(enabled) => dispatch({ type: 'setProximityAlarmsEnabled', enabled })}
        onChangeRadius={(meters) => dispatch({ type: 'setProximityAlarmRadius', meters })}
      />
      <RouteHazardScanFields
        enabled={state.enableRouteHazardScan === true}
        corridorWidthMeters={state.routeCorridorWidthMeters ?? DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS}
        onToggleEnabled={(enabled) => dispatch({ type: 'setRouteHazardScanEnabled', enabled })}
        onChangeWidth={(meters) => dispatch({ type: 'setRouteCorridorWidth', meters })}
      />
      <FooterBar
        dirty={dirty}
        justSavedAt={justSavedAt}
        onSave={handleSave}
        onDiscard={() => dispatch({ type: 'discard', config: savedState })}
      />
    </div>
  )
}
