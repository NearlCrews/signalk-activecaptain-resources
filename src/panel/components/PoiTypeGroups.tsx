/**
 * The POI-type selector: the 13 toggles laid out in four labeled groups, with
 * All and None bulk buttons. A note appears when nothing is selected, because
 * the plugin then imports every type rather than none.
 */

import type * as React from 'react'
import type { PluginConfig, PoiTypeFlag } from '../../shared/types.js'
import { POI_TYPE_GROUPS } from '../poi-type-groups.js'
import { S } from '../styles.js'

interface Props {
  config: PluginConfig
  onToggle: (flag: PoiTypeFlag, enabled: boolean) => void
  onSetAll: (enabled: boolean) => void
}

/** The grouped POI-type checkboxes shown in the configuration panel. */
export default function PoiTypeGroups ({ config, onToggle, onSetAll }: Props): React.ReactElement {
  const anySelected = POI_TYPE_GROUPS.some(
    (group) => group.options.some((option) => config[option.flag] === true)
  )

  return (
    <section style={S.groupsSection}>
      <div style={S.groupsHeader}>
        <span style={S.groupsTitle}>POI types to import</span>
        <button type='button' style={S.btnBulk} onClick={() => onSetAll(true)}>All</button>
        <button type='button' style={S.btnBulk} onClick={() => onSetAll(false)}>None</button>
      </div>
      {POI_TYPE_GROUPS.map((group) => (
        <fieldset key={group.title} style={S.group}>
          <legend style={S.groupTitle}>{group.title}</legend>
          <div style={S.checkboxGrid}>
            {group.options.map((option) => (
              <label key={option.flag} style={S.checkboxLabel}>
                <input
                  type='checkbox'
                  style={S.checkbox}
                  checked={config[option.flag] === true}
                  onChange={(e) => onToggle(option.flag, e.target.checked)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {anySelected
        ? null
        : (
          <p style={S.hint}>
            No POI types are selected, so the plugin imports every type. Choose
            at least one to narrow the import.
          </p>
          )}
    </section>
  )
}
