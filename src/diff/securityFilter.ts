/**
 * 보안 파일 제외 필터
 *
 * diff 텍스트에서 민감 파일(API 키, 인증서, 환경변수 등)이 포함된
 * 파일 블록을 제거합니다.
 *
 * ⚠️  CLAUDE.md 제약: AI 전송 전 반드시 이 필터를 먼저 적용할 것.
 * 순서를 바꾸면 민감 정보가 AI API로 유출될 수 있습니다.
 */

/**
 * 글로브 패턴 → 정규식 변환
 *
 * 지원 패턴:
 *   **  슬래시 포함 모든 문자열
 *   *   슬래시 제외 모든 문자열
 *   ?   슬래시 제외 단일 문자
 *
 * 예시:
 *   **\/.env  →  any path ending in /.env
 *   *.pem     →  any .pem filename (no slashes)
 *   secrets\/**  →  anything under secrets/
 */
function globToRegex(pattern: string): RegExp {
  let result = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!
    if (ch === '*' && pattern[i + 1] === '*') {
      // ** → 슬래시 포함 모든 문자
      result += '.*'
      i++ // 다음 * 건너뜀
    } else if (ch === '*') {
      // * → 슬래시 제외 모든 문자
      result += '[^/]*'
    } else if (ch === '?') {
      // ? → 슬래시 제외 단일 문자
      result += '[^/]'
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      // 정규식 특수문자 이스케이프
      result += '\\' + ch
    } else {
      result += ch
    }
  }
  return new RegExp(`^${result}$`)
}

/**
 * 파일 경로가 제외 패턴 중 하나에 해당하는지 확인
 *
 * 전체 경로와 파일명(basename) 양쪽으로 패턴을 체크합니다.
 * 예: 패턴 "*.pem"은 "certs/server.pem"의 "server.pem" 파일명에도 매칭됩니다.
 */
function isExcluded(filePath: string, patterns: string[]): boolean {
  const basename = filePath.split('/').pop() ?? filePath
  return patterns.some((pattern) => {
    const regex = globToRegex(pattern)
    return regex.test(filePath) || regex.test(basename)
  })
}

/**
 * diff 텍스트에서 보안 파일 블록을 제거하여 반환합니다.
 *
 * @param rawDiff      git diff 출력 또는 API에서 받은 diff 텍스트
 * @param patterns     제외할 파일 글로브 패턴 목록
 *                     (예: ["**\/.env", "*.pem", "secrets\/**"])
 * @returns 보안 파일이 제거된 diff 텍스트
 */
export function applySecurityFilter(rawDiff: string, patterns: string[]): string {
  if (patterns.length === 0) return rawDiff

  // diff를 파일 블록 단위로 분리 — 각 블록은 "diff --git a/..." 로 시작
  const blocks = rawDiff.split(/(?=^diff --git )/m)

  const kept = blocks.filter((block) => {
    if (!block.startsWith('diff --git')) return true // 헤더·빈 블록 유지

    // "diff --git a/path b/path" 에서 파일 경로 추출
    const match = block.match(/^diff --git a\/(.*?) b\//)
    if (!match) return true

    const filePath = match[1]!
    const excluded = isExcluded(filePath, patterns)
    if (excluded) {
      // 제외된 파일은 로그로 기록 (main process에서만 동작)
      process.stdout.write(`[security-filter] excluded: ${filePath}\n`)
    }
    return !excluded
  })

  return kept.join('')
}
