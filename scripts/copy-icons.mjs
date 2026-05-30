// Cross-platform replacement for the unix-only icon copy step
// ("mkdir -p public/assets/icons && cp assets/icons/icon.svg
// assets/icons/icon-*.png public/assets/icons/"), so the build runs on Linux,
// macOS, and Windows CI runners alike. Copies icon.svg and every icon-*.png
// from assets/icons into the published public/assets/icons directory.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const srcDir = join('assets', 'icons')
const destDir = join('public', 'assets', 'icons')

mkdirSync(destDir, { recursive: true })

for (const name of readdirSync(srcDir)) {
  if (name === 'icon.svg' || (name.startsWith('icon-') && name.endsWith('.png'))) {
    copyFileSync(join(srcDir, name), join(destDir, name))
  }
}
