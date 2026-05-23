/**
 * Admin-gated status endpoint for the configuration panel.
 *
 * The plugin's Express router is mounted by the server at
 * `/plugins/signalk-crows-nest`. This module adds a single
 * `GET /api/status` route that serves the StatusSnapshot the panel polls, and
 * gates the whole `/api` subtree behind the server's admin middleware. Without
 * that gate the endpoint would be reachable by anyone on the admin port;
 * plugin routers receive no authentication by default.
 */

import type { IRouter } from 'express'
import type { ServerAPI } from '@signalk/server-api'
import { PLUGIN_ID } from '../shared/plugin-id.js'
import type { StatusSnapshot } from './status-types.js'

/** Subtree to admin-gate, an absolute path under the mounted router. */
const API_PATH = `/plugins/${PLUGIN_ID}/api`

/**
 * The slice of the server's security strategy this module needs. The
 * `@signalk/server-api` ServerAPI type does not currently expose
 * `securityStrategy`, so we narrow to the single method we call rather than
 * casting through `any`. The real signalk-server always provides it.
 */
interface SecurityAwareApp {
  securityStrategy: {
    addAdminMiddleware: (path: string) => void
  }
}

/**
 * Build the `registerWithRouter` implementation for the plugin.
 *
 * @param app         The SignalK server API, used for the admin gate.
 * @param getSnapshot Supplies the current StatusSnapshot for each request.
 */
export function createStatusRouter (
  app: ServerAPI,
  getSnapshot: () => StatusSnapshot
): (router: IRouter) => void {
  // The admin gate is path-scoped and the path is fixed for the life of the
  // plugin, so calling addAdminMiddleware more than once across enable /
  // disable / enable cycles on a long-running SignalK server would stack
  // duplicate gates on the same path. Track whether we have already gated
  // the path on this app and skip on subsequent invocations.
  let pathAdminGated = false
  // Track per-router so a fresh router (a new plugin start hands us a new
  // one) gets its GET handler mounted exactly once, but a re-invocation
  // against the same router (which would otherwise stack duplicate handlers
  // Express would never reach past the first) is skipped.
  const handlerMounted = new WeakSet<IRouter>()

  return (router: IRouter): void => {
    if (!pathAdminGated) {
      let gateInstalled = false
      try {
        const securityAware = app as unknown as Partial<SecurityAwareApp>
        if (typeof securityAware.securityStrategy?.addAdminMiddleware === 'function') {
          securityAware.securityStrategy.addAdminMiddleware(API_PATH)
          gateInstalled = true
        } else {
          app.error(`Cannot admin-gate ${API_PATH}: securityStrategy.addAdminMiddleware is unavailable`)
        }
      } catch (error) {
        app.error(`Cannot admin-gate ${API_PATH}: ${String(error)}`)
      }
      if (!gateInstalled) {
        app.error(
          'Status API unavailable: the /api/status route was not mounted because it could not be admin-gated'
        )
        return
      }
      pathAdminGated = true
    }

    if (handlerMounted.has(router)) {
      return
    }
    router.get('/api/status', (_req, res) => {
      res.json(getSnapshot())
    })
    handlerMounted.add(router)
  }
}
