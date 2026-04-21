import { registerRepoHandlers } from './repo'
import { registerReleaseNoteHandlers } from './releaseNote'
import { registerSettingsHandlers } from './settings'
import { registerSecureHandlers } from './secure'

export function registerAllHandlers(): void {
  registerRepoHandlers()
  registerReleaseNoteHandlers()
  registerSettingsHandlers()
  registerSecureHandlers()
}
