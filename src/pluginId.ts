/**
 * The plugin id, shared by the Node plugin and the configuration panel.
 *
 * The SignalK server mounts the plugin, its config storage, and its HTTP
 * router under this id, and the panel polls the status endpoint at
 * `/plugins/${PLUGIN_ID}/api/status`. Keeping it in one module means a rename
 * cannot leave the panel pointing at a stale path.
 */
export const PLUGIN_ID = 'signalk-crows-nest'
