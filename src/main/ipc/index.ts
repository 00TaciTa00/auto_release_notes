import { registerRepoHandlers } from './repo'
import { registerReleaseNoteHandlers } from './releaseNote'
import { registerSettingsHandlers } from './settings'
import { registerSecureHandlers } from './secure'
import { registerDiffHandlers } from './diff'
import { registerAIHandlers } from './ai'
import { registerSecurityRuleHandlers } from './securityRule'

/** 모든 IPC 핸들러를 등록합니다. app.whenReady() 내에서 호출하세요. */
export function registerAllHandlers(): void {
  registerRepoHandlers()
  registerReleaseNoteHandlers()
  registerSettingsHandlers()
  registerSecureHandlers()
  registerDiffHandlers()
  registerAIHandlers()
  registerSecurityRuleHandlers()
}
