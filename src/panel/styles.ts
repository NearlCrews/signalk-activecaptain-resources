/**
 * Inline-style design tokens for the federated configuration panel.
 *
 * The panel renders inside the Signal K admin UI, which is Bootstrap 5.3 and
 * flips between light and dark via `data-bs-theme` on a host element. Inline
 * styles cannot read that theme, so every color here references an `--ac-*`
 * CSS custom property rather than a hex literal. THEME_STYLE (below) defines
 * those properties once on `.ac-config-panel` with explicit light values,
 * then overrides them for dark mode. Surfaces are deliberately NOT derived
 * from the host's `--bs-body-bg`: the admin's body background is page-gray,
 * so a card that inherited it would lose its white fill. Components stay
 * theme-agnostic: they read tokens, the theme layer redefines them.
 */

import type { CSSProperties } from 'react'

/**
 * Injected once by PluginConfigurationPanel. Defines the token contract,
 * the dark-mode overrides, and the pseudo-class states (focus ring,
 * disabled buttons) that inline styles cannot express.
 */
export const THEME_STYLE = `
.ac-config-panel {
  --ac-surface: #ffffff;
  --ac-surface-muted: #f8f9fa;
  --ac-surface-raised: #f1f3f5;
  --ac-border: #e0e0e0;
  --ac-text: #333333;
  --ac-text-muted: #555555;
  --ac-text-faint: #888888;
  --ac-accent: #3b82f6;
  --ac-accent-text: #ffffff;
  --ac-ok: #22c55e;
  --ac-off: #9ca3af;
  --ac-danger-bg: #fef2f2;
  --ac-danger-fg: #991b1b;
  --ac-danger-border: #fca5a5;
  --ac-success-bg: #ecfdf5;
  --ac-success-fg: #065f46;
  --ac-success-border: #6ee7b7;
}
[data-bs-theme="dark"] .ac-config-panel,
.dark-mode .ac-config-panel {
  --ac-surface: #262833;
  --ac-surface-muted: #20212b;
  --ac-surface-raised: #30323f;
  --ac-border: #3a3c4a;
  --ac-text: #e6e7ea;
  --ac-text-muted: #a3a9b5;
  --ac-text-faint: #7c8290;
  --ac-accent: #4c93ff;
  --ac-ok: #2dd4a0;
  --ac-off: #6b7785;
  --ac-danger-bg: #3a1a1a;
  --ac-danger-fg: #f5a3a3;
  --ac-danger-border: #7a3a3a;
  --ac-success-bg: #12352a;
  --ac-success-fg: #7fe3c0;
  --ac-success-border: #2f6b54;
}
.ac-config-panel input:focus-visible,
.ac-config-panel button:focus-visible {
  outline: 2px solid var(--ac-accent);
  outline-offset: 1px;
}
.ac-config-panel button:disabled,
.ac-config-panel input:disabled,
.ac-config-panel select:disabled {
  background: var(--ac-surface-raised) !important;
  color: var(--ac-text-faint) !important;
  border-color: var(--ac-border) !important;
  cursor: not-allowed !important;
}
/* The browser-default <legend> layout cuts into the fieldset's top border,
   producing a visible notch in the rounded border. Floating the legend
   lifts it out of the border into a normal block above the fieldset
   contents; the next sibling clears the float so it begins on a new line. */
.ac-config-panel fieldset > legend {
  float: left;
  width: 100%;
  margin: 0 0 8px;
  padding: 0;
}
.ac-config-panel fieldset > legend + * {
  clear: both;
}
`

/**
 * The named style tokens consumed by panel components. Declared with a
 * `satisfies` clause so each value is checked as a CSSProperties literal while
 * the inferred type of `S` keeps its specific keys: indexing `S.unknownKey`
 * remains a TypeScript error, which a `Record<string, CSSProperties>`
 * annotation would have silently allowed.
 */
