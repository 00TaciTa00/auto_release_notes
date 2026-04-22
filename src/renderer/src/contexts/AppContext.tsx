import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Repository, ReleaseNote, GlobalSettings } from '../../../shared/types'
import { api } from '../lib/api'

interface AppContextValue {
  repos: Repository[]
  setRepos: (repos: Repository[]) => void
  selectedRepoId: string | null
  setSelectedRepoId: (id: string | null) => void
  selectedRepo: Repository | null
  releaseNotes: ReleaseNote[]
  setReleaseNotes: (notes: ReleaseNote[]) => void
  settings: GlobalSettings
  setSettings: (s: GlobalSettings) => void
  addRepo: (repo: Repository) => void
  deleteRepo: (id: string) => void
  updateRepo: (id: string, patch: Partial<Repository>) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const DEFAULT_SETTINGS: GlobalSettings = {
  appLanguage: 'ko',
  appTheme: 'light',
  startupLaunch: false,
  webhookEnabled: false,
  webhookPort: 45678,
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [repos, setRepos] = useState<Repository[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null)
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([])
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS)

  // 앱 시작 시 DB에서 데이터 로드
  useEffect(() => {
    Promise.all([api.repo.getAll(), api.settings.get()]).then(([loadedRepos, loadedSettings]) => {
      setRepos(loadedRepos)
      setSelectedRepoId(loadedRepos[0]?.id ?? null)
      setSettings(loadedSettings)
    })
  }, [])

  // 선택 레포 변경 시 해당 릴리즈 노트 로드
  useEffect(() => {
    if (!selectedRepoId) {
      setReleaseNotes([])
      return
    }
    api.releaseNote.getByRepo(selectedRepoId).then(setReleaseNotes)
  }, [selectedRepoId])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.appTheme)
  }, [settings.appTheme])

  const selectedRepo = repos.find((r) => r.id === selectedRepoId) ?? null

  // repo는 이미 api.repo.add로 DB 저장 후 전달받은 값
  function addRepo(repo: Repository) {
    setRepos((prev) => [...prev, repo])
    setSelectedRepoId(repo.id)
  }

  function deleteRepo(id: string) {
    api.repo.delete(id)
    setRepos((prev) => {
      const remaining = prev.filter((r) => r.id !== id)
      setSelectedRepoId((current) => (current === id ? (remaining[0]?.id ?? null) : current))
      return remaining
    })
  }

  function updateRepo(id: string, patch: Partial<Repository>) {
    api.repo.updateSettings(id, patch)
    setRepos((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <AppContext.Provider
      value={{
        repos,
        setRepos,
        selectedRepoId,
        setSelectedRepoId,
        selectedRepo,
        releaseNotes,
        setReleaseNotes,
        settings,
        setSettings,
        addRepo,
        deleteRepo,
        updateRepo,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
