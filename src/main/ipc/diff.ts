/**
 * diff 관련 IPC 핸들러
 *
 * 채널 목록:
 *   diff:check         새 커밋 유무 확인 (빠름 — diff 미추출)
 *   diff:get-commits   커밋 목록 조회 (GitGraph 표시용)
 *   diff:extract       diff 추출 + 보안 필터 적용 → AI 입력 준비
 */

import { ipcMain } from 'electron'
import { getRepoById } from '../../db/repository'
import { getPatternsByRepo } from '../../db/securityRule'
import { getSecureKey } from '../secure'
import { checkNewCommits, getCommits, extractDiff } from '../../diff/extractor'
import { logger } from '../../shared/logger'
import { DiffError } from '../../shared/error'

export function registerDiffHandlers(): void {
  /**
   * diff:check
   * 새 커밋 유무만 확인합니다. diff를 가져오지 않으므로 빠릅니다.
   * Dashboard "새 커밋 확인" 버튼에서 사용합니다.
   */
  ipcMain.handle('diff:check', async (_event, repoId: string) => {
    logger.debug('IPC diff:check', { repoId })
    const repo = getRepoById(repoId)
    if (!repo) throw new DiffError(`레포를 찾을 수 없습니다: ${repoId}`)
    const token = getSecureKey(`repo:${repoId}:access_token`) ?? ''
    return checkNewCommits(repo, token)
  })

  /**
   * diff:get-commits
   * baselineSha 이후 커밋 목록을 반환합니다.
   * GitGraph 탭에서 커밋 내역을 표시할 때 사용합니다.
   */
  ipcMain.handle('diff:get-commits', async (_event, repoId: string) => {
    logger.debug('IPC diff:get-commits', { repoId })
    const repo = getRepoById(repoId)
    if (!repo) throw new DiffError(`레포를 찾을 수 없습니다: ${repoId}`)
    const token = getSecureKey(`repo:${repoId}:access_token`) ?? ''
    return getCommits(repo, token)
  })

  /**
   * diff:extract
   * diff를 추출하고 보안 파일 제외 필터를 적용합니다.
   * 반환값: { diff, fromSha, toSha }
   * 이후 ai:generate에 diff를 전달하여 릴리즈 노트를 생성합니다.
   */
  ipcMain.handle('diff:extract', async (_event, repoId: string) => {
    logger.info('IPC diff:extract 시작', { repoId })
    const repo = getRepoById(repoId)
    if (!repo) throw new DiffError(`레포를 찾을 수 없습니다: ${repoId}`)
    const token = getSecureKey(`repo:${repoId}:access_token`) ?? ''
    // DB에서 보안 제외 패턴 로드 (레포별 독립 설정)
    const securityPatterns = getPatternsByRepo(repoId)
    logger.debug('보안 필터 패턴', { count: securityPatterns.length, patterns: securityPatterns })
    const result = await extractDiff(repo, token, securityPatterns)
    logger.info('IPC diff:extract 완료', { fromSha: result.fromSha, toSha: result.toSha, diffLen: result.diff.length })
    return result
  })
}
