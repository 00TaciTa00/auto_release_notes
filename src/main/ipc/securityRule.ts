/**
 * 보안 파일 제외 규칙 IPC 핸들러
 *
 * 채널:
 *   security-rule:get-by-repo   레포의 규칙 목록 조회
 *   security-rule:add           패턴 추가
 *   security-rule:remove        패턴 삭제 (id 기준)
 */

import { ipcMain } from 'electron'
import { getRulesByRepo, addRule, removeRule } from '../../db/securityRule'
import { logger } from '../../shared/logger'

export function registerSecurityRuleHandlers(): void {
  ipcMain.handle('security-rule:get-by-repo', (_event, repoId: string) => {
    logger.debug('IPC security-rule:get-by-repo', { repoId })
    return getRulesByRepo(repoId)
  })

  ipcMain.handle('security-rule:add', (_event, repoId: string, pattern: string) => {
    logger.debug('IPC security-rule:add', { repoId, pattern })
    return addRule(repoId, pattern)
  })

  ipcMain.handle('security-rule:remove', (_event, id: number) => {
    logger.debug('IPC security-rule:remove', { id })
    removeRule(id)
  })
}
