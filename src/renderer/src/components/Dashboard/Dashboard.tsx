import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { useTranslation } from '../../i18n/useTranslation'
import { Button } from '../common/Button'
import { EmptyState } from '../common/EmptyState'
import { useToast } from '../common/Toast'
import { api } from '../../lib/api'
import { PLATFORM_LABEL, DIFF_SOURCE_LABEL } from '../../../../../shared/constants'
import styles from './Dashboard.module.css'

export function Dashboard() {
  const { selectedRepo, releaseNotes, setReleaseNotes, updateRepo } = useApp()
  const { showToast } = useToast()
  const t = useTranslation()
  const [checking, setChecking] = useState(false)
  const [generating, setGenerating] = useState(false)

  if (!selectedRepo) {
    return <EmptyState icon="🌿" title={t.dashboard.selectRepo} />
  }

  const repoNotes = releaseNotes.filter((n) => n.repoId === selectedRepo.id)
  const lastNote = repoNotes.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]

  /** 새 커밋이 있는지만 확인합니다 (diff 미추출) */
  async function handleCheck() {
    setChecking(true)
    try {
      const result = await api.diff.check(selectedRepo!.id)
      if (result.hasNew) {
        showToast(`${result.commitCount}${t.dashboard.hasNewCommits}`, 'success')
      } else {
        showToast(t.dashboard.noNewCommits, 'info')
      }
    } catch {
      showToast(t.dashboard.checkError, 'error')
    } finally {
      setChecking(false)
    }
  }

  /**
   * diff를 추출하고 AI 요약을 생성합니다.
   *
   * 흐름: diff:extract → ai:generate → 릴리즈 노트 목록에 추가
   * baselineSha는 ai:generate 내부에서 toSha로 자동 업데이트됩니다.
   */
  async function handleGenerate() {
    setGenerating(true)
    try {
      const { diff, fromSha, toSha } = await api.diff.extract(selectedRepo!.id)
      if (!diff.trim()) {
        showToast(t.dashboard.noDiff, 'info')
        return
      }

      const note = await api.ai.generate(selectedRepo!.id, diff, fromSha, toSha)

      setReleaseNotes([note, ...releaseNotes])
      updateRepo(selectedRepo!.id, { baselineSha: toSha })
      showToast(t.dashboard.noteGenerated, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다'
      showToast(msg, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const webhookUrl = `http://localhost:45678/webhook/${selectedRepo.id}`

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl)
    showToast(t.dashboard.webhookCopied, 'success')
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.repoName}>{selectedRepo.name}</h2>
          <div className={styles.badges}>
            <span className={styles.badge}>{PLATFORM_LABEL[selectedRepo.platform]}</span>
            <span className={styles.badge}>{DIFF_SOURCE_LABEL[selectedRepo.diffSource]}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={handleCheck} loading={checking} variant="secondary">
            {t.dashboard.checkCommits}
          </Button>
          <Button onClick={handleGenerate} loading={generating} variant="primary">
            {t.dashboard.generateNote}
          </Button>
        </div>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>{t.dashboard.repoUrl}</span>
          <span className={styles.cardValue}>{selectedRepo.repoUrl}</span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>{t.dashboard.lastNote}</span>
          <span className={styles.cardValue}>
            {lastNote
              ? new Date(lastNote.createdAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : t.dashboard.noNoteYet}
          </span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>{t.dashboard.noteCount}</span>
          <span className={styles.cardValue}>
            {repoNotes.length}{t.dashboard.noteCountUnit}
          </span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>{t.dashboard.aiLanguage}</span>
          <span className={styles.cardValue}>
            {selectedRepo.summaryLanguage === 'ko'
              ? '한국어'
              : selectedRepo.summaryLanguage === 'en'
                ? 'English'
                : '한국어 + English'}
          </span>
        </div>
      </div>

      <div className={styles.webhookSection}>
        <h3 className={styles.sectionTitle}>{t.dashboard.webhookTitle}</h3>
        <p className={styles.sectionDesc}>{t.dashboard.webhookDesc}</p>
        <div className={styles.webhookUrl}>
          <code className={styles.urlText}>{webhookUrl}</code>
          <Button size="sm" variant="secondary" onClick={copyWebhookUrl}>
            {t.common.copy}
          </Button>
        </div>
      </div>
    </div>
  )
}
