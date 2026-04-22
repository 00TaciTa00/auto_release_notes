/**
 * GitLab REST API v4를 통한 diff 추출
 *
 * 사용 엔드포인트:
 *   GET /api/v4/projects/{urlEncodedPath}/repository/compare?from={sha}&to=HEAD
 *
 * 응답 구조:
 *   { commits: [...], diffs: [{ old_path, new_path, diff }] }
 *
 * 참고: self-hosted GitLab도 동일한 API 경로를 사용합니다.
 * repoUrl에서 호스트를 자동 추출하므로 gitlab.com 외에도 동작합니다.
 */

import { DiffError } from '../shared/error'
import { logger } from '../shared/logger'

/** repoUrl에서 GitLab 호스트와 프로젝트 경로를 추출 */
function parseGitLabUrl(repoUrl: string): { host: string; projectPath: string } {
  // 예: https://gitlab.com/namespace/project
  //   → host: "https://gitlab.com"
  //   → projectPath: "namespace/project"
  const url = new URL(repoUrl)
  const projectPath = url.pathname.replace(/^\//, '').replace(/\.git$/, '')
  return { host: `${url.protocol}//${url.host}`, projectPath }
}

// GitLab API 응답 타입 정의

interface GitLabCommit {
  id: string
  message: string
  author_name: string
  authored_date: string
}

interface GitLabDiffEntry {
  old_path: string
  new_path: string
  diff: string
}

interface GitLabCompareResponse {
  commits: GitLabCommit[]
  diffs: GitLabDiffEntry[]
}

/** GitLab API 호출 공통 함수 */
async function gitlabFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'PRIVATE-TOKEN': token, // GitLab 개인 액세스 토큰
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    throw new DiffError(`GitLab API 오류: ${res.status} ${res.statusText}`, url)
  }
  return res.json() as Promise<T>
}

/** compare 엔드포인트 URL을 생성 */
function compareUrl(host: string, encodedPath: string, fromSha: string): string {
  return `${host}/api/v4/projects/${encodedPath}/repository/compare?from=${fromSha}&to=HEAD&straight=false`
}

/** baselineSha 이후 새 커밋 수를 확인합니다 */
export async function checkNewCommitsGitLab(
  repoUrl: string,
  baselineSha: string,
  token: string
): Promise<{ hasNew: boolean; commitCount: number }> {
  if (!baselineSha) return { hasNew: false, commitCount: 0 }
  const { host, projectPath } = parseGitLabUrl(repoUrl)
  const encoded = encodeURIComponent(projectPath)
  logger.debug('GitLab compare 요청', { host, projectPath })
  const data = await gitlabFetch<GitLabCompareResponse>(compareUrl(host, encoded, baselineSha), token)
  return { hasNew: data.commits.length > 0, commitCount: data.commits.length }
}

/** baselineSha 이후 커밋 목록을 반환합니다 */
export async function getCommitListGitLab(
  repoUrl: string,
  baselineSha: string,
  token: string
): Promise<Array<{ sha: string; message: string; author: string; date: string }>> {
  if (!baselineSha) return []
  const { host, projectPath } = parseGitLabUrl(repoUrl)
  const encoded = encodeURIComponent(projectPath)
  const data = await gitlabFetch<GitLabCompareResponse>(compareUrl(host, encoded, baselineSha), token)
  return data.commits.map((c) => ({
    sha: c.id,
    message: c.message.split('\n')[0] ?? '', // 커밋 메시지 첫 줄만 사용
    author: c.author_name,
    date: c.authored_date,
  }))
}

/**
 * diff를 추출합니다.
 *
 * GitLab API는 파일별 diff를 배열로 반환하므로 git diff 형식으로 재조합합니다.
 * toSha: compare 응답 commits 배열의 첫 번째 커밋(가장 최신) SHA
 */
export async function getDiffGitLab(
  repoUrl: string,
  baselineSha: string,
  token: string
): Promise<{ diff: string; toSha: string }> {
  if (!baselineSha) throw new DiffError('baselineSha가 설정되지 않았습니다', repoUrl)
  const { host, projectPath } = parseGitLabUrl(repoUrl)
  const encoded = encodeURIComponent(projectPath)
  const data = await gitlabFetch<GitLabCompareResponse>(compareUrl(host, encoded, baselineSha), token)

  if (data.commits.length === 0) {
    return { diff: '', toSha: baselineSha }
  }

  // 파일별 diff 배열을 하나의 git diff 형식 문자열로 합침
  const diff = data.diffs
    .map((d) => `diff --git a/${d.old_path} b/${d.new_path}\n${d.diff}`)
    .join('\n')

  // GitLab compare: commits[0]이 가장 최신 커밋
  const toSha = data.commits[0]?.id ?? baselineSha

  return { diff, toSha }
}
