import test from 'node:test'
import assert from 'node:assert/strict'
import {
  humanizeLightCharacter,
  renderOpenSeaMapDetail
} from '../src/inputs/openseamap/openseamap-detail.js'
import type { OverpassElement } from '../src/inputs/openseamap/overpass-client.js'

function osmNode (tags: Record<string, string>): OverpassElement {
  return { type: 'node', id: 1, tags, position: { latitude: 0, longitude: 0 } }
}

test('renders a friendly description for the lateral buoy example', () => {
  // Tags taken straight from a real Lake St. Clair lateral buoy on the
  // user's chart.
  const element = osmNode({
    man_made: 'buoy',
    'seamark:buoy_lateral:category': 'port',
    'seamark:buoy_lateral:colour': 'green',
    'seamark:buoy_lateral:shape': 'pillar',
    'seamark:information': 'Replaced by winter spar buoy.',
    'seamark:light:character': 'Fl',
    'seamark:light:colour': 'green',
    'seamark:light:exhibition': 'night',
    'seamark:light:period': '4.0',
    'seamark:name': 'DL1',
    'seamark:type': 'buoy_lateral'
  })
  const html = renderOpenSeaMapDetail(element)
  // A friendly type label plus the seamark name.
  assert.ok(html.includes('Lateral buoy: DL1'), 'header carries the friendly type and the name')
  // The family line composes category, colour, and shape into one sentence,
  // capitalised, with no raw key names.
  assert.ok(html.includes('Port, green, pillar shape'), 'family line composes category, colour, and shape')
  // The light character abbreviation is expanded; the period is shown in
  // seconds; the exhibition note is human-readable.
  assert.ok(html.includes('flashing'), 'light character is humanized')
  assert.ok(html.includes('4.0 s period'), 'light period is shown in seconds')
  assert.ok(html.includes('shown at night'), 'light exhibition is humanized')
  // The mariner's information note is shown verbatim under a clear label.
  assert.ok(html.includes('Information:'), 'information label is present')
  assert.ok(html.includes('Replaced by winter spar buoy.'), 'information text is present')
  // None of the raw OSM enum keys leak into the rendered description.
  for (const key of [
    'man_made',
    'seamark:type',
    'seamark:name',
    'seamark:buoy_lateral:category',
    'seamark:light:character'
  ]) {
    assert.ok(!html.includes(key), `raw key ${key} does not leak into the description`)
  }
})

test('renders a hazard with no curated tags as a short, non-empty description', () => {
  const html = renderOpenSeaMapDetail(osmNode({ 'seamark:type': 'rock' }))
  assert.ok(html.includes('Rock'), 'header carries the friendly type')
  assert.ok(html.includes('No additional detail available.'),
    'a curated-empty element shows a short note, not a raw tag dump')
})

test('renders a leisure=marina with no seamark:type using the marina label', () => {
  const html = renderOpenSeaMapDetail(osmNode({ leisure: 'marina', name: 'Riverside Marina' }))
  assert.ok(html.includes('Marina: Riverside Marina'), 'leisure=marina falls back to the marina label')
})

test('renders a cardinal beacon with a group-counted light character', () => {
  const html = renderOpenSeaMapDetail(osmNode({
    'seamark:type': 'beacon_cardinal',
    'seamark:beacon_cardinal:category': 'north',
    'seamark:beacon_cardinal:colour': 'black;yellow',
    'seamark:light:character': 'VQ',
    'seamark:light:colour': 'white',
    'seamark:name': 'Tower'
  }))
  assert.ok(html.includes('Cardinal beacon: Tower'))
  assert.ok(html.includes('North'), 'the category is humanized and capitalised in the sentence')
  assert.ok(html.includes('very quick'), 'the VQ light character abbreviation is expanded')
})

test('humanizeLightCharacter expands the common IALA abbreviations', () => {
  assert.equal(humanizeLightCharacter('Fl'), 'flashing')
  assert.equal(humanizeLightCharacter('LFl'), 'long flashing')
  assert.equal(humanizeLightCharacter('Q'), 'quick flashing')
  assert.equal(humanizeLightCharacter('Iso'), 'isophase')
  assert.equal(humanizeLightCharacter('Oc'), 'occulting')
  assert.equal(humanizeLightCharacter('FFl'), 'fixed and flashing')
})

test('humanizeLightCharacter keeps the group count alongside the base phrase', () => {
  assert.equal(humanizeLightCharacter('Fl(2)'), 'flashing (2)')
  assert.equal(humanizeLightCharacter('Q(9)'), 'quick flashing (9)')
  assert.equal(humanizeLightCharacter('Oc(3+1)'), 'occulting (3+1)')
})

test('humanizeLightCharacter leaves an unmapped base abbreviation unchanged', () => {
  assert.equal(humanizeLightCharacter('Xy'), 'Xy')
  assert.equal(humanizeLightCharacter('Xy(2)'), 'Xy (2)')
})

test('renders an unknown seamark:type with a generic header', () => {
  const html = renderOpenSeaMapDetail(osmNode({ 'seamark:type': 'definitely_not_a_seamark' }))
  assert.ok(html.includes('OpenSeaMap feature'), 'an unmapped type falls back to a generic label')
  assert.ok(html.includes('No additional detail available.'))
})

test('escapes HTML in tag values so a malicious tag cannot inject markup', () => {
  const html = renderOpenSeaMapDetail(osmNode({
    'seamark:type': 'rock',
    'seamark:information': '<script>alert(1)</script>'
  }))
  assert.ok(html.includes('&lt;script&gt;'), 'angle brackets in tag values are escaped')
  assert.ok(!html.includes('<script>'), 'no raw script tag survives the renderer')
})
