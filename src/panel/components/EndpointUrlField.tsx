/**
 * Text input for the OpenSeaMap source's Overpass API endpoint URL. The URL is
 * a free-form string, so the field is a plain controlled input: it commits
 * every keystroke and applies no clamping.
 */

import type * as React from 'react'
import { S } from '../styles.js'

/** Stable id linking the visible label to its input. */
const FIELD_ID = 'ac-openseamap-endpoint'

interface Props {
  value: string
  onChange: (url: string) => void
}

/** The Overpass API endpoint field shown in the OpenSeaMap card body. */
export default function EndpointUrlField ({ value, onChange }: Props): React.ReactElement {
  // Same Fragment-with-sibling-hint shape NumberField uses, so the hint
  // sits below the row instead of wrapping awkwardly beside the wide URL
  // input on narrow widths.
  return (
    <>
      <div style={S.fieldRow}>
        <label htmlFor={FIELD_ID} style={S.label}>Overpass API endpoint URL</label>
        <input
          id={FIELD_ID}
          type='url'
          style={S.inputWide}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <p style={S.hintBelow}>
        The OpenStreetMap Overpass API endpoint the OpenSeaMap source queries.
        Leave the default unless you run your own Overpass instance.
      </p>
    </>
  )
}
