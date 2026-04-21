import { ipcMain } from 'electron'
import { getAllRepos, addRepo, updateRepoSettings, deleteRepo } from '../../db/repository'
import type { Repository } from '../../shared/types'
import { logger } from '../../shared/logger'

export function registerRepoHandlers(): void {
  ipcMain.handle('repo:get-all', () => {
    logger.debug('IPC repo:get-all')
    return getAllRepos()
  })

  ipcMain.handle('repo:add', (_event, repo: Repository) => {
    logger.debug('IPC repo:add', { id: repo.id, name: repo.name })
    return addRepo(repo)
  })

  ipcMain.handle('repo:update-settings', (_event, id: string, patch: Partial<Repository>) => {
    logger.debug('IPC repo:update-settings', { id })
    updateRepoSettings(id, patch)
  })

  ipcMain.handle('repo:delete', (_event, id: string) => {
    logger.debug('IPC repo:delete', { id })
    deleteRepo(id)
  })
}
