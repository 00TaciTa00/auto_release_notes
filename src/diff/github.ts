/**
 * GitHub REST API v3를 통한 diff 추출
 *
 * 사용 엔드포인트:
 *   GET /repos/{owner}/{repo}/compare/{base}...{head}
 *
 * 응답 구조:
 *   { commits: [...], files: [{ filename, patch }] }
 *
 * 주의: GitHub API는 파일별 patch 크기가 크면 patch 필드를 생략합니다.
 * 이 경우 해당 파일의 diff는 누락됩니다 (바이너리 파일 등).
 */

import { DiffError } from '../shared/error'
import { logger } from '../shared/logger'

/** repoUrl에서 owner와 repo 이름을 추출 */
function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
  // 예: https://github.com/owner/repo-name
  //   → owner: "owner", repo: "repo-name"
  const url = new URL(repoUrl)
  const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
  const owner = parts[0]
  const repo = parts[1]
  if (!owner || !repo) {
    throw new DiffError(`GitHub URL 파싱 실패: ${repoUrl}`)
  }
  return { owner, repo }
}

// GitHub API 응답 타입 정의

interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: { name: string; date: string }
  }
}

interface GitHubFile {
  filename: string
  patch?: string // 바이너리 파일이나 매우 큰 파일은 undefined
}

interface GitHubCompareResponse {
  commits: GitHubCommit[]
  files: GitHubFile[]
}

/** GitHub API 호출 공통 함수 */
async function githubFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })
  if (!res.ok) {
    throw new DiffError(`GitHub API 오류: ${res.status} ${res.statusText}`, url)
  }
  return res.json() as Promise<T>
}

/** compare API URL을 생성 */
function compareUrl(owner: string, repo: string, baseSha: string): string {
  // {base}...{head} 형식: HEAD는 기본 브랜치의 최신 커밋
  return `https://api.github.com/repos/${owner}/${repo}/compare/${baseSha}...HEAD`
}

/** baselineSha 이후 새 커밋 수를 확인합니다 */
export async function checkNewCommitsGitHub(
  repoUrl: string,
  baselineSha: string,
  token: string
): Promise<{ hasNew: boolean; commitCount: number }> {
  if (!baselineSha) return { hasNew: false, commitCount: 0 }
  const { owner, repo } = parseGitHubUrl(repoUrl)
  logger.debug('GitHub compare 요청', { owner, repo })
  const data = await githubFetch<GitHubCompareResponse>(compareUrl(owner, repo, baselineSha), token)
  return { hasNew: data.commits.length > 0, commitCount: data.commits.length }
}

/** baselineSha 이후 커밋 목록을 반환합니다 */
export async function getCommitListGitHub(
  repoUrl: string,
  baselineSha: string,
  token: string
): Promise<Array<{ sha: string; message: string; author: string; date: string }>> {
  if (!baselineSha) return []
  const { owner, repo } = parseGitHubUrl(repoUrl)
  const data = await githubFetch<GitHubCompareResponse>(compareUrl(owner, repo, baselineSha), token)
  return data.commits.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0] ?? '', // 커밋 메시지 첫 줄만
    author: c.commit.author.name,
    date: c.commit.author.date,
  }))
}

/**
 * diff를 추출합니다.
 *
 * GitHub API는 파일별 patch를 반환하므로 git diff 형식으로 재조합합니다.
 * toSha: GitHub compare commits 배열은 시간순(오래된 것 먼저)이므로 마지막 커밋이 HEAD
 */
export async function getDiffGitHub(
  repoUrl: string,
  baselineSha: string,
  token: string
): Promise<{ diff: string; toSha: string }> {
  if (!baselineSha) throw new DiffError('baselineSha가 설정되지 않았습니다', repoUrl)
  const { owner, repo } = parseGitHubUrl(repoUrl)
  const data = await githubFetch<GitHubCompareResponse>(compareUrl(owner, repo, baselineSha), token)

  if (data.commits.length === 0) {
    return { diff: '', toSha: baselineSha }
  }

  // patch가 있는 파일만 포함 (바이너리 또는 매우 큰 파일은 제외됨)
  const diff = data.files
    .filter((f) => f.patch)
    .map((f) => `diff --git a/${f.filename} b/${f.filename}\n${f.patch ?? ''}`)
    .join('\n')

  // GitHub compare API: commits는 시간순이므로 마지막이 가장 최신
  const toSha = data.commits[data.commits.length - 1]?.sha ?? baselineSha

  return { diff, toSha }
}
