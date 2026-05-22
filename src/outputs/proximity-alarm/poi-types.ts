/**
 * The point-of-interest types the proximity alarm output acts on.
 *
 * This is the single source of truth shared by the output's
 * `PositionScanContributor.poiTypes` (which sizes the per-tick fetch) and the
 * alarm logic (which filters the result). Declaring the type once stops the
 * fetch from drifting from the filter.
 */

import type { PoiType } from '../../shared/types.js'

/** POI type the proximity-alarm output flags. Hazards are the only in-scope type. */
export const PROXIMITY_ALARM_POI_TYPE: PoiType = 'Hazard'

/** Tuple form of the above, for the `PositionScanContributor.poiTypes` field. */
export const PROXIMITY_ALARM_POI_TYPES = [PROXIMITY_ALARM_POI_TYPE] as const satisfies readonly PoiType[]
