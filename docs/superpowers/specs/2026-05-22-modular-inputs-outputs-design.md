# Modular inputs and outputs: design

Date: 2026-05-22
Status: approved for planning

## Goal

Restructure `signalk-crows-nest` so that adding a new POI data source (an
"input") or a new SignalK consumer of POI data (an "output") is a small,
well-defined task: write one self-contained module, register it on one line.

This is a pure restructuring. No runtime behavior changes. All existing tests
stay green.

## Constraints

- The repository's architectural rule holds: ONE npm package, ONE Signal K
  plugin, modular TypeScript files under `src/`. Directories under `src/` are
  fine; additional npm packages or a monorepo are not.
- No behavior change: identical `notes` resource shapes, `$source`
  attribution, hazard and route notifications (same hysteresis), status API,
  404 handling, and monitor scan sizing.
- The webpack-exposed Module Federation name `./PluginConfigurationPanel`
  stays exactly as-is; the SignalK admin UI looks it up by that name.
- All 212 existing tests stay green.

## Concepts

### Input: `PoiSource` and `InputModule`

A `PoiSource` is one upstream provider of points of interest:

```ts
interface PoiSource {
  readonly id: string                       // e.g. 'activecaptain'
  listPointsOfInterest (bbox: BoundingBox, poiTypes: string): Promise<PoiSummary[]>
  getPointOfInterest (id: string): Promise<PoiDetailEntity>
  cacheSize (): number                       // entries held for the status panel
  close (): void
}
```

An `InputModule` packages a source for registration:

```ts
interface InputModule {
  readonly id: string
  readonly name: string
  readonly configSchema: Record<string, JSONSchema7>   // merged into plugin schema
  isEnabled (config: PluginConfig): boolean
  createSource (context: InputContext): PoiSource
}
```

`InputContext` provides the `ServerAPI`, the resolved `PluginConfig`, and the
plugin data directory path.

### Output: `OutputModule`

An `OutputModule` is one consumer of POI data:

```ts
interface OutputModule {
  readonly id: string
  readonly name: string
  readonly configSchema: Record<string, JSONSchema7>
  isEnabled (config: PluginConfig): boolean
  // Position-driven outputs declare what the shared monitor must scan for.
  // Pull-only outputs (the notes provider) return null.
  positionRequirements (config: PluginConfig): PositionRequirement | null
  start (context: OutputContext): OutputHandle
}

interface PositionRequirement {
  poiTypes: string[]
  minScanRadiusMeters: number
}

interface OutputHandle { stop (): void }
```

`OutputContext` provides the `ServerAPI`, the resolved `PluginConfig`, the
aggregate `PoiSource`, the `PluginStatus` recorder, and a `PositionFeed`
(present only when at least one position-driven output is enabled).

### Position feed

`position-monitor.ts` becomes shared infrastructure exposed as a
`PositionFeed`. It runs when any position-driven output is enabled, subscribes
to `navigation.position` once, scans for POIs using the union of every enabled
output's `PositionRequirement` (union of `poiTypes`, max of
`minScanRadiusMeters`), and fans each tick out to subscribers:

```ts
interface PositionFeed {
  subscribe (handler: (tick: PositionTick) => void): () => void
}
interface PositionTick { position: Position, pois: PoiSummary[] }
```

For the two current position-driven outputs the union yields the same
`poiTypes` and `scanRadiusMeters` the monitor computes today, so the scan
behavior is unchanged.

### Registries

- `InputRegistry` holds the registered `InputModule`s and exposes a single
  aggregate `PoiSource`. With one enabled source it is pass-through. It is the
  seam for future multi-source merging (see Deferred work).
- `OutputRegistry` holds the registered `OutputModule`s, computes the merged
  position requirement, and starts/stops the enabled outputs.

## Directory layout

```
src/
  index.ts                       thin: build registries, call createPlugin
  plugin/
    plugin.ts                    createPlugin: schema assembly, start/stop lifecycle
    plugin-config.ts             PluginConfig type, schema-fragment merge
  inputs/
    poi-source.ts                PoiSource + InputModule + InputContext interfaces
    input-registry.ts
    active-captain/
      active-captain-input.ts    the InputModule (owns its config fragment)
      active-captain-client.ts   (was activeCaptainClient.ts)
      active-captain-types.ts    AC wire types (moved out of types.ts)
      poi-cache.ts               (was poiCache.ts)
      poi-store.ts               (was poiStore.ts)
      poi-detail-renderer.ts     (was handlebarsUtilities.ts)
      templates.ts
      poi-type-selection.ts      (was poiTypeSelection.ts)
      rating-filter.ts           (was ratingFilter.ts)
  outputs/
    output.ts                    OutputModule/OutputContext/OutputHandle/
                                 PositionFeed/PositionTick interfaces
    output-registry.ts
    notes-resource/
      notes-resource-output.ts   registers the SignalK notes provider
      note-builder.ts            buildNoteResource + readProperty (from index.ts)
      resource-query.ts          (was resourceQuery.ts)
    proximity-alarm/
      proximity-alarm-output.ts
      proximity-alarms.ts
    route-hazard/
      route-hazard-output.ts
      route-hazard-alarms.ts     (was routeHazardAlarms.ts)
      route-corridor.ts          (was routeCorridor.ts)
      course-reader.ts           (was courseReader.ts)
  monitoring/
    position-monitor.ts          becomes the PositionFeed
  geo/
    position-utilities.ts        (was positionUtilities.ts)
  status/
    plugin-status.ts             (was pluginStatus.ts)
    status-router.ts             (was statusRouter.ts)
    status-types.ts              (was statusTypes.ts)
  shared/
    types.ts                     cross-module domain types only
    plugin-id.ts                 (was pluginId.ts)
  panel/                         files renamed; structure unchanged
```

