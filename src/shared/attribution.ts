/**
 * Attribution footer for rendered POI detail. Each POI source supplies its own
 * attribution credit string; this helper appends it as a footer to that
 * source's rendered HTML description, so attribution is visible at the point
 * of display. This matters for OpenStreetMap data, whose ODbL license requires
 * visible attribution wherever the data is shown.
 */

/** Append a source attribution footer to a rendered HTML description. */
export function appendAttribution (html: string, attribution: string): string {
  return `${html}<p class="ac-attribution">${attribution}</p>`
}
