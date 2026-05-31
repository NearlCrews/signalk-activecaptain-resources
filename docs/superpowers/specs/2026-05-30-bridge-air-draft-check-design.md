# Bridge air-draft check: design

Date: 2026-05-30
Status: approved, pending implementation plan

## Summary

Warn the crew when a bridge they are approaching, or a bridge on their active
route ahead, has a vertical clearance at or below the vessel's air draft. The
feature compares each bridge POI's clearance against the vessel air draft plus
a configurable safety margin and raises a SignalK notification when the bridge
would not clear.

Two triggers, reusing the plugin's existing position-driven machinery:

- **Proximity:** a new output raises an `alarm` when the vessel comes within
  the proximity radius of a too-low bridge.
- **Route-ahead:** the existing route-hazard output raises a `warn`, with
  distance and ETA, when a too-low bridge lies in the active Course API route
  corridor.

## Decisions locked during brainstorming

- Trigger model: both proximity (`alarm`) and route-ahead (`warn`).
- Clearance sources: OpenSeaMap and ActiveCaptain.
- Air draft: read `design.airHeight` (SI meters) first, then a plugin-config
  fallback, else the feature is inert and logs once.
- Safety margin: configurable, default 1 m (about 3 ft). The warning fires when
  `clearance <= airDraft + margin`. The user can set the margin to 0 for a
  strict check.

## Architecture

A single shared module owns the comparison rules. Two consumers act on the
result: a new proximity output and the existing route-hazard output. Clearance
data rides on the POI data shapes so the synchronous per-tick scan can read it
without blocking.

### ActiveCaptain clearance: lazy detail resolver

ActiveCaptain's `bridgeHeight` lives only in the per-POI detail response, not in
the list summary the scan sees. A shared `BridgeClearanceResolver` resolves a
bridge's clearance:

- If the summary already carries `verticalClearanceMeters` (OpenSeaMap, or a
  value carried over by the dedupe merge), return it synchronously.
- For an ActiveCaptain bridge with no clearance yet, kick off a deduped,
  TTL-and-disk-cached `pois.getDetails(id)` and return "unknown for now." The
  resolved clearance is cached in the resolver and applied on a later tick.

`evaluate` stays synchronous. The scan box is far wider than the alarm radius
(route look-ahead is 10 nm), so a one-tick lag before an ActiveCaptain bridge's
clearance is known is harmless. No new plumbing is needed: `OutputContext.pois`
already exposes `getDetails`.

The rejected alternative was a cache-only resolver that never fetches. It is
trivial but populates ActiveCaptain clearance only when a bridge's detail was
already fetched for some other reason (for example the user opened its note),
so ActiveCaptain would contribute almost nothing in practice.

## Components and files

### New

- `src/shared/bridge-clearance.ts`
  - `readVesselAirDraft(app, fallbackMeters): number | null`: reads
    `design.airHeight` (SI meters) via `app.getSelfPath`, validates finite and
    positive, then falls back to `fallbackMeters` when that is finite and
    positive, else returns `null`.
  - `bridgeBlocksVessel(clearanceMeters, airDraftMeters, marginMeters): boolean`:
    true when `clearanceMeters <= airDraftMeters + marginMeters`, guarding
    non-finite inputs.
  - Margin bounds (`MIN_CLEARANCE_MARGIN_METERS`,
    `MAX_CLEARANCE_MARGIN_METERS`, `DEFAULT_CLEARANCE_MARGIN_METERS = 1`) plus
    `clampClearanceMargin`, mirroring the `year-filter.ts` and `rating.ts`
    shared-bounds pattern.
  - Config-fragment builders `enableBridgeAirDraftSchema`,
    `vesselAirDraftSchema`, and `clearanceMarginSchema`.
- `src/outputs/bridge-air-draft/bridge-air-draft-output.ts`: the new
  `OutputModule`. Owns the three config keys, contributes a
  `PositionScanContributor` (`poiTypes: ['Bridge']`, a vessel-proximity fetch
  box), raises `alarm`.
- `src/outputs/bridge-air-draft/bridge-clearance-alarms.ts`: the raise-once,
  clear-once evaluator, mirroring `proximity-alarms.ts`. Path
  `notifications.navigation.crowsNest.bridgeClearance.<poiId>`, source suffix
  `bridge`, the same 1.2x exit-radius hysteresis.
- `src/outputs/bridge-air-draft/bridge-clearance-resolver.ts`: the resolver
  described above (synchronous hit, async ActiveCaptain fetch, an internal
  `Map<id, number | null>` cache, deduped in-flight fetches).
- `src/panel/components/BridgeAirDraftFields.tsx`: the third control group in
  the panel's Alerts section.

### Modified

- `src/shared/types.ts`: add optional `verticalClearanceMeters?: number` (SI
  meters) to `PoiSummary` and `PoiDetailView`; add `enableBridgeAirDraftCheck`,
  `vesselAirDraftMeters`, and `bridgeClearanceMarginMeters` to `PluginConfig`.
- `src/inputs/openseamap/`: parse `seamark:bridge:clearance_height`, then
  `maxheight` and `clearance`, into `verticalClearanceMeters` at list time.
  Defensive parsing: bare numeric meters, `"3.5 m"`, feet and feet-inches
  (`"11 ft"`, `"10'6\""`), with `default`, `none`, `unsigned`, and any
  unparseable value treated as unknown.
