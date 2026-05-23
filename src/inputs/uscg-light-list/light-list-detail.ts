/**
 * Plain-English HTML renderer for a USCG Light List record.
 *
 * The wire format carries USCG-specific abbreviations and unit codes that
 * mean nothing on a chart popup; this module humanizes them. The IALA
 * light-character vocabulary is reused from the OpenSeaMap module: the
 * abbreviations are identical, so the table lives there as the single source
 * of truth and a new value belongs alongside the other OpenSeaMap entries
 * rather than in a parallel table here.
 */

import type { LightListRecord } from './light-list-types.js'
import { humanizeLightCharacter } from '../openseamap/openseamap-detail.js'

/** Plain-English label for the single-letter USCG color codes. */
const COLOR: Readonly<Record<string, string>> = {
  W: 'white',
  R: 'red',
  G: 'green',
  Y: 'yellow',
  B: 'blue'
}

/** Escape text for safe inclusion in the rendered HTML. */
function escape (value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Normalize a USCG nominal-range unit code to a short, friendly label. */
function rangeUnit (unit: string): string {
  if (unit === 'NAUT MI') return 'NM'
  if (unit === 'STAT MI') return 'mi'
  return unit
}

/** Lowercase a USCG height unit ("FT") for inline use ("ft"). */
function heightUnit (unit: string): string {
  return unit.toLowerCase()
}

/** Translate a single-letter color code to its English name. */
function humanizeColor (token: string): string {
  return COLOR[token] ?? token.toLowerCase()
}

/**
 * Translate a USCG-style light character string such as "Fl W 4s" into a
 * comma-separated, lowercase, English phrase such as "flashing, white, 4 s
 * period". Tokens are space-separated on the wire: the first carries the
 * IALA character abbreviation, the second the color, the third the period.
 * A shorter input simply produces a shorter phrase.
 */
function humanizeLightChar (raw: string): string {
  const tokens = raw.trim().split(/\s+/)
  const parts: string[] = []
  if (tokens.length > 0 && tokens[0] !== '') {
    parts.push(humanizeLightCharacter(tokens[0]))
  }
  if (tokens.length > 1) {
    parts.push(humanizeColor(tokens[1]))
  }
  if (tokens.length > 2) {
    const period = tokens[2].replace(/s$/i, '')
    parts.push(`${period} s period`)
  }
  return parts.join(', ')
}

/**
 * Compose the descriptive Light line from the four light-related fields, or
 * null when the aid carries none of them (a daymark-only buoy, for example).
 */
function lightLine (record: LightListRecord): string | null {
  if (
    record.lightChar === undefined &&
    record.color === undefined &&
    record.nominalRange === undefined &&
    record.focalPlane === undefined
  ) {
    return null
  }
  const parts: string[] = []
  if (record.lightChar !== undefined) {
    parts.push(humanizeLightChar(record.lightChar))
  }
  if (record.nominalRange !== undefined) {
    parts.push(`${record.nominalRange.value} ${rangeUnit(record.nominalRange.unit)} range`)
  }
  if (record.focalPlane !== undefined) {
    parts.push(`${record.focalPlane.value} ${heightUnit(record.focalPlane.unit)} focal plane`)
  }
  return parts.join(', ')
}

/** Compose the Structure line from the structure-type and -height fields. */
function structureLine (record: LightListRecord): string | null {
  if (record.structureType === undefined && record.structureHeight === undefined) {
    return null
  }
  const parts: string[] = []
  if (record.structureType !== undefined) {
    parts.push(record.structureType)
  }
  if (record.structureHeight !== undefined) {
    parts.push(`${record.structureHeight.value} ${heightUnit(record.structureHeight.unit)} tall`)
  }
  return parts.join(', ')
}

/** Compose the Daymark line from the daymark color and shape fields. */
function daymarkLine (record: LightListRecord): string | null {
  if (record.daymarkShape === undefined && record.daymarkColor === undefined) {
    return null
  }
  const parts: string[] = []
  if (record.daymarkColor !== undefined) {
    parts.push(record.daymarkColor)
  }
  if (record.daymarkShape !== undefined) {
    parts.push(record.daymarkShape)
  }
  return parts.join(' ')
}

/** Render the source-attribution footer line: Volume, District, last-updated date. */
function sourceLine (record: LightListRecord): string {
  const updated = record.modifiedDate !== undefined
    ? ` (last updated ${escape(record.modifiedDate.slice(0, 10))})`
    : ''
  return `USCG Light List, Volume ${record.volume}, District ${escape(record.district)}${updated}`
}

/** Render a USCG Light List record as a Freeboard-ready HTML description. */
export function renderLightListDetail (record: LightListRecord): string {
  const blocks: string[] = []
  const inactiveSuffix = record.inactive ? ' (inactive)' : ''
  blocks.push(`<h4>${escape(record.name)} (LLNR ${record.llnr})${inactiveSuffix}</h4>`)
  const light = lightLine(record)
  if (light !== null) {
    blocks.push(`<p><strong>Light:</strong> ${escape(light)}.</p>`)
  }
  const structure = structureLine(record)
  if (structure !== null) {
    blocks.push(`<p><strong>Structure:</strong> ${escape(structure)}.</p>`)
  }
  const daymark = daymarkLine(record)
  if (daymark !== null) {
    blocks.push(`<p><strong>Daymark:</strong> ${escape(daymark)}.</p>`)
  }
  if (record.soundEmitterType !== undefined) {
    blocks.push(`<p><strong>Sound signal:</strong> ${escape(record.soundEmitterType)}.</p>`)
  }
  if (record.racon !== undefined) {
    blocks.push(`<p><strong>RACON:</strong> ${escape(record.racon)} (Morse).</p>`)
  }
  if (record.remark !== undefined && record.remark.length > 0) {
    blocks.push(`<p><strong>Remarks:</strong> ${escape(record.remark)}</p>`)
  }
  blocks.push(`<p><strong>Source:</strong> ${sourceLine(record)}.</p>`)
  return blocks.join('')
}
