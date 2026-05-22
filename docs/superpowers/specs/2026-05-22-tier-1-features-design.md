# Tier 1: position-aware safety

**Status:** Approved for implementation.

**Date:** 2026-05-22

**Target release:** v1.3.0

## 1. Scope

Five enhancements from the roadmap's Tier 1, taking the plugin from a passive,
pull-only chart layer to a position-aware, offline-capable safety tool. None
need a Garmin API key.

1. Position monitor and hazard scan.
2. Proximity hazard alarms.
3. Persistent, offline cache.
4. Rating filter.
5. Hazard freshness surfacing.

## 2. Decisions

- **One opt-in toggle for the position-aware feature.** `enableProximityAlarms`
  (default false). When on, the plugin subscribes to `navigation.position`,
  scans for nearby hazards, and emits proximity alarms. When off, the plugin
  behaves exactly as today (pure pull-through), with no background API traffic.
  The scan feeds the alarm check; it does not populate the detail cache.
- **The persistent cache is always on.** It is strictly better than the
  in-memory cache and needs no toggle. It delivers the offline win
  independently of the position feature.
- **Alarms fire for Hazard points of interest** at `alert` state. Other types
  are out of scope for Tier 1; the module is structured so more types can be
  added later.
- **No new dependencies.** Position comes from the SignalK app, alarms through
  `app.handleMessage`, the persistent cache through `node:fs`, and the rating
  filter and freshness logic are pure.

## 3. New configuration

Added to `PluginConfig` and the `plugin.schema`:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `enableProximityAlarms` | boolean | `false` | Subscribe to position, scan for hazards, and emit alarms. |
| `proximityAlarmRadiusMeters` | number | `500` | Alarm when a hazard is within this distance. |
| `minimumRating` | number | `0` | Hide points of interest whose average rating is below this (0 to 5; 0 shows all). |

## 4. Modules

New files under `src/`:

- `positionMonitor.ts` - subscribes to `navigation.position` through the
  SignalK app, throttles updates (act when the vessel has moved a meaningful
  distance, and not more than once per minute), and on each tick lists the
  points of interest in a bounding box around the vessel and runs a
  proximity-alarm evaluation. Created in `start()` only when
  `enableProximityAlarms` is on,
  and fully torn down in `stop()` (unsubscribe, clear timers).
- `proximityAlarms.ts` - given the vessel position and the nearby points of
  interest, emits a SignalK notification delta for each Hazard within the
  configured radius. Hysteresis: a notification is raised once on entry and
  cleared (state `normal`) once on exit; it never re-fires every tick.
- `poiStore.ts` - a disk-backed key-value store of point-of-interest detail in
  the plugin data directory, used to hydrate `poiCache` on start and persist
  on write. Honours the cache TTL: entries older than the configured window
  are dropped on load.
- `ratingFilter.ts` - a pure function that drops `PoiSummary` entries whose
  rating is below `minimumRating`.

Existing files that change:

- `types.ts` - the three new `PluginConfig` keys; `PoiSummary` gains an
  optional `rating` and `reviewCount`.
- `index.ts` - the schema additions, and the wiring of the position monitor,
  the rating filter, and the persistent cache.
- `activeCaptainClient.ts` - `listPointsOfInterest` carries the bounding-box
  response's `reviewSummary` rating into `PoiSummary`.
- `poiCache.ts` - hydrate from and persist to `poiStore` on a real load.
- `handlebarsUtilities.ts`, `templates.ts` - a prominent stale-report warning
  for Hazard points of interest.
- `src/panel/` - panel controls for the three new options.

## 5. Notifications

`proximityAlarms` emits, through `app.handleMessage`, a delta updating
`notifications.navigation.activecaptain.hazard.<poiId>` with value
`{ state: 'alert', method: ['visual', 'sound'], message, timestamp }` on
entry, and the same path with `state: 'normal'` on exit. The message names the
hazard and its distance.

## 6. Testing

`node:test` unit tests for every new module: the throttle and teardown of the
position monitor, the alarm hysteresis (enter once, clear once, no re-fire),
the persistent store round-trip and TTL expiry on load, and the rating filter.
The hazard-freshness rendering is covered by the Handlebars test file.

## 7. Out of scope for Tier 1

Alarms for bridges, locks, and inlets; route-corridor scanning; the developer
API. These are Tier 2 and Tier 3 in `docs/roadmap.md`.