- `src/inputs/active-captain/`: populate `PoiDetailView.verticalClearanceMeters`
  from `NavigationSection.bridgeHeight`, converted by `distanceUnit` (feet or
  meters). An absent or unrecognized `distanceUnit` yields unknown, never a
  guess, because a wrong feet-versus-meters conversion is a safety bug.
- `src/inputs/dedupe-pois.ts`: carry `verticalClearanceMeters` onto the
  surviving base POI when a duplicate merges in, preferring the more
  conservative (smaller) value when both are present.
- `src/outputs/route-hazard/route-hazard-output.ts` and `route-hazard-alarms.ts`:
  when the check is enabled, annotate corridor bridges with the clearance
  verdict and emit a clearance-specific `warn` message. Bridges that fit, or
  whose clearance is unknown, keep today's generic message. `route-corridor.ts`
  stays pure geometry: the verdict is applied between the scan and the alarms.
- `src/index.ts`: register the new output.
- Panel: `AlertsSection.tsx` (mount the new control group), `config-reducer.ts`
  (handle the new keys), and `normalize-config.ts` (clamp the margin).

## Data flow

1. Inputs attach `verticalClearanceMeters` where they can: OpenSeaMap at list
   time, ActiveCaptain at detail time. The dedupe pass carries it across merges.
2. On each position tick, the proximity output scans `Bridge` POIs near the
   vessel; the route output scans bridges in the route corridor.
3. Both read the vessel air draft via `readVesselAirDraft`, get each bridge's
   clearance via the shared resolver, and apply
   `bridgeBlocksVessel(clearance, airDraft, margin)`.
4. Too low: the proximity output raises `alarm`; the route output raises `warn`
   with distance and ETA. Both raise once and clear once.

## Configuration and activation

Three new config keys, all declared by the new output, grouped in the panel's
Alerts section:

- `enableBridgeAirDraftCheck` (boolean, default false)
- `vesselAirDraftMeters` (optional fallback air draft in meters; 0 or unset
  means use `design.airHeight` only)
- `bridgeClearanceMarginMeters` (default 1, clamped to the shared bounds)

Activation:

- The proximity bridge alarm is active when `enableBridgeAirDraftCheck` is true.
- The route bridge-clearance upgrade is active when `enableBridgeAirDraftCheck`
  and `enableRouteHazardScan` are both true, since it rides the route scan the
  route-hazard output already performs.
- The route-hazard output only reads these keys; it does not redeclare them, so
  each key has a single schema declaration.

## Error handling and edge cases

- Air draft unknown (no `design.airHeight`, no fallback): both halves are inert
  and log once. The air draft is re-read each tick, so the feature activates if
  `design.airHeight` appears later.
- Clearance unknown for a bridge: silent, no alarm. v1 does not warn on
  unknown-clearance bridges; the bridge still appears as a normal POI.
- ActiveCaptain `distanceUnit` absent or unrecognized: clearance unknown, no
  guess.
- OpenSeaMap `maxheight` of `default`, `none`, `unsigned`, or any unparseable
  value: unknown.
- Non-finite distance: skip and log at debug, matching the existing alarm
  pattern. The margin is clamped to `[MIN, MAX]`.
- The notification message states that the comparison is against the charted or
  tagged clearance, so the margin is the user's allowance for tide, datum, and
  loading.

## Testing

`node:test` suites, new and extended:

- `readVesselAirDraft`: `design.airHeight` present, absent with fallback, both
  absent yields `null`.
- `bridgeBlocksVessel`: margin applied, exact-equality fires, non-finite inputs
  do not fire. `clampClearanceMargin` bounds.
- OpenSeaMap clearance parsing: meters numeric, `"3.5 m"`, feet, feet-inches,
  `default` and `none` and missing to unknown.
- ActiveCaptain `bridgeHeight` conversion: feet to meters, meters passthrough,
  unknown unit to unknown, missing to unknown.
- Dedupe carry-over: surviving base POI takes the conservative clearance.
- Resolver: synchronous OpenSeaMap hit, ActiveCaptain fetch then cache,
  `getDetails` error yields unknown without crashing.
- Proximity bridge alarm hysteresis: raise once, clear once.
- Route clearance-message upgrade: too-low bridge gets the clearance message;
  an unknown-clearance or fitting bridge keeps the generic message; an unknown
  air draft keeps the generic message.
- Panel: `normalize-config` clamps the margin, the reducer handles the new keys,
  and `BridgeAirDraftFields` renders.

## Docs and version

- README: refresh "What's New" to the new version, add the feature to Features
  and Configuration.
- CHANGELOG: a new `v0.7.0` entry (this is a feature).
- CLAUDE.md: document the new output directory, the shared `bridge-clearance.ts`
  module, the `verticalClearanceMeters` fields, the OpenSeaMap and ActiveCaptain
  clearance parsing, the dedupe carry-over, and the panel component.
- `docs/roadmap.md`: record the feature and append the new-source candidates
  surfaced in the same session (NOAA CO-OPS tide and current stations, AIS Aids
  to Navigation read from SignalK, and the World Port Index).

After implementation: run `/simplify` on the diff and fix every finding
including nits, then `npm run lint`, `npm run typecheck`, `npm test`, and
`npm run build`, all green.

Out of scope unless requested: tagging or publishing a release. The version bump
and the docs are in scope; pushing, tagging, and publishing are not.

## Defaulted minor decisions

1. The proximity bridge alarm reuses `proximityAlarmRadiusMeters` (default
   500 m) as the shared "near the vessel" radius rather than adding a fourth
   config field.
2. Unknown-clearance bridges stay silent rather than emitting an "unverified
   clearance" advisory.
