import { useState, useEffect } from 'react'
import { useApp } from '../../contexts/AppContext'
import { Button } from '../common/Button'
import { EmptyState } from '../common/EmptyState'
import { useToast } from '../common/Toast'
import { api } from '../../lib/api'
import type { CommitInfo } from '../../../../../shared/types'
import styles from './GitGraph.module.css'

export function GitGraph() {
  const { selectedRepo } = useApp()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [commits, setCommits] = useState<CommitInfo[]>([])

  // 선택 레포 변경 시 커밋 목록 자동 로드
  useEffect(() => {
    if (!selectedRepo?.id) {
      setCommits([])
      return
    }
    setLoading(true)
    api.diff
      .getCommits(selectedRepo.id)
      .then(setCommits)
      .catch(() => {
        // baselineSha 미설정 등으로 실패할 수 있음 — 조용히 빈 목록 유지
        setCommits([])
      })
      .finally(() => setLoading(false))
  }, [selectedRepo?.id])

  if (!selectedRepo) return <EmptyState icon="🌿" title="레포지토리를 선택해주세요" />

  /** 커밋 목록을 다시 불러옵니다 */
  async function handleRefresh() {
    setLoading(true)
    try {
      const updated = await api.diff.getCommits(selectedRepo!.id)
      setCommits(updated)
      showToast('커밋 내역을 새로고침했습니다', 'success')
    } catch {
      showToast('커밋 내역을 불러오는 중 오류가 발생했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>커밋 내역</h3>
          <p className={styles.baseline}>
            기준 SHA: <code className={styles.sha}>{selectedRepo.baselineSha || '(없음)'}</code>
          </p>
        </div>
        <Button variant="secondary" onClick={handleRefresh} loading={loading} size="sm">
          새로고침
        </Button>
      </div>

      {commits.length === 0 ? (
        <EmptyState
          icon="📋"
          title={
            selectedRepo.baselineSha
              ? '새 커밋이 없습니다'
              : '기준 SHA가 설정되지 않았습니다'
          }
        />
      ) : (
        <div className={styles.table}>
          <div className={styles.thead}>
            <span>SHA</span>
            <span>메시지</span>
            <span>작성자</span>
            <span>날짜</span>
          </div>
          {commits.map((c) => (
            <div key={c.sha} className={styles.row}>
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
