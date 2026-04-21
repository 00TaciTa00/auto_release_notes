/**
 * diff 추출 메인 진입점
 *
 * 레포의 diffSource 설정에 따라 적절한 구현체를 선택합니다:
 *   'api'       → platform에 따라 GitLab 또는 GitHub API 사용
 *   'local-git' → 로컬 git CLI 사용
 *
 * ⚠️  모든 diff는 이 모듈을 거쳐야 합니다.
 *     IPC 핸들러에서 직접 gitlab/github/localGit을 호출하지 마세요.
 */

import type { Repository } from '../shared/types'
import { applySecurityFilter } from './securityFilter'
import { checkNewCommitsGitLab, getCommitListGitLab, getDiffGitLab } from './gitlab'
import { checkNewCommitsGitHub, getCommitListGitHub, getDiffGitHub } from './github'
import { countNewCommits, getCommitList, getDiff, getHeadSha } from './localGit'
import { DiffError } from '../shared/error'

/** diff:get-commits IPC 응답 형식 */
export type CommitInfo = {
  sha: string
  message: string
  author: string
  date: string
}

/** diff:extract IPC 응답 형식 */
export type DiffResult = {
  diff: string    // 보안 필터 적용 후 diff 텍스트
  fromSha: string // 이전 기준 SHA (baselineSha)
  toSha: string   // 새 기준 SHA (이 값으로 baselineSha를 업데이트)
}

/**
 * 새 커밋 유무를 빠르게 확인합니다 (diff 추출 없음)
 *
 * Dashboard의 "새 커밋 확인" 버튼에서 사용합니다.
 * baselineSha가 없으면 항상 false를 반환합니다.
 */
export async function checkNewCommits(
  repo: Repository,
  accessToken: string
): Promise<{ hasNew: boolean; commitCount: number }> {
  if (!repo.baselineSha) return { hasNew: false, commitCount: 0 }

  if (repo.diffSource === 'local-git') {
    if (!repo.localPath) throw new DiffError('로컬 git 경로(localPath)가 설정되지 않았습니다', repo.repoUrl)
    const count = countNewCommits(repo.localPath, repo.baselineSha)
    return { hasNew: count > 0, commitCount: count }
  }

  // API 방식: platform에 따라 분기
  return repo.platform === 'gitlab'
    ? checkNewCommitsGitLab(repo.repoUrl, repo.baselineSha, accessToken)
    : checkNewCommitsGitHub(repo.repoUrl, repo.baselineSha, accessToken)
}

/**
 * baselineSha 이후 커밋 목록을 반환합니다 (GitGraph 표시용)
 *
 * baselineSha가 없으면 빈 배열을 반환합니다.
 */
export async function getCommits(
  repo: Repository,
  accessToken: string
): Promise<CommitInfo[]> {
  if (repo.diffSource === 'local-git') {
    if (!repo.localPath) throw new DiffError('로컬 git 경로(localPath)가 설정되지 않았습니다', repo.repoUrl)
    return getCommitList(repo.localPath, repo.baselineSha)
  }
  return repo.platform === 'gitlab'
    ? getCommitListGitLab(repo.repoUrl, repo.baselineSha, accessToken)
    : getCommitListGitHub(repo.repoUrl, repo.baselineSha, accessToken)
}

/**
 * diff를 추출하고 보안 필터를 적용합니다.
 *
 * ⚠️  처리 순서 고정 (CLAUDE.md 제약):
 *     1. raw diff 추출
 *     2. 보안 필터 적용 (민감 파일 제거)
 *     3. 필터된 diff 반환 → AI로 전달
 *
 * @param repo             레포지토리 정보
 * @param accessToken      API 액세스 토큰 (local-git 방식이면 미사용)
 * @param securityPatterns 제외할 파일 패턴 목록 (DB에서 로드)
 */
export async function extractDiff(
  repo: Repository,
  accessToken: string,
  securityPatterns: string[]
): Promise<DiffResult> {
  let rawDiff: string
  let fromSha: string
  let toSha: string

  if (repo.diffSource === 'local-git') {
    if (!repo.localPath) throw new DiffError('로컬 git 경로(localPath)가 설정되지 않았습니다', repo.repoUrl)
    rawDiff = getDiff(repo.localPath, repo.baselineSha)
    fromSha = repo.baselineSha
    toSha = getHeadSha(repo.localPath)
  } else if (repo.platform === 'gitlab') {
    const result = await getDiffGitLab(repo.repoUrl, repo.baselineSha, accessToken)
    rawDiff = result.diff
    fromSha = repo.baselineSha
    toSha = result.toSha
  } else {
    const result = await getDiffGitHub(repo.repoUrl, repo.baselineSha, accessToken)
    rawDiff = result.diff
    fromSha = repo.baselineSha
    toSha = result.toSha
  }

  // ⚠️  보안 필터는 반드시 AI 전달 전에 적용 (순서 바꾸면 안 됨)
  const filteredDiff = applySecurityFilter(rawDiff, securityPatterns)

  return { diff: filteredDiff, fromSha, toSha }
}
