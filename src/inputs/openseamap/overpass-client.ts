/**
 * HTTP client for the OpenStreetMap Overpass API.
 *
 * Builds Overpass QL queries, sends them to the configured endpoint, and
 * normalizes the responses. Concurrency, throttling, retry/backoff,
 * Retry-After honoring, and close() all live in the shared HTTP client (see
 * `../http-client.js`); this module owns only the Overpass-specific endpoint,
 * headers, query building, and response shape.
 *
 * Overpass-specific behavior:
 *  - Every request is a POST whose body is an Overpass QL query.
 *  - A descriptive `User-Agent` header is REQUIRED by the Overpass usage
 *    policy and is sent on every request.
 *  - A requested bounding box is clamped to a maximum span, so a wide box
 *    cannot build a query that hits the server's runtime limit. Distant
 *    points of interest are picked up on a later, recentered request.
 *
 * Error contract: both query methods REJECT on any HTTP, network, or parsing
 * failure. `getById` resolves with `undefined` for a query that succeeds but
 * matches no element, which is how a deleted OSM element reads.
 */

import { assertResponseOk, createHttpClient, type RateLimitOptions } from '../http-client.js'
import type { Bbox, Logger, Position } from '../../shared/types.js'

// No OpenSeaMap consumer inspects the HTTP status of a failed request: a
// not-found element is returned by Overpass as an empty result, not a 404. So
// `HttpError` is intentionally NOT re-exported here. `RateLimitOptions` is
// re-exported because the test suite imports it for fast-retry overrides.
export type { RateLimitOptions } from '../http-client.js'

/** OSM element types the Overpass API addresses. */
export type OsmElementType = 'node' | 'way' | 'relation'

/**
 * One Overpass element, normalized for the OpenSeaMap source. The Overpass
 * wire element carries `lat`/`lon` for a node and a `center` for a way or a
 * relation; both are resolved here into a single `position`.
 */
export interface OverpassElement {
  /** OSM element type. */
  type: OsmElementType
  /** Numeric OSM element id, unique only within its element type. */
  id: number
  /** OSM tags carried on the element; the source renders detail from these. */
  tags: Record<string, string>
  /** Resolved position. */
  position: Position
}

/** Descriptive User-Agent, required by the Overpass API usage policy. */
const USER_AGENT = 'signalk-crows-nest Signal K plugin'

/** Headers sent on every Overpass request. */
const BASE_HEADERS: Readonly<Record<string, string>> = {
  'User-Agent': USER_AGENT,
  'Content-Type': 'text/plain',
  Accept: 'application/json'
}

/** Server-side runtime budget, in seconds, for a bounding-box list query. */
const LIST_QUERY_TIMEOUT_SECONDS = 60

/** Server-side runtime budget, in seconds, for a single-element detail query. */
const DETAIL_QUERY_TIMEOUT_SECONDS = 25

/**
 * Per-request HTTP timeout, in milliseconds. It sits above the server-side
 * query budget so the client waits for a slow-but-progressing query rather
 * than aborting it.
 */
const REQUEST_TIMEOUT_MS = 70000

/**
 * Maximum span, in degrees, of either edge of a queried bounding box. A wider
 * box is clamped around its center: a single Overpass query stays small enough
 * to finish inside its runtime budget, and distant points of interest are
 * picked up on a later request once the vessel has moved.
 */
const MAX_BBOX_SPAN_DEGREES = 2

/**
 * Rate-limiting defaults. The public Overpass endpoints publish a strict usage
 * policy, so the client stays a conservative citizen: a low concurrency cap, a
 * one-second steady-state spacing, and exponential backoff with full jitter.
 */
const DEFAULTS: RateLimitOptions = {
  maxConcurrency: 2,
  minDelayMs: 1000,
  backoffBaseMs: 2000,
  maxBackoffMs: 60000,
  maxRetries: 3
}

/** Public surface of the Overpass client. */
export interface OverpassClient {
  /**
   * List elements within a bounding box whose `seamark:type` tag matches the
   * given alternation regex, plus every `leisure=marina`. Resolves with a
   * normalized array (possibly empty). Rejects on any failure.
   */
  listPointsOfInterest: (bbox: Bbox, seamarkRegex: string) => Promise<OverpassElement[]>
  /**
   * Fetch one element by its typed id (`node/123`, `way/456`,
   * `relation/789`). Resolves with the element, or `undefined` when the query
   * succeeds but the element no longer exists. Rejects on any failure.
   */
  getById: (typedId: string) => Promise<OverpassElement | undefined>
  /**
   * Abort any in-flight requests and stop retrying. Call this from
   * plugin.stop so a late response cannot record onto a later run's state.
   */
  close: () => void
}

/**
 * Clamp one bounding-box edge to at most `maxSpan` degrees, keeping its
 * midpoint fixed. A box already within the span is returned unchanged.
 */
function clampSpan (low: number, high: number, maxSpan: number): [number, number] {
  const span = high - low
  if (span <= maxSpan) {
    return [low, high]
  }
  const center = (low + high) / 2
  return [center - maxSpan / 2, center + maxSpan / 2]
}

/** Clamp both edges of a bounding box to {@link MAX_BBOX_SPAN_DEGREES}. */
function clampBbox (bbox: Bbox): Bbox {
  const [south, north] = clampSpan(bbox.south, bbox.north, MAX_BBOX_SPAN_DEGREES)
  const [west, east] = clampSpan(bbox.west, bbox.east, MAX_BBOX_SPAN_DEGREES)
  return { south, north, west, east }
}

