import { getDb } from './index'
import type { GlobalSettings } from '../shared/types'
import { DatabaseError } from '../shared/error'

export function getSettings(): GlobalSettings {
  try {
    const rows = getDb()
      .prepare('SELECT key, value FROM global_settings')
      .all() as { key: string; value: string }[]
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return {
      appLanguage: (m['app_language'] ?? 'ko') as 'ko' | 'en',
      appTheme: (m['app_theme'] ?? 'light') as 'light' | 'dark',
      startupLaunch: m['startup_launch'] === 'true',
      webhookEnabled: m['webhook_enabled'] === 'true',
      webhookPort: Number(m['webhook_port'] ?? '45678'),
    }
  } catch (err) {
    throw new DatabaseError(`설정 조회 실패: ${err}`)
  }
}

export function updateSettings(patch: Partial<GlobalSettings>): void {
  try {
    const db = getDb()
    const upsert = db.prepare(
      `INSERT OR REPLACE INTO global_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))`
    )
    const run = db.transaction(() => {
      if (patch.appLanguage !== undefined) upsert.run('app_language', patch.appLanguage)
      if (patch.appTheme !== undefined) upsert.run('app_theme', patch.appTheme)
      if (patch.startupLaunch !== undefined) upsert.run('startup_launch', String(patch.startupLaunch))
      if (patch.webhookEnabled !== undefined) upsert.run('webhook_enabled', String(patch.webhookEnabled))
      if (patch.webhookPort !== undefined) upsert.run('webhook_port', String(patch.webhookPort))
    })
    run()
  } catch (err) {
    throw new DatabaseError(`설정 업데이트 실패: ${err}`)
  }
}
