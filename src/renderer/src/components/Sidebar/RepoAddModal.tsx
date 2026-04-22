import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { useToast } from '../common/Toast'
import { api } from '../../lib/api'
import type { Platform, DiffSource, Repository } from '../../../../shared/types'
import styles from './RepoAddModal.module.css'

interface RepoAddModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (repo: Repository) => void
}

export function RepoAddModal({ isOpen, onClose, onAdd }: RepoAddModalProps) {
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<Platform>('gitlab')
  const [diffSource, setDiffSource] = useState<DiffSource>('api')
  const [repoUrl, setRepoUrl] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !repoUrl.trim()) return

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const repoPayload: Repository = {
        id: uuidv4(),
        name: name.trim(),
        platform,
        diffSource,
        repoUrl: repoUrl.trim(),
        localPath: diffSource === 'local-git' ? localPath.trim() || undefined : undefined,
        aiProvider: 'claude',
        summaryLanguage: 'ko',
        summaryStyle: 'detailed',
        baselineSha: '',
        displayOrder: 0,
        createdAt: now,
        updatedAt: now,
      }

      const saved = await api.repo.add(repoPayload)

      if (accessToken.trim()) {
        await api.secure.setApiKey(`repo:${saved.id}:access_token`, accessToken.trim())
      }

      onAdd(saved)
      resetForm()
      onClose()
    } catch {
      showToast('레포지토리 추가에 실패했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setName('')
    setPlatform('gitlab')
    setDiffSource('api')
    setRepoUrl('')
    setLocalPath('')
    setAccessToken('')
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="레포지토리 추가">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>표시 이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: frontend-service"
            className={styles.input}
            required
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>플랫폼</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className={styles.input}
            >
              <option value="gitlab">GitLab</option>
              <option value="github">GitHub</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Diff 소스</label>
            <select
              value={diffSource}
              onChange={(e) => setDiffSource(e.target.value as DiffSource)}
              className={styles.input}
            >
              <option value="api">API 방식</option>
              <option value="local-git">로컬 git</option>
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>저장소 URL *</label>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://gitlab.com/example/repo"
            className={styles.input}
            required
          />
        </div>

        {diffSource === 'local-git' && (
          <div className={styles.field}>
            <label className={styles.label}>로컬 경로</label>
            <input
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="/home/user/projects/my-repo"
              className={styles.input}
            />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>액세스 토큰</label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="glpat-xxxxxxxxxxxx"
            className={styles.input}
            autoComplete="off"
          />
          <p className={styles.hint}>암호화되어 안전하게 저장됩니다</p>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim() || !repoUrl.trim()}
            loading={saving}
          >
            추가
          </Button>
        </div>
      </form>
    </Modal>
  )
}
