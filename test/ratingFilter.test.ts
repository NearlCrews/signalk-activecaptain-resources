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

import test from 'node:test'
import assert from 'node:assert/strict'
import { filterByRating } from '../src/ratingFilter.js'
import type { PoiSummary } from '../src/types.js'

/** Build a PoiSummary with the given id and optional rating. */
function poi (id: string, rating?: number): PoiSummary {
  const summary: PoiSummary = {
    id,
    type: 'Marina',
    position: { latitude: 0, longitude: 0 },
    name: `Marina ${id}`
  }
  if (rating !== undefined) {
    summary.rating = rating
    summary.reviewCount = 5
  }
  return summary
}

test('filterByRating keeps entries above the threshold', () => {
  const pois = [poi('a', 4.5), poi('b', 2.0)]
  assert.deepEqual(filterByRating(pois, 3).map(p => p.id), ['a'])
})

test('filterByRating drops entries below the threshold', () => {
  const pois = [poi('a', 1.0), poi('b', 2.9)]
  assert.deepEqual(filterByRating(pois, 3), [])
})

test('filterByRating keeps entries exactly at the threshold', () => {
  const pois = [poi('a', 3.0), poi('b', 3.0)]
  assert.deepEqual(filterByRating(pois, 3).map(p => p.id), ['a', 'b'])
})

test('filterByRating with minimumRating 0 returns everything unchanged', () => {
  const pois = [poi('a', 1.0), poi('b'), poi('c', 5.0)]
  const result = filterByRating(pois, 0)
  // The "show all" case returns the very same array, not a filtered copy.
  assert.equal(result, pois)
})

test('filterByRating hides unrated entries when minimumRating is above 0', () => {
  const pois = [poi('rated', 4.0), poi('unrated')]
  // A ratable point of interest with no reviews has no rating and cannot clear
  // a positive quality bar, so it is hidden.
  assert.deepEqual(filterByRating(pois, 1).map(p => p.id), ['rated'])
})

test('filterByRating keeps non-ratable types regardless of their missing rating', () => {
  // Hazards, bridges, and locks are never reviewed; a quality bar must not
  // strip them from the chart.
  const hazard: PoiSummary = {
    id: 'h1',
    type: 'Hazard',
    position: { latitude: 0, longitude: 0 },
    name: 'Submerged rock'
  }
  const bridge: PoiSummary = {
    id: 'b1',
    type: 'Bridge',
    position: { latitude: 0, longitude: 0 },
    name: 'Swing bridge'
  }
  const lowMarina = poi('m1', 1.0)

  assert.deepEqual(
    filterByRating([hazard, bridge, lowMarina], 4).map(p => p.id),
    ['h1', 'b1'],
    'the hazard and bridge survive; only the low-rated marina is dropped'
  )
})

test('filterByRating does not mutate the input array', () => {
  const pois = [poi('a', 1.0), poi('b', 5.0)]
  filterByRating(pois, 3)
  assert.deepEqual(pois.map(p => p.id), ['a', 'b'])
})

test('filterByRating returns an empty array unchanged', () => {
  assert.deepEqual(filterByRating([], 4), [])
})
