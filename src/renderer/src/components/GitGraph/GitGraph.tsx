import { useState, useEffect } from 'react'
import { useApp } from '../../contexts/AppContext'
import { useTranslation } from '../../i18n/useTranslation'
import { Button } from '../common/Button'
import { EmptyState } from '../common/EmptyState'
import { useToast } from '../common/Toast'
import { api } from '../../lib/api'
import type { CommitInfo } from '../../../../../shared/types'
import styles from './GitGraph.module.css'

export function GitGraph() {
  const { selectedRepo } = useApp()
  const { showToast } = useToast()
  const t = useTranslation()
  const [loading, setLoading] = useState(false)
  const [commits, setCommits] = useState<CommitInfo[]>([])

  useEffect(() => {
    if (!selectedRepo?.id) {
      setCommits([])
      return
    }
    setLoading(true)
    api.diff
      .getCommits(selectedRepo.id)
      .then(setCommits)
      .catch(() => setCommits([]))
      .finally(() => setLoading(false))
  }, [selectedRepo?.id])

  if (!selectedRepo) return <EmptyState icon="🌿" title={t.gitGraph.selectRepo} />

  async function handleRefresh() {
    setLoading(true)
    try {
      const updated = await api.diff.getCommits(selectedRepo!.id)
      setCommits(updated)
      showToast(t.gitGraph.refreshed, 'success')
    } catch {
      showToast(t.gitGraph.refreshError, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{t.gitGraph.title}</h3>
          <p className={styles.baseline}>
            {t.gitGraph.baselineSha}:{' '}
            <code className={styles.sha}>{selectedRepo.baselineSha || t.gitGraph.noBaseline}</code>
          </p>
        </div>
        <Button variant="secondary" onClick={handleRefresh} loading={loading} size="sm">
          {t.common.refresh}
        </Button>
      </div>

      {commits.length === 0 ? (
        <EmptyState
          icon="📋"
          title={selectedRepo.baselineSha ? t.gitGraph.noNewCommits : t.gitGraph.noBaselineSet}
        />
      ) : (
        <div className={styles.graphWrap}>
          <div className={styles.thead}>
            <span />
            <span>{t.gitGraph.colSha}</span>
            <span>{t.gitGraph.colMessage}</span>
            <span>{t.gitGraph.colAuthor}</span>
            <span>{t.gitGraph.colDate}</span>
          </div>
          {commits.map((c, i) => (
            <div key={c.sha} className={styles.row}>
              {/* 그래프 열: 커밋 원(node) + 연결선(connector) */}
              <div className={styles.nodeCol}>
                <div className={styles.node} />
                {i < commits.length - 1 && <div className={styles.connector} />}
              </div>
              <code className={styles.sha}>{c.sha.slice(0, 7)}</code>
              <span className={styles.message}>{c.message}</span>
              <span className={styles.author}>{c.author}</span>
              <span className={styles.date}>
                {new Date(c.date).toLocaleDateString('ko-KR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
