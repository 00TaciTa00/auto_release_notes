import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { useTranslation } from '../../i18n/useTranslation'
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

/**
 * 마크다운 → 일반 텍스트 변환 (L-3 개선)
 *
 * 코드 블록, 링크, 이미지, 테이블, HTML 태그, 인용구 등을 처리합니다.
 */
function markdownToText(md: string): string {
  return md
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')   // 코드 블록 — 내용만 남김
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')       // 이미지 → alt 텍스트
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')        // 링크 → 링크 텍스트
    .replace(/<[^>]+>/g, '')                         // HTML 태그 제거
    .replace(/^#{1,6}\s+/gm, '')                    // 헤더
    .replace(/\*\*(.*?)\*\*/g, '$1')                // 굵게
    .replace(/\*(.*?)\*/g, '$1')                    // 기울임
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')                    // 인라인 코드
    .replace(/^[-*_]{3,}\s*$/gm, '')               // 수평선
    .replace(/^\|[-| :]+\|$/gm, '')                // 테이블 구분선
    .replace(/\|/g, '  ')                           // 테이블 셀 → 공백
    .replace(/^>\s+/gm, '')                         // 인용구
    .replace(/^[-*+]\s+/gm, '• ')                  // 목록
    .replace(/^\d+\.\s+/gm, '')                    // 번호 목록
    .replace(/\n{3,}/g, '\n\n')                    // 연속 빈 줄 정리
    .trim()
}

/**
 * 마크다운 → Naver Works HTML 변환
 *
 * navigator.clipboard.write() + ClipboardItem('text/html')으로 복사합니다.
 */
function markdownToNaverWorks(md: string): string {
  return md
    .replace(/^#{1,2}\s+(.*)/gm, '<h2>$1</h2>')
    .replace(/^#{3,6}\s+(.*)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/^[-*+]\s+(.*)/gm, '<li>$1</li>')
    // 연속된 <li> 블록 전체를 <ul>로 감싸기
    .replace(/(<li>[^\n]*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n/g, '<br>')
}

export function ReleaseNoteDetail({ note, repo, onBack }: ReleaseNoteDetailProps) {
  const { setReleaseNotes, releaseNotes } = useApp()
  const { showToast } = useToast()
  const t = useTranslation()

  const availableTabs = []
  if (repo.summaryLanguage === 'ko' || repo.summaryLanguage === 'both') {
    availableTabs.push({ id: 'ko', label: t.releaseNotes.tabKo })
  }
  if (repo.summaryLanguage === 'en' || repo.summaryLanguage === 'both') {
    availableTabs.push({ id: 'en', label: t.releaseNotes.tabEn })
  }
  availableTabs.push({ id: 'diff', label: t.releaseNotes.tabDiff })

  const defaultTab = availableTabs[0]?.id as ContentTab ?? 'diff'
  const [activeTab, setActiveTab] = useState<ContentTab>(defaultTab)
  const [editedKo, setEditedKo] = useState(note.editedKo ?? note.aiDraftKo ?? '')
  const [editedEn, setEditedEn] = useState(note.editedEn ?? note.aiDraftEn ?? '')
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('markdown')
  const [saving, setSaving] = useState(false)

  const aiContent = activeTab === 'ko' ? (note.aiDraftKo ?? '') : (note.aiDraftEn ?? '')
  const editedContent = activeTab === 'ko' ? editedKo : editedEn
  const setEditedContent = activeTab === 'ko' ? setEditedKo : setEditedEn

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
      showToast(t.common.saved, 'success')
    } catch {
      showToast(t.common.saveError, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    const content = activeTab === 'ko' ? editedKo : editedEn

    if (copyFormat === 'naver-works') {
      // Naver Works는 text/html MIME 타입으로 복사해야 서식이 유지됨
      const html = markdownToNaverWorks(content)
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
        ])
      } catch {
        // ClipboardItem 미지원 환경(일부 Electron 버전)에서 플레인 텍스트로 폴백
        await navigator.clipboard.writeText(html)
      }
    } else {
      const text = copyFormat === 'markdown' ? content : markdownToText(content)
      await navigator.clipboard.writeText(text)
    }

    showToast(t.common.copied, 'success')
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          {t.common.back}
        </button>
        <div className={styles.noteMeta}>
          {note.versionTag && <span className={styles.version}>{note.versionTag}</span>}
          <span className={styles.date}>
            {new Date(note.createdAt).toLocaleDateString('ko-KR')}
          </span>
          {note.changeTypes.map((ct) => (
            <ChangeTypeChip key={ct} type={ct} />
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
          <pre className={styles.diffContent}>{note.rawDiff || t.releaseNotes.noDiff}</pre>
        </div>
      ) : (
        <div className={styles.editorLayout}>
          <div className={styles.editorPane}>
            <div className={styles.paneHeader}>{t.releaseNotes.aiDraftLabel}</div>
            <pre className={styles.aiDraft}>{aiContent || t.common.noContent}</pre>
          </div>
          <div className={styles.editorPane}>
            <div className={styles.paneHeader}>{t.releaseNotes.editLabel}</div>
            <textarea
              className={styles.editor}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder={t.releaseNotes.editorPlaceholder}
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
              <option value="markdown">{t.releaseNotes.formatMarkdown}</option>
              <option value="text">{t.releaseNotes.formatText}</option>
              <option value="naver-works">{t.releaseNotes.formatNaverWorks}</option>
            </select>
            <Button variant="secondary" onClick={handleCopy}>
              {t.common.copy}
            </Button>
          </div>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {t.common.save}
          </Button>
        </div>
      )}
    </div>
  )
}
