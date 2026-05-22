/**
 * Shared type contracts for the signalk-crows-nest plugin.
 *
 * This module is the single source of truth for the data shapes that flow
 * between the plugin's input, output, and shared modules under `src/`. It also
 * describes the subset of the ActiveCaptain wire types that the plugin
 * consumes, based on observed responses from
 * https://activecaptain.garmin.com/community/api/v1. Sections and fields the
 * plugin does not render are intentionally omitted.
 */

/** A geographic point. Matches both SignalK and ActiveCaptain conventions. */
export interface Position {
  latitude: number
  longitude: number
}

/** A geographic bounding box, in degrees. */
export interface Bbox {
  north: number
  south: number
  east: number
  west: number
}

/**
 * The vessel's active route resolved into a forward-looking polyline, ready for
 * a route-corridor hazard scan. Produced by `course-reader.ts`'s
 * `getRouteAhead()`.
 *
 * The path ahead of the vessel is `[vesselPosition, ...waypoints]`, with
 * `vesselPosition` dropped when there is no fix. `vesselPosition` is kept
 * separate from `waypoints` so a consumer can choose whether the first corridor
 * segment starts at the vessel or at the next route waypoint.
 */
export interface RoutePolyline {
  /** Resource id of the active route, the final path segment of its href. */
  routeId: string
  /** Route name reported by the Course API, when one is set. */
  name?: string
  /** Vessel position when the route was read, or null when there is no fix. */
  vesselPosition: Position | null
  /**
   * Route waypoints ahead of the vessel, ordered from the next waypoint to the
   * route end, already adjusted for route direction: a route followed in
   * reverse is returned in travel order. Never empty.
   */
  waypoints: Position[]
}

/**
 * A snapshot of the vessel's own navigation data, used to scope a route scan.
 * Produced by `course-reader.ts`'s `getVesselState()`.
 */
export interface VesselState {
  /** Current position, or null when there is no fix. */
  position: Position | null
  /** Speed over ground in meters per second, or null when unavailable. */
  speedOverGround: number | null
}

/** A point of interest flagged by the route-corridor scan as lying on or near the route. */
export interface CorridorPoi {
  /** The ActiveCaptain point-of-interest id. */
  id: string
  /** The point-of-interest type; always one of Hazard, Bridge, or Lock. */
  type: PoiType
  /** The point-of-interest name. */
  name: string
  /** The point-of-interest location. */
  position: Position
  /** Distance, in meters, the vessel must travel along the route to draw level with this point. */
  alongTrackDistanceMeters: number
  /** Signed perpendicular distance, in meters, from the point to the route: + right of travel, - left. */
  crossTrackDistanceMeters: number
  /** Estimated time, in seconds, until the vessel draws level with the point; absent when no usable speed is known. */
  etaSeconds?: number
}

/** Minimal logging surface used by the plugin modules (a subset of the SignalK app). */
export interface Logger {
  debug: (message: string) => void
  error: (message: string) => void
}

/**
 * The categories of point of interest exposed by ActiveCaptain. The values are
 * the exact strings the API expects and returns.
 */
export type PoiType =
  | 'Marina'
  | 'Anchorage'
  | 'Hazard'
  | 'Business'
  | 'BoatRamp'
  | 'Bridge'
  | 'Dam'
  | 'Ferry'
  | 'Inlet'
  | 'Lock'
  | 'LocalKnowledge'
  | 'Navigational'
  | 'Airport'
  | 'Unknown'

/**
 * Availability flag used throughout the ActiveCaptain summary API. Mostly
 * tri-state (Yes / No / Unknown); some fields also report 'Nearby'.
 */
export type Availability = 'Yes' | 'No' | 'Unknown' | 'Nearby'

/** A free-form note attached to a section of a point of interest. */
export interface PoiNote {
  field: string
  value: string
}

/** Aggregate review score for a point of interest. */
export interface ReviewSummary {
  averageRating: number
  numberOfReviews: number
}

