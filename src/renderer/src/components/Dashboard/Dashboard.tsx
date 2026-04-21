import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { Button } from '../common/Button'
import { EmptyState } from '../common/EmptyState'
import { useToast } from '../common/Toast'
import { api } from '../../lib/api'
import styles from './Dashboard.module.css'

const PLATFORM_LABEL: Record<string, string> = { gitlab: 'GitLab', github: 'GitHub' }
const DIFF_SOURCE_LABEL: Record<string, string> = { api: 'REST API', 'local-git': '로컬 git' }

export function Dashboard() {
  const { selectedRepo, releaseNotes, setReleaseNotes, updateRepo } = useApp()
  const { showToast } = useToast()
  const [checking, setChecking] = useState(false)
  const [generating, setGenerating] = useState(false)

  if (!selectedRepo) {
    return <EmptyState icon="🌿" title="레포지토리를 선택해주세요" />
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
        showToast(`${result.commitCount}개의 새 커밋이 있습니다`, 'success')
      } else {
        showToast('새 커밋이 없습니다', 'info')
      }
    } catch {
      showToast('커밋 확인 중 오류가 발생했습니다', 'error')
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
      // 1. diff 추출 + 보안 파일 제외 필터 적용
      const { diff, fromSha, toSha } = await api.diff.extract(selectedRepo!.id)
      if (!diff.trim()) {
        showToast('추출된 diff가 없습니다. 새 커밋이 없거나 모두 보안 파일일 수 있습니다.', 'info')
        return
      }

      // 2. AI 요약 생성 → DB 저장 → baselineSha 업데이트
      const note = await api.ai.generate(selectedRepo!.id, diff, fromSha, toSha)

      // 3. Context에 새 노트 추가 및 baselineSha 동기화
      setReleaseNotes([note, ...releaseNotes])
      updateRepo(selectedRepo!.id, { baselineSha: toSha })
      showToast('업데이트 노트가 생성되었습니다', 'success')
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
    showToast('웹훅 URL이 복사되었습니다', 'success')
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
            새 커밋 확인
          </Button>
          <Button onClick={handleGenerate} loading={generating} variant="primary">
            업데이트 노트 생성
          </Button>
        </div>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>저장소 URL</span>
          <span className={styles.cardValue}>{selectedRepo.repoUrl}</span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>마지막 릴리즈 노트</span>
          <span className={styles.cardValue}>
            {lastNote
              ? new Date(lastNote.createdAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : '아직 없음'}
          </span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>릴리즈 노트 수</span>
          <span className={styles.cardValue}>{repoNotes.length}개</span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>AI 요약 언어</span>
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
        <h3 className={styles.sectionTitle}>웹훅 설정</h3>
        <p className={styles.sectionDesc}>
          아래 URL을 GitLab/GitHub 웹훅에 등록하면 배포 시 자동으로 감지합니다.
        </p>
        <div className={styles.webhookUrl}>
          <code className={styles.urlText}>{webhookUrl}</code>
          <Button size="sm" variant="secondary" onClick={copyWebhookUrl}>
            복사
          </Button>
        </div>
      </div>
    </div>
  )
}
