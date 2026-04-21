import { getDb } from './index'
import type { Repository } from '../shared/types'
import { DatabaseError } from '../shared/error'

interface RepoRow {
  id: string
  name: string
  platform: string
  diff_source: string
  repo_url: string
  local_path: string | null
  ai_provider: string
  summary_language: string
  summary_style: string
  baseline_sha: string | null
  display_order: number
  created_at: string
  updated_at: string
}

function rowToRepo(row: RepoRow): Repository {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform as Repository['platform'],
    diffSource: row.diff_source as Repository['diffSource'],
    repoUrl: row.repo_url,
    localPath: row.local_path ?? undefined,
    aiProvider: row.ai_provider as Repository['aiProvider'],
    summaryLanguage: row.summary_language as Repository['summaryLanguage'],
    summaryStyle: row.summary_style as Repository['summaryStyle'],
    baselineSha: row.baseline_sha ?? '',
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getAllRepos(): Repository[] {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM repositories ORDER BY display_order ASC, created_at ASC')
      .all() as RepoRow[]
    return rows.map(rowToRepo)
  } catch (err) {
    throw new DatabaseError(`레포 조회 실패: ${err}`)
  }
}

/** ID로 단일 레포를 조회합니다. IPC 핸들러에서 레포 존재 확인용으로 사용 */
export function getRepoById(id: string): Repository | null {
  try {
    const row = getDb()
      .prepare('SELECT * FROM repositories WHERE id = ?')
      .get(id) as RepoRow | null
    return row ? rowToRepo(row) : null
  } catch (err) {
    throw new DatabaseError(`레포 단건 조회 실패: ${err}`)
  }
}

export function addRepo(repo: Repository): Repository {
  try {
    const now = new Date().toISOString()
    getDb()
      .prepare(
        `INSERT INTO repositories
          (id, name, platform, diff_source, repo_url, local_path,
           ai_provider, summary_language, summary_style,
           baseline_sha, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        repo.id,
        repo.name,
        repo.platform,
        repo.diffSource,
        repo.repoUrl,
        repo.localPath ?? null,
        repo.aiProvider,
        repo.summaryLanguage,
        repo.summaryStyle,
        repo.baselineSha || null,
        repo.displayOrder,
        now,
        now
      )
    return { ...repo, createdAt: now, updatedAt: now }
  } catch (err) {
    throw new DatabaseError(`레포 추가 실패: ${err}`)
  }
}

type WritableRepoFields = Pick<
  Repository,
  'name' | 'aiProvider' | 'summaryLanguage' | 'summaryStyle' | 'baselineSha' | 'displayOrder'
>

export function updateRepoSettings(id: string, patch: Partial<WritableRepoFields>): void {
  try {
    const now = new Date().toISOString()
    const sets: string[] = ['updated_at = ?']
    const params: unknown[] = [now]

    if (patch.name !== undefined) {
      sets.push('name = ?')
      params.push(patch.name)
    }
    if (patch.aiProvider !== undefined) {
      sets.push('ai_provider = ?')
      params.push(patch.aiProvider)
    }
    if (patch.summaryLanguage !== undefined) {
      sets.push('summary_language = ?')
      params.push(patch.summaryLanguage)
    }
    if (patch.summaryStyle !== undefined) {
      sets.push('summary_style = ?')
      params.push(patch.summaryStyle)
    }
    if (patch.baselineSha !== undefined) {
      sets.push('baseline_sha = ?')
      params.push(patch.baselineSha)
    }
    if (patch.displayOrder !== undefined) {
      sets.push('display_order = ?')
      params.push(patch.displayOrder)
    }

    params.push(id)
    getDb()
      .prepare(`UPDATE repositories SET ${sets.join(', ')} WHERE id = ?`)
      .run(...(params as readonly unknown[]))
  } catch (err) {
    throw new DatabaseError(`레포 설정 업데이트 실패: ${err}`)
  }
}

export function deleteRepo(id: string): void {
  try {
    getDb().prepare('DELETE FROM repositories WHERE id = ?').run(id)
  } catch (err) {
    throw new DatabaseError(`레포 삭제 실패: ${err}`)
  }
}
