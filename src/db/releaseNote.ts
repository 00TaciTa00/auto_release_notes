import { getDb } from './index'
import type { ReleaseNote, ChangeType } from '../shared/types'
import { DatabaseError } from '../shared/error'

interface ReleaseNoteRow {
  id: number
  repo_id: string
  from_sha: string
  to_sha: string
  version_tag: string | null
  raw_diff: string
  ai_draft_ko: string | null
  ai_draft_en: string | null
  edited_ko: string | null
  edited_en: string | null
  change_types: string | null
  created_at: string
  updated_at: string
}

function rowToNote(row: ReleaseNoteRow): ReleaseNote {
  return {
    id: row.id,
    repoId: row.repo_id,
    fromSha: row.from_sha,
    toSha: row.to_sha,
    versionTag: row.version_tag ?? undefined,
    rawDiff: row.raw_diff,
    aiDraftKo: row.ai_draft_ko ?? undefined,
    aiDraftEn: row.ai_draft_en ?? undefined,
    editedKo: row.edited_ko ?? undefined,
    editedEn: row.edited_en ?? undefined,
    changeTypes: row.change_types ? (JSON.parse(row.change_types) as ChangeType[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getNotesByRepo(repoId: string): ReleaseNote[] {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM release_notes WHERE repo_id = ? ORDER BY created_at DESC')
      .all(repoId) as ReleaseNoteRow[]
    return rows.map(rowToNote)
  } catch (err) {
    throw new DatabaseError(`릴리즈 노트 조회 실패: ${err}`)
  }
}

/**
 * AI 요약 생성 후 새 릴리즈 노트를 DB에 저장합니다.
 * 생성된 레코드를 반환하며, id와 created_at은 DB가 자동 생성합니다.
 */
export function createNote(
  note: Omit<ReleaseNote, 'id' | 'createdAt' | 'updatedAt'>
): ReleaseNote {
  try {
    const now = new Date().toISOString()
    const result = getDb()
      .prepare(
        `INSERT INTO release_notes
           (repo_id, from_sha, to_sha, version_tag, raw_diff,
            ai_draft_ko, ai_draft_en, change_types, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        note.repoId,
        note.fromSha,
        note.toSha,
        note.versionTag ?? null,
        note.rawDiff,
        note.aiDraftKo ?? null,
        note.aiDraftEn ?? null,
        note.changeTypes.length > 0 ? JSON.stringify(note.changeTypes) : null,
        now,
        now
      )
    return { ...note, id: Number(result.lastInsertRowid), createdAt: now, updatedAt: now }
  } catch (err) {
    throw new DatabaseError(`릴리즈 노트 생성 실패: ${err}`)
  }
}

export function updateNote(id: number, patch: Partial<ReleaseNote>): void {
  try {
    const now = new Date().toISOString()
    const sets: string[] = ['updated_at = ?']
    const params: unknown[] = [now]

    if (patch.editedKo !== undefined) {
      sets.push('edited_ko = ?')
      params.push(patch.editedKo)
    }
    if (patch.editedEn !== undefined) {
      sets.push('edited_en = ?')
      params.push(patch.editedEn)
    }
    if (patch.changeTypes !== undefined) {
      sets.push('change_types = ?')
      params.push(JSON.stringify(patch.changeTypes))
    }
    if (patch.versionTag !== undefined) {
      sets.push('version_tag = ?')
      params.push(patch.versionTag)
    }

    params.push(id)
    getDb()
      .prepare(`UPDATE release_notes SET ${sets.join(', ')} WHERE id = ?`)
      .run(...(params as readonly unknown[]))
  } catch (err) {
    throw new DatabaseError(`릴리즈 노트 업데이트 실패: ${err}`)
  }
}
