import { ipcMain } from 'electron'
import { getSecureKey, setSecureKey } from '../secure'
import { logger } from '../../shared/logger'

export function registerSecureHandlers(): void {
  ipcMain.handle('secure:get-api-key', (_event, key: string) => {
    logger.debug('IPC secure:get-api-key', { key })
    return getSecureKey(key)
  })

  ipcMain.handle('secure:set-api-key', (_event, key: string, value: string) => {
    logger.debug('IPC secure:set-api-key', { key })
    setSecureKey(key, value)
  })
}
