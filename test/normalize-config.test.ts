import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_CACHE_DURATION_MINUTES,
  DEFAULT_MINIMUM_RATING,
  DEFAULT_NOAA_ENC_SCALE_BAND,
  DEFAULT_OPENSEAMAP_DEDUPE_RADIUS_METERS,
  DEFAULT_OPENSEAMAP_ENDPOINT,
  DEFAULT_PROXIMITY_ALARM_RADIUS_METERS,
  DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS,
  DEFAULT_USCG_LIGHT_LIST_REFRESH_HOURS,
  normalizeConfig
} from '../src/panel/normalize-config.js'
import { SEAMARK_GROUP_IDS } from '../src/shared/seamark-groups.js'
import { POI_TYPE_FLAGS } from '../src/shared/poi-type-selection.js'

test('normalizeConfig fills every POI flag true and the default duration for an empty config', () => {
  const config = normalizeConfig({})
  assert.equal(config.cachingDurationMinutes, DEFAULT_CACHE_DURATION_MINUTES)
  for (const [flag] of POI_TYPE_FLAGS) {
    assert.equal(config[flag], true, `${flag} defaults to true`)
  }
})

test('normalizeConfig keeps a valid cache duration', () => {
  assert.equal(normalizeConfig({ cachingDurationMinutes: 15 }).cachingDurationMinutes, 15)
})

test('normalizeConfig falls back to the default for an unusable cache duration', () => {
  assert.equal(normalizeConfig({ cachingDurationMinutes: 0 }).cachingDurationMinutes, DEFAULT_CACHE_DURATION_MINUTES)
  assert.equal(normalizeConfig({ cachingDurationMinutes: -5 }).cachingDurationMinutes, DEFAULT_CACHE_DURATION_MINUTES)
  assert.equal(normalizeConfig({ cachingDurationMinutes: 'soon' }).cachingDurationMinutes, DEFAULT_CACHE_DURATION_MINUTES)
})

test('normalizeConfig preserves an explicitly disabled POI flag', () => {
  const config = normalizeConfig({ includeMarinas: false, includeHazards: true })
  assert.equal(config.includeMarinas, false)
  assert.equal(config.includeHazards, true)
  assert.equal(config.includeAnchorages, true, 'an absent flag still defaults to true')
})

test('normalizeConfig treats a non-object configuration as empty', () => {
  for (const input of [null, undefined, 'config', 42]) {
    const config = normalizeConfig(input)
    assert.equal(config.cachingDurationMinutes, DEFAULT_CACHE_DURATION_MINUTES)
    assert.equal(config.includeMarinas, true)
  }
})

test('normalizeConfig defaults the safety options for an empty config', () => {
  const config = normalizeConfig({})
  assert.equal(config.minimumRating, DEFAULT_MINIMUM_RATING)
  assert.equal(config.enableProximityAlarms, false)
  assert.equal(config.proximityAlarmRadiusMeters, DEFAULT_PROXIMITY_ALARM_RADIUS_METERS)
})

test('normalizeConfig keeps valid safety options', () => {
  const config = normalizeConfig({
    minimumRating: 3,
    enableProximityAlarms: true,
    proximityAlarmRadiusMeters: 250
  })
  assert.equal(config.minimumRating, 3)
  assert.equal(config.enableProximityAlarms, true)
  assert.equal(config.proximityAlarmRadiusMeters, 250)
})

test('normalizeConfig clamps an out-of-range minimum rating', () => {
  assert.equal(normalizeConfig({ minimumRating: 9 }).minimumRating, 5)
  assert.equal(normalizeConfig({ minimumRating: -2 }).minimumRating, 0)
})

test('normalizeConfig falls back to the default for an unusable minimum rating', () => {
  assert.equal(normalizeConfig({ minimumRating: 'high' }).minimumRating, DEFAULT_MINIMUM_RATING)
  assert.equal(normalizeConfig({ minimumRating: Number.NaN }).minimumRating, DEFAULT_MINIMUM_RATING)
})

test('normalizeConfig treats a non-true enableProximityAlarms as false', () => {
  assert.equal(normalizeConfig({ enableProximityAlarms: 'yes' }).enableProximityAlarms, false)
  assert.equal(normalizeConfig({ enableProximityAlarms: false }).enableProximityAlarms, false)
})

