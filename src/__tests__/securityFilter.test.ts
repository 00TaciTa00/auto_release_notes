import { applySecurityFilter } from '../diff/securityFilter'

/** 테스트용 diff 블록 생성 헬퍼 */
function makeDiff(files: { path: string; content?: string }[]): string {
  return files
    .map(
      ({ path, content = '+changed line' }) =>
        `diff --git a/${path} b/${path}\n` +
        `--- a/${path}\n` +
        `+++ b/${path}\n` +
        `@@ -1 +1 @@\n` +
        `${content}\n`
    )
    .join('')
}

describe('applySecurityFilter', () => {
  describe('패턴 없음', () => {
    it('빈 패턴 배열이면 diff를 그대로 반환한다', () => {
      const diff = makeDiff([{ path: 'src/index.ts' }])
      expect(applySecurityFilter(diff, [])).toBe(diff)
    })

    it('빈 diff + 패턴 있어도 빈 문자열을 반환한다', () => {
      expect(applySecurityFilter('', ['*.env'])).toBe('')
    })
  })

  describe('basename 패턴 (* 와일드카드)', () => {
    it('*.env 패턴이 최상위 .env 파일을 제외한다', () => {
      const diff = makeDiff([{ path: 'src/index.ts' }, { path: '.env' }])
      const result = applySecurityFilter(diff, ['*.env'])
      expect(result).toContain('src/index.ts')
      expect(result).not.toContain('a/.env')
    })

    it('*.pem 패턴이 하위 경로의 .pem 파일도 제외한다 (basename 매칭)', () => {
      const diff = makeDiff([{ path: 'src/app.ts' }, { path: 'certs/server.pem' }])
      const result = applySecurityFilter(diff, ['*.pem'])
      expect(result).toContain('src/app.ts')
      expect(result).not.toContain('certs/server.pem')
    })

    it('*.key 패턴이 깊은 경로의 파일에도 적용된다', () => {
      const diff = makeDiff([
        { path: 'src/utils.ts' },
        { path: 'config/ssl/private.key' },
      ])
      const result = applySecurityFilter(diff, ['*.key'])
      expect(result).toContain('src/utils.ts')
      expect(result).not.toContain('config/ssl/private.key')
    })
  })

  describe('** 경로 글로브 패턴', () => {
    it('**/.env 패턴이 모든 경로의 .env 파일을 제외한다', () => {
      const diff = makeDiff([
        { path: 'src/index.ts' },
        { path: 'config/.env' },
        { path: 'nested/deep/.env' },
      ])
      const result = applySecurityFilter(diff, ['**/.env'])
      expect(result).toContain('src/index.ts')
      expect(result).not.toContain('config/.env')
      expect(result).not.toContain('nested/deep/.env')
    })

    it('secrets/** 패턴이 secrets/ 하위 모든 파일을 제외한다', () => {
      const diff = makeDiff([
        { path: 'src/app.ts' },
        { path: 'secrets/api-key.json' },
        { path: 'secrets/certs/ca.pem' },
      ])
      const result = applySecurityFilter(diff, ['secrets/**'])
      expect(result).toContain('src/app.ts')
      expect(result).not.toContain('secrets/api-key.json')
      expect(result).not.toContain('secrets/certs/ca.pem')
    })

    it('**/*.json 패턴이 모든 경로의 .json 파일을 제외한다', () => {
      const diff = makeDiff([
        { path: 'src/index.ts' },
        { path: 'package.json' },
        { path: 'config/auth.json' },
      ])
      const result = applySecurityFilter(diff, ['**/*.json'])
      expect(result).toContain('src/index.ts')
      expect(result).not.toContain('package.json')
      expect(result).not.toContain('config/auth.json')
    })
  })

  describe('복수 패턴 동시 적용', () => {
    it('여러 패턴을 모두 적용한다', () => {
      const diff = makeDiff([
        { path: 'src/index.ts' },
        { path: '.env' },
        { path: 'private.pem' },
        { path: 'secrets/token.json' },
      ])
      const result = applySecurityFilter(diff, ['*.env', '*.pem', 'secrets/**'])
      expect(result).toContain('src/index.ts')
      expect(result).not.toContain('a/.env')
      expect(result).not.toContain('private.pem')
      expect(result).not.toContain('secrets/token.json')
    })
  })

  describe('매칭 파일 없음', () => {
    it('패턴에 해당하는 파일이 없으면 diff를 그대로 반환한다', () => {
      const diff = makeDiff([{ path: 'src/index.ts' }, { path: 'README.md' }])
      const result = applySecurityFilter(diff, ['*.pem', 'secrets/**'])
      expect(result).toBe(diff)
    })
  })

  describe('모든 파일 제외', () => {
    it('모든 파일이 제외되면 빈 문자열에 가까운 결과를 반환한다', () => {
      const diff = makeDiff([{ path: '.env' }, { path: 'private.pem' }])
      const result = applySecurityFilter(diff, ['*.env', '*.pem'])
      expect(result.trim()).toBe('')
    })
  })
})