/**
 * Build the Overpass QL for a bounding-box list query. The global `[bbox:...]`
 * setting uses the Overpass `south,west,north,east` order, and applies to
 * every statement in the query. `out center tags` returns full tags and, for
 * a way or a relation, a representative center point.
 */
function buildListQuery (bbox: Bbox, seamarkRegex: string): string {
  const { south, west, north, east } = clampBbox(bbox)
  return (
    `[out:json][timeout:${LIST_QUERY_TIMEOUT_SECONDS}][bbox:${south},${west},${north},${east}];` +
    '(' +
    `nwr["seamark:type"~"${seamarkRegex}"];` +
    // OpenStreetMap tags most marinas with `leisure=marina` rather than a
    // `seamark:type`, so they are fetched alongside the seamark features.
    'nwr["leisure"="marina"];' +
    ');' +
    'out center tags;'
  )
}

/** Build the Overpass QL for a single-element detail query. */
function buildDetailQuery (type: OsmElementType, id: number): string {
  return (
    `[out:json][timeout:${DETAIL_QUERY_TIMEOUT_SECONDS}];` +
    `${type}(id:${id});` +
    'out center tags;'
  )
}

/**
 * Parse a typed OSM id (`node/123`) into its element type and numeric id.
 * Throws on a malformed id rather than issuing a guaranteed-empty query.
 */
function parseTypedId (typedId: string): { type: OsmElementType, id: number } {
  const slash = typedId.indexOf('/')
  const type = slash > 0 ? typedId.slice(0, slash) : ''
  const id = Number(typedId.slice(slash + 1))
  if (
    (type !== 'node' && type !== 'way' && type !== 'relation') ||
    !Number.isInteger(id) || id <= 0
  ) {
    throw new Error(`Invalid OSM element id "${typedId}"`)
  }
  return { type, id }
}

/** A single element as it arrives on the Overpass wire. */
interface OverpassWireElement {
  type?: string
  id?: number
  lat?: number
  lon?: number
  center?: { lat?: number, lon?: number }
  tags?: Record<string, string>
}

/** Response body of an Overpass query. */
interface OverpassResponse {
  elements?: OverpassWireElement[]
}

/**
 * Normalize one wire element, resolving its position from `lat`/`lon` (a node)
 * or `center` (a way or a relation). Returns null for an element missing the
 * fields the source needs, so one bad element cannot fail the whole list.
 */
function parseElement (wire: OverpassWireElement): OverpassElement | null {
  if (wire == null) {
    return null
  }
  const type = wire.type
  if (type !== 'node' && type !== 'way' && type !== 'relation') {
    return null
  }
  if (!Number.isFinite(wire.id)) {
    return null
  }
  const lat = wire.lat ?? wire.center?.lat
  const lon = wire.lon ?? wire.center?.lon
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }
  return {
    type,
    id: wire.id as number,
    tags: wire.tags ?? {},
    position: { latitude: lat as number, longitude: lon as number }
  }
}

/**
 * Create an Overpass client.
 *
 * @param endpoint The Overpass interpreter URL every query is POSTed to.
 * @param log      Logging surface used for diagnostics.
 * @param options  Optional rate-limit overrides. Mainly used by tests to keep
 *                 them fast; production callers can pass just the endpoint and
 *                 the logger.
 */
export function createOverpassClient (
  endpoint: string,
  log: Logger,
  options: Partial<RateLimitOptions> = {}
): OverpassClient {
  const http = createHttpClient(log, {
    label: 'Overpass',
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    defaults: DEFAULTS
  }, options)

  /** Run an Overpass QL query and return its parsed, normalized elements. */
  async function runQuery (query: string, errorPrefix: string): Promise<OverpassElement[]> {
    const response = await http.fetch(endpoint, {
      method: 'POST',
      headers: { ...BASE_HEADERS },
      body: query
    })

    await assertResponseOk(response, errorPrefix)

    const data = await response.json() as OverpassResponse
    if (!Array.isArray(data?.elements)) {
      throw new Error('Overpass response missing the elements array')
    }

    const parsed: OverpassElement[] = []
    for (const wire of data.elements) {
      const element = parseElement(wire)
      if (element !== null) {
        parsed.push(element)
      }
    }
    const skipped = data.elements.length - parsed.length
    if (skipped > 0) {
      log.debug(`Skipped ${skipped} malformed Overpass element(s)`)
    }
    return parsed
  }

  async function listPointsOfInterest (
    bbox: Bbox, seamarkRegex: string
  ): Promise<OverpassElement[]> {
    try {
      return await runQuery(
        buildListQuery(bbox, seamarkRegex),
        'Overpass list request failed'
      )
    } catch (error) {
      log.debug(`ERROR fetching Overpass elements ${JSON.stringify(bbox)} - ${String(error)}`)
      throw error
    }
  }

  async function getById (typedId: string): Promise<OverpassElement | undefined> {
    const { type, id } = parseTypedId(typedId)
    try {
      const elements = await runQuery(
        buildDetailQuery(type, id),
        `Overpass detail request failed for ${typedId}`
      )
      // An empty result is the API answering normally: the element has been
      // deleted from OpenStreetMap. The source turns this into a "not found".
      return elements[0]
    } catch (error) {
      log.debug(`ERROR fetching Overpass element ${typedId} - ${String(error)}`)
      throw error
    }
  }

  return {
    listPointsOfInterest,
    getById,
    close: () => { http.close() }
  }
}
