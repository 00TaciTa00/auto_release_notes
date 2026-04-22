import { contextBridge, ipcRenderer } from 'electron'

/**
 * 허용된 IPC 채널 화이트리스트
 *
 * renderer에서 호출할 수 있는 채널을 명시적으로 제한합니다.
 * 새 IPC 채널 추가 시 반드시 여기에도 추가하세요.
 * 목록에 없는 채널 호출은 즉시 reject됩니다.
 */
const ALLOWED_CHANNELS = [
  // 레포지토리 CRUD
  'repo:get-all',
  'repo:add',
  'repo:update-settings',
  'repo:delete',
  // 릴리즈 노트 CRUD
  'release-note:get-by-repo',
  'release-note:update',
  // 전역 설정
  'settings:get',
  'settings:update',
  // 암호화 저장소 (API 키, 액세스 토큰)
  'secure:get-api-key',
  'secure:set-api-key',
  // diff 추출
  'diff:check',
  'diff:get-commits',
  'diff:extract',
  // AI 요약 생성
  'ai:generate',
  // 보안 파일 제외 규칙
  'security-rule:get-by-repo',
  'security-rule:add',
  'security-rule:remove',
] as const

type AllowedChannel = (typeof ALLOWED_CHANNELS)[number]

function isAllowed(channel: string): channel is AllowedChannel {
  return (ALLOWED_CHANNELS as readonly string[]).includes(channel)
}

const api = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (!isAllowed(channel)) {
      return Promise.reject(new Error(`허용되지 않은 IPC 채널: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!isAllowed(channel)) return () => {}
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void =>
      callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
