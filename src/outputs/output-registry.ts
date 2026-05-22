/**
 * Output registry.
 *
 * Holds the registered `OutputModule`s, exposes their config-schema fragments,
 * and starts the enabled ones for a plugin start. A failing output start is
 * isolated and logged so one broken output cannot stop the others, mirroring
 * how the legacy entrypoint isolated the position monitor.
 */

import type { OutputContext, OutputHandle, OutputModule } from './output.js'

/** Public surface of the output registry. */
export interface OutputRegistry {
  /** The registered output modules, in registration order. */
  readonly modules: readonly OutputModule[]
  /** Each module's config-schema fragment, in registration order. */
  configSchemaFragments: () => Array<Record<string, unknown>>
  /**
   * Start every enabled output. A start that throws is logged through
   * `context.app.error` and skipped; the remaining outputs still start.
   */
  startEnabled: (context: OutputContext) => OutputHandle[]
}

/** Create an output registry over a fixed set of modules. */
export function createOutputRegistry (modules: readonly OutputModule[]): OutputRegistry {
  return {
    modules,
    configSchemaFragments: () => modules.map((module) => module.configSchema),
    startEnabled: (context: OutputContext): OutputHandle[] => {
      const handles: OutputHandle[] = []
      for (const module of modules) {
        if (!module.isEnabled(context.config)) {
          continue
        }
        try {
          handles.push(module.start(context))
        } catch (error) {
          context.app.error(`Cannot start output ${module.id}: ${String(error)}`)
        }
      }
      return handles
    }
  }
}