/** A single point of interest as returned by the bounding-box list endpoint. */
export interface PoiListItem {
  id: string
  poiType: PoiType
  mapLocation: Position
  name: string
  reviewSummary?: ReviewSummary
  poiCount?: number
}

/** Response body of the bounding-box list endpoint. */
export interface PoiListResponse {
  pointsOfInterest: PoiListItem[]
}

/** Normalized list entry produced by a source for use inside the plugin. */
export interface PoiSummary {
  id: string
  type: PoiType
  position: Position
  name: string
  /** Source slug that produced this entry, e.g. `activecaptain`. */
  source: string
  /** Public web page for this POI (source-specific). */
  url: string
  /** Human-readable attribution credit for the source. */
  attribution: string
  /** Average review rating (0 to 5), when the list response carries one. */
  rating?: number
  /** Number of reviews behind the rating. */
  reviewCount?: number
}

/**
 * A source-agnostic, fully rendered point-of-interest detail view. Every
 * `PoiSource.getDetails` returns this shape: the source has already rendered
 * its own detail HTML (with an attribution footer), so the `notes` output
 * builds a note from this without knowing which source produced it.
 */
export interface PoiDetailView {
  /** Display name. */
  name: string
  /** Map position. */
  position: Position
  /** POI type, used for the note `skIcon`. */
  type: PoiType
  /** Public web page for this POI (source-specific). */
  url: string
  /** Source slug, e.g. `activecaptain` or `openseamap`. */
  source: string
  /** Human-readable attribution credit for the source. */
  attribution: string
  /** Rendered HTML description, including the attribution footer. Omitted when none. */
  description?: string
  /** ISO-8601 UTC last-modified time, omitted when unknown. */
  timestamp?: string
}

/** Identity and location block present in every summary response. */
export interface PointOfInterest {
  id: number
  name: string
  poiType: PoiType
  mapLocation: Position
  dateLastModified: string
  notes?: PoiNote[]
}

export interface AmenitySection {
  bar?: Availability
  boatRamp?: Availability
  cellReception?: Availability
  courtesyCar?: Availability
  laundry?: Availability
  lodging?: Availability
  pets?: Availability
  restaurant?: Availability
  restroom?: Availability
  shower?: Availability
  transportation?: Availability
  trash?: Availability
  water?: Availability
  wifi?: Availability
  notes?: PoiNote[]
}

export interface BusinessSection {
  cash?: Availability
  check?: Availability
  credit?: Availability
  public?: Availability
  seasonal?: Availability
  notes?: PoiNote[]
}

export interface ContactSection {
  vhfChannel?: string
  phone?: string
  afterHourContact?: string
  email?: string
  website?: string
  addressStreet?: string
  addressCity?: string
  addressZip?: string
  addressState?: string
  addressCountry?: string
}

export interface DockageSection {
  liveaboard?: Availability
  secureAccess?: Availability
  securityPatrol?: Availability
  isFree?: boolean
  /** Total number of berths. */
  total?: number
  /** Number of berths available to transient (visiting) vessels. */
  transient?: number
  notes?: PoiNote[]
}

export interface FuelSection {
  diesel?: Availability
  ethanolFree?: Availability
  gas?: Availability
  propane?: Availability
  electric?: Availability
  notes?: PoiNote[]
}

/** Repair and marine-service trades available at a point of interest. */
export interface ServicesSection {
  boatBrokers?: Availability
  bottomPainting?: Availability
  canvasAndUpholstery?: Availability
  carpentry?: Availability
  charter?: Availability
  electronics?: Availability
  fiberglass?: Availability
  haulOut?: Availability
  marineHvac?: Availability
  mechanical?: Availability
  paint?: Availability
  plumbing?: Availability
  propellerRepair?: Availability
  pumpOut?: Availability
  repair?: Availability
  repairDieselEngines?: Availability
  repairGasEngines?: Availability
  rescueAndSalvage?: Availability
  sailsAndRigging?: Availability
  storage?: Availability
  surveyors?: Availability
  towing?: Availability
  washAndWax?: Availability
  waterTaxi?: Availability
  welding?: Availability
  notes?: PoiNote[]
}

