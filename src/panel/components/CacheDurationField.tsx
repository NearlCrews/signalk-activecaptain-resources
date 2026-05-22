/**
 * Number input for the cachingDurationMinutes setting. A thin wrapper around
 * NumberField that fixes the label, hint, and integer-with-floor-of-1 commit
 * behavior the cache duration needs.
 */

import type * as React from 'react'
import NumberField from './NumberField.js'

/** Smallest cache duration the plugin accepts: it requires a positive value. */
const MIN_MINUTES = 1

interface Props {
  value: number
  onChange: (minutes: number) => void
}

/** The cache-duration field shown in the configuration panel. */
export default function CacheDurationField ({ value, onChange }: Props): React.ReactElement {
  return (
    <NumberField
      id='ac-cache-duration'
      label='Cache duration (minutes)'
      hint='How long imported ActiveCaptain data is cached. Longer means less data traffic, shorter means fresher data.'
      value={value}
      onChange={onChange}
      min={MIN_MINUTES}
      integer
    />
  )
}
