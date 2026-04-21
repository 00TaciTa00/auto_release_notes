/**
 * 보안 파일 제외 규칙 CRUD
 *
 * 레포별로 완전히 독립적인 규칙 세트를 관리합니다.
 * diff 추출 시 main process에서 직접 호출되며,
 * IPC를 통해 renderer에서 패턴을 추가/삭제할 수 있습니다.
 */

import { getDb } from './index'
import type { SecurityExclusionRule } from '../shared/types'
import { DatabaseError } from '../shared/error'

interface SecurityRuleRow {
  id: number
  repo_id: string
  pattern: string
  created_at: string
}

function rowToRule(row: SecurityRuleRow): SecurityExclusionRule {
  return {
    id: row.id,
    repoId: row.repo_id,
    pattern: row.pattern,
    createdAt: row.created_at,
  }
}

/** 레포의 모든 보안 제외 규칙을 반환 */
export function getRulesByRepo(repoId: string): SecurityExclusionRule[] {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM security_exclusion_rules WHERE repo_id = ? ORDER BY created_at ASC')
      .all(repoId) as SecurityRuleRow[]
    return rows.map(rowToRule)
  } catch (err) {
    throw new DatabaseError(`보안 규칙 조회 실패: ${err}`)
  }
}

/** 보안 파일 제외 필터에서 사용하는 패턴 문자열 목록만 반환 */
export function getPatternsByRepo(repoId: string): string[] {
  try {
    const rows = getDb()
      .prepare('SELECT pattern FROM security_exclusion_rules WHERE repo_id = ?')
      .all(repoId) as { pattern: string }[]
    return rows.map((r) => r.pattern)
  } catch (err) {
    throw new DatabaseError(`보안 규칙 패턴 조회 실패: ${err}`)
  }
}

/** 보안 제외 패턴 추가 */
export function addRule(repoId: string, pattern: string): SecurityExclusionRule {
  try {
    const now = new Date().toISOString()
    const result = getDb()
      .prepare('INSERT INTO security_exclusion_rules (repo_id, pattern, created_at) VALUES (?, ?, ?)')
      .run(repoId, pattern, now)
    return { id: Number(result.lastInsertRowid), repoId, pattern, createdAt: now }
  } catch (err) {
    throw new DatabaseError(`보안 규칙 추가 실패: ${err}`)
  }
}

/** 보안 제외 패턴 삭제 */
export function removeRule(id: number): void {
  try {
    getDb().prepare('DELETE FROM security_exclusion_rules WHERE id = ?').run(id)
  } catch (err) {
    throw new DatabaseError(`보안 규칙 삭제 실패: ${err}`)
  }
}
