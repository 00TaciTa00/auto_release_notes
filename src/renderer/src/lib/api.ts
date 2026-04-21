/**
 * renderer → main IPC 호출 래퍼
 *
 * 모든 채널은 preload의 ALLOWED_CHANNELS에 등록된 것만 호출할 수 있습니다.
 * diff, ai는 P1에서 실제 IPC 호출로 연결됩니다.
 */

import type { Repository, ReleaseNote, GlobalSettings, CommitInfo, SecurityExclusionRule } from '../../../shared/types'

declare global {
  interface Window {
    api: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
      on(channel: string, callback: (...args: unknown[]) => void): () => void
    }
  }
}

/** 타입 안전한 IPC invoke 래퍼 */
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.api.invoke(channel, ...args) as Promise<T>
}

export const api = {
  repo: {
    getAll: (): Promise<Repository[]> =>
      invoke('repo:get-all'),
    add: (repo: Repository): Promise<Repository> =>
      invoke('repo:add', repo),
    updateSettings: (id: string, patch: Partial<Repository>): Promise<void> =>
      invoke('repo:update-settings', id, patch),
    delete: (id: string): Promise<void> =>
      invoke('repo:delete', id),
  },

  releaseNote: {
    getByRepo: (repoId: string): Promise<ReleaseNote[]> =>
      invoke('release-note:get-by-repo', repoId),
    update: (id: number, patch: Partial<ReleaseNote>): Promise<void> =>
      invoke('release-note:update', id, patch),
  },

  settings: {
    get: (): Promise<GlobalSettings> =>
      invoke('settings:get'),
    update: (patch: Partial<GlobalSettings>): Promise<void> =>
      invoke('settings:update', patch),
  },

  diff: {
    /** 새 커밋 유무 확인 (diff 미추출 — 빠름) */
    check: (repoId: string): Promise<{ hasNew: boolean; commitCount: number }> =>
      invoke('diff:check', repoId),
    /** 커밋 목록 조회 (GitGraph 표시용) */
    getCommits: (repoId: string): Promise<CommitInfo[]> =>
      invoke('diff:get-commits', repoId),
    /** diff 추출 + 보안 필터 적용 */
    extract: (repoId: string): Promise<{ diff: string; fromSha: string; toSha: string }> =>
      invoke('diff:extract', repoId),
  },

  ai: {
    /**
     * AI 요약 생성 → DB 저장 → baselineSha 업데이트
     *
     * diff:extract 결과를 그대로 전달하면 됩니다:
     *   const { diff, fromSha, toSha } = await api.diff.extract(repoId)
     *   const note = await api.ai.generate(repoId, diff, fromSha, toSha)
     */
    generate: (repoId: string, diff: string, fromSha: string, toSha: string): Promise<ReleaseNote> =>
      invoke('ai:generate', repoId, diff, fromSha, toSha),
  },

  secure: {
    getApiKey: (key: string): Promise<string | undefined> =>
      invoke('secure:get-api-key', key),
    setApiKey: (key: string, value: string): Promise<void> =>
      invoke('secure:set-api-key', key, value),
  },

  securityRule: {
    getByRepo: (repoId: string): Promise<SecurityExclusionRule[]> =>
      invoke('security-rule:get-by-repo', repoId),
    add: (repoId: string, pattern: string): Promise<SecurityExclusionRule> =>
      invoke('security-rule:add', repoId, pattern),
    remove: (id: number): Promise<void> =>
      invoke('security-rule:remove', id),
  },
}
