/*
 * MIT License
 *
 * Copyright (c) 2024 Paul Willems <paul.willems@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Pure rating filter for point-of-interest summaries.
 *
 * The plugin's `minimumRating` configuration lets the user hide poorly rated
 * points of interest. This module applies that threshold.
 */

import type { PoiSummary, PoiType } from './types.js'

/**
 * Point-of-interest types that carry ActiveCaptain user reviews. Only these
 * are subject to the rating filter. Navigation and infrastructure types
 * (Hazard, Bridge, Lock, and so on) are never reviewed, so an absent rating on
 * one of them means "not a ratable thing", not "poor quality": filtering them
 * out would wrongly strip safety-relevant markers, hazards above all, from the
 * chart even with their POI-type toggle on.
 */
const RATABLE_POI_TYPES = new Set<PoiType>(['Marina', 'Anchorage', 'Business'])

/**
 * Drop point-of-interest summaries whose average rating is below
 * `minimumRating`.
 *
 * Behaviour:
 *
 * - A `minimumRating` of 0 (or any value at or below 0) is the "show
 *   everything" case: the input array is returned unchanged.
 * - An entry of a non-ratable type (anything outside {@link RATABLE_POI_TYPES})
 *   is always kept: it has no rating to clear the bar with, and hiding it would
 *   remove navigation markers, not declutter low-quality destinations.
 * - A ratable entry whose `rating` is at or above the threshold is kept.
 * - A ratable entry with no `rating` (undefined) has had no reviews, so it has
 *   no average to compare. When `minimumRating` is greater than 0 such an entry
 *   is hidden: the user asked for a minimum quality bar, and an unrated
 *   destination cannot be shown to clear it.
 *
 * The function is pure: it never mutates the input array or its elements.
 *
 * @param pois          The normalised list entries to filter.
 * @param minimumRating The lowest average rating (0 to 5) to keep.
 * @returns A new array of the entries that meet the threshold, or the original
 *          array when `minimumRating` is 0 or below.
 */
export function filterByRating (pois: PoiSummary[], minimumRating: number): PoiSummary[] {
  if (!(minimumRating > 0)) {
    return pois
  }
  return pois.filter(poi => {
    if (!RATABLE_POI_TYPES.has(poi.type)) {
      return true
    }
    return poi.rating !== undefined && poi.rating >= minimumRating
  })
}