export const S = {
  root: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: 'var(--ac-text)',
    padding: '16px 0'
  },

  // Status bar at the top of the panel.
  statusBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 18,
    padding: '12px 16px',
    background: 'var(--ac-surface-muted)',
    border: '1px solid var(--ac-border)',
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 13
  },
  statusApi: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  dotOk: { background: 'var(--ac-ok)' },
  dotOff: { background: 'var(--ac-off)' },
  dotError: { background: 'var(--ac-danger-fg)' },
  statLabel: { color: 'var(--ac-text-muted)' },
  statValue: { fontWeight: 600, marginLeft: 4 },
  statusErrors: {
    flexBasis: '100%',
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  statusErrorItem: {
    display: 'flex',
    gap: 8,
    fontSize: 12,
    color: 'var(--ac-danger-fg)',
    background: 'var(--ac-danger-bg)',
    border: '1px solid var(--ac-danger-border)',
    borderRadius: 4,
    padding: '4px 8px'
  },
  statusErrorTime: { color: 'var(--ac-text-faint)', flexShrink: 0 },

  // Generic field row: a label-input pair laid out as one row, with the
  // hint rendered as a sibling block below (NumberField composes the two).
  // Labels are a fixed-width muted column on the left, so successive rows
  // visually align without depending on label length.
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4
  },
  label: {
    fontSize: 13,
    color: 'var(--ac-text-muted)',
    flexShrink: 0
  },
  input: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--ac-border)',
    background: 'var(--ac-surface)',
    color: 'var(--ac-text)',
    fontSize: 13,
    width: 110
  },
  hint: {
    fontSize: 12,
    color: 'var(--ac-text-muted)',
    lineHeight: 1.45,
    margin: '0 0 12px'
  },

  // Grouped-options sections: a header with bulk actions, and one fieldset
  // per group. Used by both the ActiveCaptain POI-type selector and the
  // OpenSeaMap seamark-group checklist.
  groupsSection: { marginBottom: 16 },
  groupsHeader: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  groupsTitle: { fontSize: 13, fontWeight: 600, color: 'var(--ac-text)', marginRight: 4 },
  btnBulk: {
    padding: '4px 12px',
    background: 'var(--ac-surface-raised)',
    color: 'var(--ac-text)',
    border: '1px solid var(--ac-border)',
    borderRadius: 999,
    fontSize: 12,
    cursor: 'pointer'
  },
  group: {
    background: 'var(--ac-surface)',
    border: '1px solid var(--ac-border)',
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 10
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: 'var(--ac-text-faint)',
    margin: '0 0 8px'
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 6
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--ac-text)',
    cursor: 'pointer'
  },
  checkbox: { width: 16, height: 16, flexShrink: 0, cursor: 'pointer' },

  // Generic checkbox row: a clickable label wrapping a single checkbox.
  // Used by toggle controls anywhere on the panel.
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--ac-text)',
    cursor: 'pointer',
    marginBottom: 8
  },
  // Generic labelled-input row: a label, a numeric control, and a hint, laid
  // out below a toggle in an alarm fieldset.
  labelledInputRow: {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12
  },

  // Data-source accordion cards.
  sourceCard: {
    background: 'var(--ac-surface)',
    border: '1px solid var(--ac-border)',
    borderRadius: 10,
    marginBottom: 10
  },
  sourceCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px'
  },
  alwaysOnBadge: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    color: 'var(--ac-text-muted)',
    background: 'var(--ac-surface-muted, rgba(255,255,255,0.05))',
    border: '1px solid var(--ac-border)',
    borderRadius: 3,
    padding: '2px 6px',
    flexShrink: 0
  },
  sourceCardToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--ac-text)',
    font: 'inherit'
  },
  sourceCardName: { fontSize: 14, fontWeight: 600, color: 'var(--ac-text)', flexShrink: 0 },
  sourceCardSummary: {
    fontSize: 12,
    color: 'var(--ac-text-muted)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  sourceCardChevron: { fontSize: 11, color: 'var(--ac-text-faint)', flexShrink: 0 },
  // The body of an expanded source card. Lives on the same surface as the
  // header; the header padding plus this body padding align the content
  // columns so there is no nested-card look.
  sourceCardBody: {
    padding: '0 14px 6px',
    marginTop: 4
  },

  // Panel section heading bar (Data sources, Alerts): a muted-surface row
  // with a normal-case title, replacing the smaller all-caps tracked label.
  // Matches the emitter-cannon plugin's section header so a user familiar
  // with that panel sees the same affordances.
  sectionHeading: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ac-text)',
    background: 'var(--ac-surface-muted)',
    border: '1px solid var(--ac-border)',
    borderRadius: 8,
    padding: '8px 12px',
    margin: '20px 0 10px'
  },

  // A compact pill rendered inside a source-card header to surface live
  // per-source status (request count, error flag) so a collapsed card
  // still tells the operator what is happening.
  sourceStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: 'var(--ac-text-muted)',
    background: 'var(--ac-surface-muted)',
    border: '1px solid var(--ac-border)',
    borderRadius: 999,
    padding: '2px 8px',
    flexShrink: 0
  },
  sourceStatusPillError: {
    color: 'var(--ac-danger-fg)',
    background: 'var(--ac-danger-bg)',
    borderColor: 'var(--ac-danger-border)'
  },

  // Wide text input, for values such as a URL.
  inputWide: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--ac-border)',
    background: 'var(--ac-surface)',
    color: 'var(--ac-text)',
    fontSize: 13,
    width: '100%',
    maxWidth: 440,
    boxSizing: 'border-box'
  },

  // Footer.
  footer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: '12px 0',
    borderTop: '1px solid var(--ac-border)',
    marginTop: 8
  },
  btnPrimary: {
    padding: '8px 16px',
    background: 'var(--ac-accent)',
    color: 'var(--ac-accent-text)',
    border: 'none',
    borderRadius: 6,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '8px 16px',
    background: 'var(--ac-surface-raised)',
    color: 'var(--ac-text)',
    border: '1px solid var(--ac-border)',
    borderRadius: 6,
    cursor: 'pointer'
  },
  dirty: { fontSize: 12, color: 'var(--ac-text-muted)', marginLeft: 4 },
  savedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    lineHeight: 1,
    color: 'var(--ac-success-fg)',
    background: 'var(--ac-success-bg)',
    border: '1px solid var(--ac-success-border)',
    borderRadius: 999,
    padding: '5px 12px',
    marginLeft: 4
  },

  // Non-fatal status-poll error banner.
  errorBanner: {
    color: 'var(--ac-danger-fg)',
    background: 'var(--ac-danger-bg)',
    border: '1px solid var(--ac-danger-border)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 13,
    margin: '0 0 16px'
  }
} satisfies Record<string, CSSProperties>
