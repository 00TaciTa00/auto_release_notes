/**
 * AI 요약 생성 IPC 핸들러
 *
 * 채널:
 *   ai:generate   diff → AI 요약 → DB 저장 → baselineSha 업데이트
 *
 * 흐름:
 *   1. diff:extract 로 필터된 diff + SHA 정보 획득
 *   2. ai:generate 호출 → Claude/OpenAI API → 릴리즈 노트 DB 저장
 *   3. renderer에서 AppContext.releaseNotes 갱신
 */

import { ipcMain } from 'electron'
import { getRepoById, updateRepoSettings } from '../../db/repository'
import { createNote } from '../../db/releaseNote'
import { getSecureKey } from '../secure'
import { createAIProvider } from '../../ai/provider'
import { logger } from '../../shared/logger'
import { AIError } from '../../shared/error'

export function registerAIHandlers(): void {
  /**
   * ai:generate
   *
   * @param repoId   레포지토리 ID
   * @param diff     보안 필터 적용된 diff 텍스트 (diff:extract 결과)
   * @param fromSha  diff 시작 SHA (이전 baseline)
   * @param toSha    diff 끝 SHA (새 baseline이 될 값)
   * @returns        생성된 ReleaseNote (DB에 저장된 값)
   */
  ipcMain.handle(
    'ai:generate',
    async (_event, repoId: string, diff: string, fromSha: string, toSha: string) => {
      logger.info('IPC ai:generate 시작', { repoId, diffLen: diff.length })

      const repo = getRepoById(repoId)
      if (!repo) throw new AIError(`레포를 찾을 수 없습니다: ${repoId}`)

      // AI 제공자별 API 키 키 이름이 다름
      const apiKeyName = repo.aiProvider === 'claude' ? 'claudeApiKey' : 'openaiApiKey'
      const apiKey = getSecureKey(apiKeyName)
      if (!apiKey) {
        throw new AIError(
          `${repo.aiProvider} API 키가 설정되지 않았습니다. 전역 설정(⚙️)에서 입력하세요.`,
          repo.aiProvider
        )
      }

      // AI 제공자 팩토리로 인스턴스 생성 후 요약 실행
      const provider = createAIProvider(repo.aiProvider)
      const summary = await provider.generateSummary(diff, repo, apiKey)

      // 생성된 릴리즈 노트를 DB에 저장
      const note = createNote({
        repoId,
        fromSha,
        toSha,
        rawDiff: diff,
        aiDraftKo: summary.ko,
        aiDraftEn: summary.en,
        changeTypes: summary.changeTypes,
      })

      // 다음 diff 추출의 기준점을 새 SHA로 업데이트
      // (이 값이 다음 diff:extract 시 from이 됨)
      updateRepoSettings(repoId, { baselineSha: toSha })

      logger.info('IPC ai:generate 완료', { noteId: note.id, toSha })
      return note
    }
  )
}