/** Shops and supplies available at a point of interest. */
export interface RetailSection {
  fishingSupplies?: Availability
  grocery?: Availability
  hardware?: Availability
  ice?: Availability
  marineRetail?: Availability
  notes?: PoiNote[]
}

/** Mooring-field details, present mainly on anchorages. */
export interface MooringSection {
  hasMoorings?: Availability
  dinghy?: Availability
  launch?: Availability
  liveaboard?: Availability
  isFree?: boolean
  total?: number
  transient?: number
  notes?: PoiNote[]
}

/** Navigation hazards and constraints, present mainly on anchorages. */
export interface NavigationSection {
  /**
   * Current strength. This is NOT a tri-state availability flag: the API
   * returns a strength word such as 'Weak', 'Moderate', or 'Strong'.
   */
  current?: string
  fixedBridge?: Availability
  /** Fixed-bridge clearance height, in `distanceUnit`. */
  bridgeHeight?: number
  /** Tidal range, in `distanceUnit`. */
  tide?: number
  /** Approach depth, in `distanceUnit`. */
  depthApproach?: number
  distanceUnit?: string
  notes?: PoiNote[]
}

/** A single highlighted user review returned with a summary response. */
export interface FeaturedReview {
  title?: string
  text?: string
  rating?: number
  createdBy?: string
  dateVisited?: string
  votes?: number
  /** Moderation status, e.g. 'Published' or 'PendingReview'. */
  status?: string
}

/** Full detail response of the point-of-interest summary endpoint. */
export interface PoiDetails {
  pointOfInterest: PointOfInterest
  amenity?: AmenitySection
  business?: BusinessSection
  contact?: ContactSection
  dockage?: DockageSection
  fuel?: FuelSection
  services?: ServicesSection
  retail?: RetailSection
  mooring?: MooringSection
  navigation?: NavigationSection
  reviewSummary?: ReviewSummary
  featuredReview?: FeaturedReview
}

/**
 * The PluginConfig keys that toggle a POI type: every `includeX` key. Used to
 * type the POI-type flag table and the config panel. Defined by the `include`
 * prefix so non-toggle settings (the caching duration, the rating filter, the
 * proximity-alarm options, and the route-hazard options) are never mistaken
 * for POI-type flags.
 */
export type PoiTypeFlag = Extract<keyof PluginConfig, `include${string}`>

/** Plugin configuration as supplied by the SignalK admin UI. */
export interface PluginConfig {
  cachingDurationMinutes: number
  includeMarinas?: boolean
  includeAnchorages?: boolean
  includeHazards?: boolean
  includeBusinesses?: boolean
  includeBoatRamps?: boolean
  includeBridges?: boolean
  includeDams?: boolean
  includeFerries?: boolean
  includeInlets?: boolean
  includeLocks?: boolean
  includeLocalKnowledge?: boolean
  includeNavigational?: boolean
  includeAirports?: boolean
  /** Subscribe to the vessel position, scan for nearby hazards, and emit alarms. */
  enableProximityAlarms?: boolean
  /** Distance, in meters, within which a hazard raises a proximity alarm. */
  proximityAlarmRadiusMeters?: number
  /** Scan the active Course API route ahead for hazards, bridges, and locks. */
  enableRouteHazardScan?: boolean
  /** Half-width, in meters, of the route corridor a POI must fall within. */
  routeCorridorWidthMeters?: number
  /** Hide points of interest whose average rating is below this value (0 to 5). */
  minimumRating?: number
  /** Import points of interest from OpenSeaMap (OpenStreetMap marine data). */
  openSeaMapEnabled?: boolean
  /** Overpass API endpoint URL the OpenSeaMap source queries. */
  openSeaMapEndpoint?: string
  /** Which OpenSeaMap seamark feature groups to import. */
  openSeaMapSeamarkGroups?: string[]
}