## File naming

- All non-component `.ts` files: kebab-case.
- React component `.tsx` files keep PascalCase (dominant React convention,
  TS-compliant). Non-component panel `.ts` files (`configReducer.ts` ->
  `config-reducer.ts`, `normaliseConfig.ts` -> `normalise-config.ts`,
  `poiTypeGroups.ts` -> `poi-type-groups.ts`, `styles.ts`, hooks) go kebab-case.
- Test files are renamed to match their module and updated to the new import
  paths.

## Config schema assembly

`index.ts` currently holds one literal JSON schema. Instead:

- Each `InputModule` and `OutputModule` exposes a `configSchema` properties
  fragment.
- `plugin-config.ts` merges the fragments in registration order under the
  schema's `properties`, with `required: ['cachingDurationMinutes']` and the
  plugin title/description as the schema shell.
- Field ownership:
  - ActiveCaptain input: `cachingDurationMinutes`, the 13 `includeX` toggles,
    `minimumRating`.
  - proximity-alarm output: `enableProximityAlarms`,
    `proximityAlarmRadiusMeters`.
  - route-hazard output: `enableRouteHazardScan`, `routeCorridorWidthMeters`.
- The React panel reads and writes the same flat config object, so panel
  components are unchanged apart from file renames.

## Plugin lifecycle (`plugin.ts`)

`createPlugin(app, inputRegistry, outputRegistry)` returns the SignalK
`Plugin`:

- `schema`: assembled from the registries' config fragments.
- `start(config)`:
  1. Tear down any prior runtime (idempotent guard, as today).
  2. Resolve `PluginConfig` from raw options with defaults.
  3. Build the aggregate `PoiSource` from enabled `InputModule`s.
  4. Compute the merged `PositionRequirement` from enabled
     position-driven outputs; if non-empty, build the `PositionFeed`.
  5. Start each enabled `OutputModule`, collecting `OutputHandle`s.
  6. Status is a fresh `PluginStatus` recorder per start, shared via context.
- `stop()`: stop every `OutputHandle`, stop the `PositionFeed`, close the
  aggregate `PoiSource`, drop the runtime.
- `registerWithRouter`: the status router, reading the live snapshot plus the
  aggregate source's `cacheSize()`.
- `getOpenApi`: unchanged.

If an optional output fails to start, the failure is logged and the remaining
outputs still start, matching today's behavior for the position monitor.

## Status wiring

`PluginStatus` stays a shared recorder passed through `OutputContext`. The
ActiveCaptain input's cache records detail outcomes (success, 404-as-success,
error) into it; the notes-resource output records list-fetch outcomes. The
status router reports the snapshot plus `cacheSize()` from the aggregate
source.

## Behavior preservation checklist

- `notes` resource list and single-resource shapes, including `$source`,
  `properties.readOnly`, `properties.skIcon`, `mimeType`, and `timestamp`
  omission rules.
- Read-only `setResource`/`deleteResource` rejections.
- Proximity and route notifications: same paths, messages, hysteresis,
  raise-once / clear-once semantics.
- 404 detail responses treated as a normal answer, not a reachability failure.
- Monitor scan radius and `poiTypes` identical to today for the current
  outputs.
- Status API payload and admin gating.
- `./PluginConfigurationPanel` Module Federation name unchanged.

## Build configuration updates

- `webpack.config.cjs`: update the exposed-module path
  (`./src/panel/index.tsx` -> renamed entry path). The exposed name stays
  `./PluginConfigurationPanel`.
- `tsconfig*.json` use glob includes (`src/**/*`, `test/**/*`), so the
  directory restructure needs no `include` edits; verify after the move.
- `package.json` `files` field still publishes `dist/` and `public/` only;
  no change expected, verified after the move.

## Testing

- Existing tests are moved and kebab-renamed, with import paths updated. Their
  assertions are unchanged.
- New focused tests:
  - `input-registry`: aggregate source delegates to the one enabled source;
    disabled modules are excluded.
  - `output-registry`: position requirement is the union of enabled outputs;
    `start`/`stop` propagate to handles.
  - `plugin-config`: schema fragments merge into one `properties` object with
    the expected fields and `required` entry.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all
  pass before the work is considered done.

## Deferred work (out of scope)

These are explicitly NOT in this restructuring. The interfaces above are the
seam that makes them small later:

- Multi-source result merging and POI-id namespacing. With more than one
  source, list results must be concatenated and ids namespaced
  (`<sourceId>:<rawId>`), which changes the resource ids SignalK sees. That is
  a behavior change and belongs to the "add input #2" task.
- A dynamic, schema-driven panel. New outputs still need a hand-written panel
  component to render their config fields; the server's default schema-driven
  form covers them in the meantime.

## Execution plan

A 4-agent team implements the written plan:

1. Inputs lane: `src/inputs/`, `PoiSource`/`InputModule` interfaces, the
   ActiveCaptain input module, cache, store, renderer, templates, type
   selection, rating filter.
2. Outputs core: `src/outputs/output.ts`, `output-registry.ts`, the
   notes-resource output, note builder, resource query.
3. Position-driven outputs: proximity-alarm and route-hazard outputs,
   `monitoring/position-monitor.ts` as the `PositionFeed`, course reader,
   route corridor.
4. Plugin shell: `index.ts`, `plugin/`, config assembly, `status/`, `shared/`,
   `geo/`, panel file renames, build-config updates, test migration.

Agents coordinate edits to `index.ts` and the build configs through the shared
task list to avoid conflicts.

## Documentation follow-up

After implementation, update `CLAUDE.md` (the Layout section) and any
affected `docs/` files so they describe the new directory structure.
