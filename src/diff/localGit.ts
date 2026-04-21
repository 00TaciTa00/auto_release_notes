/**
 * 로컬 git CLI를 통한 diff 추출
 *
 * diff_source = 'local-git' 인 레포에서 사용됩니다.
 * child_process.execSync으로 git 명령어를 실행하며,
 * 실행 환경에 git이 설치되어 있어야 합니다.
 *
 * 장점: API 인증 불필요, 오프라인 동작
 * 단점: git 설치 필요, localPath 설정 필요
 */

import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process'
import { DiffError } from '../shared/error'

const EXEC_OPTS: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf-8',
  maxBuffer: 50 * 1024 * 1024, // 최대 50MB diff 허용
}

/** git 명령어를 실행하고 stdout 문자열을 반환 */
function git(localPath: string, args: string): string {
  try {
    // 경로에 공백이 있을 수 있으므로 큰따옴표로 감쌈
    return execSync(`git -C "${localPath}" ${args}`, EXEC_OPTS)
  } catch (err) {
    throw new DiffError(`git 명령어 실패 (${args.split(' ')[0]}): ${err}`, localPath)
  }
}

/** 현재 HEAD 커밋의 SHA (40자 전체)를 반환 */
export function getHeadSha(localPath: string): string {
  return git(localPath, 'rev-parse HEAD').trim()
}

/** baselineSha 이후 새 커밋 수를 반환 */
export function countNewCommits(localPath: string, baselineSha: string): number {
  if (!baselineSha) return 0
  const output = git(localPath, `log --oneline "${baselineSha}..HEAD"`)
  return output.trim().split('\n').filter(Boolean).length
}

/**
 * baselineSha 이후 커밋 목록을 반환합니다 (GitGraph 표시용)
 *
 * baselineSha가 없으면 최근 20개 커밋을 반환합니다.
 */
export function getCommitList(
  localPath: string,
  baselineSha: string
): Array<{ sha: string; message: string; author: string; date: string }> {
  // sha|메시지|작성자|ISO 날짜 형식으로 출력
  const fmt = '--pretty=format:%H|%s|%an|%aI'
  const range = baselineSha ? `"${baselineSha}..HEAD"` : '--max-count=20'
  const output = git(localPath, `log ${fmt} ${range}`)
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha = '', message = '', author = '', date = ''] = line.split('|')
      return { sha, message, author, date }
    })
}

/**
 * baselineSha부터 HEAD까지의 raw diff를 반환합니다.
 *
 * baselineSha가 없으면 오류를 던집니다.
 * 레포 등록 시 또는 레포 설정에서 기준 SHA를 먼저 설정하세요.
 */
export function getDiff(localPath: string, baselineSha: string): string {
  if (!baselineSha) {
    throw new DiffError(
      'baselineSha가 설정되지 않았습니다. 레포 설정 > 기준 SHA를 먼저 설정하세요.',
      localPath
    )
  }
  return git(localPath, `diff "${baselineSha}..HEAD"`)
}