test('normalizeConfig falls back to the default for an unusable alarm radius', () => {
  assert.equal(
    normalizeConfig({ proximityAlarmRadiusMeters: -10 }).proximityAlarmRadiusMeters,
    DEFAULT_PROXIMITY_ALARM_RADIUS_METERS
  )
  assert.equal(
    normalizeConfig({ proximityAlarmRadiusMeters: 'far' }).proximityAlarmRadiusMeters,
    DEFAULT_PROXIMITY_ALARM_RADIUS_METERS
  )
})

test('normalizeConfig falls back to the default for a zero alarm radius', () => {
  assert.equal(
    normalizeConfig({ proximityAlarmRadiusMeters: 0 }).proximityAlarmRadiusMeters,
    DEFAULT_PROXIMITY_ALARM_RADIUS_METERS
  )
})

test('normalizeConfig defaults the OpenSeaMap options for an empty config', () => {
  const config = normalizeConfig({})
  assert.equal(config.openSeaMapEnabled, false)
  assert.equal(config.openSeaMapEndpoint, DEFAULT_OPENSEAMAP_ENDPOINT)
  assert.deepEqual(config.openSeaMapSeamarkGroups, [...SEAMARK_GROUP_IDS])
})

test('normalizeConfig preserves an explicitly enabled OpenSeaMap source', () => {
  const config = normalizeConfig({
    openSeaMapEnabled: true,
    openSeaMapEndpoint: 'https://overpass.example/api',
    openSeaMapSeamarkGroups: ['hazards', 'navaids']
  })
  assert.equal(config.openSeaMapEnabled, true)
  assert.equal(config.openSeaMapEndpoint, 'https://overpass.example/api')
  assert.deepEqual(config.openSeaMapSeamarkGroups, ['hazards', 'navaids'])
})

test('normalizeConfig treats a non-true openSeaMapEnabled as false', () => {
  assert.equal(normalizeConfig({ openSeaMapEnabled: 'yes' }).openSeaMapEnabled, false)
  assert.equal(normalizeConfig({ openSeaMapEnabled: false }).openSeaMapEnabled, false)
})

test('normalizeConfig falls back to the default for a blank OpenSeaMap endpoint', () => {
  assert.equal(normalizeConfig({ openSeaMapEndpoint: '   ' }).openSeaMapEndpoint, DEFAULT_OPENSEAMAP_ENDPOINT)
  assert.equal(normalizeConfig({ openSeaMapEndpoint: 42 }).openSeaMapEndpoint, DEFAULT_OPENSEAMAP_ENDPOINT)
})

test('normalizeConfig drops unknown seamark groups and keeps an explicit empty selection', () => {
  assert.deepEqual(
    normalizeConfig({ openSeaMapSeamarkGroups: ['hazards', 'bogus', 7] }).openSeaMapSeamarkGroups,
    ['hazards']
  )
  assert.deepEqual(normalizeConfig({ openSeaMapSeamarkGroups: [] }).openSeaMapSeamarkGroups, [])
})

test('normalizeConfig defaults the route-hazard scan options for an empty config', () => {
  const config = normalizeConfig({})
  assert.equal(config.enableRouteHazardScan, false)
  assert.equal(config.routeCorridorWidthMeters, DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS)
})

test('normalizeConfig keeps valid route-hazard scan options', () => {
  const config = normalizeConfig({
    enableRouteHazardScan: true,
    routeCorridorWidthMeters: 750
  })
  assert.equal(config.enableRouteHazardScan, true)
  assert.equal(config.routeCorridorWidthMeters, 750)
})

test('normalizeConfig treats a non-true enableRouteHazardScan as false', () => {
  assert.equal(normalizeConfig({ enableRouteHazardScan: 'yes' }).enableRouteHazardScan, false)
  assert.equal(normalizeConfig({ enableRouteHazardScan: false }).enableRouteHazardScan, false)
})

test('normalizeConfig falls back to the default for an unusable corridor width', () => {
  for (const input of [0, -10, 'wide', Number.NaN]) {
    assert.equal(
      normalizeConfig({ routeCorridorWidthMeters: input }).routeCorridorWidthMeters,
      DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS
    )
  }
})

test('normalizeConfig defaults openSeaMapDedupe to true when the key is absent', () => {
  assert.equal(normalizeConfig({}).openSeaMapDedupe, true)
})

