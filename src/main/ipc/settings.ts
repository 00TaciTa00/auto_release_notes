import { ipcMain } from 'electron'
import { getSettings, updateSettings } from '../../db/settings'
import type { GlobalSettings } from '../../shared/types'
import { logger } from '../../shared/logger'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => {
    logger.debug('IPC settings:get')
    return getSettings()
  })

  ipcMain.handle('settings:update', (_event, patch: Partial<GlobalSettings>) => {
    logger.debug('IPC settings:update')
    updateSettings(patch)
  })
}
