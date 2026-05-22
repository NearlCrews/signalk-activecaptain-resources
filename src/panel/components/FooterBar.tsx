/**
 * Panel footer: the Save and Discard controls plus a dirty / just-saved
 * indicator. Both buttons are disabled while the configuration is unchanged.
 */

import type * as React from 'react'
import { S } from '../styles.js'

interface Props {
  dirty: boolean
  /** Epoch milliseconds of the last successful save, or null. Drives the "Saved" pill. */
  justSavedAt: number | null
  onSave: () => void
  onDiscard: () => void
}

/** The configuration panel's footer bar. */
export default function FooterBar ({ dirty, justSavedAt, onSave, onDiscard }: Props): React.ReactElement {
  return (
    <div style={S.footer}>
      <button type='button' style={S.btnPrimary} onClick={onSave} disabled={!dirty}>
        Save
      </button>
      <button type='button' style={S.btnSecondary} onClick={onDiscard} disabled={!dirty}>
        Discard
      </button>
      {dirty
        ? <span style={S.dirty}>Unsaved changes</span>
        : justSavedAt !== null
          ? <span role='status' style={S.savedPill}>Saved</span>
          : null}
    </div>
  )
}
