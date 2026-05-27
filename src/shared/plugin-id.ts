/**
 * Plugin identity: id, canonical repository, and the outbound `User-Agent`
 * string, shared by the Node plugin and the configuration panel.
 *
 * The SignalK server mounts the plugin, its config storage, and its HTTP
 * router under {@link PLUGIN_ID}, and the panel polls the status endpoint at
 * `/plugins/${PLUGIN_ID}/api/status`. Keeping the identity values in one
 * module means a rename cannot leave the panel pointing at a stale path, the
 * note-builder publishing a stale `pluginRepo`, or one upstream client
 * advertising a different repo than another. Every outbound HTTP client
 * consumes {@link PLUGIN_USER_AGENT} so the project's identity reaches each
 * upstream service consistently.
 */

/** The plugin id. */
export const PLUGIN_ID = 'signalk-crows-nest'

/**
 * Canonical GitHub repository for this plugin. Published on every produced
 * SignalK note as `properties.pluginRepo` and embedded in
 * {@link PLUGIN_USER_AGENT} so every upstream sees the same project URL.
 */
export const PLUGIN_REPO_URL = 'https://github.com/NearlCrews/signalk-crows-nest'

/**
 * Outbound `User-Agent` string for every HTTP client the plugin owns
 * (ActiveCaptain, Overpass, USCG NAVCEN, NOAA ENC Direct). The "+url" form
 * follows the long-standing convention for identifying a bot's home page.
 */
export const PLUGIN_USER_AGENT = `${PLUGIN_ID} (+${PLUGIN_REPO_URL})`
