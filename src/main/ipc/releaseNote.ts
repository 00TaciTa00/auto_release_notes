import { ipcMain } from 'electron'
import { getNotesByRepo, updateNote } from '../../db/releaseNote'
import type { ReleaseNote } from '../../shared/types'
import { logger } from '../../shared/logger'

export function registerReleaseNoteHandlers(): void {
  ipcMain.handle('release-note:get-by-repo', (_event, repoId: string) => {
    logger.debug('IPC release-note:get-by-repo', { repoId })
    return getNotesByRepo(repoId)
  })

  ipcMain.handle('release-note:update', (_event, id: number, patch: Partial<ReleaseNote>) => {
    logger.debug('IPC release-note:update', { id })
    updateNote(id, patch)
  })
}
