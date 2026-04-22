import Store from 'electron-store'
import { logger } from '../shared/logger'

// 프로덕션에서는 머신별 고유 엔트로피로 키 파생 권장
const ENCRYPTION_KEY = 'sosik-secure-store-v1'

type SecureRecord = Record<string, string>

let _store: Store<SecureRecord> | null = null

function getStore(): Store<SecureRecord> {
  if (!_store) {
    _store = new Store<SecureRecord>({ encryptionKey: ENCRYPTION_KEY, name: 'secure' })
  }
  return _store
}

export function getSecureKey(key: string): string | undefined {
  try {
    return getStore().get(key) as string | undefined
  } catch (err) {
    logger.error('secure store 읽기 실패', { key, err: String(err) })
    return undefined
  }
}

export function setSecureKey(key: string, value: string): void {
  try {
    getStore().set(key, value)
  } catch (err) {
    logger.error('secure store 쓰기 실패', { key, err: String(err) })
    throw err
  }
}

export function deleteSecureKey(key: string): void {
  try {
    getStore().delete(key)
  } catch (err) {
    logger.error('secure store 삭제 실패', { key, err: String(err) })
  }
}
