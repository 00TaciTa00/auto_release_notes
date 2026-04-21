import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { Button } from '../common/Button'
import { TabBar } from '../common/TabBar'
import { useToast } from '../common/Toast'
import { ChangeTypeChip } from './ChangeTypeChip'
import { api } from '../../lib/api'
import type { ReleaseNote, Repository } from '../../../../shared/types'
import styles from './ReleaseNoteDetail.module.css'

interface ReleaseNoteDetailProps {
  note: ReleaseNote
  repo: Repository
  onBack: () => void
}

type ContentTab = 'ko' | 'en' | 'diff'
type CopyFormat = 'markdown' | 'text' | 'naver-works'

function markdownToText(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^[-*+]\s+/gm, '• ')
    .trim()
}

function markdownToNaverWorks(md: string): string {
  return md
    .replace(/^#{1,2}\s+(.*)/gm, '<h2>$1</h2>')
    .replace(/^#{3,6}\s+(.*)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/^[-*+]\s+(.*)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br>')
}

export function ReleaseNoteDetail({ note, repo, onBack }: ReleaseNoteDetailProps) {
  const { setReleaseNotes, releaseNotes } = useApp()
  const { showToast } = useToast()

  const availableTabs = []
  if (repo.summaryLanguage === 'ko' || repo.summaryLanguage === 'both') {
    availableTabs.push({ id: 'ko', label: '한국어' })
  }
  if (repo.summaryLanguage === 'en' || repo.summaryLanguage === 'both') {
    availableTabs.push({ id: 'en', label: 'English' })
  }
  availableTabs.push({ id: 'diff', label: '원본 Diff' })

  const defaultTab = availableTabs[0]?.id as ContentTab ?? 'diff'
  const [activeTab, setActiveTab] = useState<ContentTab>(defaultTab)
  const [editedKo, setEditedKo] = useState(note.editedKo ?? note.aiDraftKo ?? '')
  const [editedEn, setEditedEn] = useState(note.editedEn ?? note.aiDraftEn ?? '')
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('markdown')
  const [saving, setSaving] = useState(false)

  const aiContent = activeTab === 'ko' ? (note.aiDraftKo ?? '') : (note.aiDraftEn ?? '')
  const editedContent = activeTab === 'ko' ? editedKo : editedEn
  const setEditedContent = activeTab === 'ko' ? setEditedKo : setEditedEn

  /** 편집 내용을 DB에 저장하고 Context를 업데이트합니다 */
  async function handleSave() {
    setSaving(true)
    try {
      await api.releaseNote.update(note.id, { editedKo, editedEn })
      const now = new Date().toISOString()
      setReleaseNotes(
        releaseNotes.map((n) =>
          n.id === note.id ? { ...n, editedKo, editedEn, updatedAt: now } : n
        )
      )
      showToast('저장되었습니다', 'success')
    } catch {
      showToast('저장 중 오류가 발생했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleCopy() {
    const content = activeTab === 'ko' ? editedKo : editedEn
    let text: string
    if (copyFormat === 'markdown') {
      text = content
    } else if (copyFormat === 'text') {
      text = markdownToText(content)
    } else {
      text = markdownToNaverWorks(content)
    }
    navigator.clipboard.writeText(text)
    showToast('클립보드에 복사되었습니다', 'success')
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          ← 목록으로
        </button>
        <div className={styles.noteMeta}>
          {note.versionTag && <span className={styles.version}>{note.versionTag}</span>}
          <span className={styles.date}>
            {new Date(note.createdAt).toLocaleDateString('ko-KR')}
          </span>
          {note.changeTypes.map((t) => (
            <ChangeTypeChip key={t} type={t} />
          ))}
        </div>
      </div>

      <TabBar
        tabs={availableTabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as ContentTab)}
      />

      {activeTab === 'diff' ? (
        <div className={styles.diffView}>
          <pre className={styles.diffContent}>{note.rawDiff || '(diff 없음)'}</pre>
        </div>
      ) : (
        <div className={styles.editorLayout}>
          <div className={styles.editorPane}>
            <div className={styles.paneHeader}>AI 초안 (읽기 전용)</div>
            <pre className={styles.aiDraft}>{aiContent || '(내용 없음)'}</pre>
          </div>
          <div className={styles.editorPane}>
            <div className={styles.paneHeader}>편집</div>
            <textarea
              className={styles.editor}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="내용을 입력하세요..."
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {activeTab !== 'diff' && (
        <div className={styles.actions}>
          <div className={styles.copyGroup}>
            <select
              className={styles.formatSelect}
              value={copyFormat}
              onChange={(e) => setCopyFormat(e.target.value as CopyFormat)}
            >
              <option value="markdown">마크다운</option>
              <option value="text">일반 텍스트</option>
              <option value="naver-works">Naver Works</option>
            </select>
            <Button variant="secondary" onClick={handleCopy}>
              복사
            </Button>
          </div>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            저장
          </Button>
        </div>
      )}
    </div>
  )
}