test('normalizeConfig honors an explicit openSeaMapDedupe false', () => {
  assert.equal(normalizeConfig({ openSeaMapDedupe: false }).openSeaMapDedupe, false)
})

test('normalizeConfig treats a non-false openSeaMapDedupe value as true', () => {
  // Only an explicit false turns dedupe off; anything else (including unusable
  // values) keeps the default-on behavior so old configs migrate cleanly.
  assert.equal(normalizeConfig({ openSeaMapDedupe: true }).openSeaMapDedupe, true)
  assert.equal(normalizeConfig({ openSeaMapDedupe: 'no' }).openSeaMapDedupe, true)
  assert.equal(normalizeConfig({ openSeaMapDedupe: 0 }).openSeaMapDedupe, true)
})

test('normalizeConfig defaults the dedupe merge radius for an empty config', () => {
  assert.equal(
    normalizeConfig({}).openSeaMapDedupeRadiusMeters,
    DEFAULT_OPENSEAMAP_DEDUPE_RADIUS_METERS
  )
})

test('normalizeConfig keeps a valid dedupe merge radius', () => {
  assert.equal(
    normalizeConfig({ openSeaMapDedupeRadiusMeters: 75 }).openSeaMapDedupeRadiusMeters,
    75
  )
})

test('normalizeConfig falls back to the default for an unusable dedupe merge radius', () => {
  for (const input of [0, -5, 'near', Number.NaN]) {
    assert.equal(
      normalizeConfig({ openSeaMapDedupeRadiusMeters: input }).openSeaMapDedupeRadiusMeters,
      DEFAULT_OPENSEAMAP_DEDUPE_RADIUS_METERS
    )
  }
})

test('normalizeConfig defaults the USCG Light List options for an empty config', () => {
  const config = normalizeConfig({})
  assert.equal(config.uscgLightListEnabled, false)
  assert.equal(config.uscgLightListDedupe, true)
  assert.equal(config.uscgLightListRefreshHours, DEFAULT_USCG_LIGHT_LIST_REFRESH_HOURS)
})

test('normalizeConfig keeps a valid USCG Light List refresh period', () => {
  assert.equal(normalizeConfig({ uscgLightListRefreshHours: 24 }).uscgLightListRefreshHours, 24)
})

test('normalizeConfig falls back to the default for an out-of-range USCG Light List refresh period', () => {
  for (const input of [0, -1, 200, 'soon', Number.NaN]) {
    assert.equal(
      normalizeConfig({ uscgLightListRefreshHours: input }).uscgLightListRefreshHours,
      DEFAULT_USCG_LIGHT_LIST_REFRESH_HOURS
    )
  }
})

test('normalizeConfig honors an explicit uscgLightListDedupe false', () => {
  assert.equal(normalizeConfig({ uscgLightListDedupe: false }).uscgLightListDedupe, false)
})

test('normalizeConfig defaults the NOAA ENC options for an empty config', () => {
  const config = normalizeConfig({})
  assert.equal(config.noaaEncEnabled, false)
  assert.equal(config.noaaEncDedupe, true)
  assert.equal(config.noaaEncScaleBand, DEFAULT_NOAA_ENC_SCALE_BAND)
  assert.equal(config.noaaEncIncludeWrecks, true)
  assert.equal(config.noaaEncIncludeObstructions, true)
  // Rocks default off so a coastal-band query does not flood the chart plotter.
  assert.equal(config.noaaEncIncludeRocks, false)
})

test('normalizeConfig keeps a known NOAA ENC scale band', () => {
  assert.equal(normalizeConfig({ noaaEncScaleBand: 'harbour' }).noaaEncScaleBand, 'harbour')
})

test('normalizeConfig falls back to the default for an unknown NOAA ENC scale band', () => {
  for (const input of ['unknown', '', 42, null]) {
    assert.equal(
      normalizeConfig({ noaaEncScaleBand: input }).noaaEncScaleBand,
      DEFAULT_NOAA_ENC_SCALE_BAND
    )
  }
})

test('normalizeConfig honors explicit NOAA ENC layer toggles', () => {
  const config = normalizeConfig({
    noaaEncIncludeWrecks: false,
    noaaEncIncludeObstructions: false,
    noaaEncIncludeRocks: true
  })
  assert.equal(config.noaaEncIncludeWrecks, false)
  assert.equal(config.noaaEncIncludeObstructions, false)
  assert.equal(config.noaaEncIncludeRocks, true)
})
