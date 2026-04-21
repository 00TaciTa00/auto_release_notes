export type Platform = 'gitlab' | 'github'

export type DiffSource = 'api' | 'local-git'

export type AIProvider = 'claude' | 'openai'

export type SummaryLanguage = 'ko' | 'en' | 'both'

export type SummaryStyle = 'detailed' | 'concise' | 'technical'

export type ChangeType = 'bug_fix' | 'feature' | 'ui' | 'performance'

export interface Repository {
  id: string
  name: string
  platform: Platform
  diffSource: DiffSource
  repoUrl: string
  localPath?: string
  aiProvider: AIProvider
  summaryLanguage: SummaryLanguage
  summaryStyle: SummaryStyle
  baselineSha: string
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export interface SecurityExclusionRule {
  id: number
  repoId: string
  pattern: string
  createdAt: string
}

export interface ReleaseNote {
  id: number
  repoId: string
  fromSha: string
  toSha: string
  versionTag?: string
  rawDiff: string
  aiDraftKo?: string
  aiDraftEn?: string
  editedKo?: string
  editedEn?: string
  changeTypes: ChangeType[]
  createdAt: string
  updatedAt: string
}

export interface GlobalSettings {
  appLanguage: 'ko' | 'en'
  appTheme: 'light' | 'dark'
  startupLaunch: boolean
  webhookEnabled: boolean
  webhookPort: number
}

/** diff:get-commits IPC 응답 — GitGraph 표시용 */
export interface CommitInfo {
  sha: string
  message: string
  author: string
  date: string
}

/** electron-store에 저장되는 민감 정보 (암호화) */
export interface SecureStore {
  claudeApiKey?: string
  openaiApiKey?: string
  naverWorksApiKey?: string
  webhookSecretToken?: string
}
