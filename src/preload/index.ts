import { contextBridge, ipcRenderer } from 'electron'

const ALLOWED_CHANNELS = [
  'repo:get-all',
  'repo:add',
  'repo:update-settings',
  'repo:delete',
  'release-note:get-by-repo',
  'release-note:update',
  'settings:get',
  'settings:update',
  'secure:get-api-key',
  'secure:set-api-key',
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
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
